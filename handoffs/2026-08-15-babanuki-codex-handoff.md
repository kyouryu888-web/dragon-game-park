# 最弱王ババ抜き — Codexへの引き継ぎ（2026-08-15）

Claude Code で4つ目のゲーム「最弱王ババ抜き」を実装したところまでの引き継ぎ。
**ここから先（オンライン対戦の疎通確認 → PR → 本番公開）を担当してほしい。**

---

## 1. まず読むファイル

| ファイル | 内容 |
|---|---|
| `AGENTS.md` | プロジェクト全体の約束事 |
| `PUBLISHING.md` | **PR作成・マージ・本番公開の唯一の手順書。必ずこの通りに** |
| `docs/babanuki-spec.md` | **ババ抜きのルールと実装方針の唯一の正** |
| `docs/NEW_GAME_CHECKLIST.md` | 新ゲームの配線箇所（既に配線済みだが確認用） |
| `CLAUDE_HANDOFF_CURRENT.md` | 直近の作業ログ（デバッグで直したバグ2件を含む） |

## 2. 今のリポジトリの状態（重要）

**すべての作業が `main` ブランチに未コミットで置かれている。** まずブランチを切ってコミットすること。

```
 M CLAUDE_HANDOFF_CURRENT.md
 M src/App.tsx              … AppScreen に 'babanuki' 追加・画面ブロック
 M src/data/games.ts        … ゲーム一覧に babanuki 追加
 M src/pages/HomePage.tsx   … 絵文字💀・アクセント色#6f4a8e・英字名
 M src/styles/global.css    … babanuki- 接頭辞のkeyframes（末尾に追加）
?? docs/babanuki-spec.md
?? src/features/babanuki/   … 実装本体（13ファイル）
?? supabase/babanuki_rooms.sql
```

直近のコミット: `24e74a3 Merge add-game skill and new-game checklist`

## 3. 完成していて検証済みのもの

- **ルール**: 53枚・3〜6人・初期ペア処理・引く・勝ち抜け・最弱王判定・シャッフルタイム6種の出目
- **CPU 5段階**（ドラゴン段位。既存3ゲームと同じ呼称）
- **ローカル対戦**（あなた1人＋CPU）: 3人・4人・6人で通しプレイ確認済み、375px幅で横スクロールなし
- **演出**: カードの飛行、ペア成立、シャッフル移動、勝ち抜け退場、最弱王の戴冠式
- **テスト**: `npm test` → **202件パス**（うちババ抜き45件＋ランダム160局のシミュレーション3件）
- **ビルド**: `npm run build` 成功。`npm run lint` はエラー0（既存と同種の警告のみ）
- ブラウザ実機でコンソールエラー0件

## 4. 残っている作業（この順番で）

### Step 1: コミット

`main` に直接コミットせず、ブランチを切ること（例: `claude/babanuki`）。
コミットメッセージ末尾の Co-Authored-By 行は `PUBLISHING.md` の慣習に従う。

### Step 2: ユーザーにSupabaseのSQL実行を依頼する（AIには実行できない）

`supabase/babanuki_rooms.sql` を Supabase ダッシュボード → SQL Editor → New query に
全文貼り付けて Run してもらう。**「Success」の確認が取れるまで、オンライン対戦を
「動作する」ものとして報告してはいけない**（`PUBLISHING.md` の規定）。

現状、テーブルが無いためルーム作成は「ルームを開けなかった。時をおいて再び試されよ」で
失敗する（クラッシュはしない）。これはバグではない。

### Step 3: オンライン対戦の疎通確認（SQL実行後）

ブラウザ2タブで確認する。見るべき点:

1. ホストがルームを作る → 6桁コード表示 → 別タブで参加 → 人間の席が埋まると自動で対局開始
2. ルーム作成画面で**席ごとに人／CPUを選べる**こと（CPUは即座に埋まり、人間の空き席だけ待つ）
3. 引く・ペア・シャッフルタイムの演出が**両方の画面で同じように流れる**こと
4. CPUの手番・サイコロ判定を**ホスト側だけ**が実行していること（両方で二重に動かないこと）
5. 決着後に「ルーム設定へ」でルーム作成画面に戻れること

同期の仕組み: `babanuki_rooms` 1行に `game_state`(jsonb) と `version`。
書き込みは `.eq('version', version)` の楽観ロック。競合したら最新を取り直す。

### Step 4: `PUBLISHING.md` の手順で公開

ローカル検証ゲート（`npx tsc --noEmit` → `npm run build` → `npx vitest run`）→ push → PR →
**マージ前にCI/Vercelのステータス確認** → マージ → **マージコミットのSHAでデプロイ成功を確認** → 報告。

補足: この環境では `gh` CLI が使えなかった。`PUBLISHING.md` に記載のGitHub REST APIレシピ
（`\r` 除去・JSONはファイル経由・Bearer認証）で PR作成・マージが成功した実績がある。
GitHub Actions の結果は statuses API ではなく **check-runs API** に出る点に注意
（`build-and-test` が check-runs、Vercel が statuses）。

### Step 5: `CLAUDE_HANDOFF_CURRENT.md` を更新して締める

## 5. ゲーム仕様の要点（誤解しやすいところ）

詳細は `docs/babanuki-spec.md`。特に間違えやすい点だけ:

- **シャッフルタイムを宣言できるのはジョーカーを持っている人だけ**。制限時間は無く、
  次の1枚が引かれるまでの間ならいつでも押せる。手番でなくてもよい。1ターン1回、残り2名で消滅
- シャッフル後も**手番は移らない**（宣言者の権利は消費済みなので同ターンの再宣言は起きない）
- 出目3は「中央に集めてから配り直す」演出。**誰と入れ替わったかは全員に非公開**
- **ブラフ（札の飛び出し）はカードIDに紐づく**。並べ替えても、他の札を引かれても、
  その札が手札から無くなるか本人がダブルタップで解除するまで飛び出したまま
- CPUは引くまでに**3秒の「迷い」**を置く。これがジョーカー持ちの考慮時間になる
- 引く操作は**2段階**（タップで選ぶ → もう一度タップか「この札を引く」で確定）。誤タップ防止

## 6. 触るときの注意（実際に踏んだ地雷）

- **タイマーを張る `useEffect` の依存配列に状態オブジェクト全体（`logic`）を入れてはいけない。**
  手札の並べ替えのたびにタイマーがリセットされ、CPUが永久に引かなくなる。
  `turnKey`（`currentPlayerId:phase:eventSeq`）を依存にし、最新状態は ref から読む。
- **オンラインの書き込みは直列につなぐ（捨てない）。** 「通信中なら無視」にすると
  CPUの手が消えて進行が止まる。現在は Promise チェーンで順番待ちさせている。
- `src/features/englishQuest/` はホーム画面に未配線の実験フォルダ。参考にしない。
  ただし `npm run build` が `verify:english-audio` を経由するので壊さないこと。

## 7. ファイル構成（`src/features/babanuki/`）

```
babanukiTypes.ts          型と定数（CPU_THINK_MS など）
babanukiRules.ts          ルール（純粋関数）
babanukiRules.test.ts
babanukiCpu.ts            CPU 5段階
babanukiCpu.test.ts
babanukiSimulation.test.ts  ランダム160局の不変条件テスト
babanukiPlayback.ts       演出用のイベント再生（表示状態の進め方）
useBabanukiPlayback.ts    再生フック（ローカル・オンライン共通）
BabanukiTable.tsx         盤面描画・カード飛行アニメ・シャッフルボタン
BabanukiShufflePanel.tsx  サイコロ結果パネル・出目の説明
BabanukiFinale.tsx        最弱王の戴冠式＋順位表
BabanukiSettingsScreen.tsx
BabanukiPlayScreen.tsx    ローカル対局
BabanukiOnlineRoomPage.tsx / BabanukiOnlineGame.tsx  オンライン
BabanukiPage.tsx          内部ルーター（settings/play/room/online-play）
babanukiOnline.ts         Supabase通信
```

## 8. まだ確認できていないこと

- **オンライン対戦は一度も動作確認できていない**（テーブル未作成のため）
- 実機のスマホでのタップ感（ダブルタップ判定320ms、CPUの3秒）は要調整の可能性
- 決着後の「もう一度」でCPUの強さ設定が保持されることは確認済みだが、
  オンラインの再戦導線は「ルーム設定へ」戻る方式のみ
