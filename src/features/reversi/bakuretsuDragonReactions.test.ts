import { describe, expect, it } from 'vitest';
import { decideDragonReaction } from '../../components/dragonReactions';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { applyMove } from './bakuretsu/engine.ts';
import { emptyCell, idx } from './bakuretsu/rules.ts';
import type { GameState, PlayerId, SpecialType } from './bakuretsu/types.ts';
import { createBakuretsuPlaybackSteps } from './bakuretsuPlayback';
import { bakuretsuCinematicImage, bakuretsuDragonCpu, detectBakuretsuDragonReactionForStep } from './bakuretsuDragonReactions';
import { DEFAULT_BAKURETSU_REVERSI_CONFIG } from './bakuretsuUi';

function blank(): GameState {
  return {
    board: Array.from({ length: 64 }, emptyCell), currentTurn: 'BLACK',
    hands: {
      BLACK: { playerId: 'BLACK', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
      WHITE: { playerId: 'WHITE', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
    },
    activeQuestionCount: 0, status: 'PLAYING', passStreak: 0, moveNo: 0,
  };
}

function put(state: GameState, x: number, y: number, owner: PlayerId, specialType: SpecialType = 'NONE') {
  state.board[idx(x, y)] = {
    state: 'FACEUP', owner, specialType, durability: 0, isQueued: false, activated: false,
  };
}

const cpu = bakuretsuDragonCpu(DEFAULT_BAKURETSU_REVERSI_CONFIG, 'BLACK')!;

describe('爆裂リバーシーのドラゴン演出', () => {
  it('爆発を解決フレームまで予告せず、同じ保持フレームで再発火しない', () => {
    const previous = blank();
    put(previous, 2, 4, 'BLACK');
    put(previous, 3, 4, 'WHITE');
    put(previous, 4, 4, 'WHITE', 'BOMB');
    const result = applyMove(previous, { x: 5, y: 4, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const steps = createBakuretsuPlaybackSteps(previous, result);
    const index = steps.findIndex(step => step.phase === 'special-resolve' && step.special === 'BOMB');
    const base = { matchId: 'test', moveNo: result.state.moveNo, cpu };
    const at = (stepIndex: number) => detectBakuretsuDragonReactionForStep({
      ...base, stepIndex, step: steps[stepIndex],
      beforeBoard: stepIndex === 0 ? previous.board : steps[stepIndex - 1].board,
    });

    expect(index).toBeGreaterThan(0);
    expect(steps[index - 1].phase).toBe('special-highlight');
    expect(at(index - 1)).toBeNull();
    expect(at(index)).toMatchObject({ kind: expect.stringMatching(/^bomb:/), factLabel: expect.stringMatching(/^爆弾で\d+枚破壊$/) });
    expect(at(index + 1)).toBeNull();
    expect(bakuretsuCinematicImage(steps[index - 1], result.state, cpu)).toMatch(/\.webp(?:\?|$)/);
  });

  it('感染後に公開された変化だけで反応を決め、手札内容には依存しない', () => {
    const previous = blank();
    put(previous, 4, 3, 'BLACK');
    put(previous, 4, 4, 'WHITE', 'INFECT');
    const result = applyMove(previous, { x: 4, y: 5, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const steps = createBakuretsuPlaybackSteps(previous, result);
    const index = steps.findIndex(step => step.phase === 'special-resolve' && step.special === 'INFECT');
    const context = (stepIndex: number) => ({
      matchId: 'shared-match', moveNo: result.state.moveNo, stepIndex,
      step: steps[stepIndex], beforeBoard: stepIndex === 0 ? previous.board : steps[stepIndex - 1].board, cpu,
    });

    expect(index).toBeGreaterThan(0);
    expect(detectBakuretsuDragonReactionForStep(context(index - 1))).toBeNull();
    const publicEvent = detectBakuretsuDragonReactionForStep(context(index));
    expect(publicEvent).toMatchObject({ kind: expect.stringMatching(/^infection:/), factLabel: '感染で2枚奪取' });
    expect(detectBakuretsuDragonReactionForStep(context(index + 1))).toBeNull();
    expect(decideDragonReaction(publicEvent!)).toEqual(decideDragonReaction({ ...publicEvent! }));
    expect(context(index)).not.toHaveProperty('hands');
  });

  it('最終フレームだけが確定勝敗を公開し、オンライン人間対戦にはCPU画像を出さない', () => {
    const previous = blank();
    put(previous, 2, 4, 'BLACK');
    put(previous, 3, 4, 'WHITE');
    const result = applyMove(previous, { x: 4, y: 4, kind: 'NORMAL' }, DEFAULT_CONFIG);
    const steps = createBakuretsuPlaybackSteps(previous, result);
    const final = steps.at(-1)!;
    const context = { matchId: 'test', moveNo: result.state.moveNo, stepIndex: steps.length - 1, step: final,
      beforeBoard: steps.at(-2)?.board ?? previous.board, cpu, winner: 'WHITE' as const };

    expect(detectBakuretsuDragonReactionForStep({ ...context, winner: undefined })).toBeNull();
    expect(detectBakuretsuDragonReactionForStep(context)).toMatchObject({ kind: 'result', outcome: 'defeat', cutIn: 'defeat' });
    expect(bakuretsuDragonCpu({ ...DEFAULT_BAKURETSU_REVERSI_CONFIG, mode: 'online' }, null)).toBeNull();
    expect(bakuretsuCinematicImage(final, result.state, null)).toBeUndefined();
  });
});
