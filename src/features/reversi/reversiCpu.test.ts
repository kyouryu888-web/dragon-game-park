import { describe, expect, it } from 'vitest';
import { chooseReversiCpuMove } from './reversiCpu';
import {
  applyReversiMove,
  countReversiDiscs,
  createInitialReversiState,
  getValidMoves,
} from './reversiRules';
import type { Disc, ReversiBoard, ReversiCpuLevel, ReversiGameState } from './reversiTypes';

const LEVELS: ReversiCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
const CONFIG = {
  mode: 'cpu' as const,
  name: '挑戦者',
  name2: '',
  cpuLevel: 'normal' as const,
  humanSide: 'black' as const,
};

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

describe('5段階CPUの合法性', () => {
  it.each(LEVELS)('%s は初期盤で必ず合法手を選ぶ', (level) => {
    const state = createInitialReversiState(CONFIG, () => 0.2);
    const move = chooseReversiCpuMove(state, level, () => 0);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board, state.currentColor)).toContainEqual(move);
  });

  it('終了後は全段階が着手しない', () => {
    const state = { ...createInitialReversiState(CONFIG), status: 'finished' as const };
    for (const level of LEVELS) expect(chooseReversiCpuMove(state, level)).toBeNull();
  });

  it('到達可能な連続局面でも全段階が合法手だけを返す', () => {
    const random = seededRandom(42);
    let state = createInitialReversiState(CONFIG, random);
    for (let turn = 0; turn < 16 && state.status === 'playing'; turn += 1) {
      const validMoves = getValidMoves(state.board, state.currentColor);
      for (const level of LEVELS) {
        const move = chooseReversiCpuMove(state, level, () => 0.31);
        expect(move).not.toBeNull();
        expect(validMoves.some((valid) => valid.row === move!.row && valid.col === move!.col)).toBe(true);
      }
      state = applyReversiMove(state, validMoves[Math.floor(random() * validMoves.length)]);
    }
  }, 12_000);

  it('標準以上は取れる角を優先する', () => {
    const board: ReversiBoard = Array.from({ length: 8 }, () => Array<Disc>(8).fill(null));
    board[0][1] = 'white';
    board[0][2] = 'black';
    board[3][3] = 'white';
    board[3][4] = 'black';
    const state: ReversiGameState = { ...createInitialReversiState(CONFIG, () => 0.2), board };
    for (const level of ['normal', 'hard', 'very-hard'] as const) {
      expect(chooseReversiCpuMove(state, level, () => 0)).toMatchObject({ row: 0, col: 0 });
    }
  });

  it('最高難度はパスを含む残り7マスを読み切り、最終石差が最大の手を選ぶ', () => {
    const rows = [
      'WWW.BWB.',
      'BWBBWW.B',
      'BBWWBWB.',
      '.WBWBWBB',
      'BBWBWWWB',
      'BBBWBWBB',
      'BWWWWB.B',
      'BBBBBBB.',
    ];
    const board = rows.map((row) => [...row].map((cell) => {
      if (cell === 'B') return 'black';
      if (cell === 'W') return 'white';
      return null;
    })) as ReversiBoard;
    const state: ReversiGameState = {
      ...createInitialReversiState(CONFIG, () => 0.2),
      board,
      currentColor: 'white',
    };

    expect(chooseReversiCpuMove(state, 'very-hard', () => 0)).toMatchObject({ row: 3, col: 0 });
  });
});

describe('CPU同士の全局シミュレーション', () => {
  it('各難易度を先手・後手にして最大60着手以内に必ず終局する', () => {
    for (let gameIndex = 0; gameIndex < LEVELS.length; gameIndex += 1) {
      const random = seededRandom(100 + gameIndex);
      const firstLevel = LEVELS[gameIndex % LEVELS.length];
      const secondLevel = LEVELS[(gameIndex + 2) % LEVELS.length];
      let state = createInitialReversiState(CONFIG, random);
      let movesMade = 0;

      while (state.status === 'playing') {
        const before = countReversiDiscs(state.board);
        const level = state.currentColor === 'black' ? firstLevel : secondLevel;
        const move = chooseReversiCpuMove(state, level, random);
        expect(move).not.toBeNull();
        const valid = getValidMoves(state.board, state.currentColor);
        expect(valid.some((candidate) => candidate.row === move!.row && candidate.col === move!.col)).toBe(true);
        state = applyReversiMove(state, move!);
        const after = countReversiDiscs(state.board);
        expect(after.black + after.white).toBe(before.black + before.white + 1);
        expect(after.black + after.white + after.empty).toBe(64);
        movesMade += 1;
        expect(movesMade).toBeLessThanOrEqual(60);
      }

      expect(getValidMoves(state.board, 'black')).toEqual([]);
      expect(getValidMoves(state.board, 'white')).toEqual([]);
      expect(state.winner).not.toBeNull();
    }
  }, 20_000);
});
