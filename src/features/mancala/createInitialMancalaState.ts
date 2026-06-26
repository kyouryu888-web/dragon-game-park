import type { MancalaMode, MancalaConfig, CpuLevel, GameState, Pit, Player } from './mancalaTypes';
import { getCpuDisplayName } from './mancalaCpu';

const POCKETS_PER_PLAYER = 6; // 各プレイヤーの小さい穴の数
const INITIAL_STONES = 4;     // ゲーム開始時の1穴あたりの石の数

/**
 * ゲーム開始時の状態を作る。
 *
 * 引数は MancalaMode（文字列）か MancalaConfig（オブジェクト）のどちらでも受け付ける。
 * 文字列を渡すとデフォルト値（難易度 normal、プレイヤー名デフォルト）が使われる。
 *
 * 盤面配列の並び順（この順番で石を反時計回りに配る）：
 *   インデックス  0〜5  : player-1 の小さい穴（p1-pit-0〜5）
 *   インデックス  6     : player-1 のストア（p1-store）
 *   インデックス  7〜12 : player-2 の小さい穴（p2-pit-0〜5）
 *   インデックス  13    : player-2 のストア（p2-store）
 *
 * 向かいの穴の対応（捕獲ルール用）：
 *   p1-pit-0 ↔ p2-pit-5
 *   p1-pit-1 ↔ p2-pit-4
 *   p1-pit-2 ↔ p2-pit-3
 *   p1-pit-3 ↔ p2-pit-2
 *   p1-pit-4 ↔ p2-pit-1
 *   p1-pit-5 ↔ p2-pit-0
 */
export function createInitialMancalaState(modeOrConfig: MancalaMode | MancalaConfig): GameState {
  const isConfig = typeof modeOrConfig === 'object';
  const mode: MancalaMode      = isConfig ? modeOrConfig.mode      : modeOrConfig;
  const cpuLevel: CpuLevel     = isConfig ? modeOrConfig.cpuLevel  : 'normal';
  const p1Name: string         = isConfig ? (modeOrConfig.player1Name || 'プレイヤー1') : 'プレイヤー1';
  const p2NameRaw: string      = isConfig ? modeOrConfig.player2Name : '';

  const player1: Player = {
    id: 'player-1',
    name: p1Name,
    isCpu: false,
  };

  const player2: Player = mode === 'cpu'
    ? { id: 'player-2', name: getCpuDisplayName(cpuLevel), isCpu: true }
    : { id: 'player-2', name: p2NameRaw || 'プレイヤー2', isCpu: false };

  const board: Pit[] = [];

  // player-1 の小さい穴（インデックス 0〜5）
  for (let i = 0; i < POCKETS_PER_PLAYER; i++) {
    board.push({
      id: `p1-pit-${i}`,
      ownerPlayerId: 'player-1',
      stones: INITIAL_STONES,
      isStore: false,
      oppositePitId: `p2-pit-${5 - i}`, // 例：p1-pit-0の向かいはp2-pit-5
    });
  }

  // player-1 のストア（インデックス 6）
  board.push({
    id: 'p1-store',
    ownerPlayerId: 'player-1',
    stones: 0,
    isStore: true,
  });

  // player-2 の小さい穴（インデックス 7〜12）
  for (let i = 0; i < POCKETS_PER_PLAYER; i++) {
    board.push({
      id: `p2-pit-${i}`,
      ownerPlayerId: 'player-2',
      stones: INITIAL_STONES,
      isStore: false,
      oppositePitId: `p1-pit-${5 - i}`, // 例：p2-pit-0の向かいはp1-pit-5
    });
  }

  // player-2 のストア（インデックス 13）
  board.push({
    id: 'p2-store',
    ownerPlayerId: 'player-2',
    stones: 0,
    isStore: true,
  });

  return {
    gameId: crypto.randomUUID(),
    status: 'playing',
    mode,
    players: [player1, player2],
    board,
    currentPlayerId: 'player-1',
    winnerPlayerId: null,
    isDraw: false,
    turnCount: 0,
  };
}
