import type { GameState, CpuLevel } from './mancalaTypes';
import { getSelectablePits, applyMove } from './mancalaRules';

// ============================================================
// CPU 名称（難易度ごと）
// ============================================================

export function getCpuDisplayName(level: CpuLevel): string {
  const names: Record<CpuLevel, string> = {
    'very-easy': 'よわよわドラゴン',
    'easy':      'ちびドラゴン',
    'normal':    'こどもドラゴン',
    'hard':      'ドラゴンナイト',
    'very-hard': '大魔王ドラゴン',
  };
  return names[level];
}

// ============================================================
// 補助関数
// ============================================================

/**
 * 追加ターンを得られる手を探す。
 * applyMove 後も currentPlayerId が変わっていなければ追加ターン確定。
 */
export function findExtraTurnMove(state: GameState): string | null {
  for (const pit of getSelectablePits(state)) {
    const next = applyMove(state, pit.id);
    if (next.currentPlayerId === state.currentPlayerId) {
      return pit.id;
    }
  }
  return null;
}

/**
 * 捕獲できる手を探す。
 *
 * p2 の手番中、p1 のピットは通常の石配りでは石が減らない。
 * applyMove 後に p1 ピットが "stones > 0 → 0" になっていれば捕獲が起きたと判断する。
 * (追加ターンと捕獲はルール上排他なので追加ターン手はスキップ)
 */
export function findCaptureMove(state: GameState): string | null {
  const p1PitsBefore = state.board.filter(
    (p) => p.ownerPlayerId === 'player-1' && !p.isStore
  );

  for (const pit of getSelectablePits(state)) {
    const next = applyMove(state, pit.id);
    if (next.status === 'finished') continue;
    if (next.currentPlayerId === state.currentPlayerId) continue;

    const captured = p1PitsBefore.some((p1Pit) => {
      if (p1Pit.stones === 0) return false;
      const afterPit = next.board.find((p) => p.id === p1Pit.id)!;
      return afterPit.stones === 0;
    });

    if (captured) return pit.id;
  }
  return null;
}

/** 合法手からランダムに1つ選ぶ */
export function chooseRandomMove(state: GameState): string | null {
  const pits = getSelectablePits(state);
  if (pits.length === 0) return null;
  return pits[Math.floor(Math.random() * pits.length)].id;
}

/**
 * 相手が追加ターンを得にくい手を選ぶ（むずかしいレベル用）。
 * 自分の手の後、相手が追加ターンを取れる手がない場合に優先する。
 */
function findAvoidOpponentExtraTurnMove(state: GameState): string | null {
  const pits = getSelectablePits(state);

  const safe = pits.filter((pit) => {
    const next = applyMove(state, pit.id);
    if (next.status === 'finished') return true;
    // 自分が追加ターンを得た場合は相手の番ではないのでセーフ
    if (next.currentPlayerId === state.currentPlayerId) return true;
    // 相手の全合法手を試して追加ターンを取れるものがないかチェック
    const oppMoves = getSelectablePits(next);
    return !oppMoves.some((oppPit) => {
      const afterOpp = applyMove(next, oppPit.id);
      return afterOpp.currentPlayerId === next.currentPlayerId;
    });
  });

  if (safe.length === 0) return null;
  return safe[Math.floor(Math.random() * safe.length)].id;
}

// ============================================================
// Minimax（とてもむずかしいレベル）
// ============================================================

function evaluateState(state: GameState): number {
  if (state.status === 'finished') {
    if (state.isDraw) return 0;
    return state.winnerPlayerId === 'player-2' ? 1000 : -1000;
  }
  const p2Store = state.board.find((p) => p.ownerPlayerId === 'player-2' && p.isStore)!;
  const p1Store = state.board.find((p) => p.ownerPlayerId === 'player-1' && p.isStore)!;
  return p2Store.stones - p1Store.stones;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (state.status === 'finished' || depth === 0) return evaluateState(state);

  const pits = getSelectablePits(state);
  if (pits.length === 0) return evaluateState(state);

  const isMax = state.currentPlayerId === 'player-2';
  let best = isMax ? -Infinity : Infinity;

  for (const pit of pits) {
    const next = applyMove(state, pit.id);
    const score = minimax(next, depth - 1, alpha, beta);
    if (isMax) {
      if (score > best) best = score;
      if (score > alpha) alpha = score;
    } else {
      if (score < best) best = score;
      if (score < beta) beta = score;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function findMinimaxMove(state: GameState, depth: number): string | null {
  const pits = getSelectablePits(state);
  if (pits.length === 0) return null;

  let bestScore = -Infinity;
  let bestPit: string | null = null;

  for (const pit of pits) {
    const next = applyMove(state, pit.id);
    const score = minimax(next, depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestPit = pit.id;
    }
  }
  return bestPit;
}

// ============================================================
// メイン関数
// ============================================================

/**
 * CPU が選ぶ穴の pitId を返す。
 *
 * 難易度別の優先順位:
 *   very-easy: ランダム
 *   easy:      追加ターン → ランダム
 *   normal:    追加ターン → 捕獲 → ランダム
 *   hard:      追加ターン → 捕獲 → 相手の追加ターン回避 → ランダム
 *   very-hard: Minimax（深さ5）
 */
export function chooseCpuMove(state: GameState, level: CpuLevel = 'normal'): string | null {
  if (state.status !== 'playing') return null;
  if (state.currentPlayerId !== 'player-2') return null;

  switch (level) {
    case 'very-easy':
      return chooseRandomMove(state);
    case 'easy':
      return findExtraTurnMove(state) ?? chooseRandomMove(state);
    case 'normal':
      return findExtraTurnMove(state) ?? findCaptureMove(state) ?? chooseRandomMove(state);
    case 'hard':
      return (
        findExtraTurnMove(state) ??
        findCaptureMove(state) ??
        findAvoidOpponentExtraTurnMove(state) ??
        chooseRandomMove(state)
      );
    case 'very-hard':
      return findMinimaxMove(state, 5);
  }
}
