# Dragon Game Park — Current Handoff

更新日: 2026-08-01
作業状態: PR #6を`main`へマージし、本番公開・実機確認済み

## 現在の目的

新ゲーム「イングリッシュ ラーニング オデッセイ」の第1島「はじまりの森」を実装し、英語未経験の小学1年生が短時間から遊べる学習RPGとする。TOEIC点数の保証・予測表示は行わない。

## 実装済み

- `src/features/englishQuest/` にUI、教材、学習エンジン、保存、Canvasゲームを分離。
- 教材100項目: 音16、単語48、チャンク20、会話8、読解8。
- 3分診断、12メインクエスト、最終脱出ダンジョン、4地域、精霊8種と進化。
- 捕獲、Canvasアリーナ＋ボタン代替操作、Canvas錬金、会話・読解の脱出推理。
- 誤答の短期再出題、1・3・7・14・30日間隔、ヒント段階、モード横断習熟、別日・複数モードでの進化判定。
- 版付きlocalStorage、破損復旧、JSON書き出し・復元・初期化。
- MediaRecorderのメモリ内録音。保存・送信・自動採点なし。マイク拒否でも上部の戻る操作で進行可能。
- 390x844、768x1024、844x390、1280x720で表示確認。`prefers-reduced-motion`対応。
- AI生成した独自の森・ドラゴン・精霊画像をWebP圧縮して同梱。
- Kokoro-82M 0.9.4で24kHz/64kbps MP3とSHA-256マニフェストを作る制作スクリプトを追加。モデルはアプリ非同梱。
- 復元JSONを項目ID・日時・範囲・精霊状態まで正規化し、欠損設定や不正な入れ子値による画面クラッシュを防止。
- 音声マニフェストに存在するMP3だけを再生し、未生成時は二重再生なしで端末音声へフォールバック。
- 回答連打、Canvas選択後の画面離脱、録音許可待ち中の画面離脱による遅延処理・マイク残留を防止。
- 正解・誤答の色分け、正解語の即時表示、精霊・手がかりの重なり解消、音声ボタンの状態ラベルを追加。
- 英語RPGを選択時に読み込む遅延チャンクへ分離。

## 確認済み

- `npm run build`: 成功。英語用画像は合計約1.15MB、英語RPGの遅延JSは42.54KB。初期JSは588.54KB。既存JSチャンクの500KB警告は残る。
- `npm run lint`: 終了コード0。英語機能の警告0件。既存のMancala/Backgammon警告10件は未変更。
- `npx vitest run --reporter=dot`: 7ファイル、120テスト成功。
- ブラウザ通し確認: ホーム→診断10問→地図→アリーナ→錬金→脱出→保護者→録音画面。console error/warning 0件。
- ブラウザ再確認: 390x844と1280x720、遅延読み込み、音声オン/オフ、誤答フィードバック、正解/誤答各1表示、精霊・選択肢の重なり0、console error/warning 0件。
- デザイン比較資料: `docs/design/english-quest-mobile-concept.png` と各実装スクリーンショット。
- PR #6をmerge commit `8ed665d20159c0b624390be40e2448b5fd7bdb27`で`main`へマージ。GitHub CIとVercel statusは成功。
- 本番 `https://dragon-game-park.vercel.app/` でホーム→診断10問→地図→ささやきの森→音声再生→正答を確認。1440x900/390x844とも横はみ出し0、console error 0件。

## 公開後に残る品質向上

1. 一時環境へのKokoro依存取得が15分でタイムアウトしたため、音声ファイルと`manifest.json`はまだ未生成。現状は端末内SpeechSynthesisへ自動フォールバックする。
2. ネットワークが安定した環境で、Pythonへ`kokoro==0.9.4 lameenc numpy`を導入後、`npm run generate:english-audio`を実行する。
3. 生成した100音声を全件試聴し、声量・発音・マニフェストのハッシュを確認する。
4. 家族による実機プレイを3回以上行い、成功率75〜85%・誤タップ・文字サイズ・8分構成を調整する。
5. 次回以降の変更も必ず`PUBLISHING.md`のプレビュー、PR、Vercel確認手順に従う。

## 重要ファイル

- `src/features/englishQuest/EnglishQuestPage.tsx`
- `src/features/englishQuest/englishQuestContent.ts`
- `src/features/englishQuest/englishQuestEngine.ts`
- `src/features/englishQuest/englishQuestEngine.test.ts`
- `src/features/englishQuest/englishQuest.css`
- `scripts/generate-english-quest-audio.mjs`
- `scripts/generate_english_quest_audio.py`
- `public/audio/englishQuest/NOTICE.md`

## 廃止された方向

- 診断正解数で物語を自動進行させる処理は廃止。物語CTAからセッションを完走した時だけ進む。
- 有料API、ランタイムAI、Supabase同期、ログイン、広告、課金、録音保存は初版に入れない。

## 2026-08-01 デスクトップ改善・キャラクター追加

- 620px固定の縦型デスクトップ表示を廃止。900px以上は地図＋仲間キャンプの2列となり、1280x720で黒い左右余白、縦スクロール、下部CTAの見切れがない。
- 新ガイド6人を追加: ミーナ、リラ、ガルド、ティック、セージ、ノクス。`forest-guides.webp`の3x2スプライトと`GuideSprite`を使用。
- スマホ390x844は縦型地図を維持し、今日の案内役を追加。画面全体は844px内に収まる。
- 画面コンセプト: `docs/design/english-quest-desktop-companion-concept.png`。
- 現状採点・大量教材化・継続案: `docs/english-quest-product-audit.md`。最終ゴール基準は52/100、第1島アルファ単体は78/100。
- 再検証: `npm.cmd run build`成功、`npm.cmd run lint`終了コード0（既存10警告のみ）、Vitest 7ファイル120テスト成功。ブラウザ1280x720/390x844、console error/warn 0、地図→ささやきの森→地図の操作を確認。
