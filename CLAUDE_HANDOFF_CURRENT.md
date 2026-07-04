# Claude Code 引き継ぎメモ: Dragon Game Park / バックギャモン追加

この内容を Claude Code の新しいセッションに貼り付けてください。

## まず読んでほしいこと

このプロジェクトでは、UNO・マンカラだけでなく今後もたくさんのゲームを追加していく予定です。

そのため、引き継ぎでは「今の作業」だけでなく、今後のゲーム追加にも使える運用を大事にしてください。

- 作業が長くなったら、早めに引き継ぎ書を作る。
- 週の残り使用量が少ないとユーザーが言ったら、実装を無理に続けず、まず引き継ぎ書を更新する。
- 大きな機能が一段落したら、`CLAUDE_HANDOFF_CURRENT.md` を更新する。
- 節目では保存版の引き継ぎ書も作る（`handoffs/YYYY-MM-DD-*.md`）。
- ユーザーは初心者なので、ユーザーに操作してもらう時は必ず具体的に案内する。
- 修正・書き換えがあった場合、必要に応じて `CLAUDE_HANDOFF_CURRENT.md` の更新を毎回自動で行う（ユーザーからの標準指示）。

具体的な案内例:

```text
1. Chromeで http://127.0.0.1:5175/ を開いてください。
2. 画面が古いままなら Ctrl + R を1回押してください。
3. ホーム画面で「バックギャモン」を選んでください。
4. 盤が表示されるか教えてください。
```

SQLや設定値を貼ってもらう時は、必ず「今ある内容を全部消して貼るのか」「続きに貼るのか」まで明記してください。

## 現在の作業場所

- 作業フォルダ: `C:\Users\ray-0\Dragon-game-park`
- `main` ブランチが本番相当（Vercelが自動デプロイ）。
- 本番URL: `https://dragon-game-park.vercel.app`
- ローカル確認URL: `http://127.0.0.1:5175/`（サーバーはユーザーが別ウィンドウで起動済みのことが多い。起動コマンド: `node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5175`）
- 直近の保存版: [handoffs/2026-07-04-uno-mancala-redesign-complete.md](handoffs/2026-07-04-uno-mancala-redesign-complete.md)（UNOオンライン化〜ドラゴンファンタジー全面リデザイン〜マンカラ盤改善〜本番公開までの記録）
- UNO・マンカラの改善は `claude/dragon-redesign` ブランチで行い、`main` にマージ・本番公開済み。今回のバックギャモン作業は **`main` から新しいブランチ（例: `claude/backgammon`）を切って開始すること**。

## 現在の目的

バックギャモンを3つ目のゲームとして追加する。

**このセッションではまだ実装は始まっていません。** 前セッションはコードを書かず、引き継ぎ書の整備だけを行いました。次のセッションが最初にやることは、下記の「バックギャモン固有で最初に決めるべき論点」をユーザーに確認してから実装に入ることです。

## サイト全体のアーキテクチャ（ゲームを追加する時に触る場所）

新しいゲームを1つ追加するには、以下の3箇所の配線 + 1つの機能フォルダが必要です。

1. **`src/data/games.ts`** — ゲーム一覧データ。`GameInfo` 型は `{ id, title, description, status: 'available' | 'coming-soon', themeLabel }`。現在の登録:
   - `{ id: 'mancala', title: 'マンカラ', status: 'available', themeLabel: 'ボードゲーム' }`
   - `{ id: 'uno', title: 'UNO', status: 'available', themeLabel: 'カードゲーム' }`
   - バックギャモン用に `{ id: 'backgammon', title: 'バックギャモン', status: 'available', themeLabel: '...' }` を追加する。
2. **`src/pages/HomePage.tsx`** — `GAME_ICONS` / `GAME_ACCENT` の Record に `backgammon` のアイコン（絵文字候補: 🎲）とアクセントカラーを追加する。ドラゴンファンタジー配色（羊皮紙×深緑×金）に馴染む色を選ぶこと。
3. **`src/App.tsx`** — `AppScreen` 合併型に `'backgammon-setup' | 'backgammon-game' | 'backgammon-room' | 'backgammon-online-game'` 等を追加し、`onSelectGame` からの if/else ルーティングを他ゲームと同じパターンで追加する。
4. **`src/features/backgammon/`** — 新規フォルダ。マンカラを参考実装として構成を揃える（下記参照）。

### 参考実装: マンカラのファイル構成（`src/features/mancala/`）

純ロジック層（Reactに依存せず単体テスト可能）:
- `mancalaTypes.ts` — 型定義（`GameState`, `Player`, `PlayerId`, `Pit` など）
- `createInitialMancalaState.ts` — 初期状態を作るファクトリ関数
- `mancalaRules.ts` — ルールエンジン本体（`applyMove()`, `getMovePreview()` など）+ `mancalaRules.test.ts`
- `mancalaCpu.ts` — CPU思考ロジック（難易度段階あり）+ `mancalaCpu.test.ts`

UI層（React）:
- `MancalaSetupPage.tsx` — 人数・名前・CPU設定画面
- `MancalaGamePage.tsx` — オフライン対戦画面（盤描画・ターン進行・CPU自動操作・アニメーション統括）
- `MancalaBoard.tsx` / `MancalaPit.tsx` — 盤・穴の描画コンポーネント
- `MancalaRoomPage.tsx` — オンラインロビー（ルームコード発行、Supabase `mancala_rooms` テーブルとやり取り、`localStorage` にプレイヤーID/名前を保存）
- `MancalaOnlineGamePage.tsx` — オンライン対戦画面（Supabase経由で盤面同期）

バックギャモンもこの「純ロジック層 / UI層」の分離パターンを踏襲すること。ただしバックギャモンはサイコロ・複数の合法手候補・ヒット/バーなどマンカラより状態遷移が複雑なので、ルールエンジンの設計は前もって整理してから実装に入ること。

### オンライン対戦の既存パターン

Supabaseベース。マンカラの `mancala_rooms` テーブル（列: `room_code`, `player_count`, `host_id`, `guest_id`, `guest2_id`, `guest3_id`, `game_state` など）と同じ形を新テーブル（例: `backgammon_rooms`）で用意し、`MancalaRoomPage.tsx` / `MancalaOnlineGamePage.tsx` を参考に実装する。UNO側にも同様のオンライン実装があるので、必要なら比較検討する。

### デザインシステム

`src/styles/global.css` の `:root` にドラゴンファンタジー配色の変数がある（羊皮紙背景 `--bg`、深緑 `--brown`、金 `--gold` など。変数名は歴史的経緯でこの名前になっているが値は緑金系）。共有コンポーネント `src/components/Button.tsx` / `Card.tsx` を使うと自動でこの配色に乗る。フォントは見出し Zen Antique Soft、本文 Zen Maru Gothic（`index.html` でGoogle Fonts読み込み済み）。

## バックギャモン固有で最初に決めるべき論点（次セッションでユーザーに確認すること）

実装を始める前に、以下をユーザーに確認する:

1. **ルール範囲**: 標準ルールのみか、ダブリングキューブなどのバリアントも入れるか。
2. **オンライン対戦**: マンカラ/UNOと同様、最初からオンライン対戦を実装するか、まずはオフライン（人 vs CPU、人 vs 人 同一画面）から始めるか。
3. **CPU難易度**: 既存ゲームと同じ段階式（very-easy 〜 very-hard）にするか。
4. **見た目**: サイコロの演出、駒のデザイン、盤面レイアウトの希望（ドラゴンファンタジーの世界観を踏襲する前提で、他に要望があるか）。

## 次にやること

1. 上記の論点をユーザーに確認する。
2. `main` から新しいブランチ（例 `claude/backgammon`）を作成する。
3. 確認した論点をもとに、マンカラのファイル構成パターンに倣って `src/features/backgammon/` を実装する。
4. `src/data/games.ts` / `HomePage.tsx` / `App.tsx` にバックギャモンを配線する。
5. 実装後は `tsc --noEmit` / `vitest run` / プレビューでの画面確認を行い、完了したら `CLAUDE_HANDOFF_CURRENT.md` を更新する。
