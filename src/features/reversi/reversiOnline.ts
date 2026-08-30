import { supabase } from '../../lib/supabase';
import { createInitialReversiState } from './reversiRules';
import type { DiscColor, ReversiConfig, ReversiGameState } from './reversiTypes';

export const REVERSI_ONLINE_PLAYER_ID_KEY = 'dgp-reversi-online-player-id';
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type ReversiRoomRow = {
  room_code: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  guest_name: string | null;
  game_state: ReversiGameState;
  version: number;
};

export type ReversiRoomInfo = {
  roomCode: string;
  myOnlineId: string;
  myColor: DiscColor;
  isHost: boolean;
};

export type ReversiRoomSession = {
  room: ReversiRoomInfo;
  row: ReversiRoomRow;
};

export function getReversiOnlinePlayerId(): string {
  let id = sessionStorage.getItem(REVERSI_ONLINE_PLAYER_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    sessionStorage.setItem(REVERSI_ONLINE_PLAYER_ID_KEY, id);
  }
  return id;
}

export function generateReversiRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function createOnlineReversiState(hostName: string, guestName: string): ReversiGameState {
  const config: ReversiConfig = {
    mode: 'online',
    name: hostName || 'ルームの主',
    name2: guestName || '挑戦者',
    cpuLevel: 'normal',
    humanSide: 'black',
  };
  return createInitialReversiState(config);
}

export function isReversiRoomReady(row: ReversiRoomRow): boolean {
  return Boolean(row.guest_id && row.guest_name);
}

export async function createReversiRoom(hostName: string): Promise<ReversiRoomSession> {
  const roomCode = generateReversiRoomCode();
  const myOnlineId = getReversiOnlinePlayerId();
  const resolvedHostName = hostName.trim() || 'ルームの主';
  const state = createOnlineReversiState(resolvedHostName, '挑戦者');
  const inserted = {
    room_code: roomCode,
    host_id: myOnlineId,
    guest_id: null,
    host_name: resolvedHostName,
    guest_name: null,
    game_state: state,
    version: 0,
  };
  const { data, error } = await supabase
    .from('reversi_rooms')
    .insert(inserted)
    .select('*')
    .single();
  if (error || !data) throw new Error('ルームを開けなかった。時をおいて再び試されよ');
  return {
    room: { roomCode, myOnlineId, myColor: 'black', isHost: true },
    row: data as ReversiRoomRow,
  };
}

export async function joinReversiRoom(roomCode: string, guestName: string): Promise<ReversiRoomSession> {
  const code = roomCode.trim().toUpperCase();
  const myOnlineId = getReversiOnlinePlayerId();
  const existing = await fetchReversiRoom(code);
  if (!existing) throw new Error('その紋章のルームは見つからぬ');

  if (existing.host_id === myOnlineId) {
    return {
      room: { roomCode: code, myOnlineId, myColor: 'black', isHost: true },
      row: existing,
    };
  }
  if (existing.guest_id === myOnlineId) {
    return {
      room: { roomCode: code, myOnlineId, myColor: 'white', isHost: false },
      row: existing,
    };
  }
  if (existing.guest_id) throw new Error('そのルームは既に対戦が始まっている');

  const resolvedGuestName = guestName.trim() || '挑戦者';
  const nextState: ReversiGameState = {
    ...existing.game_state,
    players: {
      ...existing.game_state.players,
      white: { ...existing.game_state.players.white, name: resolvedGuestName },
    },
  };
  const { data, error } = await supabase
    .from('reversi_rooms')
    .update({
      guest_id: myOnlineId,
      guest_name: resolvedGuestName,
      game_state: nextState,
      version: existing.version + 1,
    })
    .eq('room_code', code)
    .eq('version', existing.version)
    .is('guest_id', null)
    .select('*');
  const updated = data?.[0] as ReversiRoomRow | undefined;
  if (error || !updated) throw new Error('ルームに入れなかった。別の挑戦者が先に入った可能性があります');
  return {
    room: { roomCode: code, myOnlineId, myColor: 'white', isHost: false },
    row: updated,
  };
}

export async function pushReversiState(
  roomCode: string,
  state: ReversiGameState,
  version: number,
): Promise<ReversiRoomRow | null> {
  const { data, error } = await supabase
    .from('reversi_rooms')
    .update({ game_state: state, version: version + 1 })
    .eq('room_code', roomCode)
    .eq('version', version)
    .select('*');
  if (error) return null;
  return (data?.[0] as ReversiRoomRow | undefined) ?? null;
}

export async function fetchReversiRoom(roomCode: string): Promise<ReversiRoomRow | null> {
  const { data } = await supabase
    .from('reversi_rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  return (data as ReversiRoomRow | null) ?? null;
}

export async function deleteReversiRoom(roomCode: string): Promise<void> {
  await supabase.from('reversi_rooms').delete().eq('room_code', roomCode);
}

export function subscribeReversiRoom(
  roomCode: string,
  onRow: (row: ReversiRoomRow) => void,
): () => void {
  let cancelled = false;
  const syncLatest = async () => {
    const row = await fetchReversiRoom(roomCode);
    if (!cancelled && row) onRow(row);
  };
  const channel = supabase
    .channel(`reversi-${roomCode}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'reversi_rooms', filter: `room_code=eq.${roomCode}` },
      (payload) => {
        if (!cancelled) onRow(payload.new as ReversiRoomRow);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !cancelled) void syncLatest();
    });
  const poll = window.setInterval(() => { void syncLatest(); }, 5000);

  return () => {
    cancelled = true;
    window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
