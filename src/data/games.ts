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
    id: 'english-quest',
    title: 'イングリッシュ ラーニング オデッセイ',
    description: '音を聞き、精霊を集め、ことばの謎を解く学習RPG。英語がはじめてでも、8分の冒険から楽しめます。',
    status: 'available',
    themeLabel: '学習RPG',
  },
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
  // 将来追加するゲームの例（コメントアウト中）：
  // {
  //   id: 'reversi',
  //   title: 'リバーシ',
  //   description: '定番のひっくり返しゲーム。',
  //   status: 'coming-soon',
  //   themeLabel: 'ボードゲーム',
  // },
];
