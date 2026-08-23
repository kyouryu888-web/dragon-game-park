import { describe, expect, it } from 'vitest';
import type { UnoCard, UnoColor, UnoGameState, UnoPlayerConfig } from './unoTypes';
import { createHardDeck, createStandardDeck } from './unoDeck';
import { createInitialUnoState } from './createInitialUnoState';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyInfiniteDraw,
  applyPassDrawnCard,
  applyPlayCard,
  applyStarterDraw,
  applyStartGame,
  applySwapPick,
  canPlayCard,
  getCardDrawValue,
  getPlayableCards,
  sanitizeUnoStateForVariant,
} from './unoRules';
import { getUnoCpuDisplayName } from './unoCpu';
import { getUnoCardScore, getUnoHandScore, getUnoRankings } from './unoScoring';
import { isUnoCardAllowedInVariant, sortUnoHandByColor } from './unoCardUtils';

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

function actionCard(id: string, color: UnoColor, symbol: 'skip' | 'reverse'): UnoCard {
  return { id, kind: 'action', color, symbol };
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
    starterDraws: [],
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

  it('does not include hard-only cards in the standard deck', () => {
    expect(createStandardDeck().every((card) => isUnoCardAllowedInVariant(card, 'standard'))).toBe(true);
    expect(createHardDeck().some((card) => !isUnoCardAllowedInVariant(card, 'standard'))).toBe(true);
  });

  it('deals 7 cards to each player and leaves a top discard', () => {
    const state = createInitialUnoState({ variant: 'standard', playerConfigs: players });
    expect(state.status).toBe('deciding-starter');
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

  it('starts a standard draw2 stack and lets the target accept it', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [draw2('d2', 'red'), numberCard('x', 'blue', 1)] },
      deck: [numberCard('draw-a', 'green', 3), numberCard('draw-b', 'yellow', 4)],
    };

    const pending = applyPlayCard(state, 'd2');
    expect(pending.pendingDrawCount).toBe(2);
    expect(pending.currentPlayerId).toBe('player-2');

    const next = applyAcceptDraw(pending);
    expect(next.hands['player-2']).toHaveLength(2);
    expect(next.pendingDrawCount).toBe(0);
    expect(next.currentPlayerId).toBe('player-1');
  });

  it('applies standard draw2 before finishing when it is the last card', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: {
        ...state.hands,
        'player-1': [draw2('last-draw2', 'red')],
        'player-2': [numberCard('target-card', 'blue', 7)],
      },
      deck: [numberCard('penalty-a', 'green', 3), numberCard('penalty-b', 'yellow', 4)],
    };

    const next = applyPlayCard(state, 'last-draw2');
    expect(next.status).toBe('finished');
    expect(next.winnerPlayerId).toBe('player-1');
    expect(next.hands['player-2'].map((card) => card.id)).toEqual([
      'target-card',
      'penalty-a',
      'penalty-b',
    ]);
    expect(next.finalScores?.['player-2']).toBe(14);
  });

  it('applies standard wild draw4 before finishing when it is the last card', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      hands: {
        ...state.hands,
        'player-1': [{ id: 'last-wild-draw4', kind: 'wild', symbol: 'wild-draw4' }],
        'player-2': [numberCard('target-card', 'blue', 1)],
      },
      deck: [
        numberCard('penalty-a', 'green', 1),
        numberCard('penalty-b', 'green', 2),
        numberCard('penalty-c', 'green', 3),
        numberCard('penalty-d', 'green', 4),
      ],
    };

    const next = applyPlayCard(state, 'last-wild-draw4');
    expect(next.status).toBe('finished');
    expect(next.winnerPlayerId).toBe('player-1');
    expect(next.pendingAction).toBeNull();
    expect(next.hands['player-2']).toHaveLength(5);
    expect(next.hands['player-3']).toHaveLength(0);
  });

  it('moves past a standard draw target after they accept the cards', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [draw2('d2', 'red'), numberCard('left', 'blue', 1)] },
      deck: [numberCard('penalty-a', 'green', 3), numberCard('penalty-b', 'yellow', 4)],
    };

    const pending = applyPlayCard(state, 'd2');
    expect(pending.currentPlayerId).toBe('player-2');
    const next = applyAcceptDraw(pending);
    expect(next.hands['player-2']).toHaveLength(2);
    expect(next.currentPlayerId).toBe('player-3');
  });

  it.each([
    ['skip clockwise', 'skip', 'clockwise', 'player-3', 'clockwise'],
    ['skip counterclockwise', 'skip', 'counterclockwise', 'player-2', 'counterclockwise'],
    ['reverse clockwise', 'reverse', 'clockwise', 'player-3', 'counterclockwise'],
    ['reverse counterclockwise', 'reverse', 'counterclockwise', 'player-2', 'clockwise'],
  ] as const)('%s advances to the correct player', (_label, symbol, direction, expectedPlayerId, expectedDirection) => {
    let state = baseState3('standard');
    const card = actionCard('action', 'red', symbol);
    state = {
      ...state,
      direction,
      hands: { ...state.hands, 'player-1': [card, numberCard('left', 'blue', 1)] },
    };

    const next = applyPlayCard(state, card.id);
    expect(next.currentPlayerId).toBe(expectedPlayerId);
    expect(next.direction).toBe(expectedDirection);
  });

  it('starts a wild draw4 stack after color selection', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      hands: {
        ...state.hands,
        'player-1': [
          { id: 'wild-draw4', kind: 'wild', symbol: 'wild-draw4' },
          numberCard('left', 'blue', 1),
        ],
      },
      deck: [
        numberCard('penalty-a', 'red', 1),
        numberCard('penalty-b', 'yellow', 2),
        numberCard('penalty-c', 'green', 3),
        numberCard('penalty-d', 'blue', 4),
      ],
    };

    state = applyPlayCard(state, 'wild-draw4');
    expect(state.pendingAction?.kind).toBe('color-pick');
    const pending = applyColorChoice(state, 'blue');
    expect(pending.pendingDrawCount).toBe(4);
    expect(pending.currentPlayerId).toBe('player-2');

    const next = applyAcceptDraw(pending);
    expect(next.hands['player-2']).toHaveLength(4);
    expect(next.currentPlayerId).toBe('player-3');
    expect(next.activeColor).toBe('blue');
  });

  it('decides the starter by drawing number values before play begins', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      status: 'deciding-starter',
      deck: [
        numberCard('p1-draw', 'red', 5),
        { id: 'p2-draw', kind: 'action', color: 'blue', symbol: 'reverse' },
        numberCard('p3-draw', 'green', 7),
      ],
    };

    const next = applyStarterDraw(state);
    expect(next.status).toBe('starter-ready');
    expect(next.currentPlayerId).toBe('player-3');
    expect(next.starterDraws.map((draw) => [draw.playerId, draw.value])).toEqual([
      ['player-1', 5],
      ['player-2', 0],
      ['player-3', 7],
    ]);
  });

  it('starts the game only after the starter draw is confirmed', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      status: 'deciding-starter',
      deck: [
        numberCard('p1-draw', 'red', 5),
        numberCard('p2-draw', 'blue', 8),
        numberCard('p3-draw', 'green', 7),
      ],
    };

    const decided = applyStarterDraw(state);
    expect(decided.status).toBe('starter-ready');
    expect(canPlayCard(decided, numberCard('red-play', 'red', 1))).toBe(false);

    const started = applyStartGame(decided);
    expect(started.status).toBe('playing');
    expect(started.currentPlayerId).toBe('player-2');
  });

  it('redraws only tied starter candidates until one player is highest', () => {
    let state = baseState3('standard');
    state = {
      ...state,
      status: 'deciding-starter',
      deck: [
        numberCard('p1-tie', 'red', 6),
        numberCard('p2-tie', 'blue', 6),
        numberCard('p3-low', 'green', 2),
        numberCard('p1-redraw', 'yellow', 3),
        numberCard('p2-redraw', 'yellow', 8),
      ],
    };

    const next = applyStarterDraw(state);
    expect(next.currentPlayerId).toBe('player-2');
    expect(next.status).toBe('starter-ready');
    expect(next.starterDraws.map((draw) => [draw.round, draw.playerId, draw.value])).toEqual([
      [1, 'player-1', 6],
      [1, 'player-2', 6],
      [1, 'player-3', 2],
      [2, 'player-1', 3],
      [2, 'player-2', 8],
    ]);
  });

  it('blocks and sanitizes hard-only cards in standard games', () => {
    const hardOnly: UnoCard = { id: 'hard-only', kind: 'wild', symbol: 'wild-color-roulette' };
    const standardDraw4: UnoCard = { id: 'draw4', kind: 'wild', symbol: 'wild-draw4' };
    const state: UnoGameState = {
      ...baseState('standard'),
      hands: { 'player-1': [hardOnly, numberCard('red-1', 'red', 1)], 'player-2': [] },
      deck: [hardOnly, numberCard('blue-2', 'blue', 2)],
      discardPile: [hardOnly, numberCard('red-top', 'red', 5)],
      starterDraws: [{ playerId: 'player-1', card: hardOnly, value: 0, round: 1 }],
    };

    expect(canPlayCard(state, hardOnly)).toBe(false);
    expect(canPlayCard(state, standardDraw4)).toBe(true);

    const clean = sanitizeUnoStateForVariant(state);
    expect(clean.hands['player-1'].map((card) => card.id)).toEqual(['red-1']);
    expect(clean.deck.map((card) => card.id)).toEqual(['blue-2']);
    expect(clean.discardPile[0]?.id).toBe('red-top');
    expect(clean.starterDraws).toEqual([]);
  });

  it('moves a legal deck card to the discard pile without duplicating it while sanitizing', () => {
    const hardOnly: UnoCard = { id: 'hard-top', kind: 'wild', symbol: 'wild-color-roulette' };
    const deckCard = numberCard('replacement-top', 'blue', 2);
    const state: UnoGameState = {
      ...baseState('standard'),
      deck: [deckCard],
      discardPile: [hardOnly],
    };

    const clean = sanitizeUnoStateForVariant(state);
    expect(clean.discardPile.map((card) => card.id)).toEqual(['replacement-top']);
    expect(clean.deck).toEqual([]);
    const allIds = [...clean.deck, ...clean.discardPile].map((card) => card.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('clears hard-only or orphaned pending actions while sanitizing a standard game', () => {
    const state: UnoGameState = {
      ...baseState('standard'),
      pendingAction: { kind: 'swap-pick', swapperPlayerId: 'player-1' },
    };
    expect(sanitizeUnoStateForVariant(state).pendingAction).toBeNull();

    const orphanedDraw: UnoGameState = {
      ...state,
      pendingAction: { kind: 'drawn-card-play', playerId: 'player-1', cardId: 'missing-card' },
    };
    expect(sanitizeUnoStateForVariant(orphanedDraw).pendingAction).toBeNull();
  });

  it('sorts hands by color and then card face for readability', () => {
    const hand: UnoCard[] = [
      { id: 'wild', kind: 'wild', symbol: 'wild' },
      numberCard('blue-1', 'blue', 1),
      draw2('red-draw2', 'red'),
      numberCard('red-0', 'red', 0),
      numberCard('yellow-9', 'yellow', 9),
      numberCard('green-3', 'green', 3),
    ];

    expect(sortUnoHandByColor(hand).map((card) => card.id)).toEqual([
      'red-0',
      'red-draw2',
      'yellow-9',
      'green-3',
      'blue-1',
      'wild',
    ]);
  });

  it('allows drawing even when a playable card is available, but only the drawn card may be played', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [numberCard('old-playable', 'red', 1)] },
      deck: [numberCard('drawn-playable', 'red', 2)],
    };

    const next = applyDrawCard(state);
    expect(next.pendingAction).toEqual({ kind: 'drawn-card-play', playerId: 'player-1', cardId: 'drawn-playable' });
    expect(getPlayableCards(next, 'player-1').map((card) => card.id)).toEqual(['drawn-playable']);

    const blocked = applyPlayCard(next, 'old-playable');
    expect(blocked).toBe(next);

    const played = applyPlayCard(next, 'drawn-playable');
    expect(played.discardPile[0]?.id).toBe('drawn-playable');
    expect(played.currentPlayerId).toBe('player-2');
  });

  it('ends the turn when the drawn card cannot be played', () => {
    let state = baseState('standard');
    state = {
      ...state,
      hands: { ...state.hands, 'player-1': [] },
      deck: [numberCard('not-playable', 'blue', 1), numberCard('deck-left', 'green', 2)],
    };

    const next = applyDrawCard(state);
    expect(next.discardPile[0]?.id).toBe('top');
    expect(next.hands['player-1'].map((card) => card.id)).toEqual(['not-playable']);
    expect(next.deck.map((card) => card.id)).toEqual(['deck-left']);
    expect(next.currentPlayerId).toBe('player-2');
  });

  it('can pass after drawing a playable card', () => {
    let state = baseState('standard');
    state = {
      ...state,
      deck: [numberCard('drawn-playable', 'red', 2)],
    };

    const next = applyDrawCard(state);
    const passed = applyPassDrawnCard(next);
    expect(passed.pendingAction).toBeNull();
    expect(passed.discardPile[0]?.id).toBe('top');
    expect(passed.currentPlayerId).toBe('player-2');
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

describe('UNO draw stacking', () => {
  it('lets standard players answer draw 2 with draw 2 or wild draw 4', () => {
    const drawTwo = draw2('draw-two', 'blue');
    const wildDrawFour: UnoCard = { id: 'wild-draw-four', kind: 'wild', symbol: 'wild-draw4' };
    const state: UnoGameState = {
      ...baseState3('standard'),
      pendingDrawCount: 2,
      lastDrawCardValue: 2,
      hands: {
        'player-1': [drawTwo, wildDrawFour, numberCard('left', 'green', 4)],
        'player-2': [],
        'player-3': [],
      },
    };

    expect(canPlayCard(state, drawTwo)).toBe(true);
    expect(canPlayCard(state, wildDrawFour)).toBe(true);

    const stacked = applyPlayCard(state, 'draw-two');
    expect(stacked.pendingDrawCount).toBe(4);
    expect(stacked.lastDrawCardValue).toBe(2);
    expect(stacked.currentPlayerId).toBe('player-2');
  });

  it('only accepts an equal or greater draw card in standard games', () => {
    const drawTwo = draw2('draw-two', 'blue');
    const wildDrawFour: UnoCard = { id: 'wild-draw-four', kind: 'wild', symbol: 'wild-draw4' };
    const state: UnoGameState = {
      ...baseState('standard'),
      pendingDrawCount: 4,
      lastDrawCardValue: 4,
      hands: {
        'player-1': [drawTwo, wildDrawFour, numberCard('left', 'green', 4)],
        'player-2': [],
      },
    };

    expect(canPlayCard(state, drawTwo)).toBe(false);
    expect(canPlayCard(state, wildDrawFour)).toBe(true);
  });

  it('adds a standard wild draw 4 to the pending total after choosing a color', () => {
    const state: UnoGameState = {
      ...baseState3('standard'),
      pendingDrawCount: 2,
      lastDrawCardValue: 2,
      hands: {
        'player-1': [
          { id: 'wild-draw-four', kind: 'wild', symbol: 'wild-draw4' },
          numberCard('left', 'green', 4),
        ],
        'player-2': [],
        'player-3': [],
      },
    };

    const choosing = applyPlayCard(state, 'wild-draw-four');
    expect(choosing.pendingAction?.kind).toBe('color-pick');

    const stacked = applyColorChoice(choosing, 'blue');
    expect(stacked.pendingDrawCount).toBe(6);
    expect(stacked.lastDrawCardValue).toBe(4);
    expect(stacked.activeColor).toBe('blue');
    expect(stacked.currentPlayerId).toBe('player-2');
  });

  it('preserves a valid standard draw stack while sanitizing online state', () => {
    const state: UnoGameState = {
      ...baseState('standard'),
      pendingDrawCount: 6,
      lastDrawCardValue: 4,
    };

    const clean = sanitizeUnoStateForVariant(state);
    expect(clean.pendingDrawCount).toBe(6);
    expect(clean.lastDrawCardValue).toBe(4);
  });

  it('treats wild reverse draw 4 as a stackable draw 4 in hard games', () => {
    const reverseDrawFour: UnoCard = {
      id: 'reverse-draw-four',
      kind: 'wild',
      symbol: 'wild-reverse-draw4',
    };
    const state: UnoGameState = {
      ...baseState3('hard'),
      pendingDrawCount: 4,
      lastDrawCardValue: 4,
      hands: {
        'player-1': [reverseDrawFour, numberCard('left', 'green', 4)],
        'player-2': [],
        'player-3': [],
      },
    };

    expect(getCardDrawValue(reverseDrawFour)).toBe(4);
    expect(canPlayCard(state, reverseDrawFour)).toBe(true);

    const choosing = applyPlayCard(state, 'reverse-draw-four');
    const stacked = applyColorChoice(choosing, 'yellow');
    expect(stacked.direction).toBe('counterclockwise');
    expect(stacked.pendingDrawCount).toBe(8);
    expect(stacked.lastDrawCardValue).toBe(4);
    expect(stacked.currentPlayerId).toBe('player-3');
  });

  it('does not let wild reverse draw 4 answer a larger draw stack', () => {
    const reverseDrawFour: UnoCard = {
      id: 'reverse-draw-four',
      kind: 'wild',
      symbol: 'wild-reverse-draw4',
    };
    const state: UnoGameState = {
      ...baseState('hard'),
      pendingDrawCount: 6,
      lastDrawCardValue: 6,
      hands: {
        'player-1': [reverseDrawFour, numberCard('left', 'green', 4)],
        'player-2': [],
      },
    };

    expect(canPlayCard(state, reverseDrawFour)).toBe(false);
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

  it('moves exactly once to the next seat when accepting a draw causes a knockout', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      pendingDrawCount: 2,
      lastDrawCardValue: 2,
      hands: {
        ...state.hands,
        'player-1': Array.from({ length: 23 }, (_, i) => numberCard(`accept-hand-${i}`, 'blue', 1)),
      },
      deck: [numberCard('ko-a', 'green', 2), numberCard('ko-b', 'yellow', 3)],
    };

    const next = applyAcceptDraw(state);
    expect(next.players.find((player) => player.id === 'player-1')?.isEliminated).toBe(true);
    expect(next.currentPlayerId).toBe('player-2');
    expect(next.pendingDrawCount).toBe(0);
    expect(next.pendingAction).toBeNull();
  });

  it('ends the turn cleanly when a normal draw causes a knockout', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      hands: {
        ...state.hands,
        'player-1': Array.from({ length: 24 }, (_, i) => numberCard(`normal-hand-${i}`, 'blue', 1)),
      },
      deck: [numberCard('playable-ko-card', 'red', 2)],
    };

    const next = applyDrawCard(state);
    expect(next.players.find((player) => player.id === 'player-1')?.isEliminated).toBe(true);
    expect(next.currentPlayerId).toBe('player-2');
    expect(next.pendingAction).toBeNull();
  });

  it('ends legacy infinite draw cleanly when it causes a knockout', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      hands: {
        ...state.hands,
        'player-1': Array.from({ length: 24 }, (_, i) => numberCard(`infinite-hand-${i}`, 'blue', 1)),
      },
      deck: [numberCard('infinite-ko-card', 'red', 2)],
    };

    const next = applyInfiniteDraw(state);
    expect(next.players.find((player) => player.id === 'player-1')?.isEliminated).toBe(true);
    expect(next.currentPlayerId).toBe('player-2');
    expect(next.pendingAction).toBeNull();
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

  it('rejects an invalid or eliminated swap target', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      pendingAction: { kind: 'swap-pick', swapperPlayerId: 'player-1' },
      hands: {
        ...state.hands,
        'player-1': [numberCard('mine', 'blue', 1)],
        'player-2': [numberCard('theirs', 'green', 2)],
      },
      players: state.players.map((player) =>
        player.id === 'player-2' ? { ...player, isEliminated: true } : player,
      ),
    };

    expect(applySwapPick(state, 'missing-player')).toBe(state);
    expect(applySwapPick(state, 'player-1')).toBe(state);
    expect(applySwapPick(state, 'player-2')).toBe(state);
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
    expect(state.pendingAction?.kind === 'color-roulette' ? state.pendingAction.drawnCount : null).toBe(1);
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
    expect(next.pendingAction).toEqual({
      kind: 'color-roulette',
      targetPlayerId: 'player-3',
      targetColor: 'yellow',
      drawnCount: 0,
    });
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

  it('ends color roulette cleanly when no card can be drawn', () => {
    let state = baseState3('hard');
    state = {
      ...state,
      currentPlayerId: 'player-1',
      pendingAction: { kind: 'color-roulette', targetPlayerId: 'player-2', targetColor: 'yellow' },
      hands: {
        ...state.hands,
        'player-2': [numberCard('old-blue', 'blue', 4)],
      },
      deck: [],
      discardPile: [numberCard('only-discard', 'red', 5)],
    };

    const next = applyColorRouletteStep(state);
    expect(next.pendingAction).toBeNull();
    expect(next.currentPlayerId).toBe('player-3');
    expect(next.hands['player-2'].map((card) => card.id)).toEqual(['old-blue']);
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
