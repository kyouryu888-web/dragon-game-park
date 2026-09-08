import { fetchReversiRoom, joinReversiRoom, type ReversiRoomSession } from './reversiOnline';
import {
  joinBakuretsuReversiRoom,
  type BakuretsuReversiRoomSession,
} from './bakuretsuReversiOnline';

export type ReversiAutoJoinResult =
  | { variant: 'normal'; session: ReversiRoomSession }
  | { variant: 'bakuretsu'; session: BakuretsuReversiRoomSession };

/**
 * 6桁コードをもとに通常版／爆裂版を自動判別してルームに参加する
 */
export async function joinReversiRoomAuto(
  roomCode: string,
  guestName: string,
): Promise<ReversiAutoJoinResult> {
  const code = roomCode.trim().toUpperCase();
  if (code.length !== 6) {
    throw new Error('コードは6文字で入力してください');
  }

  // 1. まず通常版ルームが存在するか確認
  let normalRoom = null;
  try {
    normalRoom = await fetchReversiRoom(code);
  } catch {
    // ネットワーク一時エラー等の場合は握りつぶして次へ
  }

  if (normalRoom) {
    const session = await joinReversiRoom(code, guestName);
    return { variant: 'normal', session };
  }

  // 2. 通常版に無ければ爆裂版へ参加を試みる
  try {
    const session = await joinBakuretsuReversiRoom(code, guestName);
    return { variant: 'bakuretsu', session };
  } catch (bakuretsuError) {
    const message =
      bakuretsuError instanceof Error
        ? bakuretsuError.message
        : 'ルームに入れませんでした';
    if (
      message.includes('既に対戦が始まっている') ||
      message.includes('満員') ||
      message.includes('定員')
    ) {
      throw new Error(message);
    }
    throw new Error('入力されたコードのルームが見つかりませんでした（コードを確認してください）');
  }
}
