// 爆裂リバーシー ルールエンジン Ver1.6 — 型定義
// P1: ヘッドレス純粋関数エンジン（サーバ権威で再利用する）

export type PlayerId = 'NONE' | 'BLACK' | 'WHITE';
export type Side = 'BLACK' | 'WHITE';
export type PieceStateEnum = 'EMPTY' | 'FACEDOWN' | 'FACEUP';
export type SpecialType = 'NONE' | 'BOMB' | 'INFECT' | 'SHIELD' | 'NEUTRAL' | 'DUMMY';
export type BlastRange = 'CROSS' | 'EIGHT';

/** 手札に配られうる特殊コマ4種 */
export const SPECIAL_KINDS: SpecialType[] = ['BOMB', 'INFECT', 'SHIELD', 'NEUTRAL'];

export interface BoardCell {
  state: PieceStateEnum;
  owner: PlayerId;        // NEUTRAL は 'NONE'
  specialType: SpecialType;
  durability: number;     // SHIELD 初期1
  isQueued: boolean;      // 当該手番で捕捉済み（処理は一度きり）
  activated: boolean;     // BOMB/INFECT が発動済みか
}

export interface PlayerHand {
  playerId: Side;
  initialSpecials: SpecialType[]; // 配布3種（公開情報）
  specialPieces: SpecialType[];   // 残り（非公開）
  dummyCount: number;             // 初期2（非公開）
}

/** Ver1.6: TurnTimer を廃止し持ち時間バンクに置換 */
export interface TimeBank {
  remainingMs: Record<Side, number>;
  consecutiveAutoMoves: Record<Side, number>;
  disconnectGraceUntil: number | null;
}

export type MoveKind = 'NORMAL' | 'DUMMY' | 'SPECIAL';

export interface Move {
  x: number;
  y: number;
  kind: MoveKind;
  special?: SpecialType; // kind==='SPECIAL' のとき必須
  /** 案B: 裏返しを辞退する方向（DIRS8の添字）。「？」を含む方向のみ指定可 */
  skipDirs?: number[];
}

export type GameStatus = 'PLAYING' | 'FINISHED';
export type EndReason = 'BOTH_PASS' | 'BOARD_FULL' | 'MUTUAL_EXTINCTION' | 'ABANDON';

export interface GameState {
  board: BoardCell[];          // 64 (idx = y*8+x)
  currentTurn: Side;
  hands: Record<Side, PlayerHand>;
  activeQuestionCount: number; // 公開情報（上限2）
  status: GameStatus;
  passStreak: number;
  moveNo: number;
  endReason?: EndReason;
  winner?: PlayerId;           // 'NONE' は引き分け
}

// ---- 解決イベント（UI再生・検証計測の両方で使う）----
export type ChainEvent =
  | { t: 'PLACE'; idx: number; by: Side; kind: MoveKind; special?: SpecialType; n: number; blast: BlastRange }
  | { t: 'QUEUE'; idxs: number[] }
  | { t: 'BOMB'; depth: number; idx: number; range: BlastRange; destroyed: number[]; absorbed: number[]; chained: number[]; owners: PlayerId[]; planter: PlayerId }
  | { t: 'INFECT'; depth: number; idx: number; stolen: number[]; selfFlipped: boolean }
  | { t: 'SHIELD_ABSORB'; idx: number; cause: 'FLIP' | 'BLAST' }
  | { t: 'FLIP'; idxs: number[]; to: Side; from: number; lines: number[][] }
  | { t: 'FLIP_CANCELLED'; idxs: number[] }
  | { t: 'RETURN_TO_HAND'; idx: number; owner: Side; special: SpecialType }
  | { t: 'REVEAL'; idx: number; special: SpecialType }
  | { t: 'RESCUE'; idx: number; player: Side }
  | { t: 'PASS'; player: Side }
  | { t: 'END'; reason: EndReason; winner: PlayerId; black: number; white: number };

export interface TurnResult {
  state: GameState;
  events: ChainEvent[];
  maxDepth: number;
}
