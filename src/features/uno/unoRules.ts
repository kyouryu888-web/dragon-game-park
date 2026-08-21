import type { UnoCard, UnoColor, UnoGameState, UnoPlayerId, UnoStarterDraw } from './unoTypes';
import { getUnoCurrentScores, getUnoHandScore } from './unoScoring';
import { isUnoCardAllowedInVariant } from './unoCardUtils';

// ═══════════════════════════════════════════════
// 内部ヘルパー（非公開）
// ═══════════════════════════════════════════════

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** 山札が空なら捨て札をシャッフルして補充する */
function reshuffleIfNeeded(state: UnoGameState): UnoGameState {
  if (state.deck.length > 0) return state;
  if (state.discardPile.length <= 1) return state; // 捨て札も 1 枚以下なら補充不可

  const [top, ...rest] = state.discardPile;
  return {
    ...state,
    deck: shuffleArray(rest),
    discardPile: [top!],
  };
}

/** プレイヤーに n 枚引かせる（山札補充も行う）*/
function drawCardsForPlayer(
  state: UnoGameState,
  playerId: UnoPlayerId,
  count: number,
): UnoGameState {
  if (state.players.find((player) => player.id === playerId)?.isEliminated) return state;

  let s = state;
  for (let i = 0; i < count; i++) {
    s = reshuffleIfNeeded(s);
    if (s.deck.length === 0) break;
    const [drawn, ...rest] = s.deck;
    s = {
      ...s,
      deck: rest,
      hands: { ...s.hands, [playerId]: [...(s.hands[playerId] ?? []), drawn!] },
    };
  }
  return s;
}

/** 指定プレイヤーにカードを引かせる。テストとCPU補助処理用。 */
export function drawCards(
  state: UnoGameState,
  playerId: UnoPlayerId,
  count: number,
): UnoGameState {
  return drawCardsForPlayer(state, playerId, count);
}

function finishGame(state: UnoGameState, winnerPlayerId: UnoPlayerId): UnoGameState {
  return {
    ...state,
    status: 'finished',
    winnerPlayerId,
    pendingAction: null,
    finalScores: getUnoCurrentScores(state),
  };
}

function fallbackStandardCard(): UnoCard {
  return { id: `fallback-${crypto.randomUUID()}`, kind: 'number', color: 'red', value: 0 };
}

export function sanitizeUnoStateForVariant(state: UnoGameState): UnoGameState {
  if (state.variant === 'hard') return state;

  const hands = Object.fromEntries(
    Object.entries(state.hands).map(([playerId, hand]) => [
      playerId,
      hand.filter((card) => isUnoCardAllowedInVariant(card, state.variant)),
    ]),
  );
  let deck = state.deck.filter((card) => isUnoCardAllowedInVariant(card, state.variant));
  let discardPile = state.discardPile.filter((card) => isUnoCardAllowedInVariant(card, state.variant));
  const starterDraws = state.starterDraws.filter((draw) => isUnoCardAllowedInVariant(draw.card, state.variant));

  if (discardPile.length === 0) {
    const [replacementTop, ...remainingDeck] = deck;
    discardPile = [replacementTop ?? fallbackStandardCard()];
    deck = remainingDeck;
  }

  let pendingAction = state.pendingAction;
  if (pendingAction?.kind === 'swap-pick' || pendingAction?.kind === 'color-roulette') {
    pendingAction = null;
  } else if (pendingAction?.kind === 'drawn-card-play') {
    const drawnCardPending = pendingAction;
    if (!hands[drawnCardPending.playerId]?.some((card) => card.id === drawnCardPending.cardId)) {
      pendingAction = null;
    }
  } else if (pendingAction?.kind === 'color-pick' && discardPile[0]?.kind !== 'wild') {
    pendingAction = null;
  }

  return {
    ...state,
    hands,
    deck,
    discardPile,
    starterDraws,
    pendingAction,
    pendingDrawCount: 0,
    lastDrawCardValue: 0,
  };
}

/**
 * hard モード: 手札 25 枚以上のプレイヤーを脱落させる。
 * 脱落したら手札をデッキ底に戻す。最後の 1 人なら finished にする。
 */
function checkElimination(state: UnoGameState): UnoGameState {
  if (state.variant !== 'hard') return state;

  let s = state;
  for (const player of s.players) {
    if (player.isEliminated) continue;
    const handSize = (s.hands[player.id] ?? []).length;
    if (handSize < 25) continue;

    // 脱落
    const hand = s.hands[player.id] ?? [];
    s = {
      ...s,
      deck: [...s.deck, ...hand],
      hands: { ...s.hands, [player.id]: [] },
      eliminatedScores: { ...s.eliminatedScores, [player.id]: getUnoHandScore(hand) },
      players: s.players.map((p) => (p.id === player.id ? { ...p, isEliminated: true } : p)),
    };

    const remaining = s.players.filter((p) => !p.isEliminated);
    if (remaining.length === 1) {
      return finishGame(s, remaining[0]!.id);
    }

  }

  return s;
}

/** ターンを進める。playersToSkip=1 で通常進行、2 でスキップ */
function advanceTurn(state: UnoGameState, playersToSkip = 1): UnoGameState {
  const nextId = getNextPlayerId(state, playersToSkip);
  return { ...state, currentPlayerId: nextId, turnCount: state.turnCount + 1 };
}

/** 脱落したプレイヤーの席を基準に、進行方向の次の生存者へ進める。 */
function advanceAfterPlayer(state: UnoGameState, playerId: UnoPlayerId): UnoGameState {
  const nextId = getNextActivePlayerAfter(state, playerId);
  return { ...state, currentPlayerId: nextId, turnCount: state.turnCount + 1 };
}

function getStarterDrawValue(card: UnoCard): number {
  return card.kind === 'number' ? card.value : 0;
}

// ─── hard: 0 のルール（全員が隣に手札を渡す）───────────────────
function applyZeroRule(state: UnoGameState): UnoGameState {
  const active = getActivePlayers(state);
  if (active.length < 2) return state;

  const newHands: Record<UnoPlayerId, UnoCard[]> = {};
  for (let i = 0; i < active.length; i++) {
    const giver = active[i]!;
    const receiverIdx =
      state.direction === 'clockwise'
        ? (i + 1) % active.length
        : (i - 1 + active.length) % active.length;
    const receiver = active[receiverIdx]!;
    newHands[receiver] = state.hands[giver] ?? [];
  }

  return { ...state, hands: { ...state.hands, ...newHands } };
}

// ═══════════════════════════════════════════════
// 公開ヘルパー
// ═══════════════════════════════════════════════

/** カードのドロー枚数を返す（スタック判定に使用。ドローカードでなければ 0）*/
export function getCardDrawValue(card: UnoCard): number {
  if (card.kind === 'action') {
    if (card.symbol === 'draw2') return 2;
    if (card.symbol === 'draw4') return 4;
  }
  if (card.kind === 'wild') {
    if (card.symbol === 'wild-draw4') return 4;
    if (card.symbol === 'wild-draw6') return 6;
    if (card.symbol === 'wild-draw10') return 10;
  }
  return 0;
}

/** 脱落していないプレイヤーの ID リスト（ターン順）*/
export function getActivePlayers(state: UnoGameState): UnoPlayerId[] {
  return state.players.filter((p) => !p.isEliminated).map((p) => p.id);
}

/**
 * 次のプレイヤー ID を返す。
 * playersToSkip=1 で通常の次、2 でスキップ（skip カード後）、
 * active.length でスキップオール後の自分自身。
 */
export function getNextPlayerId(state: UnoGameState, playersToSkip = 1): UnoPlayerId {
  const active = getActivePlayers(state);
  if (active.length === 0) return state.currentPlayerId;

  const idx = active.indexOf(state.currentPlayerId);
  const step = state.direction === 'clockwise' ? 1 : -1;
  const nextIdx = ((idx + step * playersToSkip) % active.length + active.length) % active.length;
  return active[nextIdx]!;
}

function getNextActivePlayerAfter(state: UnoGameState, playerId: UnoPlayerId): UnoPlayerId {
  const players = state.players;
  const startIndex = players.findIndex((player) => player.id === playerId);
  if (startIndex === -1) return getNextPlayerId(state);

  const step = state.direction === 'clockwise' ? 1 : -1;
  for (let offset = 1; offset <= players.length; offset++) {
    const index = ((startIndex + step * offset) % players.length + players.length) % players.length;
    const candidate = players[index];
    if (candidate && !candidate.isEliminated) return candidate.id;
  }

  return state.currentPlayerId;
}

// ═══════════════════════════════════════════════
// 出せるカード判定
// ═══════════════════════════════════════════════

/** このカードが今出せるかどうかを判定する */
export function canPlayCard(state: UnoGameState, card: UnoCard): boolean {
  if (state.status !== 'playing') return false;
  if (!isUnoCardAllowedInVariant(card, state.variant)) return false;
  if (state.pendingAction?.kind === 'drawn-card-play') {
    if (state.pendingAction.cardId !== card.id) return false;
    return canPlayCard({ ...state, pendingAction: null }, card);
  }
  if (state.pendingAction !== null) return false;

  // hard: ドロースタッキング中はドローカードのみ出せる
  if (state.pendingDrawCount > 0 && state.variant === 'hard') {
    if (card.kind === 'wild') {
      // wild-color-roulette / wild-reverse-draw4 / wild-skip-all はスタック不可
      if (
        card.symbol === 'wild-color-roulette' ||
        card.symbol === 'wild-reverse-draw4' ||
        card.symbol === 'wild-skip-all' ||
        card.symbol === 'wild'
      )
        return false;
    }
    const drawValue = getCardDrawValue(card);
    return drawValue > 0 && drawValue >= state.lastDrawCardValue;
  }

  // standard: ドローカード出された場合はカードを出せない（受け取るのみ）
  if (state.pendingDrawCount > 0 && state.variant === 'standard') return false;

  // ワイルドは常に出せる
  if (card.kind === 'wild') return true;

  // 色が一致すれば出せる
  if (card.color === state.activeColor) return true;

  // 数字カード: 数字が一致すれば出せる
  const top = state.discardPile[0];
  if (card.kind === 'number' && top?.kind === 'number') {
    return card.value === top.value;
  }

  // アクションカード: 記号が一致すれば出せる
  if (card.kind === 'action' && top?.kind === 'action') {
    return card.symbol === top.symbol;
  }

  return false;
}

/** 手札から出せるカードの一覧を返す */
export function getPlayableCards(state: UnoGameState, playerId: UnoPlayerId): UnoCard[] {
  const pending = state.pendingAction;
  if (pending?.kind === 'drawn-card-play') {
    if (pending.playerId !== playerId) return [];
    return (state.hands[playerId] ?? []).filter((c) => c.id === pending.cardId && canPlayCard(state, c));
  }
  return (state.hands[playerId] ?? []).filter((c) => canPlayCard(state, c));
}

// ═══════════════════════════════════════════════
// スタートプレイヤー決定
// ═══════════════════════════════════════════════

export function applyStarterDraw(state: UnoGameState): UnoGameState {
  if (state.status !== 'deciding-starter') return state;

  let s = state;
  let contenders = getActivePlayers(s);
  const allDraws: UnoStarterDraw[] = [];
  const drawnCards: UnoCard[] = [];
  let winnerId = contenders[0] ?? s.currentPlayerId;

  for (let round = 1; contenders.length > 1 && round <= 12; round++) {
    const roundDraws: UnoStarterDraw[] = [];

    for (const playerId of contenders) {
      s = reshuffleIfNeeded(s);
      if (s.deck.length === 0) continue;
      const [card, ...rest] = s.deck;
      const draw = {
        playerId,
        card: card!,
        value: getStarterDrawValue(card!),
        round,
      };
      roundDraws.push(draw);
      allDraws.push(draw);
      drawnCards.push(card!);
      s = { ...s, deck: rest };
    }

    if (roundDraws.length === 0) break;
    const highValue = Math.max(...roundDraws.map((draw) => draw.value));
    const winners = roundDraws.filter((draw) => draw.value === highValue);
    winnerId = winners[0]?.playerId ?? winnerId;
    contenders = winners.map((draw) => draw.playerId);
  }

  return {
    ...s,
    status: 'starter-ready',
    currentPlayerId: winnerId,
    starterDraws: allDraws,
    deck: [...s.deck, ...drawnCards],
  };
}

export function applyStartGame(state: UnoGameState): UnoGameState {
  if (state.status !== 'starter-ready') return state;
  return {
    ...state,
    status: 'playing',
    turnCount: state.turnCount + 1,
  };
}

// ═══════════════════════════════════════════════
// カードを出す
// ═══════════════════════════════════════════════

export function applyPlayCard(state: UnoGameState, cardId: string): UnoGameState {
  if (state.status !== 'playing') return state;
  const drawnCardPending = state.pendingAction?.kind === 'drawn-card-play' ? state.pendingAction : null;
  if (state.pendingAction !== null && !drawnCardPending) return state;
  if (drawnCardPending && (drawnCardPending.playerId !== state.currentPlayerId || drawnCardPending.cardId !== cardId)) {
    return state;
  }

  const hand = state.hands[state.currentPlayerId] ?? [];
  const cardIdx = hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return state;

  const card = hand[cardIdx]!;
  if (!canPlayCard(state, card)) return state;

  // 手札からカードを取り除く
  const newHand = hand.filter((_, i) => i !== cardIdx);

  // 捨て札の先頭に追加
  let s: UnoGameState = {
    ...state,
    hands: { ...state.hands, [state.currentPlayerId]: newHand },
    discardPile: [card, ...state.discardPile],
    pendingDrawCount: state.variant === 'hard' ? state.pendingDrawCount : 0,
    lastDrawCardValue: state.variant === 'hard' ? state.lastDrawCardValue : 0,
    pendingAction: null,
  };

  // ── 勝利チェック ──
  // 通常版のドロー系を最後に出した場合も、相手のペナルティーを解決してから得点を確定する。
  if (newHand.length === 0 && !(card.kind === 'action' && card.symbol === 'discard-all')) {
    const finalState = card.kind === 'wild' ? s : { ...s, activeColor: card.color };
    if (state.variant === 'standard' && card.kind === 'action' && card.symbol === 'draw2') {
      const targetPlayerId = getNextPlayerId(finalState);
      return finishGame(drawCardsForPlayer(finalState, targetPlayerId, 2), state.currentPlayerId);
    }
    if (state.variant === 'standard' && card.kind === 'wild' && card.symbol === 'wild-draw4') {
      const targetPlayerId = getNextPlayerId(finalState);
      return finishGame(drawCardsForPlayer(finalState, targetPlayerId, 4), state.currentPlayerId);
    }
    return finishGame(finalState, state.currentPlayerId);
  }

  // ── カードの効果を適用 ──
  if (card.kind === 'wild') {
    return applyWildEffect(s, card);
  }
  if (card.kind === 'action') {
    return applyActionEffect(s, card, newHand);
  }

  // 数字カード
  s = { ...s, activeColor: card.color };

  // hard: 7 → スワップ選択、0 → 全員ローテーション
  if (s.variant === 'hard') {
    if (card.value === 7) {
      return {
        ...s,
        pendingAction: { kind: 'swap-pick', swapperPlayerId: state.currentPlayerId },
      };
    }
    if (card.value === 0) {
      s = applyZeroRule(s);
    }
  }

  // UNO ウィンドウチェックを行ってからターン進行
  return checkUnoWindowAndAdvance(s, state.currentPlayerId, newHand.length);
}

// ─── ワイルドカードの効果 ────────────────────────
function applyWildEffect(state: UnoGameState, card: UnoCard & { kind: 'wild' }): UnoGameState {
  const drawMap: Record<string, number> = {
    'wild-draw4': 4,
    'wild-draw6': 6,
    'wild-draw10': 10,
    'wild-reverse-draw4': 4,
  };
  const pendingDrawAfterColor = drawMap[card.symbol] ?? 0;
  const reverseAfterColor = card.symbol === 'wild-reverse-draw4';

  return {
    ...state,
    pendingAction: {
      kind: 'color-pick',
      chooserPlayerId: state.currentPlayerId,
      pendingDrawAfterColor,
      reverseAfterColor,
    },
  };
}

// ─── アクションカードの効果 ──────────────────────
function applyActionEffect(
  state: UnoGameState,
  card: UnoCard & { kind: 'action' },
  newHand: UnoCard[],
): UnoGameState {
  const playerId = state.currentPlayerId;
  let s: UnoGameState = { ...state, activeColor: card.color };

  switch (card.symbol) {
    case 'skip': {
      // 次のプレイヤーをスキップ → 2 つ先へ
      return checkUnoWindowAndAdvance(s, playerId, newHand.length, 2);
    }

    case 'reverse': {
      const active = getActivePlayers(s);
      const newDir: 'clockwise' | 'counterclockwise' =
        s.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
      s = { ...s, direction: newDir };

      if (active.length === 2) {
        // 2 人: リバース = スキップ（同じプレイヤーが再度手番）
        return checkUnoWindowAndAdvance(s, playerId, newHand.length, 0);
      }
      return checkUnoWindowAndAdvance(s, playerId, newHand.length);
    }

    case 'draw2': {
      if (s.variant === 'standard') {
        // 即座適用: 次のプレイヤーが 2 枚引いてスキップ
        const nextId = getNextPlayerId(s);
        s = drawCardsForPlayer(s, nextId, 2);
        s = checkElimination(s);
        if (s.status === 'finished') return s;
        return checkUnoWindowAndAdvance(s, playerId, newHand.length, 2);
      }
      // hard: スタッキング
      return checkUnoWindowAndAdvance(
        { ...s, pendingDrawCount: s.pendingDrawCount + 2, lastDrawCardValue: 2 },
        playerId,
        newHand.length,
      );
    }

    case 'draw4': {
      // hard モードのみ（色付きドロー4）
      return checkUnoWindowAndAdvance(
        { ...s, pendingDrawCount: s.pendingDrawCount + 4, lastDrawCardValue: 4 },
        playerId,
        newHand.length,
      );
    }

    case 'discard-all': {
      // 出したカードと同じ色の手札をすべて捨て札に
      const currentHand = s.hands[playerId] ?? [];
      const discarded = currentHand.filter(
        (c) => c.kind !== 'wild' && c.color === card.color,
      );
      const remaining = currentHand.filter(
        (c) => c.kind === 'wild' || c.color !== card.color,
      );
      // 捨てたカードをパイルに重ねる（最後のカードが top になる）
      s = {
        ...s,
        hands: { ...s.hands, [playerId]: remaining },
        discardPile: [...discarded.slice().reverse(), ...s.discardPile],
      };
      // 手札が 0 になったら勝利
      if (remaining.length === 0) {
        return finishGame(s, playerId);
      }
      return checkUnoWindowAndAdvance(s, playerId, remaining.length);
    }

    default:
      return checkUnoWindowAndAdvance(s, playerId, newHand.length);
  }
}

// ─── UNO ウィンドウチェック後にターンを進める ────────────────
function checkUnoWindowAndAdvance(
  state: UnoGameState,
  playerId: UnoPlayerId,
  handSizeAfterPlay: number,
  playersToSkip = 1,
): UnoGameState {
  const s =
    handSizeAfterPlay === 1 && state.status === 'playing' && !state.unoDeclaredIds.includes(playerId)
      ? { ...state, unoDeclaredIds: [...state.unoDeclaredIds, playerId] }
      : state;
  return advanceTurn(s, playersToSkip);
}

// ═══════════════════════════════════════════════
// 色選択（ワイルド後）
// ═══════════════════════════════════════════════

export function applyColorChoice(state: UnoGameState, color: UnoColor): UnoGameState {
  if (state.pendingAction?.kind !== 'color-pick') return state;

  const { pendingDrawAfterColor, reverseAfterColor, chooserPlayerId } = state.pendingAction;
  const topCard = state.discardPile[0];

  let s: UnoGameState = { ...state, activeColor: color, pendingAction: null };

  // wild-skip-all: 自分がまた手番になる
  if (topCard?.kind === 'wild' && topCard.symbol === 'wild-skip-all') {
    const active = getActivePlayers(s);
    const nextId = getNextPlayerId({ ...s, currentPlayerId: chooserPlayerId }, active.length);
    return {
      ...s,
      pendingAction: null, activeColor: color,
      currentPlayerId: nextId,
      turnCount: s.turnCount + 1,
    };
  }

  // wild-color-roulette: 次のプレイヤーが目標色を引くまで引く
  if (topCard?.kind === 'wild' && topCard.symbol === 'wild-color-roulette') {
    const targetId = getNextActivePlayerAfter(s, chooserPlayerId);
    return {
      ...s,
      activeColor: color,
      pendingAction: { kind: 'color-roulette', targetPlayerId: targetId, targetColor: color },
    };
  }

  // wild-reverse-draw4: 方向反転後に新しい次のプレイヤーへドロー適用
  if (reverseAfterColor) {
    const newDir: 'clockwise' | 'counterclockwise' =
      s.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
    s = { ...s, direction: newDir };

    if (pendingDrawAfterColor > 0) {
      if (s.variant === 'hard') {
        s = { ...s, pendingDrawCount: s.pendingDrawCount + pendingDrawAfterColor, lastDrawCardValue: pendingDrawAfterColor };
        return advanceTurn(s);
      }
      // standard: 次のプレイヤーに即適用してスキップ
      const nextId = getNextPlayerId(s);
      s = drawCardsForPlayer(s, nextId, pendingDrawAfterColor);
      s = checkElimination(s);
      if (s.status === 'finished') return s;
      return advanceTurn(s, 2);
    }
    return advanceTurn(s);
  }

  // 通常のドローワイルド（wild-draw4, wild-draw6, wild-draw10）
  if (pendingDrawAfterColor > 0) {
    if (s.variant === 'hard') {
      s = { ...s, pendingDrawCount: s.pendingDrawCount + pendingDrawAfterColor, lastDrawCardValue: pendingDrawAfterColor };
      return advanceTurn(s);
    }
    // standard: 次のプレイヤーに即適用してスキップ
    const nextId = getNextPlayerId(s);
    s = drawCardsForPlayer(s, nextId, pendingDrawAfterColor);
    s = checkElimination(s);
    if (s.status === 'finished') return s;
    return advanceTurn(s, 2);
  }

  // 普通の wild（色だけ変える）
  return advanceTurn(s);
}

// ═══════════════════════════════════════════════
// カードを引く
// ═══════════════════════════════════════════════

/**
 * 通常の「カードを引く」アクション。
 * - 手札に出せるカードがあっても1枚引ける
 * - 引いたカードが出せる場合は、その引いたカードだけを出せる
 * - 引いたカードが出せない場合はターン終了
 */
export function applyDrawCard(state: UnoGameState): UnoGameState {
  if (state.status !== 'playing') return state;
  if (state.pendingAction !== null) return state;
  if (state.pendingDrawCount > 0) return state; // applyAcceptDraw を使うべき

  const drawingPlayerId = state.currentPlayerId;
  let s = reshuffleIfNeeded(state);
  if (s.deck.length === 0) return advanceTurn(s);

  const [drawn, ...rest] = s.deck;
  const currentHand = s.hands[s.currentPlayerId] ?? [];
  s = {
    ...s,
    deck: rest,
    hands: { ...s.hands, [s.currentPlayerId]: [...currentHand, drawn!] },
  };

  s = checkElimination(s);
  if (s.status === 'finished') return s;
  if (s.players.find((player) => player.id === drawingPlayerId)?.isEliminated) {
    return advanceAfterPlayer({ ...s, pendingAction: null }, drawingPlayerId);
  }

  if (canPlayCard(s, drawn!)) {
    return { ...s, pendingAction: { kind: 'drawn-card-play', playerId: drawingPlayerId, cardId: drawn!.id } };
  }

  return advanceTurn(s);
}

export function applyPassDrawnCard(state: UnoGameState): UnoGameState {
  if (state.status !== 'playing') return state;
  if (state.pendingAction?.kind !== 'drawn-card-play') return state;
  return advanceTurn({ ...state, pendingAction: null });
}

/**
 * 旧ハード版の無限ドロー補助。現在の通常ドローでは使わず、
 * カラールーレットのような専用効果だけが複数ドローを扱う。
 */
export function applyInfiniteDraw(state: UnoGameState): UnoGameState {
  const drawingPlayerId = state.currentPlayerId;
  let s = state;
  const MAX = 200;

  for (let i = 0; i < MAX; i++) {
    s = reshuffleIfNeeded(s);
    if (s.deck.length === 0) break; // 山札も捨て札も尽きた

    // 1 枚引く
    const [drawn, ...rest] = s.deck;
    const currentHand = s.hands[s.currentPlayerId] ?? [];
    s = {
      ...s,
      deck: rest,
      hands: { ...s.hands, [s.currentPlayerId]: [...currentHand, drawn!] },
    };

    // 脱落チェック
    s = checkElimination(s);
    if (s.status === 'finished') return s;
    if (s.players.find((player) => player.id === drawingPlayerId)?.isEliminated) {
      return advanceAfterPlayer({ ...s, pendingAction: null }, drawingPlayerId);
    }

    // 引いたカードが出せるなら即プレイ
    if (canPlayCard(s, drawn!)) {
      return applyPlayCard(s, drawn!.id);
    }
  }

  // 出せるカードが引けなかった: ターン終了
  return advanceTurn(s);
}

/**
 * hard モード: ドロースタッキングを受け入れる（pendingDrawCount 枚引いてターン終了）。
 */
export function applyAcceptDraw(state: UnoGameState): UnoGameState {
  if (state.status !== 'playing') return state;
  if (state.pendingAction !== null) return state;
  if (state.pendingDrawCount === 0) return state;

  const count = state.pendingDrawCount;
  const drawingPlayerId = state.currentPlayerId;
  let s: UnoGameState = { ...state, pendingDrawCount: 0, lastDrawCardValue: 0 };
  s = drawCardsForPlayer(s, drawingPlayerId, count);
  s = checkElimination(s);
  if (s.status === 'finished') return s;
  if (s.players.find((player) => player.id === drawingPlayerId)?.isEliminated) {
    return advanceAfterPlayer({ ...s, pendingAction: null }, drawingPlayerId);
  }
  return advanceTurn(s);
}

// ═══════════════════════════════════════════════
// hard: スワップ選択（7 のルール）
// ═══════════════════════════════════════════════

export function applySwapPick(state: UnoGameState, targetPlayerId: UnoPlayerId): UnoGameState {
  if (state.pendingAction?.kind !== 'swap-pick') return state;

  const swapperId = state.pendingAction.swapperPlayerId;
  const swapper = state.players.find((player) => player.id === swapperId);
  const target = state.players.find((player) => player.id === targetPlayerId);
  if (
    !swapper || swapper.isEliminated ||
    !target || target.isEliminated ||
    targetPlayerId === swapperId
  ) {
    return state;
  }
  const swapperHand = state.hands[swapperId] ?? [];
  const targetHand = state.hands[targetPlayerId] ?? [];

  const s: UnoGameState = {
    ...state,
    hands: {
      ...state.hands,
      [swapperId]: targetHand,
      [targetPlayerId]: swapperHand,
    },
    pendingAction: null,
  };

  return advanceTurn(s);
}

// ═══════════════════════════════════════════════
// hard: カラールーレット（1 ステップずつ進める）
// ═══════════════════════════════════════════════

export function applyColorRouletteStep(state: UnoGameState): UnoGameState {
  if (state.pendingAction?.kind !== 'color-roulette') return state;

  const { targetPlayerId, targetColor } = state.pendingAction;
  const target = state.players.find((player) => player.id === targetPlayerId);
  if (!target || target.isEliminated) {
    const nextId = getNextActivePlayerAfter({ ...state, pendingAction: null }, targetPlayerId);
    return { ...state, pendingAction: null, currentPlayerId: nextId, turnCount: state.turnCount + 1 };
  }

  let s = reshuffleIfNeeded(state);
  if (s.deck.length === 0) {
    return advanceAfterPlayer({ ...s, pendingAction: null }, targetPlayerId);
  }

  const handSizeBeforeDraw = (s.hands[targetPlayerId] ?? []).length;
  s = drawCardsForPlayer(s, targetPlayerId, 1);
  const drawnCard = s.hands[targetPlayerId]?.[handSizeBeforeDraw];
  if (!drawnCard) {
    return advanceAfterPlayer({ ...s, pendingAction: null }, targetPlayerId);
  }

  // 脱落チェック
  s = checkElimination(s);
  if (s.status === 'finished') return s;

  const targetAfterDraw = s.players.find((player) => player.id === targetPlayerId);
  if (!targetAfterDraw || targetAfterDraw.isEliminated) {
    const nextId = getNextActivePlayerAfter({ ...s, pendingAction: null }, targetPlayerId);
    return { ...s, pendingAction: null, currentPlayerId: nextId, turnCount: s.turnCount + 1 };
  }

  // 引いたカードが目標色なら終了
  if (drawnCard && drawnCard.kind !== 'wild' && drawnCard.color === targetColor) {
    s = { ...s, pendingAction: null };
    // ターンは targetPlayerId の次のプレイヤーへ
    const afterTarget = getNextActivePlayerAfter(s, targetPlayerId);
    return { ...s, currentPlayerId: afterTarget, turnCount: s.turnCount + 1 };
  }

  // まだ続く
  return s;
}

// ═══════════════════════════════════════════════
// UNO 宣言 / ペナルティ
// ═══════════════════════════════════════════════

export function applyUnoDeclaration(state: UnoGameState, playerId: UnoPlayerId): UnoGameState {
  if (state.pendingAction?.kind !== 'uno-window') return state;
  if (state.pendingAction.playerWithOneCard !== playerId) return state;

  const unoDeclaredIds = state.unoDeclaredIds.includes(playerId)
    ? state.unoDeclaredIds
    : [...state.unoDeclaredIds, playerId];

  return { ...state, pendingAction: null, unoDeclaredIds };
}
