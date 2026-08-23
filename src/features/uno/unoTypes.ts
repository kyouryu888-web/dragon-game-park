// ============================================================
// UNO 専用の型定義
// ============================================================

/** 4色 */
export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';

/** 数字カードの値 */
export type UnoNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** アクションカードの記号（colored card）*/
export type UnoActionSymbol =
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'draw4'       // hard モードのみ（色付きドロー4）
  | 'discard-all'; // hard モードのみ（指定カラー全捨て）

/** ワイルドカードの記号 */
export type UnoWildSymbol =
  | 'wild'
  | 'wild-draw4'
  | 'wild-draw6'           // hard のみ
  | 'wild-draw10'          // hard のみ
  | 'wild-reverse-draw4'   // hard のみ
  | 'wild-color-roulette'  // hard のみ（重ね出し不可）
  | 'wild-skip-all';       // hard のみ

/** カードの種類（3つの union で定義）*/
export type UnoCardFace =
  | { kind: 'number'; color: UnoColor; value: UnoNumber }
  | { kind: 'action'; color: UnoColor; symbol: UnoActionSymbol }
  | { kind: 'wild';   symbol: UnoWildSymbol };

/** 1枚のカード（face + ユニークID）*/
export type UnoCard = UnoCardFace & { id: string };

// ---- プレイヤー ----

/** プレイヤーID。形式: 'player-0' ～ 'player-9' */
export type UnoPlayerId = string;

/** 1人のプレイヤー情報 */
export type UnoPlayer = {
  id: UnoPlayerId;
  name: string;
  isCpu: boolean;
  cpuLevel?: UnoCpuLevel;
  isEliminated: boolean; // hard モード: 25枚以上で脱落
};

// ---- ゲーム設定 ----

export type UnoVariant = 'standard' | 'hard';
export type UnoCpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

export type UnoPlayerConfig = {
  name: string;
  isCpu: boolean;
  cpuLevel?: UnoCpuLevel;
};

export type UnoConfig = {
  variant: UnoVariant;
  /** プレイヤーの並び順。最初の手番は開始前のカード引きで決める */
  playerConfigs: UnoPlayerConfig[];
};

// ---- ペンディングアクション（割り込み状態）----

/** ワイルドカード後の色選択待ち */
export type PendingColorPick = {
  kind: 'color-pick';
  chooserPlayerId: UnoPlayerId;
  /** 色確定後に適用するドロー枚数（0 = なし）*/
  pendingDrawAfterColor: number;
  /** wild-reverse-draw4: 色確定後に方向反転 */
  reverseAfterColor: boolean;
};

/** hard モード: 7を出した後のスワップ相手選択待ち */
export type PendingSwapPick = {
  kind: 'swap-pick';
  swapperPlayerId: UnoPlayerId;
};

/** hard モード: カラールーレット実行中 */
export type PendingColorRoulette = {
  kind: 'color-roulette';
  targetPlayerId: UnoPlayerId;
  targetColor: UnoColor;
  /** このルーレットで引いた枚数。既存の保存状態では未設定の場合がある。 */
  drawnCount?: number;
};

/** UNO 宣言猶予ウィンドウ */
export type PendingUnoWindow = {
  kind: 'uno-window';
  playerWithOneCard: UnoPlayerId;
  declared: boolean;
};

/** 山札から1枚引いた後、その引いたカードだけ出せる状態 */
export type PendingDrawnCardPlay = {
  kind: 'drawn-card-play';
  playerId: UnoPlayerId;
  cardId: string;
};

export type PendingAction =
  | PendingColorPick
  | PendingSwapPick
  | PendingColorRoulette
  | PendingUnoWindow
  | PendingDrawnCardPlay
  | null;

/** ゲーム開始前に、スタートプレイヤー決定のために引いたカード */
export type UnoStarterDraw = {
  playerId: UnoPlayerId;
  card: UnoCard;
  value: number;
  round: number;
};

// ---- ゲーム全体の状態 ----

export type UnoGameState = {
  gameId: string;
  variant: UnoVariant;
  status: 'deciding-starter' | 'starter-ready' | 'playing' | 'finished';

  /** 全プレイヤー（順番がターン順）*/
  players: UnoPlayer[];

  /** 各プレイヤーの手札（キー: UnoPlayerId）*/
  hands: Record<UnoPlayerId, UnoCard[]>;

  /** 山札（先頭が次に引くカード）*/
  deck: UnoCard[];

  /** 捨て札（先頭が直前に出されたカード）*/
  discardPile: UnoCard[];

  /** 現在手番のプレイヤーID */
  currentPlayerId: UnoPlayerId;

  /** 開始前のスタートプレイヤー決定に使ったカード */
  starterDraws: UnoStarterDraw[];

  /** 進行方向 */
  direction: 'clockwise' | 'counterclockwise';

  /** 現在の有効な色（ワイルド後は選択色）*/
  activeColor: UnoColor;

  /** ドロースタッキングの累積枚数 */
  pendingDrawCount: number;

  /** スタック可否判定用（最後に出されたドローカードの枚数）*/
  lastDrawCardValue: number;

  /** 割り込み状態 */
  pendingAction: PendingAction;

  /** 勝者のID（status='finished' のときのみ有効）*/
  winnerPlayerId: UnoPlayerId | null;

  /** ゲーム終了時に確定した手札点数 */
  finalScores: Record<UnoPlayerId, number> | null;

  /** ハード版の25枚KOで脱落した瞬間の手札点数 */
  eliminatedScores: Record<UnoPlayerId, number>;

  /** ターンカウンタ（CPU の useEffect 依存配列用）*/
  turnCount: number;

  /** UNO 宣言済みプレイヤーの集合 */
  unoDeclaredIds: UnoPlayerId[];
};
