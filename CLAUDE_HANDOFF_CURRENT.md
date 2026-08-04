# Dragon Game Park — Current Handoff

更新日: 2026-08-05
作業状態: `codex/english-quest-gameplay-v2`で再設計を実装済み。公開前ゲート実行中。

## 現在の目的

「イングリッシュ ラーニング オデッセイ」を、英語に一度も触れたことがなく文字も読めない小学1年生が、迷わず楽しく始められる学習RPGへ作り直す。TOEIC 900点を保証・予測表示せず、第1島の100項目と共通学習エンジンを後続島へ拡張する。

## 2026-08-05 Gameplay v2 実装

- 初回診断10問を廃止し、英字を1文字も出さない「日本語案内＋絵2つ」の3問チュートリアルへ変更。
- 最初は「ささやきの森」だけを開放し、捕獲→アリーナ→錬金→脱出の順に地域を1つずつ解放。地図に「つぎ」と案内ルートを表示。
- 共通4択の`LearningSession`と`CanvasChallenges`を削除し、4種類の専用ゲームへ置換。
  - 捕獲: 光の足あとを探索→隠れた精霊を発見→絵のお供えで意味想起。
  - アリーナ: D-pad/矢印キーでドラゴンを移動し、聞こえた色の結晶へ接触。ゆっくりモードあり。
  - 錬金: 音→絵→文字のしずくをドラッグまたはタップで泉へ運び、句へ合成。
  - 脱出: 部屋を探索して看板と音声を集め、2つを鍵へ結合して世界内の出口を開く。
- 失敗してもゲームオーバーにせず、ヒント付き再挑戦と学習記録だけを残す。
- 既存の`Attempt`、習熟段階、分散復習、localStorage、保護者画面、録音比較は維持。
- チャンク・会話・読解へ前提項目を設定し、`composeSession`が未達の項目を先出ししないよう変更。
- アリーナの座標更新中に親状態を更新するReact警告を修正し、連続入力を参照座標で安定化。

## 確認済み

- `npx.cmd tsc --noEmit`: 成功。
- `npm.cmd run build`: 成功。英語RPG遅延JS 55.06KB、CSS 51.90KB。既存の初期JS 588.54KB警告は残る。
- `npm.cmd run lint`: 終了コード0。英語機能の新規警告0件、既存のMancala/Backgammon警告10件のみ。
- `npx.cmd vitest run`: 8ファイル、126テスト成功。
- ブラウザ通し確認: 初回案内→絵2択3問→案内地図→捕獲4体→アリーナ移動→錬金9合成→脱出3部屋→地図。
- 1440x900: 全画面幅を使用し黒い左右帯なし。歓迎画面・導入・4ゲームの下部操作が見切れない。
- 390x844: 地図、アリーナD-pad、錬金の泉、脱出の手がかりトレイ、初回CTAがすべて画面内。横はみ出し0。
- 初回導入内の英字数0、ブラウザconsole error/warning 0件（修正後の新規タブ）。
- デザイン仕様: `docs/design/english-quest-*-v2.jpg` 5点。

## 公開前に残る手順

1. コミット、push、PR作成、CI/Vercel成功確認後に`main`へマージ。
2. マージコミットのVercel成功と本番URLの主要導線を再確認。

## 重要ファイル

- `src/features/englishQuest/EnglishQuestPage.tsx`
- `src/features/englishQuest/BeginnerJourney.tsx`
- `src/features/englishQuest/CaptureGame.tsx`
- `src/features/englishQuest/ArenaGame.tsx`
- `src/features/englishQuest/MergeGame.tsx`
- `src/features/englishQuest/EscapeGame.tsx`
- `src/features/englishQuest/englishQuestGameplay.ts`
- `src/features/englishQuest/englishQuestEngine.ts`
- `src/features/englishQuest/englishQuest.css`

## 現在も残る制約

- 初版の実教材は第1島100項目。TOEIC 900点台に必要な数千項目・全Part演習・120分持久力訓練は後続島の範囲。
- Kokoro音声100件は未生成で、現状は端末のSpeechSynthesisへフォールバックする。
- 家族による実機プレイ3回と、成功率75〜85%を基準にした難易度調整は未実施。
- 有料API、ランタイムAI、Supabase同期、ログイン、広告、課金、録音保存は初版に入れない。

## 廃止された方向

- すべてのモードを「音を聞いて4択」に見せる共通セッション。
- 初回から英字・チャンク・会話・読解を混ぜる10問診断。
- 4地域を同時に解放して子ども自身に進め方を判断させる地図。
