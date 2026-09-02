import { supabase } from '../../lib/supabase';
import type { GameState, Move, Side, TurnResult } from './bakuretsu/types.ts';
import {
  type BakuretsuAutoMoveCounts,
  type BakuretsuTimeBanks,
} from './bakuretsuUi';

export const BAKURETSU_REVERSI_ONLINE_PLAYER_ID_KEY = 'dgp-bakuretsu-reversi-online-player-id';
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type BakuretsuReversiRoomRow = {
  room_code: string;
  host_name: string;
  guest_name: string | null;
  game_state: GameState;
  last_turn_result: TurnResult | null;
  legal_moves: Move[];
  time_banks: BakuretsuTimeBanks;
  auto_move_counts: BakuretsuAutoMoveCounts;
  match_no: number;
  version: number;
  viewer_side: Side;
  playback_ready_at: string | null;
  turn_started_at: string | null;
  turn_deadline: string | null;
};

export type BakuretsuReversiRoomInfo = {
  roomCode: string;
  myOnlineId: string;
  mySide: Side;
  isHost: boolean;
};

export type BakuretsuReversiRoomSession = {
  room: BakuretsuReversiRoomInfo;
  row: BakuretsuReversiRoomRow;
};

export type BakuretsuReversiSnapshot = {
  state: GameState;
  result: TurnResult | null;
  legalMoves: Move[];
  clocks: BakuretsuTimeBanks;
  autoMoveCounts: BakuretsuAutoMoveCounts;
  matchNo: number;
  playbackReadyAt: string | null;
  turnStartsAt: string | null;
  turnDeadline: string | null;
};

export function getBakuretsuReversiOnlinePlayerId(): string {
  let id = sessionStorage.getItem(BAKURETSU_REVERSI_ONLINE_PLAYER_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(BAKURETSU_REVERSI_ONLINE_PLAYER_ID_KEY, id);
  }
  return id;
}

export function generateBakuretsuReversiRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function snapshotFromBakuretsuReversiRow(row: BakuretsuReversiRoomRow): BakuretsuReversiSnapshot {
  return {
    state: row.game_state,
    result: row.last_turn_result,
    legalMoves: row.legal_moves,
    clocks: row.time_banks,
    autoMoveCounts: row.auto_move_counts,
    matchNo: row.match_no,
    playbackReadyAt: row.playback_ready_at,
    turnStartsAt: row.turn_started_at,
    turnDeadline: row.turn_deadline,
  };
}

export function isBakuretsuReversiRoomReady(row: BakuretsuReversiRoomRow): boolean {
  return Boolean(row.guest_name);
}

function sessionFromRow(row: BakuretsuReversiRoomRow, myOnlineId: string): BakuretsuReversiRoomSession {
  const mySide = row.viewer_side;
  return {
    room: { roomCode: row.room_code, myOnlineId, mySide, isHost: mySide === 'BLACK' },
    row,
  };
}

export async function createBakuretsuReversiRoom(hostName: string): Promise<BakuretsuReversiRoomSession> {
  const roomCode = generateBakuretsuReversiRoomCode();
  const myOnlineId = getBakuretsuReversiOnlinePlayerId();
  const { data, error } = await supabase.rpc('create_bakuretsu_reversi_room', {
    p_room_code: roomCode,
    p_player_id: myOnlineId,
    p_host_name: hostName.trim() || 'ルームの主',
  });
  if (error || !data) throw new Error('爆裂ルームを開けなかった。時をおいて再び試されよ');
  return sessionFromRow(data as BakuretsuReversiRoomRow, myOnlineId);
}

export async function joinBakuretsuReversiRoom(
  roomCode: string,
  guestName: string,
): Promise<BakuretsuReversiRoomSession> {
  const code = roomCode.trim().toUpperCase();
  const myOnlineId = getBakuretsuReversiOnlinePlayerId();
  const { data, error } = await supabase.rpc('join_bakuretsu_reversi_room', {
    p_room_code: code,
    p_player_id: myOnlineId,
    p_guest_name: guestName.trim() || '挑戦者',
  });
  if (error || !data) throw new Error('爆裂ルームに入れません。コードか参加状況を確認してください');
  return sessionFromRow(data as BakuretsuReversiRoomRow, myOnlineId);
}

export async function submitBakuretsuReversiMove(
  roomCode: string,
  playerId: string,
  move: Move | null,
  timeout: boolean,
  version: number,
): Promise<BakuretsuReversiRoomRow | null> {
  const { data, error } = await supabase.rpc('submit_bakuretsu_reversi_move', {
    p_room_code: roomCode,
    p_player_id: playerId,
    p_move: move,
    p_timeout: timeout,
    p_version: version,
  });
  if (error || !data) return null;
  return data as BakuretsuReversiRoomRow;
}

export async function acknowledgeBakuretsuReversiPlayback(
  roomCode: string,
  playerId: string,
  version: number,
): Promise<BakuretsuReversiRoomRow | null> {
  const { data, error } = await supabase.rpc('ack_bakuretsu_reversi_playback', {
    p_room_code: roomCode,
    p_player_id: playerId,
    p_version: version,
  });
  if (error || !data) return null;
  return data as BakuretsuReversiRoomRow;
}

export async function rematchBakuretsuReversiRoom(
  roomCode: string,
  playerId: string,
  version: number,
): Promise<BakuretsuReversiRoomRow | null> {
  const { data, error } = await supabase.rpc('rematch_bakuretsu_reversi_room', {
    p_room_code: roomCode,
    p_player_id: playerId,
    p_version: version,
  });
  if (error || !data) return null;
  return data as BakuretsuReversiRoomRow;
}

export async function fetchBakuretsuReversiRoom(
  roomCode: string,
  playerId: string,
): Promise<BakuretsuReversiRoomRow | null> {
  const { data, error } = await supabase.rpc('fetch_bakuretsu_reversi_room', {
    p_room_code: roomCode,
    p_player_id: playerId,
  });
  if (error || !data) return null;
  return data as BakuretsuReversiRoomRow;
}

export async function deleteBakuretsuReversiRoom(roomCode: string, playerId: string): Promise<void> {
  await supabase.rpc('delete_bakuretsu_reversi_room', {
    p_room_code: roomCode,
    p_player_id: playerId,
  });
}

export function subscribeBakuretsuReversiRoom(
  roomCode: string,
  playerId: string,
  onRow: (row: BakuretsuReversiRoomRow) => void,
): () => void {
  let cancelled = false;
  const syncLatest = async () => {
    const row = await fetchBakuretsuReversiRoom(roomCode, playerId);
    if (!cancelled && row) onRow(row);
  };
  void syncLatest();
  const poll = window.setInterval(() => { void syncLatest(); }, 1000);

  return () => {
    cancelled = true;
    window.clearInterval(poll);
  };
}
