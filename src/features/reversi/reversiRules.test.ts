import { describe, expect, it } from 'vitest';
import {
  applyReversiMove,
  countReversiDiscs,
  createInitialReversiBoard,
  createInitialReversiState,
  getFlipsForMove,
  getReversiWinner,
  getValidMoves,
  placeDisc,
} from './reversiRules';
import type { Disc, DiscColor, ReversiBoard, ReversiGameState } from './reversiTypes';

const CONFIG = {
  mode: 'cpu' as const,
  name: '黒竜',
  name2: '白竜',
  cpuLevel: 'normal' as const,
  humanSide: 'black' as const,
};

function emptyBoard(): ReversiBoard {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

function stateWith(board: ReversiBoard, currentColor: DiscColor = 'black'): ReversiGameState {
  return {
    ...createInitialReversiState(CONFIG, () => 0.2),
    board,
    currentColor,
  };
}

describe('リバーシ初期盤', () => {
  it('8x8・中央4石・黒先手・合法手4箇所で始まる', () => {
    const state = createInitialReversiState(CONFIG, () => 0.2);
    expect(state.board).toHaveLength(8);
    expect(state.board.every((row) => row.length === 8)).toBe(true);
    expect(countReversiDiscs(state.board)).toEqual({ black: 2, white: 2, empty: 60 });
    expect(state.currentColor).toBe('black');
    expect(getValidMoves(state.board, 'black').map(({ row, col }) => [row, col])).toEqual([
      [2, 3], [3, 2], [4, 5], [5, 4],
    ]);
  });

  it('初期盤を毎回独立した配列で作る', () => {
    const first = createInitialReversiBoard();
    const second = createInitialReversiBoard();
    first[0][0] = 'black';
    expect(second[0][0]).toBeNull();
  });
});

describe('8方向の合法手と反転', () => {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1],
  ] as const;

  for (const [rowDelta, colDelta] of directions) {
    it(`方向 ${rowDelta},${colDelta} の石だけを返す`, () => {
      const board = emptyBoard();
      board[3 + rowDelta][3 + colDelta] = 'white';
      board[3 + rowDelta * 2][3 + colDelta * 2] = 'black';
      expect(getFlipsForMove(board, 'black', 3, 3)).toEqual([
        { row: 3 + rowDelta, col: 3 + colDelta },
      ]);
    });
  }

  it('8方向を同時に返せる', () => {
    const board = emptyBoard();
    for (const [rowDelta, colDelta] of directions) {
      board[3 + rowDelta][3 + colDelta] = 'white';
      board[3 + rowDelta * 2][3 + colDelta * 2] = 'black';
    }
    expect(getFlipsForMove(board, 'black', 3, 3)).toHaveLength(8);
  });

  it('途中が空・味方だけ・自石で閉じない列は返せない', () => {
    const board = emptyBoard();
    board[3][4] = 'white';
    board[3][6] = 'black';
    board[4][3] = 'black';
    board[5][3] = 'black';
    board[2][3] = 'white';
    expect(getFlipsForMove(board, 'black', 3, 3)).toEqual([]);
  });

  it('盤外または埋まっているマスは不正手', () => {
    const board = createInitialReversiBoard();
    expect(getFlipsForMove(board, 'black', -1, 3)).toEqual([]);
    expect(getFlipsForMove(board, 'black', 3, 3)).toEqual([]);
  });
});

describe('着手・パス・終局', () => {
  it('合法手で総石数が1増え、入力盤を破壊しない', () => {
    const board = createInitialReversiBoard();
    const snapshot = board.map((row) => [...row]);
    const placed = placeDisc(board, 'black', { row: 2, col: 3 })!;
    expect(countReversiDiscs(placed.board)).toEqual({ black: 4, white: 1, empty: 59 });
    expect(board).toEqual(snapshot);
    expect(placed.flips).toEqual([{ row: 3, col: 3 }]);
  });

  it('不正手は状態オブジェクトを変えない', () => {
    const state = createInitialReversiState(CONFIG, () => 0.2);
    expect(applyReversiMove(state, { row: 0, col: 0 })).toBe(state);
  });

  it('相手だけ置けない場合は自動パスして同じ色の手番を続ける', () => {
    const board: ReversiBoard = Array.from({ length: 8 }, () => Array<Disc>(8).fill('black'));
    board[0] = [null, 'white', 'black', null, 'white', 'black', 'black', 'black'];
    board[7][7] = null;
    const next = applyReversiMove(stateWith(board), { row: 0, col: 0 });
    expect(next.status).toBe('playing');
    expect(next.currentColor).toBe('black');
    expect(next.passedColor).toBe('white');
    expect(getValidMoves(next.board, 'black').map(({ row, col }) => [row, col])).toContainEqual([0, 3]);
    expect(getValidMoves(next.board, 'white')).toEqual([]);
  });

  it('両者とも置けなくなると空きが残っていても終了する', () => {
    const board: ReversiBoard = Array.from({ length: 8 }, () => Array<Disc>(8).fill('black'));
    board[0] = [null, 'white', 'black', 'black', 'black', 'black', 'black', 'black'];
    board[7][7] = null;
    const next = applyReversiMove(stateWith(board), { row: 0, col: 0 });
    expect(next.status).toBe('finished');
    expect(next.winner).toBe('black');
    expect(countReversiDiscs(next.board).empty).toBe(1);
  });

  it('盤面が満杯なら即終了する', () => {
    const board: ReversiBoard = Array.from({ length: 8 }, () => Array<Disc>(8).fill('black'));
    board[0] = [null, 'white', 'black', 'black', 'black', 'black', 'black', 'black'];
    const next = applyReversiMove(stateWith(board), { row: 0, col: 0 });
    expect(next.status).toBe('finished');
    expect(countReversiDiscs(next.board).empty).toBe(0);
  });

  it('終了後の操作は無視する', () => {
    const state = { ...createInitialReversiState(CONFIG, () => 0.2), status: 'finished' as const };
    expect(applyReversiMove(state, { row: 2, col: 3 })).toBe(state);
  });
});

describe('勝敗集計', () => {
  it('黒・白・引き分けを盤面だけから判定する', () => {
    const blackWin = Array.from({ length: 8 }, () => Array<Disc>(8).fill('black'));
    const whiteWin = Array.from({ length: 8 }, () => Array<Disc>(8).fill('white'));
    const draw = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => (row + col) % 2 === 0 ? 'black' : 'white')) as ReversiBoard;
    expect(getReversiWinner(blackWin)).toBe('black');
    expect(getReversiWinner(whiteWin)).toBe('white');
    expect(getReversiWinner(draw)).toBe('draw');
  });
});
