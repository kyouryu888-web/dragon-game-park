import type { GameState } from './mancalaTypes';
import { getSelectablePits, applyMove } from './mancalaRules';

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

// ============================================================
// メイン関数
// ============================================================

/**
 * CPUが選ぶ穴の pitId を返す。
 *
 * 優先順位:
 *   1. 追加ターンを得られる手
 *   2. 捕獲できる手
 *   3. ランダムに合法手を選ぶ
 *
 * 選べる手がない、またはゲーム中でない場合は null を返す。
 */
export function chooseCpuMove(state: GameState): string | null {
  if (state.status !== 'playing') return null;
  if (state.currentPlayerId !== 'player-2') return null;

  return (
    findExtraTurnMove(state) ??
    findCaptureMove(state) ??
    chooseRandomMove(state)
  );
}
