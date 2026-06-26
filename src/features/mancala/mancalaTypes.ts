// ============================================================
// マンカラ専用の型定義
// ============================================================

/** プレイヤーID。将来4人対戦に拡張するときはここに追加する */
export type PlayerId = 'player-1' | 'player-2';

/** 対戦モード */
export type MancalaMode = 'cpu' | 'local-2p';

/** CPU の強さ（5段階） */
export type CpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

/** ゲーム開始設定（設定画面 → 対局画面に渡す） */
export type MancalaConfig = {
  mode: MancalaMode;
  cpuLevel: CpuLevel;
  player1Name: string;
  player2Name: string; // local-2p のみ使用。cpu 時は cpuLevel から自動生成
};

/** ゲームの進行状態 */
export type GameStatus = 'playing' | 'finished';

/** プレイヤー1人分の情報 */
export type Player = {
  id: PlayerId;
  name: string;
  isCpu: boolean;
};

/**
 * 盤面上の1つの穴（小さい穴＝pocket、大きい穴＝store）
 *
 * isStore: true  → ストア（得点穴）
 * isStore: false → ポケット（通常の穴）
 *
 * oppositePitId: 向かい側のポケットのID（捕獲ルール用）
 *   ストアには向かいの穴がないので undefined
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
 *   並び順（この順番で石を配る）：
 *   [p1-pit-0〜5, p1-store, p2-pit-0〜5, p2-store]
 *   ※ 将来オンライン対戦でそのまま共有できる構造
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
  mode: MancalaMode;
};
