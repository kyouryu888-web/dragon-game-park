import { supabase } from '../../lib/supabase';
import type { GameState, PlayerId } from './backgammonTypes';
import { createInitialBackgammonState } from './createInitialBackgammonState';

// localStorage キー（マンカラ/UNOと共通のプレイヤーID）
const PLAYER_ID_KEY = 'dgp-online-player-id';

export type OnlinePayload = {
  seq: number;
  state: GameState;
  hostName: string;
  guestName: string | null;
};

export type BackgammonRoomRow = {
  room_code: string;
  host_id: string;
  guest_id: string | null;
  game_state: OnlinePayload;
};

export type BackgammonRoomInfo = {
  roomCode: string;
  myPlayerId: string;
  /** host=white（金）/ guest=black（緋） */
  myColor: PlayerId;
  myName: string;
};

export function getOnlinePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

/** ホストとしてルームを作る */
export async function createRoom(hostName: string): Promise<BackgammonRoomInfo> {
  const roomCode = generateRoomCode();
  const myPlayerId = getOnlinePlayerId();
  const payload: OnlinePayload = {
    seq: 0,
    state: createInitialBackgammonState(),
    hostName,
    guestName: null,
  };
  const { error } = await supabase.from('backgammon_rooms').insert({
    room_code: roomCode,
    host_id: myPlayerId,
    player_count: 2,
    game_state: payload,
  });
  if (error) throw new Error('ルームを開けなかった。時をおいて再び試されよ');
  return { roomCode, myPlayerId, myColor: 'white', myName: hostName };
}

/** ゲストとしてルームに入る */
export async function joinRoom(roomCode: string, guestName: string): Promise<BackgammonRoomInfo> {
  const myPlayerId = getOnlinePlayerId();
  const { data, error } = await supabase
    .from('backgammon_rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  if (error || !data) throw new Error('その紋章のルームは見つからぬ');
  const row = data as BackgammonRoomRow;

  // 再入室（自分が既にゲスト）は許可
  if (row.guest_id && row.guest_id !== myPlayerId) {
    throw new Error('そのルームは既に対戦が始まっている');
  }
  if (row.host_id === myPlayerId) {
    // 自分がホストのルームに入り直した
    return { roomCode, myPlayerId, myColor: 'white', myName: row.game_state.hostName };
  }

  const payload: OnlinePayload = {
    ...row.game_state,
    guestName,
    seq: row.game_state.seq + 1,
  };
  const { error: updateErr } = await supabase
    .from('backgammon_rooms')
    .update({ guest_id: myPlayerId, game_state: payload })
    .eq('room_code', roomCode);
  if (updateErr) throw new Error('ルームに入れなかった。時をおいて再び試されよ');
  return { roomCode, myPlayerId, myColor: 'black', myName: guestName };
}

/** 盤面を送信する（seq を進めて全体を書き込む） */
export async function pushPayload(roomCode: string, payload: OnlinePayload): Promise<void> {
  await supabase
    .from('backgammon_rooms')
    .update({ game_state: payload })
    .eq('room_code', roomCode);
}

/** 最新の行を取得 */
export async function fetchRoom(roomCode: string): Promise<BackgammonRoomRow | null> {
  const { data } = await supabase
    .from('backgammon_rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  return (data as BackgammonRoomRow) ?? null;
}

/**
 * ルーム行の更新を購読する。返り値は解除関数。
 * Realtime が主、5秒ポーリングがフォールバック（マンカラと同じ構成）。
 */
export function subscribeRoom(
  roomCode: string,
  onRow: (row: BackgammonRoomRow) => void,
): () => void {
  let cancelled = false;

  const syncLatest = async () => {
    const row = await fetchRoom(roomCode);
    if (!cancelled && row) onRow(row);
  };

  const channel = supabase
    .channel(`backgammon-${roomCode}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'backgammon_rooms', filter: `room_code=eq.${roomCode}` },
      (payload) => {
        if (!cancelled) onRow(payload.new as BackgammonRoomRow);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !cancelled) void syncLatest();
    });

  const poll = setInterval(() => { void syncLatest(); }, 5000);

  return () => {
    cancelled = true;
    clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
