import { describe, expect, it } from 'vitest';
import type { UnoGameState } from './unoTypes';
import {
  buildUnoCpuPrefill,
  buildUnoOnlineConfig,
  canApplyUnoOnlineAction,
  countUnoJoined,
  findOpenUnoSlot,
  findRejoinPlayerId,
  getUnoGuestFieldByPlayerIndex,
  isUnoRoomReady,
  renameUnoPlayer,
  type UnoRoomRow,
} from './unoOnline';
import { createInitialUnoState } from './createInitialUnoState';

function row(patch: Partial<UnoRoomRow>): UnoRoomRow {
  return {
    room_code: 'ABC123',
    variant: 'standard',
    player_count: 2,
    host_id: 'host',
    guest_id: null,
    guest2_id: null,
    guest3_id: null,
    guest4_id: null,
    guest5_id: null,
    guest6_id: null,
    guest7_id: null,
    guest8_id: null,
    guest9_id: null,
    version: 0,
    ...patch,
  };
}

function state(): UnoGameState {
  return createInitialUnoState({
    variant: 'standard',
    playerConfigs: [
      { name: 'A', isCpu: false, cpuLevel: 'normal' },
      { name: 'B', isCpu: false, cpuLevel: 'normal' },
    ],
  });
}

describe('UNO online room helpers', () => {
  it('maps player slots to guest fields', () => {
    expect(getUnoGuestFieldByPlayerIndex(0)).toBeNull();
    expect(getUnoGuestFieldByPlayerIndex(1)).toBe('guest_id');
    expect(getUnoGuestFieldByPlayerIndex(9)).toBe('guest9_id');
  });

  it('counts joined players and detects ready rooms', () => {
    const waiting = row({ player_count: 4, guest_id: 'p2', guest2_id: 'p3' });
    expect(countUnoJoined(waiting)).toBe(3);
    expect(isUnoRoomReady(waiting)).toBe(false);

    const ready = row({ player_count: 4, guest_id: 'p2', guest2_id: 'p3', guest3_id: 'p4' });
    expect(countUnoJoined(ready)).toBe(4);
    expect(isUnoRoomReady(ready)).toBe(true);
  });

  it('finds rejoin roles and open slots', () => {
    const waiting = row({ player_count: 3, guest_id: 'p2' });
    expect(findRejoinPlayerId(waiting, 'host')).toBe('player-1');
    expect(findRejoinPlayerId(waiting, 'p2')).toBe('player-2');
    expect(findRejoinPlayerId(waiting, 'new')).toBeNull();
    expect(findOpenUnoSlot(waiting)).toEqual({ playerIndex: 2, field: 'guest2_id' });
  });

  it('prefills CPU slots and builds config', () => {
    const slots = [
      { name: 'CPU A', isCpu: true, cpuLevel: 'hard' as const },
      { name: 'Guest', isCpu: false, cpuLevel: 'normal' as const },
    ];
    expect(buildUnoCpuPrefill(3, slots)).toEqual({ guest_id: 'cpu-player-2' });

    const config = buildUnoOnlineConfig('hard', 3, 'Host', slots);
    expect(config.variant).toBe('hard');
    expect(config.playerConfigs).toEqual([
      { name: 'Host', isCpu: false, cpuLevel: 'normal' },
      { name: 'CPU A', isCpu: true, cpuLevel: 'hard' },
      { name: 'Guest', isCpu: false, cpuLevel: 'normal' },
    ]);
  });

  it('renames a joining player as a human', () => {
    const initial = state();
    const renamed = renameUnoPlayer(initial, 1, 'Guest Name');
    expect(renamed.players[1]?.name).toBe('Guest Name');
    expect(renamed.players[1]?.isCpu).toBe(false);
  });
});

describe('UNO online action permissions', () => {
  it('allows only the current player to take turn actions', () => {
    const s = state();
    expect(canApplyUnoOnlineAction(s, 'player-1', 'turn')).toBe(true);
    expect(canApplyUnoOnlineAction(s, 'player-2', 'turn')).toBe(false);
  });

  it('scopes pending actions to the correct player', () => {
    const s: UnoGameState = {
      ...state(),
      pendingAction: { kind: 'color-pick', chooserPlayerId: 'player-2', pendingDrawAfterColor: 0, reverseAfterColor: false },
    };
    expect(canApplyUnoOnlineAction(s, 'player-2', 'color-pick')).toBe(true);
    expect(canApplyUnoOnlineAction(s, 'player-1', 'color-pick')).toBe(false);
  });

  it('allows UNO declaration for self and penalty against another player', () => {
    const s: UnoGameState = {
      ...state(),
      pendingAction: { kind: 'uno-window', playerWithOneCard: 'player-2', declared: false },
    };
    expect(canApplyUnoOnlineAction(s, 'player-2', 'uno-declare')).toBe(true);
    expect(canApplyUnoOnlineAction(s, 'player-1', 'uno-penalty', 'player-2')).toBe(true);
    expect(canApplyUnoOnlineAction(s, 'player-2', 'uno-penalty', 'player-2')).toBe(false);
  });
});
