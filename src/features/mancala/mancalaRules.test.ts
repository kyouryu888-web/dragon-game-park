import { describe, it, expect } from 'vitest';
import { createInitialMancalaState } from './createInitialMancalaState';
import {
  canSelectPit,
  getSelectablePits,
  applyMove,
  checkGameEnd,
} from './mancalaRules';
import type { GameState, PlayerId } from './mancalaTypes';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/** 指定した穴の石の数を変えた新しい状態を返す（元の状態は変えない） */
function setPitStones(state: GameState, pitId: string, stones: number): GameState {
  return {
    ...state,
    board: state.board.map((p) => (p.id === pitId ? { ...p, stones } : p)),
  };
}

/** 手番プレイヤーを変えた新しい状態を返す */
function setCurrentPlayer(state: GameState, playerId: PlayerId): GameState {
  return { ...state, currentPlayerId: playerId };
}

// ============================================================
// 1. 初期盤面のテスト
// ============================================================

describe('createInitialMancalaState：初期盤面', () => {
  it('プレイヤーが2人いる', () => {
    const state = createInitialMancalaState('cpu');
    expect(state.players).toHaveLength(2);
  });

  it('各プレイヤーの小さい穴が6個ずつある', () => {
    const state = createInitialMancalaState('cpu');
    const p1Pockets = state.board.filter((p) => p.ownerPlayerId === 'player-1' && !p.isStore);
    const p2Pockets = state.board.filter((p) => p.ownerPlayerId === 'player-2' && !p.isStore);
    expect(p1Pockets).toHaveLength(6);
    expect(p2Pockets).toHaveLength(6);
  });

  it('各小さい穴に4個ずつ石がある', () => {
    const state = createInitialMancalaState('cpu');
    const pockets = state.board.filter((p) => !p.isStore);
    for (const pit of pockets) {
      expect(pit.stones).toBe(4);
    }
  });

  it('各ストアは0個で始まる', () => {
    const state = createInitialMancalaState('cpu');
    const stores = state.board.filter((p) => p.isStore);
    for (const store of stores) {
      expect(store.stones).toBe(0);
    }
  });

  it('最初の手番は player-1', () => {
    const state = createInitialMancalaState('cpu');
    expect(state.currentPlayerId).toBe('player-1');
  });

  it('ゲーム状態は playing', () => {
    const state = createInitialMancalaState('cpu');
    expect(state.status).toBe('playing');
  });

  it('CPUモードでは player-2 が CPU になる', () => {
    const state = createInitialMancalaState('cpu');
    const p2 = state.players.find((p) => p.id === 'player-2')!;
    expect(p2.isCpu).toBe(true);
  });

  it('2人対戦モードでは両プレイヤーとも人間になる', () => {
    const state = createInitialMancalaState('local-2p');
    for (const player of state.players) {
      expect(player.isCpu).toBe(false);
    }
  });
});

// ============================================================
// 2. 合法手判定のテスト
// ============================================================

describe('canSelectPit：合法手判定', () => {
  it('自分側の石がある穴は選べる', () => {
    const state = createInitialMancalaState('cpu');
    expect(canSelectPit(state, 'p1-pit-0')).toBe(true);
  });

  it('相手側の穴は選べない', () => {
    const state = createInitialMancalaState('cpu');
    expect(canSelectPit(state, 'p2-pit-0')).toBe(false);
  });

  it('自分のストアは選べない', () => {
    const state = createInitialMancalaState('cpu');
    expect(canSelectPit(state, 'p1-store')).toBe(false);
  });

  it('相手のストアは選べない', () => {
    const state = createInitialMancalaState('cpu');
    expect(canSelectPit(state, 'p2-store')).toBe(false);
  });

  it('石が0個の穴は選べない', () => {
    let state = createInitialMancalaState('cpu');
    state = setPitStones(state, 'p1-pit-0', 0);
    expect(canSelectPit(state, 'p1-pit-0')).toBe(false);
  });

  it('ゲーム終了後はどの穴も選べない', () => {
    let state = createInitialMancalaState('cpu');
    state = { ...state, status: 'finished' };
    expect(canSelectPit(state, 'p1-pit-0')).toBe(false);
  });
});

describe('getSelectablePits：選択可能な穴の一覧', () => {
  it('初期状態では player-1 の6つの穴がすべて選べる', () => {
    const state = createInitialMancalaState('cpu');
    const selectable = getSelectablePits(state);
    expect(selectable).toHaveLength(6);
    for (const pit of selectable) {
      expect(pit.ownerPlayerId).toBe('player-1');
    }
  });
});

// ============================================================
// 3. 石配りのテスト
// ============================================================

describe('applyMove：石配り', () => {
  it('選んだ穴の石が0になる', () => {
    const state = createInitialMancalaState('cpu');
    const nextState = applyMove(state, 'p1-pit-0');
    expect(nextState.board.find((p) => p.id === 'p1-pit-0')!.stones).toBe(0);
  });

  it('隣の穴に1個ずつ石が配られる', () => {
    const state = createInitialMancalaState('cpu');
    // p1-pit-0（4石）→ p1-pit-1,2,3,4 に1個ずつ配る
    const nextState = applyMove(state, 'p1-pit-0');
    expect(nextState.board.find((p) => p.id === 'p1-pit-1')!.stones).toBe(5);
    expect(nextState.board.find((p) => p.id === 'p1-pit-2')!.stones).toBe(5);
    expect(nextState.board.find((p) => p.id === 'p1-pit-3')!.stones).toBe(5);
    expect(nextState.board.find((p) => p.id === 'p1-pit-4')!.stones).toBe(5);
  });

  it('石の合計数が変わらない', () => {
    const state = createInitialMancalaState('cpu');
    const totalBefore = state.board.reduce((sum, p) => sum + p.stones, 0);
    const nextState = applyMove(state, 'p1-pit-0');
    const totalAfter = nextState.board.reduce((sum, p) => sum + p.stones, 0);
    expect(totalAfter).toBe(totalBefore);
  });

  it('相手のストアには石が入らない（1周以上する場合）', () => {
    // p1-pit-5（index=5）に9石 → 配ると p2-store を通過するルートになる
    let state = createInitialMancalaState('cpu');
    state = setPitStones(state, 'p1-pit-5', 9);
    const p2StoreBefore = state.board.find((p) => p.id === 'p2-store')!.stones;
    const nextState = applyMove(state, 'p1-pit-5');
    const p2StoreAfter = nextState.board.find((p) => p.id === 'p2-store')!.stones;
    expect(p2StoreAfter).toBe(p2StoreBefore); // 増えていない
  });

  it('不正な手（相手の穴）を指定した場合は状態が変わらない', () => {
    const state = createInitialMancalaState('cpu');
    const nextState = applyMove(state, 'p2-pit-0');
    expect(nextState).toBe(state); // まったく同じオブジェクトが返る
  });
});

// ============================================================
// 4. 追加ターンのテスト
// ============================================================

describe('追加ターン', () => {
  it('最後の石が自分のストアに入ったら手番が変わらない', () => {
    // p1-pit-2（index=2）は p1-store（index=6）まで4マス
    // 初期の4石ならちょうど p1-store に着地 → 追加ターン
    const state = createInitialMancalaState('cpu');
    const nextState = applyMove(state, 'p1-pit-2');
    expect(nextState.currentPlayerId).toBe('player-1'); // 手番が変わらない
  });

  it('追加ターンでない場合は相手に手番が移る', () => {
    // p1-pit-0（4石）→ p1-pit-4 に着地（ストアに届かない）→ 手番交代
    const state = createInitialMancalaState('cpu');
    const nextState = applyMove(state, 'p1-pit-0');
    expect(nextState.currentPlayerId).toBe('player-2');
  });
});

// ============================================================
// 5. 捕獲ルールのテスト
// ============================================================

describe('捕獲ルール', () => {
  it('最後の石が自分の空の穴に入り、向かいに石があれば捕獲される', () => {
    let state = createInitialMancalaState('cpu');
    // p1-pit-4 に1石だけ残し、p1-pit-5 を空にする
    // p2-pit-0（p1-pit-5 の向かい）は4石のまま
    state = setPitStones(state, 'p1-pit-4', 1);
    state = setPitStones(state, 'p1-pit-5', 0);

    const nextState = applyMove(state, 'p1-pit-4');
    // p1-pit-4（1石） → p1-pit-5（空）に着地 → 捕獲！
    // p1-store += 1（着地した石） + 4（向かいの p2-pit-0）= 5

    expect(nextState.board.find((p) => p.id === 'p1-store')!.stones).toBe(5);
    expect(nextState.board.find((p) => p.id === 'p1-pit-5')!.stones).toBe(0);
    expect(nextState.board.find((p) => p.id === 'p2-pit-0')!.stones).toBe(0);
  });

  it('向かいの穴が空なら捕獲は起きない', () => {
    let state = createInitialMancalaState('cpu');
    state = setPitStones(state, 'p1-pit-4', 1);
    state = setPitStones(state, 'p1-pit-5', 0);
    state = setPitStones(state, 'p2-pit-0', 0); // 向かいも空にする

    const nextState = applyMove(state, 'p1-pit-4');
    // 向かいが空なので捕獲なし → p1-store は変わらない
    expect(nextState.board.find((p) => p.id === 'p1-store')!.stones).toBe(0);
    expect(nextState.board.find((p) => p.id === 'p1-pit-5')!.stones).toBe(1);
  });

  it('player-2 が捕獲できる', () => {
    let state = createInitialMancalaState('cpu');
    state = setCurrentPlayer(state, 'player-2');
    // p2-pit-4 に1石、p2-pit-5 を空にする
    // p2-pit-5 の向かいは p1-pit-0（初期4石）
    state = setPitStones(state, 'p2-pit-4', 1);
    state = setPitStones(state, 'p2-pit-5', 0);

    const nextState = applyMove(state, 'p2-pit-4');
    // p2-pit-4（1石） → p2-pit-5（空）に着地 → 捕獲！
    // p2-store += 1 + 4 = 5
    expect(nextState.board.find((p) => p.id === 'p2-store')!.stones).toBe(5);
    expect(nextState.board.find((p) => p.id === 'p2-pit-5')!.stones).toBe(0);
    expect(nextState.board.find((p) => p.id === 'p1-pit-0')!.stones).toBe(0);
  });
});

// ============================================================
// 6. ゲーム終了判定のテスト
// ============================================================

describe('checkGameEnd：ゲーム終了判定', () => {
  it('player-1 の穴が全て空になるとゲーム終了する', () => {
    let state = createInitialMancalaState('cpu');
    // p1 の穴を全部0にして、p1-pit-5 だけ1石残す
    for (let i = 0; i < 5; i++) {
      state = setPitStones(state, `p1-pit-${i}`, 0);
    }
    state = setPitStones(state, 'p1-pit-5', 1);
    // p1-pit-5（1石）→ p1-store に着地（追加ターン）→ p1 の全穴が空 → 終了
    const nextState = applyMove(state, 'p1-pit-5');
    expect(nextState.status).toBe('finished');
  });

  it('ゲーム終了時、残った石が各プレイヤーのストアに移動する', () => {
    let state = createInitialMancalaState('cpu');
    for (let i = 0; i < 5; i++) {
      state = setPitStones(state, `p1-pit-${i}`, 0);
    }
    state = setPitStones(state, 'p1-pit-5', 1);

    const p2StonesBefore = state.board
      .filter((p) => p.ownerPlayerId === 'player-2' && !p.isStore)
      .reduce((sum, p) => sum + p.stones, 0); // p2 の穴の石合計

    const nextState = applyMove(state, 'p1-pit-5');

    // p2 の小さい穴は全て0になっている
    const p2PocketsAfter = nextState.board.filter(
      (p) => p.ownerPlayerId === 'player-2' && !p.isStore
    );
    for (const pit of p2PocketsAfter) {
      expect(pit.stones).toBe(0);
    }

    // p2 のストアに残り石が入っている
    const p2Store = nextState.board.find((p) => p.id === 'p2-store')!;
    expect(p2Store.stones).toBeGreaterThanOrEqual(p2StonesBefore);
  });
});

// ============================================================
// 7. 勝敗・引き分け判定のテスト
// ============================================================

describe('勝敗・引き分け判定', () => {
  /**
   * テスト用：全ての小さい穴を空にして、ストアに指定の石数をセットし
   * checkGameEnd を呼んで終了状態を作るヘルパー
   */
  function createFinishedState(p1Score: number, p2Score: number): GameState {
    let state = createInitialMancalaState('cpu');
    for (let i = 0; i < 6; i++) {
      state = setPitStones(state, `p1-pit-${i}`, 0);
      state = setPitStones(state, `p2-pit-${i}`, 0);
    }
    state = setPitStones(state, 'p1-store', p1Score);
    state = setPitStones(state, 'p2-store', p2Score);
    return checkGameEnd(state);
  }

  it('player-1 のストアが多ければ player-1 が勝者になる', () => {
    const state = createFinishedState(25, 23);
    expect(state.winnerPlayerId).toBe('player-1');
    expect(state.isDraw).toBe(false);
    expect(state.status).toBe('finished');
  });

  it('player-2 のストアが多ければ player-2 が勝者になる', () => {
    const state = createFinishedState(20, 28);
    expect(state.winnerPlayerId).toBe('player-2');
    expect(state.isDraw).toBe(false);
  });

  it('同数なら引き分けになる', () => {
    const state = createFinishedState(24, 24);
    expect(state.winnerPlayerId).toBeNull();
    expect(state.isDraw).toBe(true);
  });
});
