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
    const events = detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-0', captureCompleted: true });
    expect(events).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2', level: 3 }),
      kind: 'mancala-large-loss', outcome: 'disadvantage',
      factLabel: '7石を捕獲された', cutIn: 'pressure',
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

function publicCapture(mode: 'cpu' | 'local-2p', oppositeCount = 6) {
  const initial = createInitialMancalaState(mode);
  return { ...initial, board: initial.board.map(pit => {
    if (pit.id === 'p1-pit-0') return { ...pit, stones: 1 };
    if (pit.id === 'p1-pit-1') return { ...pit, stones: 0 };
    if (pit.id === 'p2-pit-4') return { ...pit, stones: oppositeCount };
    return pit;
  }) };
}

describe('Mancala completed public presentation v2', () => {
  it('requires actual capture playback completion and ignores reconnect snapshots', () => {
    const before = publicCapture('cpu');
    const after = applyMove(before, 'p1-pit-0');
    expect(detectMancalaDragonReactions(before, after)).toEqual([]);
    expect(detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-0', captureCompleted: false })).toEqual([]);
    expect(detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-3', captureCompleted: true })).toEqual([]);
    expect(detectMancalaDragonReactions(before, {
      ...after, board: after.board.map(pit => pit.isStore ? { ...pit, stones: pit.stones + 1 } : pit),
    }, { pitId: 'p1-pit-0', captureCompleted: true })).toEqual([]);
  });

  it('does not call a large store gain during sowing a capture', () => {
    const initial = createInitialMancalaState('local-2p');
    const before = { ...initial, board: initial.board.map(pit => pit.id === 'p1-pit-0' ? { ...pit, stones: 80 } : pit) };
    const after = applyMove(before, 'p1-pit-0');
    const beforeStore = before.board.find(pit => pit.id === 'p1-store')!.stones;
    expect(after.board.find(pit => pit.id === 'p1-store')!.stones - beforeStore).toBeGreaterThanOrEqual(6);
    const reactions = detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-0', captureCompleted: true });
    expect(reactions).toMatchObject([{ kind: 'mancala-sow', presenter: 'narrator', outcome: 'neutral' }]);
    expect(reactions[0].cutIn).toBeUndefined();
  });

  it('narrates a completed human capture from a separate neutral mascot', () => {
    const before = publicCapture('local-2p');
    const after = applyMove(before, 'p1-pit-0');
    expect(detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-0', captureCompleted: true })).toMatchObject([{
      cpu: { id: 'dragon-narrator:player-1', name: 'ゲーム案内', level: 3 },
      presenter: 'narrator', outcome: 'neutral', kind: 'mancala-large-capture', factLabel: '7石を捕獲', priority: 3,
    }]);
  });

  it('keeps small captures as brief wipes without a major scene', () => {
    const before = publicCapture('local-2p', 2);
    const after = applyMove(before, 'p1-pit-0');
    const reactions = detectMancalaDragonReactions(before, after, { pitId: 'p1-pit-0', captureCompleted: true });
    expect(reactions).toMatchObject([{ kind: 'mancala-capture', factLabel: '3石を捕獲', priority: 2 }]);
    expect(reactions[0].cutIn).toBeUndefined();
  });

  it('uses a public narrator for human extra turns and final results', () => {
    const before = createInitialMancalaState('local-2p');
    const after = applyMove(before, 'p1-pit-2');
    expect(detectMancalaDragonReactions(before, after)).toMatchObject([{
      kind: 'mancala-extra-turn', presenter: 'narrator', outcome: 'neutral',
    }]);
    const finished = { ...before, status: 'finished' as const, turnCount: 1, winnerPlayerId: 'player-2' as const };
    expect(detectMancalaDragonReactions(before, finished)).toMatchObject([{
      kind: 'mancala-victory', presenter: 'narrator', outcome: 'neutral', factLabel: `${before.players[1].name}の勝ち`,
    }]);
    expect(detectMancalaDragonReactions(before, { ...finished, winnerPlayerId: null, isDraw: true })).toMatchObject([{
      kind: 'mancala-draw', presenter: 'narrator', outcome: 'neutral', factLabel: '引き分け',
    }]);
  });
});
