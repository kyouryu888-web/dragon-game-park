import { describe, it, expect } from 'vitest';
import type { CpuLevel, GameState, PlayerId, Point } from './backgammonTypes';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import {
  applyMove,
  expandDice,
  getLegalMoves,
  passTurn,
  rollDice,
  rollOpening,
} from './backgammonRules';
import {
  chooseCpuMoveSequence,
  getCpuDisplayName,
  shouldCpuAcceptDouble,
  shouldCpuOfferDouble,
} from './backgammonCpu';

function makeState(
  placements: { index: number; owner: PlayerId; count: number }[],
  overrides: Partial<GameState> = {},
): GameState {
  const base = createInitialBackgammonState();
  const points: Point[] = Array.from({ length: 24 }, () => null);
  for (const p of placements) {
    points[p.index] = { owner: p.owner, count: p.count };
  }
  return { ...base, points, phase: 'moving', currentPlayer: 'white', ...overrides };
}

describe('getCpuDisplayName', () => {
  it('5段階すべてに名前がある', () => {
    const levels: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
    for (const level of levels) {
      expect(getCpuDisplayName(level).length).toBeGreaterThan(0);
    }
  });
});

describe('chooseCpuMoveSequence', () => {
  it('全難易度で合法な手順を返す（初期配置から）', () => {
    const levels: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
    for (const level of levels) {
      const state = { ...createInitialBackgammonState(), phase: 'moving' as const, dice: expandDice(3, 1) };
      const seq = chooseCpuMoveSequence(state, level);
      expect(seq).not.toBeNull();
      expect(seq!.moves.length).toBe(2);
    }
  });

  it('打てる手がなければ null を返す', () => {
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 2 },
        { index: 7, owner: 'black', count: 2 },
        { index: 4, owner: 'black', count: 2 },
      ],
      { dice: [3, 6] },
    );
    // 10-3=7 ブロック、10-6=4 ブロック
    expect(chooseCpuMoveSequence(state, 'normal')).toBeNull();
  });

  it('hard はヒットできる手を選ぶ（明らかに有利な手の選好）', () => {
    // white 10 → 7 で black のブロットをヒットできる
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 3 },
        { index: 7, owner: 'black', count: 1 },
        { index: 23, owner: 'black', count: 5 },
      ],
      { dice: [3, 1] },
    );
    const seq = chooseCpuMoveSequence(state, 'hard', () => 0.5);
    expect(seq!.moves.some((m) => m.to === 7 && m.die === 3)).toBe(true);
  });
});

describe('ゲーム完走スモークテスト', () => {
  it('CPU同士の対局が必ず終局する（5ゲーム）', () => {
    // 再現可能な擬似乱数（mulberry32）
    function makeRng(seed: number) {
      return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const levels: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
    for (let game = 0; game < 5; game++) {
      const rng = makeRng(1000 + game);
      const level = levels[game];
      let state = createInitialBackgammonState();
      let guard = 0;
      while (state.phase !== 'finished') {
        expect(guard++).toBeLessThan(5000);
        if (state.phase === 'opening-roll') {
          state = rollOpening(state, rng);
        } else if (state.phase === 'rolling') {
          state = rollDice(state, rng);
        } else if (state.phase === 'moving') {
          if (getLegalMoves(state).length === 0) {
            state = passTurn(state);
          } else {
            const seq = chooseCpuMoveSequence(state, level, rng);
            expect(seq).not.toBeNull();
            state = applyMove(state, seq!.moves[0]);
          }
        }
      }
      expect(state.winner).not.toBeNull();
      expect(state.borneOff[state.winner!]).toBe(15);
      expect(state.resultPoints).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('ダブリングキューブの判断', () => {
  it('大差でリードしていれば normal 以上はダブルを提案する', () => {
    // white が大きくリード（ピップ差が大）
    const state = makeState(
      [
        { index: 2, owner: 'white', count: 15 },  // white 残りわずか
        { index: 3, owner: 'black', count: 15 },  // black はまだ遠い（3→23 方向）
      ],
      { phase: 'rolling', currentPlayer: 'white' },
    );
    expect(shouldCpuOfferDouble(state, 'normal')).toBe(true);
    expect(shouldCpuOfferDouble(state, 'very-easy')).toBe(false); // 弱CPUは使わない
  });

  it('互角ならダブルは提案しない', () => {
    const state = { ...createInitialBackgammonState(), phase: 'rolling' as const };
    expect(shouldCpuOfferDouble(state, 'very-hard')).toBe(false);
  });

  it('絶望的に遅れているときは降りる', () => {
    const state = makeState(
      [
        { index: 2, owner: 'white', count: 15 },   // white はほぼ上がり
        { index: 3, owner: 'black', count: 15 },   // black は大きく遅れ
      ],
      { phase: 'double-offered', currentPlayer: 'white', doubleOfferedBy: 'white' },
    );
    expect(shouldCpuAcceptDouble(state, 'black', 'hard')).toBe(false);
    expect(shouldCpuAcceptDouble(state, 'black', 'very-easy')).toBe(true); // 最弱は何でも受ける
  });
});
