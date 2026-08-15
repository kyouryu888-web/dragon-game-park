/**
 * オンライン対戦（ルームコード方式）の通信。
 *
 * 構成は backgammonOnline.ts（supabase呼び出しをこのモジュールに集約）を土台に、
 * UNO から version の楽観ロックと CPU 枠のプリフィルを取り込んでいる。
 * 楽観ロックのおかげで、シャッフルタイムの同時宣言は「先に書き込めた1件」だけが通る。
 */
import { supabase } from '../../lib/supabase';
import type { BabanukiConfig, BabanukiState, CpuLevel, PlayerConfig } from './babanukiTypes';
import { createInitialBabanukiState } from './babanukiRules';
import { getCpuDisplayName } from './babanukiCpu';

const PLAYER_ID_KEY = 'dgp-online-player-id';
const PLAYER_NAME_KEY = 'dragon-game-park:babanuki-online-name';

/** 座席2〜6に対応する列名 */
export const GUEST_FIELDS = ['guest_id', 'guest2_id', 'guest3_id', 'guest4_id', 'guest5_id'] as const;

export type BabanukiRoomRow = {
  room_code: string;
  player_count: number;
  host_id: string;
  guest_id: string | null;
  guest2_id: string | null;
  guest3_id: string | null;
  guest4_id: string | null;
  guest5_id: string | null;
  game_state: BabanukiState;
  version: number;
};

export type BabanukiRoomInfo = {
  roomCode: string;
  /** 'player-1'（ホスト）〜'player-6' */
  myPlayerId: string;
};

export type OnlineSlot = {
  isCpu: boolean;
  cpuLevel: CpuLevel;
};

export function getOnlinePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getSavedOnlineName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveOnlineName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // 保存できなくても対戦は続けられる
  }
}

export function generateRoomCode(): string {
  // 紛らわしい文字（I, L, O, 0, 1）を除いた32字から6桁
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function getPlayerIdByIndex(index: number): string {
  return `player-${index + 1}`;
}

export function getIndexByPlayerId(playerId: string): number {
  return Number(playerId.replace('player-', '')) - 1;
}

function slotOccupantId(row: BabanukiRoomRow, index: number): string | null {
  if (index === 0) return row.host_id;
  return row[GUEST_FIELDS[index - 1]] ?? null;
}

/** 人間の席が全部埋まったか（CPU席は最初から埋まっている） */
export function isRoomReady(row: BabanukiRoomRow): boolean {
  for (let i = 0; i < row.player_count; i += 1) {
    if (row.game_state.players[i]?.isCpu) continue;
    if (!slotOccupantId(row, i)) return false;
  }
  return true;
}

export function countHumans(row: BabanukiRoomRow): { joined: number; total: number } {
  let joined = 0;
  let total = 0;
  for (let i = 0; i < row.player_count; i += 1) {
    if (row.game_state.players[i]?.isCpu) continue;
    total += 1;
    if (slotOccupantId(row, i)) joined += 1;
  }
  return { joined, total };
}

/** 再入室（同じ端末が戻ってきた）なら、その席のIDを返す */
export function findRejoinPlayerId(row: BabanukiRoomRow, onlinePlayerId: string): string | null {
  for (let i = 0; i < row.player_count; i += 1) {
    if (slotOccupantId(row, i) === onlinePlayerId) return getPlayerIdByIndex(i);
  }
  return null;
}

/** 空いている人間の席（先頭から）を返す */
export function findOpenSlotIndex(row: BabanukiRoomRow): number | null {
  for (let i = 1; i < row.player_count; i += 1) {
    if (row.game_state.players[i]?.isCpu) continue;
    if (!slotOccupantId(row, i)) return i;
  }
  return null;
}

function buildConfig(playerCount: number, hostName: string, slots: OnlineSlot[]): BabanukiConfig {
  const players: PlayerConfig[] = [{ name: hostName || 'ホスト', isCpu: false, cpuLevel: 'normal' }];
  for (let i = 1; i < playerCount; i += 1) {
    const slot = slots[i - 1] ?? { isCpu: true, cpuLevel: 'normal' as CpuLevel };
    players.push({
      name: slot.isCpu ? getCpuDisplayName(slot.cpuLevel) : '',
      isCpu: slot.isCpu,
      cpuLevel: slot.cpuLevel,
    });
  }
  return { playerCount, players };
}

/** ホストとしてルームを作る */
export async function createRoom(
  playerCount: number,
  hostName: string,
  slots: OnlineSlot[],
): Promise<BabanukiRoomInfo> {
  const roomCode = generateRoomCode();
  const myOnlineId = getOnlinePlayerId();
  const state = createInitialBabanukiState(buildConfig(playerCount, hostName, slots));

  const row: Record<string, unknown> = {
    room_code: roomCode,
    player_count: playerCount,
    host_id: myOnlineId,
    game_state: state,
    version: 0,
  };
  // CPU席は最初から埋めておく（人間の空き席だけを待つ）
  for (let i = 1; i < playerCount; i += 1) {
    if (state.players[i].isCpu) row[GUEST_FIELDS[i - 1]] = `cpu-${getPlayerIdByIndex(i)}`;
  }

  const { error } = await supabase.from('babanuki_rooms').insert(row);
  if (error) throw new Error('ルームを開けなかった。時をおいて再び試されよ');
  return { roomCode, myPlayerId: 'player-1' };
}

/** ゲストとしてルームに入る */
export async function joinRoom(roomCode: string, guestName: string): Promise<BabanukiRoomInfo> {
  const myOnlineId = getOnlinePlayerId();
  const { data, error } = await supabase
    .from('babanuki_rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  if (error || !data) throw new Error('その紋章のルームは見つからぬ');
  const row = data as BabanukiRoomRow;

  const rejoin = findRejoinPlayerId(row, myOnlineId);
  if (rejoin) return { roomCode, myPlayerId: rejoin };

  const openIndex = findOpenSlotIndex(row);
  if (openIndex === null) throw new Error('そのルームはもう満席だ');

  const nextState: BabanukiState = {
    ...row.game_state,
    players: row.game_state.players.map((p, i) =>
      i === openIndex ? { ...p, name: guestName || `プレイヤー${i + 1}` } : p,
    ),
  };

  const { error: updateError } = await supabase
    .from('babanuki_rooms')
    .update({
      [GUEST_FIELDS[openIndex - 1]]: myOnlineId,
      game_state: nextState,
      version: row.version + 1,
    })
    .eq('room_code', roomCode)
    .eq('version', row.version);
  if (updateError) throw new Error('ルームに入れなかった。時をおいて再び試されよ');

  return { roomCode, myPlayerId: getPlayerIdByIndex(openIndex) };
}

/**
 * 状態を書き込む。version が一致したときだけ成功する（楽観ロック）。
 * 同時に宣言された場合、先に書き込めた1件だけが通る。
 */
export async function pushState(
  roomCode: string,
  state: BabanukiState,
  version: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('babanuki_rooms')
    .update({ game_state: state, version: version + 1 })
    .eq('room_code', roomCode)
    .eq('version', version)
    .select('version');
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function fetchRoom(roomCode: string): Promise<BabanukiRoomRow | null> {
  const { data } = await supabase
    .from('babanuki_rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  return (data as BabanukiRoomRow) ?? null;
}

export async function deleteRoom(roomCode: string): Promise<void> {
  await supabase.from('babanuki_rooms').delete().eq('room_code', roomCode);
}

/**
 * ルーム行の更新を購読する。返り値は解除関数。
 * Realtime が主、5秒ポーリングがフォールバック（既存ゲームと同じ構成）。
 */
export function subscribeRoom(
  roomCode: string,
  onRow: (row: BabanukiRoomRow) => void,
): () => void {
  let cancelled = false;

  const syncLatest = async () => {
    const row = await fetchRoom(roomCode);
    if (!cancelled && row) onRow(row);
  };

  const channel = supabase
    .channel(`babanuki-${roomCode}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'babanuki_rooms', filter: `room_code=eq.${roomCode}` },
      (payload) => {
        if (!cancelled) onRow(payload.new as BabanukiRoomRow);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !cancelled) void syncLatest();
    });

  const poll = setInterval(() => {
    void syncLatest();
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
