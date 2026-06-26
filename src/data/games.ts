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
    description: '木製ボードとカラフルなおはじきで遊ぶ、かわいいカラハ式マンカラです。',
    status: 'available',
    themeLabel: 'ボードゲーム',
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
