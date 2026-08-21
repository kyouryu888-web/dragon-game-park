import { describe, expect, it } from 'vitest';
import { createInitialUnoState } from './createInitialUnoState';
import { chooseUnoCpuAction } from './unoCpu';
import { isUnoCardAllowedInVariant } from './unoCardUtils';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyPassDrawnCard,
  applyPlayCard,
  applyStarterDraw,
  applyStartGame,
  applySwapPick,
  applyUnoDeclaration,
} from './unoRules';
import type { UnoGameState, UnoPlayerId, UnoVariant } from './unoTypes';

function makeRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function getActingPlayerId(state: UnoGameState): UnoPlayerId {
  const pending = state.pendingAction;
  if (pending?.kind === 'color-pick') return pending.chooserPlayerId;
  if (pending?.kind === 'swap-pick') return pending.swapperPlayerId;
  if (pending?.kind === 'uno-window') return pending.playerWithOneCard;
  if (pending?.kind === 'drawn-card-play') return pending.playerId;
  return state.currentPlayerId;
}

function advanceCpuGame(state: UnoGameState): UnoGameState {
  if (state.status === 'deciding-starter') return applyStarterDraw(state);
  if (state.status === 'starter-ready') return applyStartGame(state);

  const playerId = getActingPlayerId(state);
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`操作プレイヤーが見つかりません: ${playerId}`);

  const action = chooseUnoCpuAction(state, playerId, player.cpuLevel ?? 'normal');
  if (!action) throw new Error(`CPU操作を決められません: ${playerId}`);

  switch (action.type) {
    case 'play-card':
      return applyPlayCard(state, action.cardId);
    case 'draw-card':
      return applyDrawCard(state);
    case 'pass-drawn-card':
      return applyPassDrawnCard(state);
    case 'accept-draw':
      return applyAcceptDraw(state);
    case 'choose-color':
      return applyColorChoice(state, action.color);
    case 'choose-swap':
      return applySwapPick(state, action.targetPlayerId);
    case 'roulette-step':
      return applyColorRouletteStep(state);
    case 'declare-uno':
      return applyUnoDeclaration(state, action.playerId);
  }
}

function expectStateInvariants(state: UnoGameState, expectedCardCount: number, step: number): void {
  const physicalCards = [
    ...state.deck,
    ...state.discardPile,
    ...Object.values(state.hands).flat(),
  ];
  const ids = physicalCards.map((card) => card.id);

  expect(ids.length, `step ${step}: カード総数`).toBe(expectedCardCount);
  expect(new Set(ids).size, `step ${step}: カードID重複`).toBe(ids.length);
  expect(
    physicalCards.every((card) => isUnoCardAllowedInVariant(card, state.variant)),
    `step ${step}: モード外カード`,
  ).toBe(true);

  if (state.status === 'playing') {
    expect(
      state.players.find((player) => player.id === state.currentPlayerId)?.isEliminated,
      `step ${step}: 脱落者の手番`,
    ).not.toBe(true);
  }

  const pendingAction = state.pendingAction;
  if (pendingAction?.kind === 'drawn-card-play') {
    expect(
      state.hands[pendingAction.playerId]?.some((card) => card.id === pendingAction.cardId),
      `step ${step}: 引いたカードの操作待ち`,
    ).toBe(true);
  }
}

function runCpuGame(variant: UnoVariant, seed: number, playerCount = 4): UnoGameState {
  const originalRandom = Math.random;
  Math.random = makeRandom(seed);

  try {
    let state = createInitialUnoState({
      variant,
      playerConfigs: Array.from({ length: playerCount }, (_, index) => ({
        name: `CPU ${index + 1}`,
        isCpu: true,
        cpuLevel: 'very-hard',
      })),
    });
    const expectedCardCount = variant === 'standard' ? 108 : 144;

    for (let step = 0; step < 5_000; step++) {
      expectStateInvariants(state, expectedCardCount, step);
      if (state.status === 'finished') return state;

      const next = advanceCpuGame(state);
      expect(next, `step ${step}: 状態が進みません`).not.toBe(state);
      state = next;
    }

    throw new Error(`${variant}版CPU対局が5000操作以内に終了しませんでした`);
  } finally {
    Math.random = originalRandom;
  }
}

describe('UNO full-game simulations', () => {
  for (const variant of ['standard', 'hard'] as const) {
    for (const seed of [1, 7, 42]) {
      it(`${variant} finishes without corrupting cards (seed ${seed})`, () => {
        const finished = runCpuGame(variant, seed);
        expect(finished.status).toBe('finished');
        expect(finished.winnerPlayerId).not.toBeNull();
        expect(finished.finalScores).not.toBeNull();
      });
    }
  }

  it.each([
    ['standard', 10, 99],
    ['hard', 6, 99],
  ] as const)('%s supports a complete maximum-player CPU game', (variant, playerCount, seed) => {
    const finished = runCpuGame(variant, seed, playerCount);
    expect(finished.status).toBe('finished');
    expect(finished.players).toHaveLength(playerCount);
  });
});
