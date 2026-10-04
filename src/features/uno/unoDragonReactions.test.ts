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

 describe('UNO v2 public action cues', () => {
  it.each(['standard', 'hard'] as const)('announces reverse before minor hand-count chatter in %s mode', variant => {
    const before = { ...fixture(), variant };
    const next: UnoGameState = { ...before, direction: 'counterclockwise', turnCount: before.turnCount + 1,
      hands: { ...before.hands, 'player-2': before.hands['player-2'].slice(1) } };
    expect(detectUnoDragonReactions(before, next)).toMatchObject([{ kind: 'uno-reverse', factLabel: 'リバース・順番が逆に', cpu: { id: 'player-2' } }]);
  });

  it('keeps UNO one-card urgency above a simultaneous reverse', () => {
    const before = { ...fixture(), hands: { ...fixture().hands, 'player-2': [card('a'), card('b')] } };
    const next: UnoGameState = { ...before, direction: 'counterclockwise', turnCount: before.turnCount + 1,
      hands: { ...before.hands, 'player-2': [card('b')] } };
    expect(detectUnoDragonReactions(before, next)[0].kind).toBe('uno-1-cards');
  });

  it.each(['red', 'blue'] as const)('announces confirmed %s colour, including choosing the same colour', activeColor => {
    const before: UnoGameState = { ...fixture(), activeColor: 'red', pendingAction: {
      kind: 'color-pick', chooserPlayerId: 'player-1', pendingDrawAfterColor: 0, reverseAfterColor: false,
    } };
    const next: UnoGameState = { ...before, activeColor, pendingAction: null, turnCount: before.turnCount + 1 };
    const event = detectUnoDragonReactions(before, next)[0];
    expect(event).toMatchObject({ kind: 'uno-color-picked', presenter: 'narrator', factLabel: activeColor === 'red' ? '赤に決定' : '青に決定' });
    expect(event.cpu.id).not.toBe('player-1');
    expect(detectUnoDragonReactions(fixture(), before)).toEqual([]);
  });

  it('announces roulette stopping from public counts without inspecting the final card', () => {
    const before: UnoGameState = { ...fixture(), pendingAction: { kind: 'color-roulette', targetPlayerId: 'player-2', targetColor: 'blue', drawnCount: 2 } };
    const next: UnoGameState = { ...before, turnCount: before.turnCount + 1, pendingAction: null,
      hands: { ...before.hands, 'player-2': [...before.hands['player-2'], card('private-blue')] } };
    const alternate = { ...next, hands: { ...next.hands, 'player-2': next.hands['player-2'].map((_card, i) => card(`other-secret-${i}`)) } };
    expect(detectUnoDragonReactions(before, next)).toEqual(detectUnoDragonReactions(before, alternate));
    expect(detectUnoDragonReactions(before, next)).toMatchObject([{ kind: 'uno-roulette-stop', factLabel: 'ルーレットが止まった・3まい', priority: 3 }]);
    expect(detectUnoDragonReactions(before, { ...next, hands: before.hands })).toEqual([]);
  });

  it('narrates human-only victory and rejects bootstrap, rewind, game-change and missing-update transitions', () => {
    const before = { ...fixture(), players: fixture().players.map(player => ({ ...player, isCpu: false })) };
    const next: UnoGameState = { ...before, turnCount: before.turnCount + 1, status: 'finished', winnerPlayerId: 'player-1' };
    expect(detectUnoDragonReactions(before, next)).toMatchObject([{ presenter: 'narrator', kind: 'uno-victory', factLabel: 'Humanの勝ち' }]);
    expect(detectUnoDragonReactions({ ...before, status: 'starter-ready' }, next)).toEqual([]);
    expect(detectUnoDragonReactions(before, { ...next, turnCount: before.turnCount - 1 })).toEqual([]);
    expect(detectUnoDragonReactions(before, { ...next, turnCount: before.turnCount + 2 })).toEqual([]);
    expect(detectUnoDragonReactions(before, { ...next, gameId: 'new-match' })).toEqual([]);
  });
});
