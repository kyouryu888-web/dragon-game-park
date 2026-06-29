import { describe, expect, it } from 'vitest';
import type { UnoCard, UnoColor, UnoGameState, UnoPlayerConfig } from './unoTypes';
import { createHardDeck, createStandardDeck } from './unoDeck';
import { createInitialUnoState } from './createInitialUnoState';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyPlayCard,
  applySwapPick,
  canPlayCard,
} from './unoRules';
import { getUnoCpuDisplayName } from './unoCpu';
import { getUnoCardScore, getUnoHandScore, getUnoRankings } from './unoScoring';

const players: UnoPlayerConfig[] = [
  { name: 'A', isCpu: false, cpuLevel: 'normal' },
  { name: 'B', isCpu: true, cpuLevel: 'normal' },
];

function numberCard(id: string, color: UnoColor, value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): UnoCard {
  return { id, kind: 'number', color, value };
}

function draw2(id: string, color: UnoColor): UnoCard {
  return { id, kind: 'action', color, symbol: 'draw2' };
}

function baseState(variant: 'standard' | 'hard' = 'standard'): UnoGameState {
  return {
    gameId: 'test',
    variant,
    status: 'playing',
    players: [
      { id: 'player-1', name: 'A', isCpu: false, cpuLevel: 'normal', isEliminated: false },
      { id: 'player-2', name: 'B', isCpu: true, cpuLevel: 'normal', isEliminated: false },
    ],
    hands: {
      'player-1': [],
      'player-2': [],
    },
    deck: [],
    discardPile: [numberCard('top', 'red', 5)],
    currentPlayerId: 'player-1',
    direction: 'clockwise',
    activeColor: 'red',
    pendingDrawCount: 0,
    lastDrawCardValue: 0,
    pendingAction: null,
    winnerPlayerId: null,
    finalScores: null,
    eliminatedScores: {},
    turnCount: 0,
    unoDeclaredIds: [],
  };
}

function baseState3(variant: 'standard' | 'hard' = 'standard'): UnoGameState {
  return {
    ...baseState(variant),
    players: [
      { id: 'player-1', name: 'A', isCpu: false, cpuLevel: 'normal', isEliminated: false },
      { id: 'player-2', name: 'B', isCpu: true, cpuLevel: 'normal', isEliminated: false },
      { id: 'player-3', name: 'C', isCpu: true, cpuLevel: 'normal', isEliminated: false },
    ],
    hands: {
      'player-1': [],
      'player-2': [],
      'player-3': [],
    },
  };
}

describe('UNO deck and setup', () => {
  it('creates standard and hard deck sizes', () => {
    expect(createStandardDeck()).toHaveLength(108);
    expect(createHardDeck()).toHaveLength(144);
  });

  it('deals 7 cards to each player and leaves a top discard', () => {
    const state = createInitialUnoState({ variant: 'standard', playerConfigs: players });
    expect(state.hands['player-1']).toHaveLength(7);
    expect(state.hands['player-2']).toHaveLength(7);
    expect(state.discardPile).toHaveLength(1);
    expect(state.deck).toHaveLength(108 - 15);
  });

  it('has five CPU display names', () => {
    expect(getUnoCpuDisplayName('very-easy')).toBe('ベビードラゴン');
    expect(getUnoCpuDisplayName('easy')).toBe('ドラゴン');
    expect(getUnoCpuDisplayName('normal')).toBe('スーパードラゴン');
    expect(getUnoCpuDisplayName('hard')).toBe('ドラゴンキング');
    expect(getUnoCpuDisplayName('very-hard')).toBe('ゴッドドラゴン');
  });
});

describe('UNO normal rules', () => {
  it('allows same color, same number, and wild cards', () => {
    const state = baseState();
    expect(canPlayCard(state, numberCard('red-1', 'red', 1))).toBe(true);
    expect(canPlayCard(state, numberCard('blue-5', 'blue', 5))).toBe(true);
    expect(canPlayCard(state, numberCard('blue-1', 'blue', 1))).toBe(false);
    expect(canPlayCard(state, { id: 'wild', kind: 'wild', symbol: 'wild' })).toBe(true);
  });

  it('applies standard draw2 immediately and skips the target', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [draw2('d2', 'red'), numberCard('x', 'blue', 1)] },
      deck: [numberCard('draw-a', 'green', 3), numberCard('draw-b', 'yellow', 4)],
    };

    const next = applyPlayCard(state, 'd2');
    expect(next.hands['player-2']).toHaveLength(2);
    expect(next.currentPlayerId).toBe('player-1');
  });

  it('does not draw from the deck while a playable card is available', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [numberCard('playable', 'red', 1)] },
      deck: [numberCard('deck-card', 'blue', 2)],
    };

    const next = applyDrawCard(state);
    expect(next).toBe(state);
    expect(next.hands['player-1']).toHaveLength(1);
    expect(next.deck).toHaveLength(1);
  });

  it('scores remaining cards by official UNO values and ranks by points', () => {
    const wild: UnoCard = { id: 'wild', kind: 'wild', symbol: 'wild' };
    expect(getUnoCardScore(numberCard('n', 'red', 7))).toBe(7);
    expect(getUnoCardScore(draw2('d', 'blue'))).toBe(20);
    expect(getUnoCardScore(wild)).toBe(50);
    expect(getUnoHandScore([numberCard('n2', 'red', 2), draw2('d2', 'green'), wild])).toBe(72);

    let state = baseState('standard');
    state = {
      ...state,
      status: 'finished',
      winnerPlayerId: 'player-1',
      finalScores: { 'player-1': 0, 'player-2': 72 },
      hands: {
        'player-1': [],
        'player-2': [numberCard('n2', 'red', 2), draw2('d2', 'green'), wild],
      },
    };

    const rankings = getUnoRankings(state);
    expect(rankings.map((entry) => [entry.player.id, entry.score])).toEqual([
      ['player-1', 0],
      ['player-2', 72],
    ]);
  });

  it('declares UNO automatically when a player has one card left', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [numberCard('play', 'red', 3), numberCard('last', 'blue', 4)] },
    };

    const next = applyPlayCard(state, 'play');
    expect(next.pendingAction).toBeNull();
    expect(next.unoDeclaredIds).toContain('player-1');
    expect(next.currentPlayerId).toBe('player-2');
  });
});

describe('UNO hard rules', () => {
  it('stacks draw cards by equal or greater value', () => {
    let state = baseState('hard');
    state = {
      ...state,
      pendingDrawCount: 2,
      lastDrawCardValue: 2,
      hands: { ...state.hands, 'player-1': [draw2('stack', 'blue'), numberCard('left', 'green', 4)] },
    };

    const next = applyPlayCard(state, 'stack');
    expect(next.pendingDrawCount).toBe(4);
    expect(next.lastDrawCardValue).toBe(2);
  });

  it('eliminates a player at 25 cards and finishes when one remains', () => {
    let state = baseState('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      pendingDrawCount: 2,
      lastDrawCardValue: 2,
      hands: {
        ...state.hands,
        'player-1': Array.from({ length: 23 }, (_, i) => numberCard(`h-${i}`, 'blue', 1)),
      },
      deck: [numberCard('ko-a', 'green', 2), numberCard('ko-b', 'yellow', 3)],
    };

    const next = applyAcceptDraw(state);
    expect(next.players.find((p) => p.id === 'player-1')?.isEliminated).toBe(true);
    expect(next.status).toBe('finished');
    expect(next.winnerPlayerId).toBe('player-2');
  });

  it('7 swaps hands with a chosen player', () => {
    let state = baseState('hard');
    state = {
      ...state,
      hands: {
        'player-1': [numberCard('seven', 'red', 7), numberCard('mine', 'blue', 1)],
        'player-2': [numberCard('yours', 'green', 2)],
      },
    };

    state = applyPlayCard(state, 'seven');
    expect(state.pendingAction?.kind).toBe('swap-pick');
    const next = applySwapPick(state, 'player-2');
    expect(next.hands['player-1'].map((c) => c.id)).toEqual(['yours']);
    expect(next.hands['player-2'].map((c) => c.id)).toEqual(['mine']);
  });

  it('0 passes every hand to the next player', () => {
    let state = baseState('hard');
    state = {
      ...state,
      hands: {
        'player-1': [numberCard('zero', 'red', 0), numberCard('p1', 'blue', 1)],
        'player-2': [numberCard('p2', 'green', 2)],
      },
    };

    const next = applyPlayCard(state, 'zero');
    expect(next.hands['player-1'].map((c) => c.id)).toEqual(['p2']);
    expect(next.hands['player-2'].map((c) => c.id)).toEqual(['p1']);
  });

  it('color roulette continues until the target color appears', () => {
    let state = baseState('hard');
    state = {
      ...state,
      pendingAction: { kind: 'color-roulette', targetPlayerId: 'player-2', targetColor: 'green' },
      currentPlayerId: 'player-1',
      deck: [numberCard('not-yet', 'blue', 1), numberCard('hit', 'green', 2)],
    };

    state = applyColorRouletteStep(state);
    expect(state.pendingAction?.kind).toBe('color-roulette');
    state = applyColorRouletteStep(state);
    expect(state.pendingAction).toBeNull();
    expect(state.currentPlayerId).toBe('player-1');
  });

  it('color roulette skips eliminated players when choosing the target', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      players: state.players.map((player) =>
        player.id === 'player-2' ? { ...player, isEliminated: true } : player,
      ),
      discardPile: [{ id: 'roulette', kind: 'wild', symbol: 'wild-color-roulette' }],
      pendingAction: { kind: 'color-pick', chooserPlayerId: 'player-1', pendingDrawAfterColor: 0, reverseAfterColor: false },
    };

    const next = applyColorChoice(state, 'yellow');
    expect(next.pendingAction).toEqual({ kind: 'color-roulette', targetPlayerId: 'player-3', targetColor: 'yellow' });
  });

  it('color roulette ends and advances when the target is knocked out', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      pendingAction: { kind: 'color-roulette', targetPlayerId: 'player-2', targetColor: 'yellow' },
      hands: {
        ...state.hands,
        'player-2': Array.from({ length: 24 }, (_, index) => numberCard(`roulette-hand-${index}`, 'blue', 1)),
      },
      deck: [numberCard('ko-draw', 'blue', 2)],
    };

    const next = applyColorRouletteStep(state);
    expect(next.players.find((player) => player.id === 'player-2')?.isEliminated).toBe(true);
    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerId).toBe('player-3');
    expect(next.status).toBe('playing');
  });

  it('wild draw 10 waits for color choice then starts a draw stack', () => {
    let state = baseState('hard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [{ id: 'wd10', kind: 'wild', symbol: 'wild-draw10' }, numberCard('safe', 'red', 2)] },
    };

    state = applyPlayCard(state, 'wd10');
    expect(state.pendingAction?.kind).toBe('color-pick');
    const next = applyColorChoice(state, 'blue');
    expect(next.pendingDrawCount).toBe(10);
    expect(next.currentPlayerId).toBe('player-2');
  });
});
