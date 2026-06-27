// ============================================================
// マンカラ専用の型定義
// ============================================================

/** プレイヤーID（最大4人） */
export type PlayerId = 'player-1' | 'player-2' | 'player-3' | 'player-4';

/** CPU の強さ（5段階） */
export type CpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

/** 1人分のプレイヤー設定（設定画面から渡す） */
export type PlayerConfig = {
  name: string;
  isCpu: boolean;
  cpuLevel: CpuLevel;
};

/** ゲーム開始設定（設定画面 → 対局画面に渡す） */
export type MancalaConfig = {
  playerCount: 2 | 3 | 4;
  players: PlayerConfig[]; // playerCount 人分の配列
};

/** ゲームの進行状態 */
export type GameStatus = 'playing' | 'finished';

/** プレイヤー1人分の情報（盤面上の状態） */
export type Player = {
  id: PlayerId;
  name: string;
  isCpu: boolean;
  cpuLevel: CpuLevel;
};

/**
 * 盤面上の1つの穴（小さい穴＝pocket、大きい穴＝store）
 *
 * isStore: true  → ストア（得点穴）
 * isStore: false → ポケット（通常の穴）
 *
 * oppositePitId: 向かい側のポケットのID（捕獲ルール用・2人プレイのみ）
 */
export type Pit = {
  id: string;
  ownerPlayerId: PlayerId;
  stones: number;
  isStore: boolean;
  oppositePitId?: string;
};

/**
 * ゲーム全体の状態
 *
 * board: 盤面上の全ての穴を配列で管理する
 *   並び順（石を時計回りに配る順）：
 *   [p1-pit-0〜5, p1-store, p2-pit-0〜5, p2-store, ...]
 *   ※ プレイヤー数に応じて繰り返す
 */
export type GameState = {
  gameId: string;
  status: GameStatus;
  players: Player[];
  board: Pit[];
  currentPlayerId: PlayerId;
  winnerPlayerId: PlayerId | null;
  isDraw: boolean;
  turnCount: number;
  playerCount: 2 | 3 | 4;
  /** 現在ゲームに残っているプレイヤーID（脱落するたびに減る） */
  activePlayerIds: PlayerId[];
};
