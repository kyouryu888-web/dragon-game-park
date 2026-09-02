import { describe, expect, it } from 'vitest';
import { applyMove } from './bakuretsu/engine.ts';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { initGame, legalMoves, makeRng } from './bakuretsu/rules.ts';
import { bakuretsuStatesMatch, canResolveBakuretsuTimeout, decideBakuretsuSync } from './bakuretsuOnlineSync';
import type { BakuretsuReversiSnapshot } from './bakuretsuReversiOnline';

function snapshot(seed = 1): BakuretsuReversiSnapshot {
  return {
    state: initGame(DEFAULT_CONFIG, makeRng(seed)),
    result: null,
    legalMoves: [],
    clocks: { BLACK: 1_200_000, WHITE: 1_200_000 },
    autoMoveCounts: { BLACK: 0, WHITE: 0 },
    matchNo: 0,
    playbackReadyAt: null,
    turnStartsAt: null,
    turnDeadline: null,
  };
}

describe('Bakuretsu online synchronization decisions', () => {
  it('refreshes metadata without replaying its confirmed move while the same move is playing', () => {
    const initial = snapshot();
    const result = applyMove(initial.state, legalMoves(initial.state, DEFAULT_CONFIG)[0], DEFAULT_CONFIG);
    const incoming = { ...initial, state: result.state, result };
    expect(decideBakuretsuSync(initial.state, 0, result.state, incoming)).toBe('refresh');
  });

  it('treats JSONB key reordering as the same state while preserving array order', () => {
    const initial = snapshot().state;
    const reordered = Object.fromEntries(Object.entries(initial).reverse()) as unknown as typeof initial;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(initial));
    expect(bakuretsuStatesMatch(initial, reordered)).toBe(true);

    const changedBoard = {
      ...reordered,
      board: reordered.board.map((cell, index) => index === 0 ? { ...cell, isQueued: !cell.isQueued } : cell),
    };
    expect(bakuretsuStatesMatch(initial, changedBoard)).toBe(false);
  });

  it('queues a newer opponent move while the local event sequence is playing', () => {
    const initial = snapshot();
    const first = applyMove(initial.state, legalMoves(initial.state, DEFAULT_CONFIG)[0], DEFAULT_CONFIG);
    const second = applyMove(first.state, legalMoves(first.state, DEFAULT_CONFIG)[0], DEFAULT_CONFIG);
    const incoming = { ...initial, state: second.state, result: second };
    expect(decideBakuretsuSync(initial.state, 0, first.state, incoming)).toBe('queue');
  });

  it('plays one exact incoming TurnResult but resets on a missed move or same-ply conflict', () => {
    const initial = snapshot();
    const first = applyMove(initial.state, legalMoves(initial.state, DEFAULT_CONFIG)[0], DEFAULT_CONFIG);
    const second = applyMove(first.state, legalMoves(first.state, DEFAULT_CONFIG)[0], DEFAULT_CONFIG);
    expect(decideBakuretsuSync(initial.state, 0, null, { ...initial, state: first.state, result: first })).toBe('playback');
    expect(decideBakuretsuSync(initial.state, 0, null, { ...initial, state: second.state, result: second })).toBe('reset');

    const conflict = snapshot(1);
    conflict.state.hands.BLACK.specialPieces = [];
    conflict.state.moveNo = initial.state.moveNo;
    expect(decideBakuretsuSync(initial.state, 0, null, conflict)).toBe('reset');
  });

  it('ignores old generations and resets for a host rematch generation', () => {
    const current = snapshot();
    expect(decideBakuretsuSync(current.state, 2, null, { ...snapshot(), matchNo: 1 })).toBe('ignore');
    expect(decideBakuretsuSync(current.state, 2, null, { ...snapshot(), matchNo: 3 })).toBe('reset');
  });

  it('lets the active player resolve timeout and gives the rival a thirty-second takeover grace', () => {
    const deadline = '2026-09-01T12:00:30.000Z';
    expect(canResolveBakuretsuTimeout('BLACK', 'BLACK', deadline, Date.parse('2026-09-01T12:00:00.000Z'))).toBe(true);
    expect(canResolveBakuretsuTimeout('WHITE', 'BLACK', deadline, Date.parse('2026-09-01T12:00:29.999Z'))).toBe(false);
    expect(canResolveBakuretsuTimeout('WHITE', 'BLACK', deadline, Date.parse(deadline))).toBe(false);
    expect(canResolveBakuretsuTimeout('WHITE', 'BLACK', deadline, Date.parse(deadline) + 30_000)).toBe(true);
    expect(canResolveBakuretsuTimeout('WHITE', 'BLACK', null, Date.parse(deadline))).toBe(false);
  });
});
