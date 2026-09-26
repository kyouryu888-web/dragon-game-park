import { describe, expect, it } from 'vitest';
import { createInitialUnoState } from './createInitialUnoState';
import { detectUnoDragonReactions } from './unoDragonReactions';
import type { UnoCard, UnoGameState } from './unoTypes';

const card = (id: string): UnoCard => ({ id, kind: 'number', color: 'red', value: 3 });
function fixture(): UnoGameState {
  const start = createInitialUnoState({
    variant: 'hard',
    playerConfigs: [
      { name: 'Human', isCpu: false },
      { name: 'Baby', isCpu: true, cpuLevel: 'very-easy' },
      { name: 'King', isCpu: true, cpuLevel: 'hard' },
    ],
  });
  return { ...start, status: 'playing', currentPlayerId: 'player-2', turnCount: 6,
    hands: { 'player-1': [card('human')], 'player-2': [card('secret-a'), card('secret-b'), card('secret-c'), card('secret-d')], 'player-3': [card('king')] },
  };
}

describe('UNO public dragon cues', () => {
  it('uses published card count, not hidden card identities', () => {
    const before = fixture();
    const next = { ...before, turnCount: 7, hands: { ...before.hands, 'player-2': [card('secret-a'), card('secret-b'), card('secret-c')] } };
    const alternateBefore = { ...before, hands: { ...before.hands, 'player-2': [card('joker'), card('green'), card('wild'), card('9')] } };
    const alternateNext = { ...next, hands: { ...next.hands, 'player-2': [card('new-a'), card('new-b'), card('new-c')] } };
    expect(detectUnoDragonReactions(before, next)).toEqual(detectUnoDragonReactions(alternateBefore, alternateNext));
    expect(detectUnoDragonReactions(before, next)[0]).toMatchObject({ kind: 'uno-3-cards', factLabel: '残り3まい', cpu: { id: 'player-2', level: 1 } });
  });

  it('keeps KO and winner facts true and ignores skipped updates', () => {
    const before = fixture();
    const eliminated = { ...before, turnCount: 7, players: before.players.map(player => player.id === 'player-2' ? { ...player, isEliminated: true } : player) };
    expect(detectUnoDragonReactions(before, eliminated)[0]).toMatchObject({ outcome: 'defeat', factLabel: '25まいでアウト', cpu: { id: 'player-2' } });
    const finished = { ...before, turnCount: 7, status: 'finished' as const, winnerPlayerId: 'player-3' };
    expect(detectUnoDragonReactions(before, finished)[0]).toMatchObject({ outcome: 'victory', cpu: { id: 'player-3' }, factLabel: 'Kingの勝ち' });
    expect(detectUnoDragonReactions(before, { ...finished, turnCount: 9 })).toEqual([]);
  });
});
