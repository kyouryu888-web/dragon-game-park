// 検証ループで掃引する全パラメータ。エンジン内にハードコードしない。
import type { BlastRange, SpecialType } from './types.ts';

export interface RuleConfig {
  /** 爆破射程を EIGHT へ切り替える盤上コマ数の閾値 */
  blastThreshold: number;
  blastRangeEarly: BlastRange;
  blastRangeLate: BlastRange;
  /** INFECT の奪取範囲（N閾値の対象外） */
  infectRange: BlastRange;
  shieldDurability: number;
  dummyCount: number;
  specialCount: number;
  /** 配布プール（NEUTRAL の存廃検証用） */
  dealPool: SpecialType[];
  maxQuestionMarks: number;
  /** 中立コマが挟み込みの端になれるか（原則①より false） */
  neutralCanBeEndpoint: boolean;
  /** 中立コマが裏返らない永続壁になるか */
  neutralPermanent: boolean;
  /** 中立のみを挟んだライン（相手コマ0枚）を裏返せるか */
  neutralOnlyLineFlips: boolean;
  /** 爆破範囲内のBOMBが誘爆するか（false なら未発動返却） */
  bombDetonatesOnBlast: boolean;
  /** 案B: 爆風が範囲内の全特殊コマ（INFECT含む）を誘発するか */
  blastTriggersAllSpecials: boolean;
  /** 中立コマを合法手マス以外の空きマスにも配置できるか */
  neutralFreePlacement: boolean;
  /** 裏返しを爆破より先に確定するか（原則②の解決順序の反転） */
  flipBeforeBlast: boolean;
  /** 案B: 「？」を含むラインの裏返しを辞退できるか */
  optionalQuestionLines: boolean;
  /** 爆破が仕掛けた側（配置者）のコマを破壊しないか（原則①の徹底） */
  bombSparesPlanter: boolean;
  /** 案D: 特殊コマを表向きに置く（ブラフ機構・ダミー権を廃止） */
  openSpecials: boolean;
  /** 救済配置エリア（中央 n×n、満杯なら +2 拡張） */
  rescueAreaSize: number;
  /** 双方全滅時に引き分け即終局（Ver1.6で中央リセットを廃止） */
  mutualExtinctionIsDraw: boolean;
}

export const DEFAULT_CONFIG: RuleConfig = {
  blastThreshold: 24,          // 再導出: 破壊率19.1%
  blastRangeEarly: 'CROSS',
  blastRangeLate: 'EIGHT',
  infectRange: 'CROSS',
  shieldDurability: 1,
  dummyCount: 0,               // ダミー権廃止
  specialCount: 3,
  dealPool: ['BOMB', 'INFECT', 'SHIELD', 'NEUTRAL'],
  maxQuestionMarks: 2,
  neutralCanBeEndpoint: false,
  neutralPermanent: false,
  neutralOnlyLineFlips: false,
  bombDetonatesOnBlast: true,
  blastTriggersAllSpecials: false, // 検証で無効と判明 → P3後に再掃引
  neutralFreePlacement: false, // 同上
  flipBeforeBlast: true,  // ★欠陥1の修正を正式採用
  optionalQuestionLines: false, // 案D採用に伴い不要
  bombSparesPlanter: true,   // ★双方パス問題を解消
  openSpecials: true,          // 案D採用: ブラフ機構を廃止
  rescueAreaSize: 4,
  mutualExtinctionIsDraw: true,
};
