/**
 * 最弱王ババ抜き ルール（純粋関数のみ・副作用なし）
 * 仕様は docs/babanuki-spec.md が唯一の正。
 */
import type {
  BabanukiConfig,
  BabanukiEvent,
  BabanukiPlayer,
  BabanukiState,
  Card,
  Suit,
} from './babanukiTypes';
import { isJoker } from './babanukiTypes';

export type Rng = () => number;

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club'];

/** 52枚＋ジョーカー1枚 = 53枚 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  deck.push({ id: 'joker', suit: 'joker', rank: 0 });
  return deck;
}

export function shuffleItems<T>(items: T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function rollDie(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}

// ---------------------------------------------------------------- 座席と残存者

export function getPlayer(state: BabanukiState, playerId: string): BabanukiPlayer {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`unknown player: ${playerId}`);
  return player;
}

export function activePlayers(state: BabanukiState): BabanukiPlayer[] {
  return state.seatOrder
    .map((id) => getPlayer(state, id))
    .filter((p) => p.finishedRank === null);
}

/**
 * 座席をたどって次の残存プレイヤーを返す。
 * step は座席の進む向き。+1 = 左隣（次の手番の方向）、-1 = 右隣（引く相手の方向）。
 */
function neighborFromSeat(state: BabanukiState, playerId: string, step: number): string | null {
  const size = state.seatOrder.length;
  const start = state.seatOrder.indexOf(playerId);
  if (start < 0) return null;
  for (let i = 1; i <= size; i += 1) {
    const index = (start + step * i + size * size) % size;
    const candidate = getPlayer(state, state.seatOrder[index]);
    if (candidate.id === playerId) continue; // 自分自身は隣にならない
    if (candidate.finishedRank === null) return candidate.id;
  }
  return null;
}

/** 引く相手（右隣）。勝ち抜け済みは飛ばす */
export function getRightNeighborId(state: BabanukiState, playerId: string): string | null {
  return neighborFromSeat(state, playerId, -1);
}

/** 次の手番（左隣）。勝ち抜け済みは飛ばす */
export function getLeftNeighborId(state: BabanukiState, playerId: string): string | null {
  return neighborFromSeat(state, playerId, 1);
}

// ---------------------------------------------------------------- 状態の複製

function cloneState(state: BabanukiState): BabanukiState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.slice() })),
    seatOrder: state.seatOrder.slice(),
    discardPile: state.discardPile.slice(),
    finishOrder: state.finishOrder.slice(),
    pendingShuffle: state.pendingShuffle ? { ...state.pendingShuffle } : null,
    events: [],
  };
}

function mutablePlayer(state: BabanukiState, playerId: string): BabanukiPlayer {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`unknown player: ${playerId}`);
  return player;
}

// ---------------------------------------------------------------- ペア処理

/**
 * 手札から同じ数字のペアを取り除く。3枚なら2枚だけ、4枚なら2ペアとも捨てる。
 * ジョーカーは何とも揃わない。
 */
function extractPairs(hand: Card[]): { rest: Card[]; pairs: [Card, Card][] } {
  const byRank = new Map<number, Card[]>();
  for (const card of hand) {
    if (isJoker(card)) continue;
    const list = byRank.get(card.rank) ?? [];
    list.push(card);
    byRank.set(card.rank, list);
  }

  const removed = new Set<string>();
  const pairs: [Card, Card][] = [];
  for (const cards of byRank.values()) {
    for (let i = 0; i + 1 < cards.length; i += 2) {
      pairs.push([cards[i], cards[i + 1]]);
      removed.add(cards[i].id);
      removed.add(cards[i + 1].id);
    }
  }

  return { rest: hand.filter((card) => !removed.has(card.id)), pairs };
}

/** ペアを捨てる。捨てた分のイベントを events へ積む（呼び出し側で draft を渡す） */
function discardPairsInPlace(draft: BabanukiState, playerId: string, events: BabanukiEvent[]): void {
  const player = mutablePlayer(draft, playerId);
  const { rest, pairs } = extractPairs(player.hand);
  if (pairs.length === 0) return;

  player.hand = rest;
  clearSpotlightIfGone(player);
  for (const pair of pairs) {
    draft.discardPile.push(pair[0], pair[1]);
    events.push({ kind: 'discard-pair', playerId, cardIds: [pair[0].id, pair[1].id] });
  }
}

/** 手札0枚なら勝ち抜けにする */
function checkFinishInPlace(draft: BabanukiState, playerId: string, events: BabanukiEvent[]): void {
  const player = mutablePlayer(draft, playerId);
  if (player.finishedRank !== null || player.hand.length > 0) return;

  draft.finishOrder.push(playerId);
  player.finishedRank = draft.finishOrder.length;
  player.spotlightCardId = null;
  events.push({ kind: 'finish', playerId, rank: player.finishedRank });
}

/** 残り1人になったら最弱王が確定する */
function checkGameEndInPlace(draft: BabanukiState, events: BabanukiEvent[]): boolean {
  const actives = activePlayers(draft);
  if (actives.length > 1) return false;

  const loser = actives[0] ?? null;
  draft.loserId = loser?.id ?? null;
  draft.phase = 'finished';
  draft.pendingShuffle = null;
  if (loser) events.push({ kind: 'game-end', loserId: loser.id });
  return true;
}

// ---------------------------------------------------------------- シャッフルタイムの権利

/**
 * シャッフルタイムを宣言できるのは**ジョーカーを持っている人だけ**。
 * 制限時間はなく、次のカードが引かれるまでの間はいつでも宣言できる。
 */
export function canDeclareShuffle(state: BabanukiState, playerId: string): boolean {
  if (state.phase !== 'awaiting-draw') return false;
  if (activePlayers(state).length <= 2) return false; // 残り2名になったら権利は消滅する
  if (state.shuffleUsedThisTurn) return false; // 1ターン1回まで
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.finishedRank !== null) return false;
  return player.shuffleRight && holdsJoker(player);
}

/** 誰か1人でもシャッフルタイムを宣言できる状態か */
export function canAnyoneDeclareShuffle(state: BabanukiState): boolean {
  return activePlayers(state).some((p) => canDeclareShuffle(state, p.id));
}

function advanceTurnInPlace(draft: BabanukiState, events: BabanukiEvent[]): void {
  const next = getLeftNeighborId(draft, draft.currentPlayerId);
  if (!next) {
    checkGameEndInPlace(draft, events);
    return;
  }
  draft.currentPlayerId = next;
  draft.shuffleUsedThisTurn = false;
  draft.phase = 'awaiting-draw';
}

// ---------------------------------------------------------------- 初期化

export function createInitialBabanukiState(
  config: BabanukiConfig,
  rng: Rng = Math.random,
): BabanukiState {
  const count = config.playerCount;
  const players: BabanukiPlayer[] = config.players.slice(0, count).map((p, index) => ({
    id: `player-${index + 1}`,
    name: p.name,
    isCpu: p.isCpu,
    cpuLevel: p.cpuLevel,
    hand: [],
    spotlightCardId: null,
    finishedRank: null,
    shuffleRight: true,
  }));
  const seatOrder = players.map((p) => p.id);

  // サイコロで親を決め、親の左隣から1枚ずつ配る
  const dealerIndex = (rollDie(rng) - 1) % count;
  const deck = shuffleItems(createDeck(), rng);
  deck.forEach((card, i) => {
    const seat = (dealerIndex + 1 + i) % count;
    players[seat].hand.push(card);
  });

  const state: BabanukiState = {
    players,
    seatOrder,
    currentPlayerId: players[(dealerIndex + 1) % count].id,
    phase: 'awaiting-draw',
    shuffleUsedThisTurn: false,
    pendingShuffle: null,
    discardPile: [],
    finishOrder: [],
    loserId: null,
    events: [],
    eventSeq: 0,
  };

  // 配り終えたら、全員が同じ数字のペアを場に捨てる
  const events: BabanukiEvent[] = [];
  for (const id of seatOrder) {
    const before = mutablePlayer(state, id).hand.map((c) => c.id);
    discardPairsInPlace(state, id, []);
    const after = new Set(mutablePlayer(state, id).hand.map((c) => c.id));
    const discarded = before.filter((cardId) => !after.has(cardId));
    if (discarded.length > 0) events.push({ kind: 'initial-discard', playerId: id, cardIds: discarded });
    checkFinishInPlace(state, id, events);
  }

  // 勝ち抜けが出た結果、手番者が抜けていることがある
  if (mutablePlayer(state, state.currentPlayerId).finishedRank !== null) {
    const next = getLeftNeighborId(state, state.currentPlayerId);
    if (next) state.currentPlayerId = next;
  }

  checkGameEndInPlace(state, events);

  state.events = events;
  state.eventSeq = 1;
  return state;
}

/** 現在の人数・名前・人/CPU・CPU強さを保ったまま、新しい対局を始める。 */
export function createBabanukiRematchState(
  state: BabanukiState,
  rng: Rng = Math.random,
): BabanukiState {
  const fresh = createInitialBabanukiState(
    {
      playerCount: state.players.length,
      players: state.players.map((player) => ({
        name: player.name,
        isCpu: player.isCpu,
        cpuLevel: player.cpuLevel,
      })),
    },
    rng,
  );

  // オンラインの購読側が「新しい局面」と確実に判定できるよう、連番は単調増加させる。
  // 初期ペア捨ては初回表示と同様に完成後の盤面を即表示し、前局の盤面からは再生しない。
  fresh.events = [];
  fresh.eventSeq = state.eventSeq + 1;
  return fresh;
}

// ---------------------------------------------------------------- 手札の操作

/** 手札の並べ替え（自分の手札のみ） */
export function reorderHand(
  state: BabanukiState,
  playerId: string,
  fromIndex: number,
  toIndex: number,
): BabanukiState {
  const draft = cloneState(state);
  const player = mutablePlayer(draft, playerId);
  if (
    fromIndex < 0 || fromIndex >= player.hand.length ||
    toIndex < 0 || toIndex >= player.hand.length ||
    fromIndex === toIndex
  ) {
    return state;
  }

  // 飛び出しはカードIDで持っているので、並べ替えても付いてくる
  const [moved] = player.hand.splice(fromIndex, 1);
  player.hand.splice(toIndex, 0, moved);

  draft.events = state.events;
  draft.eventSeq = state.eventSeq;
  return draft;
}

/**
 * 飛び出させる札を決める。同じ札をもう一度指定すると解除。
 * 一度飛び出させたら、その札が手札から無くなるか本人が解除するまで続く。
 */
export function setSpotlight(
  state: BabanukiState,
  playerId: string,
  cardId: string | null,
): BabanukiState {
  const draft = cloneState(state);
  const player = mutablePlayer(draft, playerId);
  if (cardId !== null && !player.hand.some((c) => c.id === cardId)) return state;
  player.spotlightCardId = player.spotlightCardId === cardId ? null : cardId;
  draft.events = state.events;
  draft.eventSeq = state.eventSeq;
  return draft;
}

/** 飛び出させていた札が手札から無くなったときだけ解除する */
function clearSpotlightIfGone(player: BabanukiPlayer): void {
  if (player.spotlightCardId === null) return;
  if (!player.hand.some((c) => c.id === player.spotlightCardId)) player.spotlightCardId = null;
}

// ---------------------------------------------------------------- カードを引く

/** 手番者が右隣の手札の fromIndex 番目を引く */
export function drawCard(state: BabanukiState, fromIndex: number): BabanukiState {
  if (state.phase !== 'awaiting-draw') return state;

  const targetId = getRightNeighborId(state, state.currentPlayerId);
  if (!targetId) return state;

  const draft = cloneState(state);
  const events: BabanukiEvent[] = [];
  const drawer = mutablePlayer(draft, draft.currentPlayerId);
  const target = mutablePlayer(draft, targetId);
  if (fromIndex < 0 || fromIndex >= target.hand.length) return state;

  const [card] = target.hand.splice(fromIndex, 1);
  clearSpotlightIfGone(target);
  events.push({ kind: 'draw', fromId: targetId, toId: drawer.id, fromIndex, cardId: card.id });

  // 引かれて0枚になった人も即・勝ち抜け（引いた側より先に順位が確定する）
  checkFinishInPlace(draft, targetId, events);

  drawer.hand.push(card);
  discardPairsInPlace(draft, drawer.id, events);
  checkFinishInPlace(draft, drawer.id, events);

  if (!checkGameEndInPlace(draft, events)) {
    advanceTurnInPlace(draft, events);
  }

  draft.events = events;
  draft.eventSeq = state.eventSeq + 1;
  return draft;
}

// ---------------------------------------------------------------- シャッフルタイム

/** 宣言する。サイコロの目まで決めて 'rolling' に入る */
export function declareShuffle(
  state: BabanukiState,
  playerId: string,
  rng: Rng = Math.random,
): BabanukiState {
  if (!canDeclareShuffle(state, playerId)) return state;

  const draft = cloneState(state);
  const declarer = mutablePlayer(draft, playerId);
  declarer.shuffleRight = false;
  draft.shuffleUsedThisTurn = true;
  draft.pendingShuffle = {
    declarerId: playerId,
    dice: rollDie(rng),
  };
  draft.phase = 'rolling';
  draft.events = [];
  draft.eventSeq = state.eventSeq + 1;
  return draft;
}

/**
 * 出目から「誰の手札が誰に渡るか」の写像を作る。
 * 戻り値は fromPlayerId -> toPlayerId。
 */
export function buildShuffleMapping(
  state: BabanukiState,
  dice: number,
  rng: Rng = Math.random,
): Record<string, string> {
  const actives = activePlayers(state).map((p) => p.id);
  const size = actives.length;
  const mapping: Record<string, string> = {};

  if (dice === 3) {
    // 全員をランダムに再配置（自分の手札が戻ることもある）
    const targets = shuffleItems(actives, rng);
    actives.forEach((from, i) => {
      mapping[from] = targets[i];
    });
    return mapping;
  }

  // 座席の進む向き: +1 が左隣。出目1=左隣へ / 2=右隣へ / 5=2つ左隣へ / 6=2つ右隣へ / 4=移動なし
  const stepByDice: Record<number, number> = { 1: 1, 2: -1, 4: 0, 5: 2, 6: -2 };
  const step = stepByDice[dice] ?? 0;
  actives.forEach((from, i) => {
    mapping[from] = actives[(i + step + size * 2) % size];
  });
  return mapping;
}

/** サイコロ演出のあとに手札を実際に動かす */
export function resolveShuffle(state: BabanukiState, rng: Rng = Math.random): BabanukiState {
  if (state.phase !== 'rolling' || !state.pendingShuffle) return state;

  const draft = cloneState(state);
  const events: BabanukiEvent[] = [];
  const { declarerId, dice } = state.pendingShuffle;
  const mapping = buildShuffleMapping(state, dice, rng);

  const handsById = new Map<string, Card[]>();
  for (const [fromId, toId] of Object.entries(mapping)) {
    handsById.set(toId, getPlayer(state, fromId).hand.slice());
  }
  for (const [id, hand] of handsById.entries()) {
    const player = mutablePlayer(draft, id);
    player.hand = hand;
    // 実際に手札が動く出目では、前の持ち主が付けたブラフを自然に解除する。
    // 出目4（ドクロ）は何も動かないため、そのまま残す。
    if (dice !== 4) player.spotlightCardId = null;
  }

  events.push({ kind: 'shuffle', declarerId, dice, mapping });
  draft.pendingShuffle = null;

  // 移動でペアが揃っても、その場では捨てられない（通常の手番でのみ捨てる）。
  // 手番はそのまま。宣言した本人の権利はもう無いので、このターンの再宣言も起きない。
  draft.phase = 'awaiting-draw';

  draft.events = events;
  draft.eventSeq = state.eventSeq + 1;
  return draft;
}

// ---------------------------------------------------------------- 表示用ヘルパー

/** 順位表（1位…最弱王）。決着後に使う */
export function getRankings(state: BabanukiState): { playerId: string; rank: number }[] {
  const ranked = state.finishOrder.map((playerId, index) => ({ playerId, rank: index + 1 }));
  if (state.loserId) ranked.push({ playerId: state.loserId, rank: ranked.length + 1 });
  return ranked;
}

export function holdsJoker(player: BabanukiPlayer): boolean {
  return player.hand.some(isJoker);
}
