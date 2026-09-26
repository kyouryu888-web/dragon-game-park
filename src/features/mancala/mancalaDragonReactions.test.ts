import { describe, expect, it } from 'vitest';
import { createInitialMancalaState } from './createInitialMancalaState';
import { applyMove } from './mancalaRules';
import { detectMancalaDragonReactions } from './mancalaDragonReactions';

describe('Mancala public dragon cues', () => {
  it('identifies the CPU whose visible pit was captured after the completed move', () => {
    const initial = createInitialMancalaState('cpu');
    const before = {
      ...initial,
      board: initial.board.map(pit => {
        if (pit.id === 'p1-pit-0') return { ...pit, stones: 1 };
        if (pit.id === 'p1-pit-1') return { ...pit, stones: 0 };
        if (pit.id === 'p2-pit-4') return { ...pit, stones: 6 };
        return pit;
      }),
    };
    const after = applyMove(before, 'p1-pit-0');
    const events = detectMancalaDragonReactions(before, after);
    expect(events).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2', level: 3 }),
      kind: 'mancala-large-loss', outcome: 'disadvantage',
      factLabel: '7石を獲得された', cutIn: 'pressure',
    })]);
  });

  it('gives the CPU its own extra-turn cue without predicting a future move', () => {
    const initial = createInitialMancalaState('cpu');
    const before = { ...initial, currentPlayerId: 'player-2' as const };
    const after = applyMove(before, 'p2-pit-2');
    expect(after.currentPlayerId).toBe('player-2');
    expect(detectMancalaDragonReactions(before, after)).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2' }),
      kind: 'mancala-extra-turn', factLabel: '追加ターン',
    })]);
  });

  it('uses the real winner and ignores skipped or replayed updates', () => {
    const before = createInitialMancalaState('cpu');
    const finished = {
      ...before, status: 'finished' as const,
      winnerPlayerId: 'player-1' as const, turnCount: before.turnCount + 1,
    };
    expect(detectMancalaDragonReactions(before, finished)).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2' }),
      outcome: 'defeat', factLabel: `${before.players[0].name}の勝ち`,
    })]);
    expect(detectMancalaDragonReactions(before, { ...finished, turnCount: 3 })).toEqual([]);
    expect(detectMancalaDragonReactions(finished, finished)).toEqual([]);
  });
});
