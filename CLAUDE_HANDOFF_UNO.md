# Claude Code 引き継ぎメモ: Dragon Game Park / UNOオンライン改善

この内容を Claude Code の新しいセッションに貼り付けてください。

## まず読んでほしいこと

このプロジェクトでは、UNOだけでなく今後もたくさんのゲームを追加していく予定です。

そのため、引き継ぎでは「今のUNO作業」だけでなく、今後のゲーム追加にも使える運用を大事にしてください。

- 作業が長くなったら、早めに引き継ぎ書を作る。
- 週の残り使用量が少ないとユーザーが言ったら、実装を無理に続けず、まず引き継ぎ書を更新する。
- 大きな機能が一段落したら、`CLAUDE_HANDOFF_CURRENT.md` を更新する。
- 節目では保存版の引き継ぎ書も作る。
- ユーザーは初心者なので、ユーザーに操作してもらう時は必ず具体的に案内する。

具体的な案内例:

```text
1. Chromeで http://127.0.0.1:5175/ を開いてください。
2. 画面が古いままなら Ctrl + R を1回押してください。
3. UNO → オフラインで遊ぶ → 通常版2人 を選んでください。
4. 中央の裏向き山札が光っているか見てください。
5. 山札をクリックして、カードが引けるか教えてください。
```

SQLや設定値を貼ってもらう時は、必ず「今ある内容を全部消して貼るのか」「続きに貼るのか」まで明記してください。

## 現在の作業場所

- 作業フォルダ: `C:\Users\ray-0\Dragon-game-park`
- ブランチ: `codex/uno-online`
- PR: `https://github.com/kyouryu888-web/dragon-game-park/pull/1`
- ローカル確認URL: `http://127.0.0.1:5175/`
- Supabase の `uno_rooms` SQL はユーザーが実行済み。
- Supabase SQL Editor では `Success. No rows returned` が表示済み。
- 既存PRにはUNOオンラインMVPまで入っている。
- この引き継ぎ時点の最新UNO改善はまだ未コミット。

## 現在の目的

UNOの通常版/ハード版を、オフラインとオンラインの両方で安定して遊べる状態にする。

直近では、以下の改善を入れた状態です。

- 勝敗後の順位を「残り枚数」ではなくUNO式の点数で表示。
- UNO宣言はオンラインに不向きなため自動化。
- UNO宣言忘れ指摘による2枚ペナルティは削除。
- 中央の裏向き山札カードをクリックしてカードを引くUIに変更。
- 出せるカードがある時は山札を押せないようにし、出せない時だけ山札が強調されるように変更。
- 中央山札が押せない不具合を修正。原因は `button` の中に `UnoCardView` の `button` が入る入れ子構造だったため、`UnoCardView` 自体にクリックを渡す形へ変更。
- ワイルド色選択や7交換などの保留アクションを、手札下ではなくプレイ画面上に表示。
- ターン移動時、中央リング上の矢印が回るアニメーションを追加。
- 進行方向を分かりやすくするため、現在の人から順に並ぶターン順リストを追加。
- 中央円形リング自体にも「時計回り/反時計回り」ラベルと4つの方向矢印を表示するよう改善。
- 自分の名前/カード枚数付近に `UNO! 自動` 表示を追加。
- CPUの番にCPU手札が見えてしまう不具合を修正。
- カラールーレットで対象が25枚KOになった時、pending状態が残って進めなくなる不具合を修正。
- カラールーレットは脱落済みプレイヤーを対象にしないように修正。

## 点数ルール

UNO公式ルールに基づき、残った手札を以下の点数で計算します。

- 数字カード: 数字そのまま
- スキップ/リバース/ドローなどの記号カード: 20点
- ワイルドカード: 50点

点数が少ないほど上位です。

ハード版で25枚KOになったプレイヤーは、手札を山札に戻す前に脱落時点の点数を保存します。

## Codexが入れた未コミット変更

主な変更:

- `src/features/uno/unoScoring.ts` を新規追加。
  - `getUnoCardScore`
  - `getUnoHandScore`
  - `getUnoCurrentScores`
  - `getUnoFinalScores`
  - `getUnoRankings`
- `src/features/uno/unoTypes.ts`
  - `finalScores`
  - `eliminatedScores`
  を `UnoGameState` に追加。
- `src/features/uno/createInitialUnoState.ts`
  - 上記2フィールドを初期化。
- `src/features/uno/unoRules.ts`
  - 終了時に `finishGame` を通してスコア確定。
  - ハード版25枚KO時は、手札を山札に戻す前に `eliminatedScores` に点数保存。
  - 残り1枚になったら `unoDeclaredIds` に自動追加し、`uno-window` を出さずにターン進行。
  - 出せるカードがある時は山札から引けないように `applyDrawCard` にガードを追加。
  - ルーレット対象が25枚KOになったら、ルーレットを終了して次の生存者へ進める。
  - ルーレット対象決定時に脱落者を飛ばす。
  - 脱落済みプレイヤーにはカードを引かせない。
  - `applyUnoPenalty` を削除。
- `src/features/uno/unoCpu.ts`
  - CPUのペナルティ指摘アクションを削除。
- `src/features/uno/unoOnline.ts`
  - `uno-penalty` 権限判定を削除。
- `src/features/uno/UnoGamePage.tsx`
  - 結果表示を点数順位に変更。
  - `PendingPanel` から指摘ペナルティボタンを削除。
  - 色選択/交換などのパネルを `UnoTableView` の `pendingOverlay` としてテーブル上に表示する構造へ変更。
  - CPUの番ではCPU手札を見せず、人間側の手札表示に戻す。
  - カラールーレットのボタン文言を「1まい引く」から「ルーレットを進める」に変更し、ホストが引くように見える誤解を減らした。
- `src/features/uno/UnoOnlineGamePage.tsx`
  - オンライン終了画面にも点数順位を表示。
  - ペナルティ指摘処理を削除。
  - pending UI をテーブル上へ移動。
- `src/features/uno/UnoTableView.tsx`
  - `pendingOverlay` を追加。
  - 中央山札カードをクリック可能な `button` に変更。
  - その後、山札クリック不能の原因になっていたボタン入れ子を解消し、`UnoCardView` 自体にクリックを渡す形に変更。
  - 出せるカードがない時、またはドロー累積を受け取る時だけ山札を強調。
  - ターン移動時の円周矢印 `uno-turn-orbit` を追加。
  - 進行方向を文章でも追えるターン順リストを追加。
  - 中央リングに方向ラベルと4方向の矢印マーカーを追加。
  - 自分の席に `UNO! 自動` バッジを表示。
  - 手札下の引くボタンは案内表示へ変更。
- `src/styles/global.css`
  - 山札クリック強調、中央オーバーレイ、ターン矢印アニメーション、UNO自動バッジ、ドロー案内のCSSを追加。
- `src/features/uno/unoRules.test.ts`
  - 点数計算テスト追加。
  - 自動UNOテスト追加。
  - 出せるカードがある時に山札から引けないテストを追加。
  - ルーレット対象決定時に脱落者を飛ばすテストを追加。
  - ルーレットで25枚KOになったらpendingが消えて次へ進むテストを追加。
- `src/features/uno/unoOnline.test.ts`
  - `uno-penalty` テストを削除し、自動UNO方針に合わせた。

## 現在の未コミット差分

`git status --short` では以下:

```text
 M src/features/uno/UnoGamePage.tsx
 M src/features/uno/UnoOnlineGamePage.tsx
 M src/features/uno/UnoTableView.tsx
 M src/features/uno/createInitialUnoState.ts
 M src/features/uno/unoCpu.ts
 M src/features/uno/unoOnline.test.ts
 M src/features/uno/unoOnline.ts
 M src/features/uno/unoRules.test.ts
 M src/features/uno/unoRules.ts
 M src/features/uno/unoTypes.ts
 M src/styles/global.css
?? src/features/uno/unoScoring.ts
```

## 検証済み

Codex環境では通常の `npm` がPATHになかったため、以下のようにCodex同梱NodeをPATHに足して実行した。

```powershell
$env:Path = 'C:\Users\ray-0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
.\node_modules\.bin\tsc.CMD --noEmit
.\node_modules\.bin\vitest.CMD run
.\node_modules\.bin\tsc.CMD -b
.\node_modules\.bin\vite.CMD build
.\node_modules\.bin\oxlint.CMD
```

結果:

- `tsc --noEmit`: 成功
- `vitest run`: 成功、4 test files / 66 tests passed
- `vite build`: 成功
- `oxlint`: 成功。ただし既存のマンカラ関連warningが表示される。UNO由来のエラーではない。
- `vite build` は 500kB 超のchunk警告が出るが、これはビルド失敗ではない。

## 注意点

- Codex内ブラウザでは `http://127.0.0.1:5175/` が安全ポリシーでブロックされたため、Codex側でスクリーンショット検証は未実施。
- ユーザーのChromeでは `http://127.0.0.1:5175/` を開ける状態。
- 画面検証はユーザーに具体的な手順を伝えて実施してもらう。
- 引き継ぎ後、まず `git diff` と `git status --short` を確認すること。

## 次にやること

1. `git diff` で今回の未コミット差分を確認する。
2. 必要ならローカルサーバーを起動する。

```powershell
$env:Path = 'C:\Users\ray-0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
.\node_modules\.bin\vite.CMD --host 127.0.0.1 --port 5175
```

3. ユーザーにChromeで `http://127.0.0.1:5175/` を開いてもらう。
4. 画面で以下を確認してもらう。
   - UNOゲームが開く。
   - 出せるカードがない時だけ中央の山札が押せる状態で目立つ。
   - 出せるカードがある時は山札ではなく手札カードを出す案内になる。
   - 山札クリックでカードを引ける。
   - ワイルド色選択がプレイ画面上に出る。
   - ターン移動時に中央リング上の矢印が動く。
   - 中央リング上の「時計回り/反時計回り」と4方向矢印で進行方向が分かる。
   - ターン順リストで、現在の人、次の人、進行方向が分かる。
   - CPUの番でもCPU手札が見えない。
   - カラールーレットで対象者が25枚KOになっても次へ進む。
   - 手札が残り1枚の時に `UNO! 自動` が出る。
   - ゲーム終了後、点数付き順位表が出る。
5. 問題があれば修正する。
6. 問題なければコミットしてPRブランチへpushする。

推奨コミットメッセージ:

```text
Polish UNO scoring and table controls
```

7. push後、PR #1 のVercel Previewが通ったらオンライン2タブ確認に進む。

## 今後のゲーム追加時の引き継ぎ運用

このプロジェクトでは、今後もゲームを追加していく。

今後は以下の運用を推奨する。

- `CLAUDE_HANDOFF_CURRENT.md`
  - 常に最新状態の引き継ぎ書。
  - Claude Codeへ渡す時は基本的にこれを使う。
- `handoffs/YYYY-MM-DD-game-or-feature.md`
  - 大きな節目の保存版。
  - UNO、別ゲーム、オンライン化、リリース前など、後で見返したいタイミングで作る。

引き継ぎ書を作るべきタイミング:

- 作業が長くなってきた時。
- 新しいゲームの追加が一段落した時。
- オンライン化やSupabase/Vercelなど外部連携に入る前。
- 未コミット変更が増えた時。
- テストは通ったが画面確認が残っている時。
- ユーザーが「残り使用量が少ない」と言った時。
- Claude Codeなど別AIへ渡す時。

引き継ぎ書には必ず以下を入れる:

- 現在の目的。
- 作業フォルダとブランチ。
- PRやPreview URL。
- 変更済みファイル。
- 未コミット差分。
- 実行済みテストと結果。
- 未確認のこと。
- 次にやること。
- ユーザーが操作する必要がある場合の具体的手順。

ユーザーは初心者なので、操作案内は必ず具体的にする。

## 2026-06-29 追記: カラールーレット自動進行の修正

今回の追加修正:

- `src/features/uno/UnoGamePage.tsx`
  - カラールーレットの手動ボタンを削除。
  - ルーレット中は「自動で進めています...」だけを表示する。
  - ローカル対戦でルーレットが1枚引いたあと止まらないよう、対象手札枚数・山札枚数・対象プレイヤー状態を `rouletteProgressKey` として監視するよう変更。
- `src/features/uno/UnoOnlineGamePage.tsx`
  - オンライン画面から手動ルーレット処理を削除。
  - ルーレット進行は従来通りホストクライアントが自動で `applyColorRouletteStep` を実行する。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。

## 2026-06-29 追記: 足あとカード裏・効果ボタン整理・進行矢印調整

ユーザーの追加コメントを受けて、以下を修正。

- `src/features/uno/UnoCardView.tsx`
  - 山札カード裏を足あと風マークに変更。実画面ではChromeで `Ctrl + R` 更新後に確認可能。
- `src/features/uno/UnoTableView.tsx`
  - 普通の数字カードには `?` ボタンを出さないようにした。
  - ハード版の `0` と `7` は効果があるため `?` を残す。
  - 場のカードも効果があるカードだけ `?` を表示。
- `src/styles/global.css`
  - 手札カードの `?` ボタンを右上から左上へ移動。重なったカードでも押しやすくするため。
  - 中央リングの進行矢印を `→` から、円周に沿う角度の記号表示へ調整。
  - プレイヤー情報欄に重なりにくいよう、矢印位置をリング下寄りに変更。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。
- `.\node_modules\.bin\oxlint.CMD`: UNO由来エラーなし。既存のMancala警告のみ。

未確認:

- 実画面で足あとカード裏がユーザーの好みに合うか。
- 進行矢印がプレイヤー情報と重ならず見やすいか。

## 2026-06-29 追記: 重複ヘッダー削除・山形マーカー・相手カード裏統一

ユーザーの追加コメントを受けて、以下を修正。

- `src/features/uno/UnoTableView.tsx`
  - テーブル内の `プレイヤーX の番です / 色: ...` ヘッダーを削除。上部の大きなターン表示と重複していたため。
  - 進行マーカーの文字 `→` を削除し、CSSだけで描く山形マーカーに変更。
  - 相手の裏向きカードも足あとマーク構造に変更。
- `src/styles/global.css`
  - `.uno-table-header` の通常/モバイルCSSを削除。
  - `.uno-next-direction-arrow::before` で `＜ / ＞` に近い山形マークを描画。
  - 相手カード裏を山札カード裏に近い斜線入り・足あと系デザインへ変更。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。
- `.\node_modules\.bin\oxlint.CMD`: UNO由来エラーなし。既存のMancala警告のみ。

未確認:

- 実画面で山形マーカーの角度が円の線に沿って見えるか。
- 相手カード裏が山札カード裏と十分に統一されているか。
- `.\node_modules\.bin\oxlint.CMD`: UNO由来エラーなし。既存のMancala Fast Refresh / deps警告のみ。

未確認:

- Codex側では `http://127.0.0.1:5175/` のブラウザ操作がポリシーでブロックされるため、実画面でのルーレット自動進行はユーザーChromeで確認が必要。

## 2026-06-29 追記: 席順とカード効果確認UI

今回の追加修正:

- `src/features/uno/UnoTableView.tsx`
  - 自分を下に固定したまま、席配置を進行方向に合わせて並べ替える `getSeatedOpponents` を追加。
  - 時計回りでは次の人が左側、反時計回りでは次の人が右側に来るようにした。
  - プレイ中にカード効果を確認できる「カード効果」ボタンを追加。
  - 場のカードと手札カードに小さな `?` ボタンを追加。カードを出す操作とは別に効果説明を開ける。
  - 説明文は小学生向けに、英語を避けて短い日本語で表示。
- `src/styles/global.css`
  - カード効果ボタン、カード個別説明、カード効果一覧パネルのスタイルを追加。
  - スマホ幅ではカード効果一覧を1列表示にする。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。
- `.\node_modules\.bin\oxlint.CMD`: UNO由来エラーなし。既存のMancala Fast Refresh / deps警告のみ。

未確認:

- 実画面で `?` ボタンがカード操作を邪魔しないか、ユーザーChromeで確認が必要。
- 4人以上・リバース後の席順が直感どおりか、ユーザーChromeで確認が必要。

## 2026-06-29 追記: ブラウザコメント対応

ユーザーの実画面コメントを受けて、以下を修正。

- `src/features/uno/UnoTableView.tsx`
  - 中央リングの意味不明な矢印表示を廃止。
  - リング上に `いま` / `つぎ` / `2番` / `3番` の順番チップを表示。
  - 手札枠内にも `山札から引く` / `Nまい引く` ボタンを追加し、中央山札とどちらからでも引けるようにした。
- `src/features/uno/UnoCardView.tsx`
  - カード裏の漢字 `龍` 表示を廃止。
  - CSSで描くドラゴン風マークに変更。
- `src/styles/global.css`
  - ドラゴン風カード裏マーク、順番チップ、手札内山札ボタンのCSSを追加。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。
- `.\node_modules\.bin\oxlint.CMD`: UNO由来エラーなし。既存のMancala警告のみ。

未確認:

- 実画面で中央リングの順番チップが見やすいか。
- 手札枠内の山札ボタンがスマホで押しやすいか。

## 2026-06-29 追記: 中央リング再修正と山札裏デザイン保留

ユーザーの実画面コメントを受けて、以下を修正。

- `src/features/uno/UnoTableView.tsx`
  - 中央リング上の `いま` / `つぎ` / `2番` / `3番` チップを削除。重なって読めなかったため。
  - `つぎへ` テキストを削除し、次の席側に小さな `→` マーカーだけを表示。
- `src/styles/global.css`
  - 古い `uno-ring-step` / `uno-turn-orbit` 系CSSを削除。
  - 新しい `uno-next-direction-arrow` のCSSを追加。

山札カード裏デザイン:

- ユーザーから「実装前にいくつか候補を出して選ばせてほしい」と要望あり。
- まだ山札カード裏デザインの再変更は未実装。次回は候補提示から行うこと。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vitest.CMD run`: 4 files / 66 tests passed
- `.\node_modules\.bin\tsc.CMD -b`: 成功
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超chunk警告のみ。
## 2026-06-29 追記: UNOテーブル進行マーカーと手札視認性の改善

今回の追加修正:

- `src/features/uno/UnoTableView.tsx`
  - 進行マーカーを中央リング固定から、現在プレイヤー席と次プレイヤー席の中間に出す方式へ変更。
  - 席ごとの座標を `getSeatPoints` で持ち、`getTurnMarkerPlacement` で中間位置と角度を計算。
  - 相手席の表示は、進行方向に応じた座席順を維持したまま、マーカーだけを席間に表示。
  - 手札ファンは、出せるカード数が多い時ほどカード間隔を広げ、出せるカードをより上に浮かせて前面表示。
- `src/styles/global.css`
  - 古い `.uno-next-direction-arrow` を廃止し、`.uno-between-turn-marker` を追加。
  - マーカーは `›` 風の山形表示にし、CSS変数 `--uno-turn-angle` で次プレイヤー方向へ回転。
  - 相手の裏カード束と名前枠の重なりを減らすため、席内のgap、z-index、カード束の高さを調整。
  - 手札エリアの高さと上余白を増やし、出せるカードに緑の外枠を追加。

検証:

- `.\node_modules\.bin\tsc.CMD --noEmit`: 成功
- `.\node_modules\.bin\vitest.CMD run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 24 tests passed
- `.\node_modules\.bin\vite.CMD build`: 成功。500kB超のchunk警告のみ。
- in-app browserで `http://127.0.0.1:5175/` を開き、UNO設定からオフライン4人ハード版へ進めて表示確認。

見た目の確認状況:

- 進行マーカーは「いま」の席と「つぎ」の席の間に表示される。
- ただし、最終的な見た目の好みはユーザーChrome上でもう一度確認が必要。
- 手札の出せるカードは以前より前面に出るが、15枚以上の大量手札ではさらに改善余地あり。
