import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { initGame, legalMoves, makeRng } from './bakuretsu/rules.ts';
import {
  acknowledgeBakuretsuReversiPlayback,
  BAKURETSU_REVERSI_ONLINE_PLAYER_ID_KEY,
  createBakuretsuReversiRoom,
  generateBakuretsuReversiRoomCode,
  getBakuretsuReversiOnlinePlayerId,
  joinBakuretsuReversiRoom,
  submitBakuretsuReversiMove,
  snapshotFromBakuretsuReversiRow,
  type BakuretsuReversiRoomRow,
} from './bakuretsuReversiOnline';

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

function roomRow(version = 0): BakuretsuReversiRoomRow {
  const state = initGame(DEFAULT_CONFIG, makeRng(17));
  return {
    room_code: 'ABC234',
    host_name: '主',
    guest_name: null,
    game_state: state,
    last_turn_result: null,
    legal_moves: legalMoves(state, DEFAULT_CONFIG),
    time_banks: { BLACK: 1_200_000, WHITE: 1_200_000 },
    auto_move_counts: { BLACK: 0, WHITE: 0 },
    match_no: 0,
    version,
    viewer_side: 'BLACK',
    playback_ready_at: null,
    turn_started_at: null,
    turn_deadline: null,
  };
}

describe('Bakuretsu Reversi online helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    rpcMock.mockReset();
  });

  it('keeps one identity per tab and separates another tab', () => {
    const randomUUID = vi.fn().mockReturnValueOnce('tab-a').mockReturnValueOnce('tab-b');
    vi.stubGlobal('crypto', { randomUUID });
    const firstTab = storageFor();
    vi.stubGlobal('sessionStorage', firstTab);
    expect(getBakuretsuReversiOnlinePlayerId()).toBe('tab-a');
    expect(getBakuretsuReversiOnlinePlayerId()).toBe('tab-a');
    expect(firstTab.setItem).toHaveBeenCalledWith(BAKURETSU_REVERSI_ONLINE_PLAYER_ID_KEY, 'tab-a');

    vi.stubGlobal('sessionStorage', storageFor());
    expect(getBakuretsuReversiOnlinePlayerId()).toBe('tab-b');
  });

  it('generates a six-character room code without ambiguous characters', () => {
    const values = [0, 0.15, 0.3, 0.5, 0.75, 0.999];
    let index = 0;
    expect(generateBakuretsuReversiRoomCode(() => values[index++])).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('asks the server to create the private initial state instead of uploading one', async () => {
    vi.stubGlobal('sessionStorage', storageFor());
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'host-tab-identity') });
    rpcMock.mockResolvedValue({ data: roomRow(), error: null });

    await createBakuretsuReversiRoom('主');

    expect(rpcMock).toHaveBeenCalledWith('create_bakuretsu_reversi_room', {
      p_room_code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{6}$/),
      p_player_id: 'host-tab-identity',
      p_host_name: '主',
    });
  });

  it('joins through the participant-checked RPC and receives the white-side view', async () => {
    vi.stubGlobal('sessionStorage', storageFor());
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'guest-tab') });
    const existing = roomRow(4);
    const updated = { ...existing, guest_name: '客', version: 5, viewer_side: 'WHITE' as const };
    rpcMock.mockResolvedValue({ data: updated, error: null });

    const session = await joinBakuretsuReversiRoom('abc234', '客');

    expect(session.room).toMatchObject({ roomCode: 'ABC234', mySide: 'WHITE', isHost: false });
    expect(rpcMock).toHaveBeenCalledWith('join_bakuretsu_reversi_room', {
      p_room_code: 'ABC234',
      p_player_id: 'guest-tab',
      p_guest_name: '客',
    });
  });

  it('submits only the chosen move and version, never a client-computed state or clock', async () => {
    const row = roomRow(7);
    const before = snapshotFromBakuretsuReversiRow(row);
    const move = legalMoves(before.state, DEFAULT_CONFIG)[0];
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(submitBakuretsuReversiMove('ABC234', 'host-tab-identity', move, false, 7)).resolves.toBeNull();
    expect(rpcMock).toHaveBeenCalledWith('submit_bakuretsu_reversi_move', {
      p_room_code: 'ABC234',
      p_player_id: 'host-tab-identity',
      p_move: move,
      p_timeout: false,
      p_version: 7,
    });
    expect(JSON.stringify(rpcMock.mock.calls.at(-1))).not.toMatch(/game_state|last_turn_result|time_banks/);
  });

  it('acknowledges completed playback without sending state or client clock data', async () => {
    rpcMock.mockResolvedValue({ data: roomRow(9), error: null });

    await acknowledgeBakuretsuReversiPlayback('ABC234', 'guest-tab-identity', 8);

    expect(rpcMock).toHaveBeenCalledWith('ack_bakuretsu_reversi_playback', {
      p_room_code: 'ABC234',
      p_player_id: 'guest-tab-identity',
      p_version: 8,
    });
    expect(JSON.stringify(rpcMock.mock.calls.at(-1))).not.toMatch(/game_state|last_turn_result|time_banks/);
  });
});
