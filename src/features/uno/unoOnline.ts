import type { UnoConfig, UnoCpuLevel, UnoGameState, UnoPlayerConfig, UnoPlayerId, UnoVariant } from './unoTypes';
import { createInitialUnoState } from './createInitialUnoState';

export type UnoOnlineRoomInfo = {
  roomCode: string;
  myPlayerId: UnoPlayerId;
};

export type UnoRoomRow = {
  room_code: string;
  variant: UnoVariant;
  player_count: number;
  host_id: string | null;
  guest_id: string | null;
  guest2_id: string | null;
  guest3_id: string | null;
  guest4_id: string | null;
  guest5_id: string | null;
  guest6_id: string | null;
  guest7_id: string | null;
  guest8_id: string | null;
  guest9_id: string | null;
  game_state?: unknown;
  version: number;
};

export type UnoOnlinePlayerSlot = {
  name: string;
  isCpu: boolean;
  cpuLevel: UnoCpuLevel;
};

export const UNO_ONLINE_PLAYER_ID_KEY = 'dgp-uno-online-player-id';
export const UNO_ONLINE_PLAYER_NAME_KEY = 'dgp-uno-online-player-name';

export const UNO_CPU_LEVELS: UnoCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];

export const UNO_GUEST_FIELDS = [
  'guest_id',
  'guest2_id',
  'guest3_id',
  'guest4_id',
  'guest5_id',
  'guest6_id',
  'guest7_id',
  'guest8_id',
  'guest9_id',
] as const;

export type UnoGuestField = (typeof UNO_GUEST_FIELDS)[number];

export function generateUnoRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getUnoOnlinePlayerId(): string {
  let id = sessionStorage.getItem(UNO_ONLINE_PLAYER_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    sessionStorage.setItem(UNO_ONLINE_PLAYER_ID_KEY, id);
  }
  return id;
}

export function getSavedUnoOnlineName(): string {
  return localStorage.getItem(UNO_ONLINE_PLAYER_NAME_KEY) ?? '';
}

export function saveUnoOnlineName(name: string): void {
  localStorage.setItem(UNO_ONLINE_PLAYER_NAME_KEY, name);
}

export function getUnoPlayerIdByIndex(index: number): UnoPlayerId {
  return `player-${index + 1}`;
}

export function getUnoGuestFieldByPlayerIndex(index: number): UnoGuestField | null {
  if (index <= 0) return null;
  return UNO_GUEST_FIELDS[index - 1] ?? null;
}

export function getUnoSlotValue(row: Partial<UnoRoomRow>, index: number): string | null {
  if (index === 0) return row.host_id ?? null;
  const field = getUnoGuestFieldByPlayerIndex(index);
  return field ? row[field] ?? null : null;
}

export function countUnoJoined(row: Partial<UnoRoomRow>): number {
  const playerCount = row.player_count ?? 2;
  let count = row.host_id ? 1 : 0;
  for (let i = 1; i < playerCount; i++) {
    if (getUnoSlotValue(row, i)) count++;
  }
  return count;
}

export function isUnoRoomReady(row: Partial<UnoRoomRow>): boolean {
  const playerCount = row.player_count ?? 2;
  if (!row.host_id) return false;
  for (let i = 1; i < playerCount; i++) {
    if (!getUnoSlotValue(row, i)) return false;
  }
  return true;
}

export function findRejoinPlayerId(row: Partial<UnoRoomRow>, onlinePlayerId: string): UnoPlayerId | null {
  const playerCount = row.player_count ?? 2;
  for (let i = 0; i < playerCount; i++) {
    if (getUnoSlotValue(row, i) === onlinePlayerId) return getUnoPlayerIdByIndex(i);
  }
  return null;
}

export function findOpenUnoSlot(row: Partial<UnoRoomRow>): { playerIndex: number; field: UnoGuestField } | null {
  const playerCount = row.player_count ?? 2;
  for (let i = 1; i < playerCount; i++) {
    const field = getUnoGuestFieldByPlayerIndex(i);
    if (field && !row[field]) return { playerIndex: i, field };
  }
  return null;
}

export function buildUnoOnlineConfig(
  variant: UnoVariant,
  playerCount: number,
  hostName: string,
  slots: UnoOnlinePlayerSlot[],
): UnoConfig {
  const players: UnoPlayerConfig[] = Array.from({ length: playerCount }, (_, index) => {
    if (index === 0) {
      return { name: hostName.trim() || 'ホスト', isCpu: false, cpuLevel: 'normal' };
    }
    const slot = slots[index - 1] ?? { name: '', isCpu: false, cpuLevel: 'normal' as UnoCpuLevel };
    return {
      name: slot.name,
      isCpu: slot.isCpu,
      cpuLevel: slot.cpuLevel,
    };
  });

  return { variant, playerConfigs: players };
}

export function createUnoOnlineInitialState(
  variant: UnoVariant,
  playerCount: number,
  hostName: string,
  slots: UnoOnlinePlayerSlot[],
): UnoGameState {
  return createInitialUnoState(buildUnoOnlineConfig(variant, playerCount, hostName, slots));
}

export function buildUnoCpuPrefill(playerCount: number, slots: UnoOnlinePlayerSlot[]): Partial<UnoRoomRow> {
  const prefill: Partial<UnoRoomRow> = {};
  for (let i = 1; i < playerCount; i++) {
    const slot = slots[i - 1];
    const field = getUnoGuestFieldByPlayerIndex(i);
    if (slot?.isCpu && field) prefill[field] = `cpu-player-${i + 1}`;
  }
  return prefill;
}

export function renameUnoPlayer(state: UnoGameState, playerIndex: number, name: string): UnoGameState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return {
    ...state,
    players: state.players.map((player, index) =>
      index === playerIndex ? { ...player, name: trimmed, isCpu: false } : player,
    ),
  };
}

export function canApplyUnoOnlineAction(
  state: UnoGameState,
  myPlayerId: UnoPlayerId,
  action: 'turn' | 'color-pick' | 'swap-pick' | 'uno-declare',
): boolean {
  if (state.status !== 'playing') return false;
  const pending = state.pendingAction;

  if (action === 'turn') {
    return pending === null && state.currentPlayerId === myPlayerId;
  }
  if (action === 'color-pick') {
    return pending?.kind === 'color-pick' && pending.chooserPlayerId === myPlayerId;
  }
  if (action === 'swap-pick') {
    return pending?.kind === 'swap-pick' && pending.swapperPlayerId === myPlayerId;
  }
  if (action === 'uno-declare') {
    return pending?.kind === 'uno-window' && pending.playerWithOneCard === myPlayerId;
  }
  return false;
}
