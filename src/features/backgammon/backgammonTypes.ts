// バックギャモンの型定義（純ロジック層・Reactに依存しない）

export type CpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

/** プレイヤーID。white=金龍（インデックス23→0へ進む）、black=翠龍（0→23へ進む） */
export type PlayerId = 'white' | 'black';

export type PlayerConfig = {
  name: string;
  isCpu: boolean;
  cpuLevel: CpuLevel;
};

export type BackgammonConfig = {
  /** [0]=white（金）, [1]=black（翠） */
  players: [PlayerConfig, PlayerConfig];
  /** ダブリングキューブを使うか */
  useDoublingCube: boolean;
};

/** ポイント1つの状態。駒がなければ null */
export type Point = { owner: PlayerId; count: number } | null;

export type Phase =
  | 'opening-roll'    // オープニングロール（両者1個ずつ振って先手を決める）
  | 'rolling'         // 手番プレイヤーがサイコロを振る前（ダブル提案可能）
  | 'moving'          // 出目を使って駒を動かす
  | 'double-offered'  // ダブル提案中（相手が受諾/拒否を選ぶ）
  | 'finished';

export type WinKind = 'single' | 'gammon' | 'backgammon';

/** 1手（駒1個をサイコロ1個分動かす） */
export type Move = {
  from: number | 'bar';  // 0-23 のポイント番号 or バー
  to: number | 'off';    // 0-23 のポイント番号 or ベアオフ
  die: number;           // 使用する出目
};

export type GameState = {
  /** 24ポイント。index 0-5 が white のホームボード、18-23 が black のホームボード */
  points: Point[];
  bar: Record<PlayerId, number>;
  borneOff: Record<PlayerId, number>;
  currentPlayer: PlayerId;
  phase: Phase;
  /** まだ使っていない出目（ゾロ目なら同じ数字が4個） */
  dice: number[];
  /** 演出用: 直近に振ったサイコロの生の出目 */
  rolled: [number, number] | null;
  /** オープニングロールの出目 [white, black]（演出用） */
  openingRoll: [number, number] | null;
  /** ダブリングキューブ。owner=null はセンター（どちらも提案可能） */
  cube: { value: number; owner: PlayerId | null };
  /** ダブル提案者（phase が double-offered のとき） */
  doubleOfferedBy: PlayerId | null;
  winner: PlayerId | null;
  winKind: WinKind | null;
  /** 勝者の獲得点（キューブ値 × 勝ち方の倍率） */
  resultPoints: number | null;
  turnCount: number;
};
