import type { GameState, CpuLevel, PlayerId } from './mancalaTypes';
import { getSelectablePits, applyMove } from './mancalaRules';

// ============================================================
// CPU 名称（難易度ごと）
// ============================================================

export function getCpuDisplayName(level: CpuLevel): string {
  const names: Record<CpuLevel, string> = {
    'very-easy': 'ベビードラゴン',
    'easy':      'ドラゴン',
    'normal':    'スーパードラゴン',
    'hard':      'ドラゴンキング',
    'very-hard': 'ゴッドドラゴン',
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
 * 捕獲できる手を探す（2人プレイ時のみ有効）。
 *
 * applyMove 後に相手のピットが "stones > 0 → 0" になっていれば
 * 捕獲が起きたと判断する。
 * (追加ターンと捕獲はルール上排他なので追加ターン手はスキップ)
 *
 * @param cpuPlayerId - この CPU のプレイヤーID（デフォルト 'player-2'）
 */
export function findCaptureMove(
  state: GameState,
  cpuPlayerId: PlayerId = 'player-2'
): string | null {
  // 捕獲は 2人プレイ時のみ
  if (state.playerCount !== 2) return null;

  const opponentId = state.players.find((p) => p.id !== cpuPlayerId)!.id;
  const oppPitsBefore = state.board.filter(
    (p) => p.ownerPlayerId === opponentId && !p.isStore
  );

  for (const pit of getSelectablePits(state)) {
    const next = applyMove(state, pit.id);
    if (next.status === 'finished') continue;
    if (next.currentPlayerId === state.currentPlayerId) continue; // 追加ターンはスキップ

    const captured = oppPitsBefore.some((oppPit) => {
      if (oppPit.stones === 0) return false;
      const afterPit = next.board.find((p) => p.id === oppPit.id)!;
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
 */
function findAvoidOpponentExtraTurnMove(state: GameState): string | null {
  const pits = getSelectablePits(state);

  const safe = pits.filter((pit) => {
    const next = applyMove(state, pit.id);
    if (next.status === 'finished') return true;
    if (next.currentPlayerId === state.currentPlayerId) return true;
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

function evaluateState(state: GameState, cpuPlayerId: PlayerId): number {
  if (state.status === 'finished') {
    if (state.isDraw) return 0;
    return state.winnerPlayerId === cpuPlayerId ? 1000 : -1000;
  }
  const myStore = state.board.find(
    (p) => p.ownerPlayerId === cpuPlayerId && p.isStore
  )!;
  const oppStores = state.board.filter(
    (p) => p.ownerPlayerId !== cpuPlayerId && p.isStore
  );
  const avgOppScore =
    oppStores.reduce((s, p) => s + p.stones, 0) / oppStores.length;
  return myStore.stones - avgOppScore;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  cpuPlayerId: PlayerId,
): number {
  if (state.status === 'finished' || depth === 0) {
    return evaluateState(state, cpuPlayerId);
  }

  const pits = getSelectablePits(state);
  if (pits.length === 0) return evaluateState(state, cpuPlayerId);

  const isMax = state.currentPlayerId === cpuPlayerId;
  let best = isMax ? -Infinity : Infinity;

  for (const pit of pits) {
    const next = applyMove(state, pit.id);
    const score = minimax(next, depth - 1, alpha, beta, cpuPlayerId);
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

function findMinimaxMove(
  state: GameState,
  cpuPlayerId: PlayerId,
  depth: number
): string | null {
  const pits = getSelectablePits(state);
  if (pits.length === 0) return null;

  let bestScore = -Infinity;
  let bestPit: string | null = null;

  for (const pit of pits) {
    const next = applyMove(state, pit.id);
    const score = minimax(next, depth - 1, -Infinity, Infinity, cpuPlayerId);
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
 * @param cpuPlayerId - この CPU のプレイヤーID（デフォルト 'player-2'）
 *
 * 難易度別の優先順位:
 *   very-easy: ランダム
 *   easy:      追加ターン → ランダム
 *   normal:    追加ターン → 捕獲 → ランダム
 *   hard:      追加ターン → 捕獲 → 相手の追加ターン回避 → ランダム
 *   very-hard: Minimax（深さ5）
 */
export function chooseCpuMove(
  state: GameState,
  cpuPlayerId: PlayerId = 'player-2',
  level: CpuLevel = 'normal'
): string | null {
  if (state.status !== 'playing') return null;
  if (state.currentPlayerId !== cpuPlayerId) return null;

  switch (level) {
    case 'very-easy':
      return chooseRandomMove(state);
    case 'easy':
      return findExtraTurnMove(state) ?? chooseRandomMove(state);
    case 'normal':
      return (
        findExtraTurnMove(state) ??
        findCaptureMove(state, cpuPlayerId) ??
        chooseRandomMove(state)
      );
    case 'hard':
      return (
        findExtraTurnMove(state) ??
        findCaptureMove(state, cpuPlayerId) ??
        findAvoidOpponentExtraTurnMove(state) ??
        chooseRandomMove(state)
      );
    case 'very-hard':
      return findMinimaxMove(state, cpuPlayerId, 5);
  }
}
