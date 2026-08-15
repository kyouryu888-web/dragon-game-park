/**
 * 最弱王ババ抜き 型定義
 * ルールの詳細は docs/babanuki-spec.md を参照。
 */

/** CPUの強さ（マンカラ・バックギャモンと同じ5段階） */
export type CpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

export type Suit = 'spade' | 'heart' | 'diamond' | 'club' | 'joker';

/** ジョーカーは suit='joker' / rank=0 で表す */
export type Card = {
  id: string;
  suit: Suit;
  rank: number;
};

export type PlayerConfig = {
  name: string;
  isCpu: boolean;
  cpuLevel: CpuLevel;
};

export type BabanukiConfig = {
  playerCount: number;
  players: PlayerConfig[];
};

export type BabanukiPlayer = {
  id: string;
  name: string;
  isCpu: boolean;
  cpuLevel: CpuLevel;
  /** 手札は順序付き。引く側は位置を選ぶので順序に意味がある */
  hand: Card[];
  /**
   * 飛び出させている札のカードID。引く側にも見える。
   * **位置ではなくカードそのものに紐づく**ので、並べ替えても飛び出したままで、
   * その札が手札から無くなるか本人が解除するまで続く。
   */
  spotlightCardId: string | null;
  /** 勝ち抜けた順位（1始まり）。まだ残っていれば null */
  finishedRank: number | null;
  /** シャッフルタイムの権利（1ゲーム1回） */
  shuffleRight: boolean;
};

/**
 * awaiting-draw : 手番者が右隣から1枚引くのを待っている。
 *                 **シャッフルタイムはこの間ずっと宣言できる**（制限時間はない）。
 * rolling       : シャッフルタイム発動中（サイコロ〜手札移動）
 */
export type BabanukiPhase = 'awaiting-draw' | 'rolling' | 'finished';

/** アニメーション再生用のイベント記述。オンラインでは受信側がこれを見て同じ演出を流す */
export type BabanukiEvent =
  | { kind: 'initial-discard'; playerId: string; cardIds: string[] }
  | { kind: 'draw'; fromId: string; toId: string; fromIndex: number; cardId: string }
  | { kind: 'discard-pair'; playerId: string; cardIds: [string, string] }
  | { kind: 'shuffle'; declarerId: string; dice: number; mapping: Record<string, string> }
  | { kind: 'finish'; playerId: string; rank: number }
  | { kind: 'game-end'; loserId: string };

export type PendingShuffle = {
  declarerId: string;
  dice: number;
};

export type BabanukiState = {
  players: BabanukiPlayer[];
  /** 時計回りの座席順。index+1 が左隣（次の手番）、index-1 が右隣（引く相手） */
  seatOrder: string[];
  currentPlayerId: string;
  phase: BabanukiPhase;
  /** 1ターンにシャッフルタイムは1回まで */
  shuffleUsedThisTurn: boolean;
  pendingShuffle: PendingShuffle | null;
  discardPile: Card[];
  /** 勝ち抜け順のプレイヤーID */
  finishOrder: string[];
  /** 最弱王（決着後のみ） */
  loserId: string | null;
  /** 直近の操作で起きたことだけを入れる（履歴ではない） */
  events: BabanukiEvent[];
  /** events が更新されるたびに増える。クライアントは未再生ぶんの判定に使う */
  eventSeq: number;
};

/**
 * CPUが「どの札を引こうか迷っている」間の長さ。
 * これがそのまま、人間がシャッフルタイムを使うか考えられる時間になる。
 */
export const CPU_THINK_MS = 3000;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

export function isJoker(card: Card): boolean {
  return card.suit === 'joker';
}
