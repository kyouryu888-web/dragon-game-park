import type { MancalaConfig, CpuLevel, GameState, Pit, Player, PlayerId } from './mancalaTypes';
import { getCpuDisplayName } from './mancalaCpu';

const POCKETS_PER_PLAYER = 6;
const INITIAL_STONES = 4;

const ALL_PLAYER_IDS: PlayerId[] = ['player-1', 'player-2', 'player-3', 'player-4'];
const ID_TO_PREFIX: Record<PlayerId, string> = {
  'player-1': 'p1',
  'player-2': 'p2',
  'player-3': 'p3',
  'player-4': 'p4',
};

/**
 * ゲーム開始時の状態を作る。
 *
 * MancalaConfig オブジェクトを受け取る（プレイヤー数・各人の設定を含む）。
 * 後方互換性のため 'cpu' / 'local-2p' の文字列も受け付ける（テスト用）。
 *
 * 盤面配列の並び順（石を時計回りに配る順）：
 *   [p1-pit-0〜5, p1-store, p2-pit-0〜5, p2-store, ...]
 *   プレイヤー数分だけ繰り返す
 *
 * 向かいの穴の対応（2人プレイ時のみ・捕獲ルール用）：
 *   p1-pit-i ↔ p2-pit-(5-i)
 */
export function createInitialMancalaState(
  modeOrConfig: MancalaConfig | 'cpu' | 'local-2p'
): GameState {
  // 後方互換性：文字列を受け取った場合は 2人設定に変換
  if (typeof modeOrConfig === 'string') {
    const isCpu = modeOrConfig === 'cpu';
    return createInitialMancalaState({
      playerCount: 2,
      players: [
        { name: '',    isCpu: false, cpuLevel: 'normal' },
        { name: '',    isCpu: isCpu, cpuLevel: 'normal' },
      ],
    });
  }

  const { playerCount, players: playerConfigs } = modeOrConfig;
  const playerIds = ALL_PLAYER_IDS.slice(0, playerCount);

  const players: Player[] = playerIds.map((id, i) => {
    const cfg: { name: string; isCpu: boolean; cpuLevel: CpuLevel } =
      playerConfigs[i] ?? { name: '', isCpu: false, cpuLevel: 'normal' };
    const defaultName = cfg.isCpu
      ? getCpuDisplayName(cfg.cpuLevel)
      : `プレイヤー${i + 1}`;
    return {
      id,
      name: cfg.name.trim() || defaultName,
      isCpu: cfg.isCpu,
      cpuLevel: cfg.cpuLevel,
    };
  });

  const board: Pit[] = [];

  for (let pi = 0; pi < playerCount; pi++) {
    const playerId = playerIds[pi];
    const prefix   = ID_TO_PREFIX[playerId];

    // ポケット（小さい穴）
    for (let i = 0; i < POCKETS_PER_PLAYER; i++) {
      // oppositePitId は 2人プレイ時のみ設定（捕獲ルール用）
      const oppositePitId =
        playerCount === 2
          ? `${ID_TO_PREFIX[playerIds[1 - pi]]}-pit-${5 - i}`
          : undefined;

      board.push({
        id: `${prefix}-pit-${i}`,
        ownerPlayerId: playerId,
        stones: INITIAL_STONES,
        isStore: false,
        oppositePitId,
      });
    }

    // ストア（得点穴）
    board.push({
      id: `${prefix}-store`,
      ownerPlayerId: playerId,
      stones: 0,
      isStore: true,
    });
  }

  return {
    gameId: crypto.randomUUID(),
    status: 'playing',
    playerCount,
    players,
    board,
    currentPlayerId: 'player-1',
    winnerPlayerId: null,
    isDraw: false,
    turnCount: 0,
    activePlayerIds: playerIds,
  };
}
