import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { UnoCard, UnoGameState, UnoPlayerId } from './unoTypes';
import { UnoCinematicOverlay } from './UnoCinematicOverlay';
import {
  detectUnoCinematicEvents,
  getUnoCinematicDuration,
  isBlockingUnoCinematic,
} from './unoCinematics';

function numberCard(id: string, color: 'red' | 'yellow' | 'green' | 'blue', value: 1 | 2 | 3): UnoCard {
  return { id, kind: 'number', color, value };
}

function state(overrides: Partial<UnoGameState> = {}): UnoGameState {
  return {
    gameId: 'cinematic-game',
    variant: 'hard',
    status: 'playing',
    players: [
      { id: 'player-1', name: 'ドラゴン', isCpu: false, isEliminated: false },
      { id: 'player-2', name: 'キング', isCpu: false, isEliminated: false },
      { id: 'player-3', name: 'ゴッド', isCpu: true, cpuLevel: 'hard', isEliminated: false },
    ],
    hands: {
      'player-1': [numberCard('p1', 'red', 1)],
      'player-2': [numberCard('p2', 'blue', 2)],
      'player-3': [numberCard('p3', 'green', 3)],
    },
    deck: [],
    discardPile: [numberCard('top', 'red', 1)],
    currentPlayerId: 'player-2',
    starterDraws: [],
    direction: 'clockwise',
    activeColor: 'red',
    pendingDrawCount: 0,
    lastDrawCardValue: 0,
    pendingAction: null,
    winnerPlayerId: null,
    finalScores: null,
    eliminatedScores: {},
    turnCount: 3,
    unoDeclaredIds: [],
    ...overrides,
  };
}

function hand(size: number, playerId: UnoPlayerId): UnoCard[] {
  return Array.from({ length: size }, (_, index) => numberCard(`${playerId}-${index}`, 'blue', 2));
}

describe('UNO cinematic event detection', () => {
  it('emits one draw-counter event with the new cumulative count', () => {
    const previous = state({ pendingDrawCount: 2, lastDrawCardValue: 2 });
    const next = state({
      pendingDrawCount: 6,
      lastDrawCardValue: 4,
      currentPlayerId: 'player-3',
      turnCount: 4,
      discardPile: [{ id: 'wild-4', kind: 'wild', symbol: 'wild-draw4' }],
    });

    expect(detectUnoCinematicEvents(previous, next)).toMatchObject([{
      kind: 'draw-counter',
      playerId: 'player-2',
      addedCount: 4,
      totalCount: 6,
      reversed: false,
    }]);
  });

  it('attributes a color-pick counter to its chooser and detects reverse draw 4', () => {
    const previous = state({
      pendingDrawCount: 4,
      pendingAction: {
        kind: 'color-pick',
        chooserPlayerId: 'player-2',
        pendingDrawAfterColor: 4,
        reverseAfterColor: true,
      },
    });
    const next = state({
      pendingDrawCount: 8,
      pendingAction: null,
      direction: 'counterclockwise',
      currentPlayerId: 'player-1',
      turnCount: 4,
      discardPile: [{ id: 'reverse-4', kind: 'wild', symbol: 'wild-reverse-draw4' }],
    });

    expect(detectUnoCinematicEvents(previous, next)).toMatchObject([{
      kind: 'draw-counter',
      playerId: 'player-2',
      totalCount: 8,
      reversed: true,
    }]);
  });

  it('emits forced-draw only after the target accepts the stack', () => {
    const previous = state({
      pendingDrawCount: 6,
      hands: { ...state().hands, 'player-2': hand(3, 'player-2') },
    });
    const next = state({
      pendingDrawCount: 0,
      currentPlayerId: 'player-3',
      turnCount: 4,
      hands: { ...state().hands, 'player-2': hand(9, 'player-2') },
    });

    expect(detectUnoCinematicEvents(previous, next)).toMatchObject([{
      kind: 'forced-draw',
      playerId: 'player-2',
      count: 6,
    }]);
  });

  it('prioritizes knockout over forced-draw for the same update', () => {
    const previous = state({
      pendingDrawCount: 10,
      hands: { ...state().hands, 'player-2': hand(20, 'player-2') },
    });
    const next = state({
      pendingDrawCount: 0,
      currentPlayerId: 'player-3',
      turnCount: 4,
      players: state().players.map((player) =>
        player.id === 'player-2' ? { ...player, isEliminated: true } : player,
      ),
      hands: { ...state().hands, 'player-2': [] },
    });

    expect(detectUnoCinematicEvents(previous, next)).toMatchObject([{
      kind: 'knockout',
      playerId: 'player-2',
      cause: 'draw-stack',
      count: 10,
    }]);
  });

  it('emits roulette progress and safe events with the persisted count', () => {
    const previous = state({
      pendingAction: {
        kind: 'color-roulette',
        targetPlayerId: 'player-2',
        targetColor: 'yellow',
        drawnCount: 2,
      },
      hands: { ...state().hands, 'player-2': hand(3, 'player-2') },
    });
    const continuing = state({
      pendingAction: {
        kind: 'color-roulette',
        targetPlayerId: 'player-2',
        targetColor: 'yellow',
        drawnCount: 3,
      },
      hands: { ...state().hands, 'player-2': hand(4, 'player-2') },
    });
    const safe = state({
      pendingAction: null,
      currentPlayerId: 'player-3',
      hands: { ...state().hands, 'player-2': hand(4, 'player-2') },
    });

    expect(detectUnoCinematicEvents(previous, continuing)).toMatchObject([{
      kind: 'roulette-step',
      targetColor: 'yellow',
      drawnCount: 3,
    }]);
    expect(detectUnoCinematicEvents(previous, safe)).toMatchObject([{
      kind: 'roulette-safe',
      targetColor: 'yellow',
      drawnCount: 3,
    }]);
  });

  it('uses the shared knockout event when roulette reaches 25 cards', () => {
    const previous = state({
      pendingAction: {
        kind: 'color-roulette',
        targetPlayerId: 'player-2',
        targetColor: 'green',
        drawnCount: 6,
      },
      hands: { ...state().hands, 'player-2': hand(24, 'player-2') },
    });
    const next = state({
      pendingAction: null,
      currentPlayerId: 'player-3',
      turnCount: 4,
      players: state().players.map((player) =>
        player.id === 'player-2' ? { ...player, isEliminated: true } : player,
      ),
      hands: { ...state().hands, 'player-2': [] },
    });

    expect(detectUnoCinematicEvents(previous, next)).toMatchObject([{
      kind: 'knockout',
      cause: 'color-roulette',
      count: 7,
    }]);
  });

  it('does not replay events across a newly created game', () => {
    expect(detectUnoCinematicEvents(state(), state({ gameId: 'next-game' }))).toEqual([]);
  });

  it('blocks turns only for full-screen cut-ins', () => {
    const counter = detectUnoCinematicEvents(
      state({ pendingDrawCount: 2 }),
      state({ pendingDrawCount: 4, discardPile: [{ id: 'draw2', kind: 'action', color: 'red', symbol: 'draw2' }] }),
    )[0];
    const roulette = {
      kind: 'roulette-step' as const,
      key: 'roulette',
      playerId: 'player-2',
      playerName: 'キング',
      targetColor: 'red' as const,
      drawnCount: 1,
    };

    expect(isBlockingUnoCinematic(counter)).toBe(true);
    expect(getUnoCinematicDuration(counter)).toBe(2400);
    expect(isBlockingUnoCinematic(roulette)).toBe(false);
    expect(getUnoCinematicDuration(roulette)).toBe(350);
  });

  it('passes the same 2.4 second duration to the full-screen CSS animation', () => {
    const counter = {
      kind: 'draw-counter' as const,
      key: 'counter-duration',
      playerId: 'player-1' as const,
      playerName: 'ドラゴン',
      addedCount: 4,
      totalCount: 8,
      cardName: 'ワイルド ドロー4',
      reversed: false,
    };

    const html = renderToStaticMarkup(UnoCinematicOverlay({ event: counter }));

    expect(html).toContain('--uno-cinematic-duration:2400ms');
  });

});
