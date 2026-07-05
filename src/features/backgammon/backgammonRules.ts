import type { GameState, Move, PlayerId, WinKind } from './backgammonTypes';

// ============================================================
// 基本ヘルパー
// ============================================================

export function getOpponent(player: PlayerId): PlayerId {
  return player === 'white' ? 'black' : 'white';
}

/** 進行方向。white は index が減る、black は増える */
function direction(player: PlayerId): 1 | -1 {
  return player === 'white' ? -1 : 1;
}

/** ホームボードの index 範囲 */
function homeRange(player: PlayerId): [number, number] {
  return player === 'white' ? [0, 5] : [18, 23];
}

/** バーから入る先の index（die: 1-6） */
function barEntryIndex(player: PlayerId, die: number): number {
  return player === 'white' ? 24 - die : die - 1;
}

/** ベアオフに必要な正確な出目（そのポイントから上がる場合） */
function exactBearOffDie(player: PlayerId, index: number): number {
  return player === 'white' ? index + 1 : 24 - index;
}

/** そのポイントに駒を置けるか（空 / 自分の駒 / 相手のブロット） */
function canLand(state: GameState, player: PlayerId, index: number): boolean {
  const point = state.points[index];
  return point === null || point.owner === player || point.count === 1;
}

/** 全駒がホームボード内（＋ベアオフ済み）にあるか */
export function canBearOff(state: GameState, player: PlayerId): boolean {
  if (state.bar[player] > 0) return false;
  const [lo, hi] = homeRange(player);
  for (let i = 0; i < 24; i++) {
    if (i >= lo && i <= hi) continue;
    const point = state.points[i];
    if (point && point.owner === player && point.count > 0) return false;
  }
  return true;
}

/** ピップカウント（ゴールまでの合計距離。小さいほど有利） */
export function getPipCount(state: GameState, player: PlayerId): number {
  let pips = state.bar[player] * 25;
  for (let i = 0; i < 24; i++) {
    const point = state.points[i];
    if (point && point.owner === player) {
      pips += point.count * (player === 'white' ? i + 1 : 24 - i);
    }
  }
  return pips;
}

// ============================================================
// サイコロ
// ============================================================

export type Rng = () => number;

function rollDie(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}

/** ゾロ目は4個に展開する */
export function expandDice(d1: number, d2: number): number[] {
  return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

/**
 * オープニングロール。両者1個ずつ振り、大きい方が先手（その2つの目で最初の手番）。
 * ゾロ目なら phase は opening-roll のまま（振り直し）。
 */
export function rollOpening(state: GameState, rng: Rng = Math.random): GameState {
  const whiteDie = rollDie(rng);
  const blackDie = rollDie(rng);
  if (whiteDie === blackDie) {
    return { ...state, openingRoll: [whiteDie, blackDie] };
  }
  const first: PlayerId = whiteDie > blackDie ? 'white' : 'black';
  return {
    ...state,
    openingRoll: [whiteDie, blackDie],
    currentPlayer: first,
    phase: 'moving',
    rolled: [whiteDie, blackDie],
    dice: expandDice(whiteDie, blackDie),
    turnCount: 1,
  };
}

/** 手番プレイヤーがサイコロを振る（phase: rolling → moving） */
export function rollDice(state: GameState, rng: Rng = Math.random): GameState {
  const d1 = rollDie(rng);
  const d2 = rollDie(rng);
  return {
    ...state,
    phase: 'moving',
    rolled: [d1, d2],
    dice: expandDice(d1, d2),
  };
}

// ============================================================
// 合法手の列挙
// ============================================================

/** 指定の出目1個で打てる単一手をすべて挙げる（最大限使用ルールは考慮しない生の候補） */
function getRawMovesForDie(state: GameState, die: number): Move[] {
  const player = state.currentPlayer;
  const moves: Move[] = [];

  // バーに駒があれば、バーからの復帰以外は打てない
  if (state.bar[player] > 0) {
    const to = barEntryIndex(player, die);
    if (canLand(state, player, to)) {
      moves.push({ from: 'bar', to, die });
    }
    return moves;
  }

  const dir = direction(player);
  const bearingOff = canBearOff(state, player);
  const [lo, hi] = homeRange(player);

  for (let from = 0; from < 24; from++) {
    const point = state.points[from];
    if (!point || point.owner !== player) continue;

    const to = from + dir * die;
    if (to >= 0 && to <= 23) {
      if (canLand(state, player, to)) {
        moves.push({ from, to, die });
      }
    } else if (bearingOff) {
      const exact = exactBearOffDie(player, from);
      if (die === exact) {
        moves.push({ from, to: 'off', die });
      } else if (die > exact) {
        // 超過目のベアオフ: より後方（ホーム内で遠い側）に駒がない場合のみ
        let hasFarther = false;
        for (let i = lo; i <= hi; i++) {
          if (exactBearOffDie(player, i) > exact) {
            const p = state.points[i];
            if (p && p.owner === player && p.count > 0) { hasFarther = true; break; }
          }
        }
        if (!hasFarther) moves.push({ from, to: 'off', die });
      }
    }
  }
  return moves;
}

/** 1手だけ適用した盤面（手番終了・勝敗判定はしない） */
function applyMoveRaw(state: GameState, move: Move): GameState {
  const player = state.currentPlayer;
  const opponent = getOpponent(player);
  const points = state.points.slice();
  const bar = { ...state.bar };
  const borneOff = { ...state.borneOff };

  // 移動元から取る
  if (move.from === 'bar') {
    bar[player] -= 1;
  } else {
    const src = points[move.from]!;
    points[move.from] = src.count === 1 ? null : { owner: player, count: src.count - 1 };
  }

  // 移動先へ置く
  if (move.to === 'off') {
    borneOff[player] += 1;
  } else {
    const dst = points[move.to];
    if (dst && dst.owner === opponent) {
      // ヒット（相手のブロットをバーへ）
      bar[opponent] += 1;
      points[move.to] = { owner: player, count: 1 };
    } else {
      points[move.to] = { owner: player, count: (dst?.count ?? 0) + 1 };
    }
  }

  // 使った出目を1個消費
  const dice = state.dice.slice();
  dice.splice(dice.indexOf(move.die), 1);

  return { ...state, points, bar, borneOff, dice };
}

export type MoveSequence = { moves: Move[]; state: GameState };

/** 残りの出目で打てる全手順を深さ優先で列挙する（重複出目は1回だけ試す） */
function enumerateSequences(state: GameState): MoveSequence[] {
  const results: MoveSequence[] = [];

  function dfs(s: GameState, moves: Move[]) {
    const uniqueDice = Array.from(new Set(s.dice));
    let extended = false;
    for (const die of uniqueDice) {
      for (const move of getRawMovesForDie(s, die)) {
        extended = true;
        const next = applyMoveRaw(s, move);
        dfs(next, [...moves, move]);
      }
    }
    if (!extended) {
      results.push({ moves, state: s });
    }
  }

  dfs(state, []);
  return results;
}

/**
 * 「最大限使用ルール」を満たす手順のみを返す。
 * - 使える出目の数が最大になる手順しか選べない
 * - 1個しか使えず出目が2種類あるなら、大きい方を使える手順を優先
 */
export function getLegalMoveSequences(state: GameState): MoveSequence[] {
  const all = enumerateSequences(state);
  const maxLen = Math.max(...all.map((s) => s.moves.length));
  let candidates = all.filter((s) => s.moves.length === maxLen);

  if (maxLen === 1) {
    const uniqueDice = Array.from(new Set(state.dice));
    if (uniqueDice.length === 2) {
      const bigger = Math.max(...uniqueDice);
      const withBigger = candidates.filter((s) => s.moves[0].die === bigger);
      if (withBigger.length > 0) candidates = withBigger;
    }
  }
  return candidates;
}

/** いま打てる「最初の1手」の候補（最大限使用ルールでフィルタ済み・重複除去） */
export function getLegalMoves(state: GameState): Move[] {
  if (state.phase !== 'moving' || state.dice.length === 0) return [];
  const sequences = getLegalMoveSequences(state);
  const seen = new Set<string>();
  const moves: Move[] = [];
  for (const seq of sequences) {
    if (seq.moves.length === 0) continue;
    const m = seq.moves[0];
    const key = `${m.from}>${m.to}>${m.die}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push(m);
    }
  }
  return moves;
}

// ============================================================
// 手の適用・手番進行・勝敗
// ============================================================

/** 勝ち方の判定（winner 確定時に呼ぶ） */
function judgeWinKind(state: GameState, winner: PlayerId): WinKind {
  const loser = getOpponent(winner);
  if (state.borneOff[loser] > 0) return 'single';
  // ギャモン: 相手が1個も上げていない
  // バックギャモン: さらに相手がバー or 勝者のホームボード内に駒を残している
  const [lo, hi] = homeRange(winner);
  if (state.bar[loser] > 0) return 'backgammon';
  for (let i = lo; i <= hi; i++) {
    const p = state.points[i];
    if (p && p.owner === loser && p.count > 0) return 'backgammon';
  }
  return 'gammon';
}

const WIN_MULTIPLIER: Record<WinKind, number> = { single: 1, gammon: 2, backgammon: 3 };

/** 手番を相手に渡す */
function endTurn(state: GameState): GameState {
  return {
    ...state,
    currentPlayer: getOpponent(state.currentPlayer),
    phase: 'rolling',
    dice: [],
    rolled: null,
    turnCount: state.turnCount + 1,
  };
}

/**
 * 合法手を1手適用する。全出目を使い切る／残りが打てない場合は自動で手番交代。
 * 15個ベアオフしたら勝敗確定。
 */
export function applyMove(state: GameState, move: Move): GameState {
  const next = applyMoveRaw(state, move);
  const player = state.currentPlayer;

  if (next.borneOff[player] >= 15) {
    const winKind = judgeWinKind(next, player);
    return {
      ...next,
      phase: 'finished',
      winner: player,
      winKind,
      resultPoints: state.cube.value * WIN_MULTIPLIER[winKind],
      dice: [],
    };
  }

  if (next.dice.length === 0 || getLegalMoves({ ...next, phase: 'moving' }).length === 0) {
    return endTurn(next);
  }
  return next;
}

/** 出目を振ったが1手も打てないとき、手番をパスする */
export function passTurn(state: GameState): GameState {
  return endTurn(state);
}

/** 振った直後に打てる手があるか（なければ UI がパスを案内する） */
export function hasAnyMove(state: GameState): boolean {
  return getLegalMoves(state).length > 0;
}

export type ChainedMove = { dest: number; moves: [Move, Move] };

/**
 * 同じ駒を2手続けて動かして到達できる盤上の移動先（サイコロ2個分を一度に動かすUI用）。
 * 1手目・2手目とも合法手（最大限使用ルール込み）のみを辿る。
 */
export function getChainedMoves(state: GameState, from: number | 'bar'): ChainedMove[] {
  if (state.phase !== 'moving' || state.dice.length < 2) return [];
  const player = state.currentPlayer;
  const results: ChainedMove[] = [];
  const seen = new Set<number>();
  for (const m1 of getLegalMoves(state).filter((m) => m.from === from && m.to !== 'off')) {
    const next = applyMove(state, m1);
    if (next.phase !== 'moving' || next.currentPlayer !== player) continue;
    for (const m2 of getLegalMoves(next)) {
      if (m2.from !== m1.to || m2.to === 'off') continue;
      const dest = m2.to as number;
      if (!seen.has(dest)) {
        seen.add(dest);
        results.push({ dest, moves: [m1, m2] });
      }
    }
  }
  return results;
}

/**
 * 相手との接触が完全になくなり、あとは全駒をゴールへ運ぶだけの状態か（ベアオフ自動化の条件）。
 * 自分の全駒がホーム内にあり、相手の駒がバーにも自分のホーム内にも無いこと。
 */
export function isPureBearOffRace(state: GameState, player: PlayerId): boolean {
  if (!canBearOff(state, player)) return false;
  const opponent = getOpponent(player);
  if (state.bar[opponent] > 0) return false;
  const [lo, hi] = homeRange(player);
  for (let i = lo; i <= hi; i++) {
    const p = state.points[i];
    if (p && p.owner === opponent && p.count > 0) return false;
  }
  return true;
}

// ============================================================
// ダブリングキューブ
// ============================================================

/** いまダブルを提案できるか（自分の手番・振る前・キューブ所有権あり） */
export function canOfferDouble(state: GameState, player: PlayerId): boolean {
  return (
    state.phase === 'rolling' &&
    state.currentPlayer === player &&
    (state.cube.owner === null || state.cube.owner === player) &&
    state.cube.value < 64
  );
}

export function offerDouble(state: GameState): GameState {
  return { ...state, phase: 'double-offered', doubleOfferedBy: state.currentPlayer };
}

/** ダブル受諾: キューブ値2倍・所有権は受けた側へ。提案者の手番（rolling）に戻る */
export function acceptDouble(state: GameState): GameState {
  const accepter = getOpponent(state.doubleOfferedBy!);
  return {
    ...state,
    phase: 'rolling',
    cube: { value: state.cube.value * 2, owner: accepter },
    doubleOfferedBy: null,
  };
}

/** ダブル拒否: 現在のキューブ値で提案者の勝ち */
export function declineDouble(state: GameState): GameState {
  const winner = state.doubleOfferedBy!;
  return {
    ...state,
    phase: 'finished',
    winner,
    winKind: 'single',
    resultPoints: state.cube.value,
    doubleOfferedBy: null,
  };
}
