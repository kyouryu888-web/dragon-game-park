import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { applyMove } from './bakuretsu/engine.ts';
import { emptyCell, idx, initGame, makeRng } from './bakuretsu/rules.ts';
import type { GameState, PlayerId, SpecialType } from './bakuretsu/types.ts';
import {
  createBakuretsuPlaybackSteps,
  getBakuretsuStepDuration,
  playbackFlipOrder,
} from './bakuretsuPlayback';
import { chooseBakuretsuAutoMove, forceAutoMoveLoss, neutralWallBlockers } from './bakuretsuUi';

function blank(turn: 'BLACK' | 'WHITE' = 'BLACK'): GameState {
  return {
    board: Array.from({ length: 64 }, emptyCell),
    currentTurn: turn,
    hands: {
      BLACK: { playerId: 'BLACK', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
      WHITE: { playerId: 'WHITE', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
    },
    activeQuestionCount: 0,
    status: 'PLAYING',
    passStreak: 0,
    moveNo: 0,
  };
}

function put(state: GameState, x: number, y: number, owner: PlayerId, specialType: SpecialType = 'NONE', durability = 0) {
  state.board[idx(x, y)] = {
    state: 'FACEUP', owner, specialType, durability, isQueued: false, activated: false,
  };
}

describe('爆裂リバーシーの表示タイムライン', () => {
  it('PLACE→FLIP→特殊発動→最終盤面の順で、FLIP.idxsをそのまま使う', () => {
    const state = blank();
    put(state, 2, 4, 'BLACK');
    put(state, 3, 4, 'WHITE');
    put(state, 4, 4, 'WHITE', 'BOMB');
    const result = applyMove(state, { x: 5, y: 4, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const steps = createBakuretsuPlaybackSteps(state, result);
    const flip = result.events.find((event) => event.t === 'FLIP');

    expect(steps[0].phase).toBe('placing');
    expect(playbackFlipOrder(steps)).toEqual(flip?.idxs);
    expect(steps.findIndex((step) => step.phase === 'flipping')).toBeLessThan(
      steps.findIndex((step) => step.phase === 'special-highlight'),
    );
    const bomb = result.events.find((event) => event.t === 'BOMB');
    const bombResolve = steps.find((step) => step.phase === 'special-resolve' && step.special === 'BOMB');
    expect(bombResolve?.label).toBe(`爆弾発動 → ${(bomb?.destroyed.length ?? 0) + (bomb?.chained.length ?? 0) + 1}枚破壊`);
    expect(steps.at(-1)?.phase).toBe('final');
    expect(steps.at(-1)?.board).toEqual(result.state.board);
  });

  it('同一深度の発火元をエンジンのイベント列順で1つずつ保持する', () => {
    const state = blank();
    put(state, 1, 4, 'BLACK');
    put(state, 2, 4, 'WHITE', 'SHIELD', 1);
    put(state, 3, 4, 'WHITE');
    put(state, 4, 4, 'WHITE', 'BOMB');
    put(state, 3, 3, 'BLACK', 'BOMB');
    for (let i = 0; i < 20; i += 1) put(state, i % 8, 7 - ((i / 8) | 0), 'WHITE');
    const result = applyMove(state, { x: 5, y: 4, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const expected = result.events.filter((event) => event.t === 'BOMB' || event.t === 'INFECT').map((event) => event.idx);
    const actual = createBakuretsuPlaybackSteps(state, result)
      .filter((step) => step.phase === 'special-highlight')
      .map((step) => step.activeIndices[0]);
    expect(actual).toEqual(expected);
  });

  it('盾は反転せず通常コマ化する専用フレームを持つ', () => {
    const state = blank();
    put(state, 2, 4, 'BLACK');
    put(state, 3, 4, 'WHITE', 'SHIELD', 1);
    put(state, 4, 4, 'WHITE');
    const result = applyMove(state, { x: 5, y: 4, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const steps = createBakuretsuPlaybackSteps(state, result);
    const shield = steps.find((step) => step.phase === 'shield');
    expect(shield?.label).toBe('盾 耐久1消費 → 通常コマ化');
    expect(shield?.board[idx(3, 4)]).toMatchObject({ owner: 'WHITE', specialType: 'NONE', durability: 0 });
    expect(steps.findIndex((step) => step.phase === 'flipping')).toBeLessThan(
      steps.findIndex((step) => step.phase === 'shield'),
    );
  });

  it('感染は奪取を先に表示し、感染源自身は相手色の通常コマにする', () => {
    const state = blank();
    put(state, 4, 3, 'BLACK');
    put(state, 4, 4, 'WHITE', 'INFECT');
    const result = applyMove(state, { x: 4, y: 5, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const infection = createBakuretsuPlaybackSteps(state, result)
      .find((step) => step.phase === 'special-resolve' && step.special === 'INFECT');
    expect(infection?.label).toBe('感染 → 2枚奪取');
    expect(infection?.board[idx(4, 3)].owner).toBe('WHITE');
    expect(infection?.board[idx(4, 4)]).toMatchObject({ owner: 'BLACK', specialType: 'NONE' });
  });

  it('低速・標準・高速と低モーションでも段階を0msにしない', () => {
    const state = initGame(DEFAULT_CONFIG, makeRng(1));
    const result = applyMove(state, { x: 3, y: 2, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const step = createBakuretsuPlaybackSteps(state, result)[0];
    expect(getBakuretsuStepDuration(step, 'slow', false)).toBe(500);
    expect(getBakuretsuStepDuration(step, 'normal', false)).toBe(250);
    expect(getBakuretsuStepDuration(step, 'fast', false)).toBe(125);
    expect(getBakuretsuStepDuration(step, 'fast', true)).toBeGreaterThan(0);
  });
});

describe('爆裂リバーシーのUI補助ルール', () => {
  it('時間切れ自動着手は特殊コマを使わず、最小反転→y→x順を選ぶ', () => {
    const state = initGame(DEFAULT_CONFIG, makeRng(1));
    expect(chooseBakuretsuAutoMove(state)).toEqual({ x: 3, y: 2, kind: 'NORMAL' });
  });

  it('自石の端になれない中立コマを壁として検出する', () => {
    const state = blank();
    put(state, 3, 4, 'WHITE');
    put(state, 2, 4, 'NONE', 'NEUTRAL');
    put(state, 1, 4, 'BLACK');
    expect(neutralWallBlockers(state.board, 4, 4, 'BLACK')).toEqual([idx(2, 4)]);
  });

  it('5回目の自動着手は手を打った側の敗北として確定する', () => {
    const state = initGame(DEFAULT_CONFIG, makeRng(1));
    const result = applyMove(state, { x: 3, y: 2, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const forced = forceAutoMoveLoss(result, 'BLACK');
    expect(forced.state).toMatchObject({ status: 'FINISHED', endReason: 'ABANDON', winner: 'WHITE' });
    expect(forced.events.at(-1)).toMatchObject({ t: 'END', reason: 'ABANDON', winner: 'WHITE' });
  });
});
