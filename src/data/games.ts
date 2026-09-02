/**
 * ゲーム1つ分の情報
 * 将来ゲームを追加するときは、games 配列にこの形式で追記するだけでOK
 */
export type GameInfo = {
  id: string;
  title: string;
  description: string;
  status: 'available' | 'coming-soon'; // available=遊べる coming-soon=近日公開
  themeLabel: string;                   // カードに表示するジャンル名
};

/**
 * ゲーム一覧
 * ここにデータを追加するだけで、ゲーム選択画面に自動で表示される
 */
export const games: GameInfo[] = [
  {
    id: 'mancala',
    title: 'マンカラ',
    description: '古木の盤に石を配り、種を蒔くように陣を築く——いにしえより伝わる遊戯カラハ。',
    status: 'available',
    themeLabel: 'ボードゲーム',
  },
  {
    id: 'backgammon',
    title: 'バックギャモン',
    description: '骰子に運命を委ね、15の駒を故郷へ帰す——世界最古の盤上遊戯。番人ドラゴンとの対決も、遠方の者との対戦も。',
    status: 'available',
    themeLabel: 'ボードゲーム',
  },
  {
    id: 'uno',
    title: 'UNO',
    description: '色と数字を紡いで手札を燃やし尽くすカードの決闘。掟の厳しいハード版も待ち受ける。',
    status: 'available',
    themeLabel: 'カードゲーム',
  },
  {
    id: 'babanuki',
    title: '最弱王ババ抜き',
    description: 'ジョーカーを最後まで抱えた者が最弱王。1人1回のシャッフルタイムが、膠着した盤面を根こそぎひっくり返す。',
    status: 'available',
    themeLabel: 'カードゲーム',
  },
  {
    id: 'reversi',
    title: 'リバーシ（通常）',
    description: '黒炎と白銀の竜陣。角を制し、一手ごとに敵陣を奪い合って最後の石まで勝敗を奪い合う。',
    status: 'available',
    themeLabel: 'ボードゲーム',
  },
  {
    id: 'bakuretsu-reversi',
    title: '爆裂リバーシー',
    description: '爆弾・感染・盾の魔法が飛び交う過激なリバーシ。相手の特殊コマは見えないため心理戦が試される。',
    status: 'available',
    themeLabel: 'ボードゲーム',
  },
  // 将来追加するゲームの例（コメントアウト中）：
];
