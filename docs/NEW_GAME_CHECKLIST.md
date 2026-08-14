# 新ゲーム追加チェックリスト（軽量版）

`NEW_GAME_PROMPT.md`（854行）は実装パターンの辞書。**全部読むとトークンを大量に消費する**ので、
新セッションではまずこのファイルだけ読み、必要になったパターンだけ `NEW_GAME_PROMPT.md` の
該当見出しを `grep -n` で拾って部分的に読むこと。

最終確認: 2026-08-14（`npm run build` 成功、下記の行番号は同日時点）

## 1. 配線箇所（これで全部・4ファイル）

| # | ファイル | 変更内容 |
|---|---|---|
| 1 | [src/data/games.ts:17](../src/data/games.ts) | `games` 配列に `{ id, title, description, status, themeLabel }` を追加 |
| 2 | [src/pages/HomePage.tsx:8](../src/pages/HomePage.tsx) | `GAME_ICONS` に絵文字、`GAME_ACCENT`(:18) にアクセント色、`GAME_EN`(:27) に英字名 |
| 3 | [src/App.tsx:17](../src/App.tsx) | `AppScreen` に画面名を追加 → 冒頭に import → `onSelectGame`(:52) に分岐 → 画面の `if (screen === ...)` ブロックを追加 |
| 4 | `src/features/<game>/` | 実装本体（新規フォルダ） |

オンライン対戦を入れる場合のみ 5つめ:

| 5 | `supabase/<game>_rooms.sql` | テーブル定義。**SQLの実行はユーザーがSupabase管理画面で行う**（Claudeは実行できない） |

## 2. feature フォルダの構成パターン

2種類ある。**新ゲームは backgammon 型を推奨**（App.tsx への追加が1画面分で済む＝配線が最小）。

- **backgammon型（内部ルーター・推奨）**: `App.tsx` は `'backgammon'` の1画面だけ。
  画面遷移は [BackgammonPage.tsx:14](../src/features/backgammon/BackgammonPage.tsx) の
  `type Screen = 'settings' | 'waiting' | 'play' | 'online-play'` で内部管理。
- **mancala/uno型（App.tsx に全画面を列挙）**: 既存2ゲームがこの形。真似しなくてよい。

ファイル分割の定石（backgammon 参照）:

```
<game>Types.ts            型定義
<game>Rules.ts            純粋なルール関数（副作用なし）
<game>Rules.test.ts       ルールのユニットテスト（vitest）
createInitial<Game>State.ts  初期状態
<game>Cpu.ts / .test.ts   CPU AI（5段階の強さ）
<game>Online.ts           Supabase 連携（オンライン対戦する場合のみ）
<Game>Page.tsx            内部ルーター（エントリ）
<Game>SettingsScreen.tsx  設定画面
<Game>PlayScreen.tsx      対局画面
<Game>Ui.tsx              共通UI部品
```

## 3. 共通資産（再実装しないこと）

- UI: `src/components/` の `Layout` / `Card` / `Button` / `Embers`
- CSS変数・共通クラス: `src/styles/global.css`（`NEW_GAME_PROMPT.md:764` 以降に一覧）
- Supabaseクライアント: `src/lib/supabase.ts`（使い回す。新規作成しない）

## 4. `NEW_GAME_PROMPT.md` の索引（必要な時だけ該当行を読む）

| 欲しいもの | 見出し行 |
|---|---|
| プレイヤー名の localStorage 永続化 | :160 |
| CPU 5段階の強さ（ドラゴンテーマ） | :246 |
| オンライン対戦（ルームコード方式）一式 | :342 |
| プレイヤー視点の盤面回転 | :574 |
| 脱落アニメーション（3-4人） | :603 |
| スマホ対応（タップ遅延・フィードバック） | :703 |
| 石アニメーションの設計 | :729 |
| CSS変数／共通クラス一覧 | :766 / :778 |
| 品質基準（完成の条件） | :810 |

## 5. 完成前の確認

```bash
npm run build
```

`tsc -b` を含む本番と同じビルド。ローカルの型チェックだけで済ませない。
ルール・CPUには vitest のテストを書く（`npm test`）。

公開手順は `PUBLISHING.md`、または `/publish-game` スキル。

## 6. 着手前にユーザーへ確認すること

- ゲーム名／ルールのバリエーション（例: 何人まで、ハードルールの有無）
- CPU対戦は必要か（必要なら5段階）
- **オンライン対戦は必要か**（必要なら Supabase テーブル作成をユーザーに依頼する必要あり）
- カードに出す絵文字・アクセント色の希望

## 補足

`src/features/englishQuest/` は `games.ts` にも `App.tsx` にも未配線（ホーム画面から辿れない）。
新ゲームの参考にはしないこと。`npm run build` は `verify:english-audio` を経由するので、
このフォルダを壊すとビルドが落ちる点にだけ注意。
