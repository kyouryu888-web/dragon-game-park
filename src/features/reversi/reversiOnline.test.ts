import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock } }));

import {
  REVERSI_ONLINE_PLAYER_ID_KEY,
  createOnlineReversiState,
  generateReversiRoomCode,
  getReversiOnlinePlayerId,
  joinReversiRoom,
  pushReversiState,
  type ReversiRoomRow,
} from './reversiOnline';

function storageFor(values = new Map<string, string>()): Storage {
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    get length() { return values.size; },
  };
}

describe('Reversi online helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    fromMock.mockReset();
  });

  it('keeps one identity per tab and separates another tab', () => {
    const randomUUID = vi.fn().mockReturnValueOnce('tab-a').mockReturnValueOnce('tab-b');
    vi.stubGlobal('crypto', { randomUUID });
    const firstTab = storageFor();
    vi.stubGlobal('sessionStorage', firstTab);
    expect(getReversiOnlinePlayerId()).toBe('tab-a');
    expect(getReversiOnlinePlayerId()).toBe('tab-a');
    expect(firstTab.setItem).toHaveBeenCalledWith(REVERSI_ONLINE_PLAYER_ID_KEY, 'tab-a');

    vi.stubGlobal('sessionStorage', storageFor());
    expect(getReversiOnlinePlayerId()).toBe('tab-b');
  });

  it('generates a six-character room code without ambiguous characters', () => {
    const values = [0, 0.15, 0.3, 0.5, 0.75, 0.999];
    let index = 0;
    const code = generateReversiRoomCode(() => values[index++]);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('creates a human black host and human white guest', () => {
    const state = createOnlineReversiState('主', '客');
    expect(state.players.black).toMatchObject({ name: '主', isCpu: false });
    expect(state.players.white).toMatchObject({ name: '客', isCpu: false });
    expect(state.currentColor).toBe('black');
  });

  it('joins an open room as white with an optimistic version guard', async () => {
    vi.stubGlobal('sessionStorage', storageFor());
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'guest-tab') });
    const initial = createOnlineReversiState('主', '挑戦者');
    const existing: ReversiRoomRow = {
      room_code: 'ABC234',
      host_id: 'host-tab',
      guest_id: null,
      host_name: '主',
      guest_name: null,
      game_state: initial,
      version: 4,
    };
    const updated: ReversiRoomRow = {
      ...existing,
      guest_id: 'guest-tab',
      guest_name: '客',
      game_state: {
        ...initial,
        players: { ...initial.players, white: { ...initial.players.white, name: '客' } },
      },
      version: 5,
    };
    const fetchSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const updateSelect = vi.fn().mockResolvedValue({ data: [updated], error: null });
    const versionEq = vi.fn(() => ({ is: vi.fn(() => ({ select: updateSelect })) }));
    const roomEq = vi.fn(() => ({ eq: versionEq }));
    const update = vi.fn(() => ({ eq: roomEq }));
    fromMock
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: fetchSingle })) })) })
      .mockReturnValueOnce({ update });

    const session = await joinReversiRoom('abc234', '客');

    expect(session.room).toMatchObject({ roomCode: 'ABC234', myColor: 'white', isHost: false });
    expect(session.row.game_state.players.white.name).toBe('客');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ version: 5, guest_id: 'guest-tab' }));
    expect(versionEq).toHaveBeenCalledWith('version', 4);
  });

  it('returns null when a state write loses the version race', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    fromMock.mockReturnValue({ update: vi.fn(() => ({ eq: firstEq })) });

    const state = createOnlineReversiState('主', '客');
    await expect(pushReversiState('ABC234', state, 7)).resolves.toBeNull();
    expect(secondEq).toHaveBeenCalledWith('version', 7);
  });
});
