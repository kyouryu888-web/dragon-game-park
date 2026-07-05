# 本番公開Runbook（Claude Code / Codex 共通）

このファイルは Dragon Game Park で新しいゲーム機能を実装してから本番公開するまでの、
**ツールに依存しない唯一の手順書**です。Claude Code / Codex どちらのAIエージェントが
作業する場合も、PRを作る前・マージする前に必ずこの手順に従ってください。

Claude Code から使う場合は `/publish-game` スキル（`.claude/skills/publish-game/`）が
このファイルを読み込むよう案内します。Codex など他のツールは `AGENTS.md` からこのファイル
へ誘導されます。

## 大原則

**`main` ブランチへのマージ = 即・本番公開です。**
このリポジトリは Vercel と連携しており、`main` に何かがマージされると自動的に
本番URL（`https://dragon-game-park.vercel.app`）へビルド・デプロイされます。
「PRを作る」のと「マージする」のとでは重みが全く違うことを常に意識してください。

## 手順

### 1. ブランチを切る

```
git checkout main
git pull --ff-only
git checkout -b claude/<機能名>
```

### 2. 実装する

既存のゲーム追加パターン（配線箇所・ファイル構成）は `CLAUDE_HANDOFF_CURRENT.md` の
「サイト全体のアーキテクチャ」節にまとまっています。新しいゲームを追加するときは
必ずそこを読んでから、既存ゲーム（マンカラ・UNO・バックギャモン）と同じ構成に合わせてください。

### 3. ローカル検証ゲート（必須・この順番で・全部グリーンになるまで次へ進まない）

```
npx tsc --noEmit
npm run build
npx vitest run
```

**重要: `npx tsc --noEmit` だけで「型は通った」と判断しないでください。**
このコマンドはプロジェクト参照なしの緩いチェックで、実際に本番ビルドだけが検出する
エラー（オブジェクトリテラルのキー重複、未使用変数など）を見逃したことがあります。
`npm run build`（内部で `tsc -b && vite build` を実行し、Vercelが実行するのと同じコマンド）
が通ることを必ず確認してください。これが一次情報です。

UI に変更がある場合は、プレビュー（モバイル幅 375〜430px 程度）で実際にタップ操作して
崩れがないか確認してください。

### 4. コミットしてpushする

コミットメッセージの末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
（またはそのとき使っているモデル名）を付ける、既存の慣習に従ってください。

```
git add <変更ファイル>
git commit -m "..."
git push -u origin claude/<機能名>
```

### 5. PRを作る

まず `gh --version` でGitHub CLIが使えるか確認してください。

**`gh` が使える場合:**

```
gh pr create --title "..." --body "..."
```

**`gh` が使えない場合（このセッションで実際に発生した状況）:**

`gh` はインストールしても実行環境の別セッションには反映されないことがあるため、
インストールを試みるより GitHub REST API を直接叩く方が確実です。以下は実際に
動作確認済みのレシピです。3つの落とし穴に注意してください。

```bash
# 1. git の資格情報からトークンを取得する
CRED_LINE=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | grep '^password=' | tr -d '\r')
#                                                                                                     ^^^^^^^^^^^
# 落とし穴1: Windows環境だと \r が混入し、除去しないと 401 Bad credentials になる
TOKEN="${CRED_LINE#password=}"

# 2. JSON本文は一度ファイルに書き出してから送る
node -e '
const fs = require("fs");
fs.writeFileSync("<scratchpadのパス>/pr_body.json", JSON.stringify({
  title: "...",
  head: "claude/<機能名>",
  base: "main",
  body: "## Summary\n- ...",
}));
'
# 落とし穴2: JSON本文をシェル変数に直接埋め込むと、日本語や改行を含む場合に
# 400 "Problems parsing JSON" になる。必ずファイル経由で --data-binary @file を使う。

# 3. 認証ヘッダーは Bearer 方式を使う
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/pulls \
  --data-binary "@<scratchpadのパス>/pr_body.json"
# 落とし穴3: "Authorization: token $TOKEN" 形式では 401 になった実績がある。Bearerを使うこと。

unset TOKEN CRED_LINE
```

一時ファイルは作業ディレクトリではなく、スクラッチパッド（セッションごとの一時領域）に
書き出してください。**トークンの値は絶対にコマンド出力・ログ・会話に表示しないこと。**

### 6. マージ前に必ずCI/Vercelの結果を確認する

**ここが一番重要なゲートです。** PRの `mergeable: true` だけを見て安心しないでください。
それとは別に、ブランチの最新コミットに対するステータスチェックを確認します。

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/<owner>/<repo>/commits/claude/<機能名>/status"
```

レスポンスの `state` が `success` になっていることを確認してください
（`.github/workflows/ci.yml` の "CI" と、Vercelの "Vercel" の両方）。

- **`failure` の場合**: マージしてはいけません。`npm run build` をローカルで再現して
  原因を特定・修正し、再度push→このステータス確認からやり直してください。
  （このリポジトリでは実際にこのゲートで「ローカルのtsc --noEmitでは見えなかった
  本番ビルドエラー」を検出したことがあります。）
- **`pending` の場合**: しばらく待ってから再確認してください。

### 7. マージする

```
gh pr merge <PR番号> --merge
```

`gh` が無い場合はAPI:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/pulls/<PR番号>/merge \
  --data-binary "@<マージ用JSONファイル>"
```

### 8. ローカルの main を更新する

```
git checkout main
git pull --ff-only
```

### 9. マージ後、本番デプロイの成功を必ず確認する

**PRブランチのステータスを確認しただけでは不十分です。** マージコミット自体のSHAに
対して、もう一度ステータスAPIを叩いて本番デプロイが成功したことを確認してください。

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/<owner>/<repo>/commits/<マージコミットのSHA>/status"
```

`state: success` を確認できたら、初めて公開完了です。

### 10. ユーザーに報告する

本番URL（`https://dragon-game-park.vercel.app`）と、今回何が公開されたかの要約を
伝えてください。

## オンライン対戦ゲームを追加する場合の特別ルール

新しいゲームにオンライン対戦（Supabaseのルーム機能）を追加する場合は、
`supabase/backgammon_rooms.sql` と同じ形で `supabase/<game>_rooms.sql` を作成してください:

- `room_code`（主キー）/ `host_id` / `guest_id` / `game_state jsonb` / `created_at` / `updated_at`
- RLS は `anon, authenticated` に対して select/insert/update/delete を全開放
- `alter publication supabase_realtime add table ...` でRealtimeを有効化

**AIはSupabaseのデータベース認証情報を持っていないため、このSQLを自分で実行することは
できません。** 必ず立ち止まって、ユーザーに次の手順を案内し、実行の確認を待ってください:

1. Supabaseダッシュボード → 対象プロジェクト → 左メニューの「SQL Editor」を開く
2. 「New query」で空のクエリを開く
3. 作成した `.sql` ファイルの中身を全文コピーして、そのクエリ欄に貼り付ける
4. 「Run」を押して「Success」を確認する

この確認が取れるまで、そのゲームのオンライン対戦機能を「動作する」ものとして
ユーザーに報告しないでください。

## 必ず立ち止まって人に確認するべき条件（ストップ条件）

以下に該当する場合は、勝手に進めず必ずユーザーに確認してください:

- ローカルの `npm run build` や `npx vitest run` の失敗が、原因を調べても簡単に直せない
- マージ前後のステータス確認で `failure` が解消しない
- Supabaseへの直接のSQL実行や、その他AIが認証情報を持たない操作が必要
- 既存の別ブランチ・他人の作業・本番データを壊す可能性がある操作

## 関連ドキュメント

- **`CLAUDE_HANDOFF_CURRENT.md`** — 現在進行中の作業内容・直近の方針・次にやること
- **`handoffs/`** — 過去の作業内容の保存版記録
