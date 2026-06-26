import { describe, it, expect } from 'vitest';
import { createInitialMancalaState } from './createInitialMancalaState';
import {
  chooseCpuMove,
  findExtraTurnMove,
  findCaptureMove,
} from './mancalaCpu';
import { getSelectablePits } from './mancalaRules';
import type { GameState, PlayerId } from './mancalaTypes';

// ============================================================
// テスト用ヘルパー
// ============================================================

function setPitStones(state: GameState, pitId: string, stones: number): GameState {
  return {
    ...state,
    board: state.board.map((p) => (p.id === pitId ? { ...p, stones } : p)),
  };
}

function setCurrentPlayer(state: GameState, playerId: PlayerId): GameState {
  return { ...state, currentPlayerId: playerId };
}

/** p2 の全ピットを指定の石数にする */
function setAllP2Pits(state: GameState, stones: number): GameState {
  let s = state;
  for (let i = 0; i < 6; i++) {
    s = setPitStones(s, `p2-pit-${i}`, stones);
  }
  return s;
}

/** p1 の全ピットを指定の石数にする */
function setAllP1Pits(state: GameState, stones: number): GameState {
  let s = state;
  for (let i = 0; i < 6; i++) {
    s = setPitStones(s, `p1-pit-${i}`, stones);
  }
  return s;
}

// ============================================================
// 1. 基本動作
// ============================================================

describe('chooseCpuMove：基本動作', () => {
  it('ゲーム終了後は null を返す', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = { ...state, status: 'finished' };
    expect(chooseCpuMove(state)).toBeNull();
  });

  it('player-1 の手番のときは null を返す', () => {
    const state = createInitialMancalaState('cpu'); // 初期手番は player-1
    expect(chooseCpuMove(state)).toBeNull();
  });

  it('選べる穴が全て0の場合は null を返す', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);
    expect(chooseCpuMove(state)).toBeNull();
  });

  it('返ってきた pitId は必ず合法手の中にある', () => {
    // 初期盤面を p2 の手番にしてランダム手を確認
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');

    // p2-pit-2 は 4石で追加ターンになるので別の値にして純粋なランダムを確認
    // (index 9 + 4 = 13 = p2-store → 追加ターン)
    state = setPitStones(state, 'p2-pit-2', 1);

    const move = chooseCpuMove(state);
    expect(move).not.toBeNull();
    if (move !== null) {
      const selectableIds = getSelectablePits(state).map((p) => p.id);
      expect(selectableIds).toContain(move);
    }
  });
});

// ============================================================
// 2. 追加ターンの優先
// ============================================================

describe('findExtraTurnMove：追加ターン優先', () => {
  it('追加ターンを得られる手を返す', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);
    // p2-pit-5 (index 12) に1石 → index 13 (p2-store) に着地 → 追加ターン
    state = setPitStones(state, 'p2-pit-5', 1);
    // p2-pit-0 (index 7) に2石 → index 9 (p2-pit-2) に着地 → 追加ターンなし
    state = setPitStones(state, 'p2-pit-0', 2);

    expect(findExtraTurnMove(state)).toBe('p2-pit-5');
  });

  it('追加ターン手がなければ null を返す', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);
    // p2-pit-0 に2石だけ（追加ターンにならない）
    state = setPitStones(state, 'p2-pit-0', 2);

    expect(findExtraTurnMove(state)).toBeNull();
  });
});

describe('chooseCpuMove：追加ターン優先', () => {
  it('追加ターンを得られる手を最優先で選ぶ', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);
    state = setPitStones(state, 'p2-pit-5', 1); // 追加ターン手
    state = setPitStones(state, 'p2-pit-0', 2); // 普通の手

    expect(chooseCpuMove(state)).toBe('p2-pit-5');
  });
});

// ============================================================
// 3. 捕獲の優先
// ============================================================

describe('findCaptureMove：捕獲優先', () => {
  it('捕獲できる手を返す', () => {
    // セットアップ:
    //   p2-pit-4 (index 11) に1石 → index 12 (p2-pit-5) に着地
    //   p2-pit-5 は空、向かいの p1-pit-0 に4石 → 捕獲！
    //   p2-pit-0 に2石 → index 9 (p2-pit-2) に着地、p2-pit-2 は空だが
    //     向かいの p1-pit-3 を 0 にして捕獲なし
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);

    state = setPitStones(state, 'p2-pit-4', 1); // 捕獲手
    state = setPitStones(state, 'p2-pit-0', 2); // 非捕獲手（向かいに石がない）
    state = setPitStones(state, 'p1-pit-3', 0); // p2-pit-2 の向かいを空に

    expect(findCaptureMove(state)).toBe('p2-pit-4');
  });

  it('捕獲手がなければ null を返す', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    // p1の全ピットを空にすれば捕獲は絶対に起きない
    state = setAllP1Pits(state, 0);
    // p2-pit-2 は追加ターンになるので石を変える
    state = setPitStones(state, 'p2-pit-2', 1);

    expect(findCaptureMove(state)).toBeNull();
  });
});

describe('chooseCpuMove：捕獲優先（追加ターンなし）', () => {
  it('追加ターン手がなく捕獲手がある場合、捕獲手を選ぶ', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);

    // 捕獲手: p2-pit-4 (1石) → p2-pit-5 (空) → p1-pit-0 (4石) を捕獲
    state = setPitStones(state, 'p2-pit-4', 1);
    // 非捕獲手: p2-pit-0 (2石) → p2-pit-2 (空) だが p1-pit-3 を空にして捕獲なし
    state = setPitStones(state, 'p2-pit-0', 2);
    state = setPitStones(state, 'p1-pit-3', 0);

    expect(chooseCpuMove(state)).toBe('p2-pit-4');
  });
});

// ============================================================
// 4. ランダムフォールバック
// ============================================================

describe('chooseCpuMove：ランダムフォールバック', () => {
  it('追加ターンも捕獲もない場合、合法手の中から選ぶ', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    // p1 の全ピットを空にして捕獲不能にする
    state = setAllP1Pits(state, 0);
    // p2-pit-2 は通常4石で追加ターンになるので変更
    state = setPitStones(state, 'p2-pit-2', 1);

    const move = chooseCpuMove(state);
    expect(move).not.toBeNull();

    const selectableIds = getSelectablePits(state).map((p) => p.id);
    if (move !== null) {
      expect(selectableIds).toContain(move);
    }
  });

  it('合法手が1つだけのとき、それを選ぶ', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    state = setAllP2Pits(state, 0);
    state = setAllP1Pits(state, 0); // 捕獲不能

    // p2-pit-0 に3石（追加ターン・捕獲なし）
    // index 7 + 3 = 10 (p2-pit-3) → 追加ターンではない
    state = setPitStones(state, 'p2-pit-0', 3);

    const move = chooseCpuMove(state);
    expect(move).toBe('p2-pit-0');
  });
});
