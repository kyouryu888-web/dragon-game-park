# 新規ゲーム追加 引き継ぎプロンプト

このファイルの内容を新しいClaude Codeセッションに貼り付けると、
「ドラゴンゲームパーク」への新しいゲーム追加をすぐに開始できます。

---

## ここから下をコピーして新規セッションに貼り付ける

---

# ドラゴンゲームパーク：新しいゲームを追加したい

## あなたへのお願い

私はゲーム開発の初心者です。専門用語を使いすぎず、1つずつ丁寧に教えてください。
コードを書くときは、私が確認できるようにスクリーンショットを求めてください。

## プロジェクト概要

「ドラゴンゲームパーク」という Web ゲーム集を開発・公開しています。
最初のゲームとして「マンカラ（カラハ式）」を実装・公開済みです。
今回は **新しいゲームを追加** したいと思っています。

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

## プロジェクトのファイル構成

```
src/
├── App.tsx                        ← 画面ルーター（新しいゲームはここに追加）
├── main.tsx
├── App.css / index.css
├── assets/
│   └── hero.png（ドラゴン画像）
├── components/
│   ├── Button.tsx                 ← 共通ボタン
│   ├── Card.tsx                   ← 共通カード
│   └── Layout.tsx                 ← 共通レイアウト（max-width, padding）
├── data/
│   └── games.ts                   ← ゲーム一覧（新しいゲームはここに登録）
├── pages/
│   └── HomePage.tsx               ← ゲーム選択画面（games.ts から自動表示）
├── features/
│   └── mancala/                   ← マンカラゲームの実装（参考にする）
│       ├── mancalaTypes.ts        ← 型定義
│       ├── mancalaRules.ts        ← ゲームロジック
│       ├── mancalaRules.test.ts   ← テスト
│       ├── mancalaCpu.ts          ← CPU AI
│       ├── mancalaCpu.test.ts     ← テスト
│       ├── createInitialMancalaState.ts
│       ├── MancalaSetupPage.tsx   ← 設定画面
│       ├── MancalaGamePage.tsx    ← 対局画面（メインロジック）
│       ├── MancalaBoard.tsx       ← ボード表示・アニメーション
│       └── MancalaPit.tsx         ← 穴・ストア表示
└── styles/
    └── global.css                 ← CSS変数・レスポンシブ・アニメーション
```

## 新しいゲームを追加するときの手順

### Step 1：games.ts にゲームを登録する

`src/data/games.ts` の `games` 配列に追加する。

```typescript
{
  id: 'ゲームID（英字）',
  title: 'ゲーム名（日本語）',
  description: 'ゲームの説明文',
  status: 'available',        // 'coming-soon' にするとボタンが「近日公開」になる
  themeLabel: 'ボードゲーム', // カードに表示するジャンル
}
```

### Step 2：HomePage.tsx にアイコンとカラーを追加する

`src/pages/HomePage.tsx` の `GAME_ICONS` と `GAME_ACCENT` に追加する。

```typescript
const GAME_ICONS: Record<string, string> = {
  mancala: '🎯',
  新しいゲームID: '絵文字',   // ← 追加
};

const GAME_ACCENT: Record<string, string> = {
  mancala: '#c87038',
  新しいゲームID: '#カラーコード', // ← 追加
};
```

### Step 3：App.tsx に画面状態を追加する

`src/App.tsx` の `AppScreen` 型と画面分岐に追加する。

```typescript
type AppScreen = 'home' | 'mancala-setup' | 'mancala-game'
  | '新ゲームID-setup' | '新ゲームID-game'; // ← 追加

// onSelectGame の分岐に追加
if (gameId === '新ゲームID') setScreen('新ゲームID-setup');

// 設定画面・対局画面の分岐を追加
if (screen === '新ゲームID-setup') { return <新ゲームSetupPage ... /> }
if (screen === '新ゲームID-game')  { return <新ゲームGamePage  ... /> }
```

### Step 4：feature フォルダを作る

`src/features/新ゲームID/` フォルダを作り、以下のファイルを実装する。

```
src/features/新ゲームID/
├── 新ゲームTypes.ts         ← 型定義（GameState, Player など）
├── 新ゲームRules.ts         ← ゲームロジック（純粋関数）
├── 新ゲームRules.test.ts    ← ロジックのテスト
├── 新ゲームCpu.ts           ← CPU AI（人間 vs CPU に対応する場合）
├── 新ゲームCpu.test.ts      ← CPU AI のテスト
├── createInitial新ゲーム.ts ← 初期状態を作る関数
├── 新ゲームSetupPage.tsx    ← 設定画面（モード選択など）
├── 新ゲームGamePage.tsx     ← 対局画面（メインロジック・アニメーション）
└── 新ゲームBoard.tsx        ← ボード表示（必要なら）
```

## 既存コードのパターン（マンカラを参考にする）

### 画面名の統一ルール

| 画面 | 名前 |
|---|---|
| トップ | ゲーム選択画面 |
| 設定 | [ゲーム名]設定画面 |
| 対局 | [ゲーム名]対局画面 |

ボタン名もこの名前で統一する。例：「マンカラ設定画面へ戻る」

### CSS 変数（global.css で定義済み）

```css
--bg, --card, --text, --text-mid, --text-muted
--brown, --orange, --green, --gold
--border, --border-light
--shadow-sm, --shadow-md, --shadow-lg
--r-sm(10px), --r-md(16px), --r-lg(24px)
/* レスポンシブ */
--board-store-w, --board-gap, --board-px, --board-py, --board-radius
--hero-pt, --hero-pb, --setup-pt, --game-page-pt, --game-page-pb
```

### CSS クラス（global.css で定義済み）

```css
.app-layout        /* 最大幅・余白（Layout.tsx が使用）*/
.game-grid         /* ゲームカード一覧のグリッド */
.mode-cards        /* 設定画面のモードカード */
.board-outer       /* ボード外枠 */
.board-grid        /* ボードのグリッド */
.board-count-row   /* 石の個数表示行 */
.btn, .btn-primary, .btn-secondary, .btn-ghost  /* ボタン */
.pit-btn           /* 穴ボタン */
.dragon-float      /* ドラゴンふわふわ */
.cpu-thinking-pulse /* CPU 思考中の点滅 */
.result-appear     /* 結果カードのスケールイン */
.turn-slide        /* 手番バナーのスライドイン */
```

### ゲームロジックの実装パターン

- ロジックは **純粋関数** で書く（副作用なし）
- `applyMove(state, action) => newState` の形式
- テストは Vitest で書く（`*.test.ts`）
- CPU AI は priority 順で手を選ぶ（追加ターン→有利な手→ランダム）

### アニメーション実装のパターン（マンカラ参照）

- `animSteps[]`（各ステップの状態）+ `animIdx`（現在のステップ）で管理
- `useLayoutEffect` で DOM 位置を計算してから CSS transition
- `position: fixed` のオーバーレイで盤面の上にレンダリング
- Web Animations API（`element.animate()`）でドロップアニメーション

### CPU 実装の注意点

- `useEffect` の依存配列に注意（`[mode, status, currentPlayerId, turnCount]`）
- `cancelled` フラグでクリーンアップ（コンポーネントアンマウント時の誤動作防止）
- `isCpuThinking` フラグでアニメーション中のボード操作を無効化

## 品質基準（完成の条件）

新しいゲームを完成とみなす基準：

```bash
npx vitest run      # 全テスト通過
npm run build       # TypeScriptエラーなし・ビルド成功
```

- `console.log` が残っていない
- `dist/`・`node_modules/` を git に含めない
- スマホ・タブレット・PC で大きく崩れない
- 人間 vs 人間・人間 vs CPU 両方で最後まで遊べる
- 勝敗・引き分けが正しく表示される
- 画面遷移（設定画面へ戻る・ゲーム選択画面へ戻る）が動く
- リスタートが動く

## GitHub・Vercel へのデプロイ手順

完成したら以下で自動公開される：

```bash
git add .
git commit -m "Add [ゲーム名] game"
git push
```

`git push` するだけで Vercel が自動的に再デプロイします。  
公開URL: https://dragon-game-park.vercel.app

---

## 今回追加したいゲーム

（ここに作りたいゲームの名前とルールを書いてください）

例：
- ゲーム名：リバーシ（オセロ）
- ルール：相手の石を挟んでひっくり返す。盤面の石が多い方が勝ち。
- 対戦モード：人間 vs 人間、人間 vs CPU
- 特記事項：なし

---

上記の情報をもとに、新しいゲームを追加するための計画を立てて、
Step 1 から順番に進めてください。
