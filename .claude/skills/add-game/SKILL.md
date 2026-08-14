---
name: add-game
description: Dragon Game Park に新しいゲームを追加するときに使う。ユーザーが「新しいゲームを作りたい」「〇〇（リバーシ/将棋/五目並べ等）を追加して」「ゲームを増やして」のように言ったときに呼び出す。トークンを浪費せずに、配線漏れなくゲームを実装するための手順。
---

# add-game

配線箇所・推奨構成・実装パターンの実体は **`docs/NEW_GAME_CHECKLIST.md`** が唯一の正。
このスキルは「どの順で進めるか」だけを定める。内容をここに複製しないこと。

## 0. 読むもの（これ以上読まない）

1. `docs/NEW_GAME_CHECKLIST.md` を読む。
2. 詳細な実装パターンが必要になった時点で、チェックリスト§4の索引を使って
   `NEW_GAME_PROMPT.md` の**該当行だけ**を `sed -n 'N,Mp'` で読む。
   全文854行を読むことは禁止。既存ゲームのソースも、grepで当該関数を特定してから部分読みする。

## 1. 着手前にユーザーへ確認する（必須・まとめて1回で聞く）

チェックリスト§6の項目。特に次の2つは実装量が大きく変わるので必ず確定させる:

- **オンライン対戦の要否** — 必要なら `supabase/<game>_rooms.sql` を用意し、
  **SQL実行はユーザーにSupabase管理画面で行ってもらう**（Claudeは実行できない）。
- **CPU対戦の要否** — 必要なら5段階の強さ（チェックリスト§4の索引 → `NEW_GAME_PROMPT.md:246`）。

ルールに曖昧さがある場合（例: ローカルルールの有無、人数、勝敗条件）も、
実装を始める前にここでまとめて確認する。実装後の作り直しがいちばん高くつく。

## 2. 実装順（ロジック → UI → 配線 の順を守る）

1. `src/features/<game>/` を作り、**backgammon型（内部ルーター）**で組む。
2. `<game>Types.ts` → `<game>Rules.ts` → `<game>Rules.test.ts` の順。
   ルールは副作用のない純粋関数にし、**UIを書く前に `npm test` で緑にする**。
3. CPUを作る場合は `<game>Cpu.ts` + テスト。
4. 画面（`<Game>Page.tsx` / SettingsScreen / PlayScreen）。UIは `src/components/` と
   `src/styles/global.css` の既存資産を使う。独自の色・ボタンを新規実装しない。
5. オンライン対戦は最後。`src/lib/supabase.ts` を使い回す。
6. 最後にチェックリスト§1の配線4箇所（`games.ts` / `HomePage.tsx`の3マップ / `App.tsx` / featureフォルダ）
   を埋める。**HomePage の3マップは漏らしやすいので必ず3つとも確認する。**

## 3. 完成の判定

```bash
npm test
npm run build
```

`npm run build` は `verify:english-audio` と `tsc -b` を含む本番同等ビルド。
ローカルの型チェックだけで完了と報告しない。ビルドログは
`> tmp/build.log 2>&1` に流して `grep -iE "error|fail"` と exit code だけ確認する（全文を読まない）。

可能なら preview ツールで実際に起動し、ホーム画面から新ゲームに入って1手打てることまで確認する。

## 4. 公開

`PUBLISHING.md` の手順に従う（`/publish-game` スキルを呼ぶ）。
オンライン対戦を含む場合は、マージ前にSupabaseのSQL実行をユーザーに依頼済みか確認する。

## 5. 終わったら

`CLAUDE_HANDOFF_CURRENT.md` を更新する。
配線箇所や推奨構成が変わった場合は `docs/NEW_GAME_CHECKLIST.md` の行番号も直す
（行番号がずれたままだと次のセッションが余計なファイルを読むことになる）。
