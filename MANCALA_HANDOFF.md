# マンカラ改修・改善 引き継ぎ書

このファイルの内容を新しいClaude Codeセッションに貼り付けると、
マンカラの改修・改善をすぐに開始できます。

---

## ここから下をコピーして新規セッションに貼り付ける

---

# ドラゴンゲームパーク：マンカラを修正・改善したい

## あなたへのお願い

私はゲーム開発の初心者です。専門用語を使いすぎず、1つずつ丁寧に教えてください。
作業前に必ず現在のファイルを読んでから変更してください。
変更後は `npx vitest run` と `npm run build` が成功することを確認してください。

## プロジェクト概要

「ドラゴンゲームパーク」という Web ゲーム集を開発・公開しています。
最初のゲームとして「マンカラ（カラハ式）」を実装・公開済みです。
今回は **マンカラを修正・改善** したいと思っています。

## 環境情報

- **作業フォルダ**: `C:\Users\ray-0\Dragon-game-park`
- **GitHub**: https://github.com/kyouryu888-web/dragon-game-park
- **公開URL（Vercel）**: https://dragon-game-park.vercel.app
- **OS**: Windows 11
- **シェル**: PowerShell

## 技術構成

- React 19 + TypeScript（strict モード）
- Vite 8.1.0（ビルドツール）
- Vitest 4.1.9（テスト）
- CSS カスタムプロパティ（レスポンシブ対応）
- ルーティングライブラリなし（App.tsx の useState で画面切り替え）

---

## マンカラのファイル一覧と役割

```
src/features/mancala/
│
├── mancalaTypes.ts              ← 型定義
├── mancalaRules.ts              ← ゲームロジック（純粋関数）
├── mancalaRules.test.ts         ← ロジックのテスト（30件）
├── mancalaCpu.ts                ← CPU AI（追加ターン優先 → 捕獲優先 → ランダム）
├── mancalaCpu.test.ts           ← CPUのテスト（12件）
├── createInitialMancalaState.ts ← ゲーム開始時の状態を作る
│
├── MancalaSetupPage.tsx         ← 設定画面（モード選択・ルール説明）
├── MancalaGamePage.tsx          ← 対局画面（メインロジック・アニメーション管理）
├── MancalaBoard.tsx             ← ボード表示・浮遊アニメーション
└── MancalaPit.tsx               ← 穴・ストア表示コンポーネント
```

また、以下のファイルも関係します：
- `src/App.tsx` — 画面切り替えルーター
- `src/styles/global.css` — CSS変数・アニメーション定義

---

## 現在の実装：詳細

### ゲーム状態（GameState）

```typescript
type GameState = {
  gameId: string;
  status: 'playing' | 'finished';
  players: Player[];          // [player-1, player-2]
  board: Pit[];               // 全14穴の配列（下記の順番）
  currentPlayerId: PlayerId;
  winnerPlayerId: PlayerId | null;
  isDraw: boolean;
  turnCount: number;
  mode: 'cpu' | 'local-2p';
};
```

### 盤面配列（board）の構造

```
インデックス:  0     1     2     3     4     5    | 6       | 7     8     9    10    11    12   | 13
穴ID:      p1-pit-0〜5                          | p1-store | p2-pit-0〜5                      | p2-store
所有者:     player-1 × 6                        | player-1 | player-2 × 6                      | player-2
```

向かいの穴（捕獲ルール用）:
- `p1-pit-i` ↔ `p2-pit-(5-i)`  例：p1-pit-0 の向かいは p2-pit-5

### 画面表示上のボード配置

```
左端          上の行（P2）                   右端
[P2-store] | P2-pit-5 P2-pit-4 P2-pit-3 P2-pit-2 P2-pit-1 P2-pit-0 | [P1-store]
           | P1-pit-0 P1-pit-1 P1-pit-2 P1-pit-3 P1-pit-4 P1-pit-5 |
                      下の行（P1）
```

P2 の穴は表示時に `reverse()` して右→左に表示（board 配列の p2-pit-0〜5 とは順が逆）。

### アニメーションの仕組み（MancalaGamePage.tsx）

アニメーションは以下の状態変数で管理する：

```typescript
const [animSteps,     setAnimSteps]     = useState<GameState[]>([]);
const [animActiveIds, setAnimActiveIds] = useState<string[]>([]);
const [animIdx,       setAnimIdx]       = useState(0);
const [pendingMove,   setPendingMove]   = useState<string | null>(null);
```

- `animSteps[i]` = ステップ i の表示用盤面スナップショット
- `animActiveIds[i]` = ステップ i で「着地した穴」の ID
  - `[0]` = 石を拾い上げた元の穴
  - `[1..N]` = 石が1個ずつ着地していく穴
- `animIdx` = 現在表示中のステップ番号（`setInterval` で 400ms ごとに +1）
- `pendingMove` = アニメーション完了後に `applyMove` するために保持する pitId

`STONE_ANIM_MS = 400`（石1個あたりのアニメーション時間）

アニメーション終了条件：`animIdx >= animSteps.length`

### FloatingCluster アニメーション（MancalaBoard.tsx）

石の塊が宙に浮いて横移動する：

- `animIdx === 0`：元の穴の中心から上方 35px へ浮き上がる（`useLayoutEffect` + `requestAnimationFrame` 二重フレームで position 設定後に CSS transition を適用）
- `animIdx >= 1`：次の穴の上方 35px まで CSS transition で横移動
- `stonesInCluster = totalStones - animIdx`（着地するたびに1個減る）

`position: fixed` オーバーレイとして `zIndex: 9998` に表示。
各穴の DOM 位置は `cellRefMap`（`Map<string, HTMLElement>`）で管理。

### DroppingStone アニメーション（MancalaBoard.tsx）

石の塊から1個が穴に落下する：

- 表示条件：`animIdx > 0 && animIdx <= totalStones`
- `delay = stepMs * 0.54`（塊が穴の上に到着してから落下開始）
- `duration = stepMs * 0.44`
- Web Animations API で `translate(0,0)` → `translate(0, dy)` + opacity 0 で落下

### CPU の動作（MancalaGamePage.tsx の useEffect）

```
依存配列: [mode, status, currentPlayerId, turnCount]

条件: mode === 'cpu' && status === 'playing' && currentPlayerId === 'player-2'

タイムラグ: 700ms 後に chooseCpuMove を実行
キャンセル: cancelled フラグで cleanup（コンポーネントアンマウント時の誤動作防止）
```

### CPU の思考ロジック（mancalaCpu.ts）

優先順位：
1. `findExtraTurnMove` — 追加ターンを得られる手
2. `findCaptureMove` — 相手の石を捕獲できる手
3. `chooseRandomMove` — 上記がなければランダム

### 設定の保存（MancalaSetupPage.tsx）

```typescript
const STORAGE_KEY = 'dragon-game-park:mancala-mode';
// localStorage にモード（'cpu' | 'local-2p'）を保存・読み込み
```

---

## CSS の主な仕組み

### グローバルな CSS 変数（global.css）

```css
/* 木製ボードの色 */
--wood-deep: #3a1e08  --wood-dark: #5c3010
--wood-mid:  #7a4820  --wood-light: #b87838

/* ブランドカラー */
--brown: #5a3018  --orange: #c87028  --green: #4e8a4e  --gold: #d8b030

/* テキスト */
--text: #3a2518  --text-mid: #6a4a30  --text-muted: #907060

/* レスポンシブ（clamp で画面幅に追従） */
--board-store-w: clamp(32px, 9.5vw, 44px)
--board-gap:     clamp(3px, 1vw, 5px)
--board-px:      clamp(6px, 2vw, 10px)
--board-radius:  clamp(15px, 4vw, 22px)
```

### ピットのアニメーション CSS クラス

```css
.pit-btn.is-active  /* 石が着地 → 跳ねるアニメーション（黄色いグロー） */
.pit-btn.is-source  /* 石を拾い上げた穴 → へこんで明るくなる */
.pit-btn.is-selectable:hover /* 選択可能な穴 → ホバーで拡大 */
```

### 石の色パレット（GEM_COLORS、MancalaPit.tsx でエクスポート）

```typescript
export const GEM_COLORS = [
  { main: '#e63a2a', shine: '#ff8a7a' },  // ルビー
  { main: '#2878cc', shine: '#74b9ff' },  // サファイア
  { main: '#d4a408', shine: '#ffe060' },  // トパーズ
  { main: '#25a855', shine: '#6fcf97' },  // エメラルド
  { main: '#8e44c0', shine: '#d4a4e0' },  // アメジスト
  { main: '#d46018', shine: '#f08060' },  // アンバー
  { main: '#12a896', shine: '#5fe0c8' },  // アクアマリン
  { main: '#c81060', shine: '#f48fb1' },  // ローズクォーツ
];
```

---

## 現在の既知バグ・改善余地

### 修正済み（このセッションまでに対応済み）

- [x] `App.tsx` の古い開発メモコメント削除
- [x] ゲーム終了後の「設定画面へ戻る」→「マンカラ設定画面へ戻る」（4箇所）
- [x] ゲーム中ナビゲーションの「設定画面へ戻る」→「マンカラ設定画面へ戻る」

### 未対応の改善候補（優先度は要相談）

以下は見つかっている改善点です。改修セッションで取り組む内容を選んでください：

#### UI・UX
- [ ] プレイヤー名を対局前に入力できるようにする
- [ ] 石の個数表示フォント・色をもう少し見やすくする
- [ ] ゲーム終了後のリスタートで「同じモードで続ける」と「設定に戻る」を明確に分ける
- [ ] CPU 思考中のビジュアルフィードバックをより分かりやすくする
- [ ] 手番矢印（▶◀）をもっと目立つデザインにする

#### ゲームプレイ
- [ ] CPU の強さを選べるようにする（「かんたん」「ふつう」「むずかしい」）
- [ ] 対局回数・勝率などの履歴を localStorage に保存する
- [ ] 引き分けの場合のメッセージ・演出を追加する
- [ ] 「ヒント機能」（追加ターンや捕獲が狙える穴をハイライト）

#### アニメーション
- [ ] 捕獲発生時の特別な演出を追加する
- [ ] 追加ターン取得時の特別な演出を追加する
- [ ] ゲーム終了時の紙吹雪・勝利アニメーション

#### サウンド
- [ ] 石が落ちる音
- [ ] 追加ターン・捕獲時の効果音
- [ ] BGM（ループ）

#### アクセシビリティ
- [ ] キーボード操作対応（Tab で穴を選択、Enter で確定）
- [ ] スクリーンリーダー対応（aria-label の充実）

---

## テストの現状

```
テストファイル: 2つ
テスト数: 42件（全通過）

mancalaRules.test.ts (30件)
  - 初期盤面: 8件
  - 合法手判定: 6件
  - 石配り: 5件
  - 追加ターン: 2件
  - 捕獲ルール: 3件
  - ゲーム終了判定: 2件
  - 勝敗・引き分け判定: 3件 + その他 1件

mancalaCpu.test.ts (12件)
  - 基本動作: 4件
  - 追加ターン優先: 3件
  - 捕獲優先: 3件
  - ランダムフォールバック: 2件
```

新しいロジックを追加するときはテストも追加してください。

---

## 作業後の確認手順

```bash
# テスト確認
npx vitest run

# ビルド確認
npm run build

# 問題なければ GitHub に push → Vercel が自動デプロイ
git add .
git commit -m "Fix/Improve: 変更内容のメモ"
git push
```

---

## 今回やりたい修正・改善

（ここに作業内容を書いてください）

例：
- CPU の強さを3段階（かんたん・ふつう・むずかしい）にしたい
- 捕獲発生時に特別なアニメーションを追加したい
- プレイヤー名を入力できるようにしたい

---

上記の情報をもとに、指定の改善を進めてください。
作業の前に対象ファイルを必ず `Read` ツールで読んでから変更してください。
