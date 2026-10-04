# ボード演出 v2 実画面検証

2026-10-04。検証対象は隔離ワークツリーの `http://127.0.0.1:5178`。Microsoft Edge headless、Playwright Coreを使用。Browser plugin / browser skillはこのセッション一覧にないため、指定されたPlaywright fallbackで実施。

## 最終結果

- **ローカル実導線・固定公開イベント52項目成功、失敗0。** 統合結果は [final-results.json](./final-results.json)。初回 `results.json` の41成功/2差分をそのまま合格として扱わず、同条件の再検証4成功と追加375pxの9成功を項目名で統合した。
- **実Supabaseの独立2 browser context対局2件成功、page errors 0、両context退出確認。** [online-results.json](./online-results.json)、[マンカラ個別最終記録](./online-mancala-final.json)、[バックギャモン個別最終記録](./online-backgammon-final.json) に成功記録を保存。
- 最終コードの `npx tsc -b` 成功。公開反応4テストファイル28件成功。盤面ルール・通常反転アニメ・爆裂再生/同期/ACK/SQL・BGルールの8ファイル113件も成功。SQL、エンジン、ACK手順、公開、PRはこの担当作業で変更していない。

## ローカル画面で確認した範囲

375×844、390×844、900×700。実ホームからゲーム設定、VS CPU、開始、盤面入力まで、マンカラ・バックギャモン・通常リバーシ・爆裂リバーシで確認した。

公開イベントを固定した [boards-fixture.html](./boards-fixture.html) は、実コンポーネント・実ルール・実再生経路を使う検証専用ページである。人間同士の公開案内、にぎやか/控えめ/オフ、reduced motion、画像読込、横溢れ、意味のある描画、Vite error overlayなし、関連console異常なしを確認した。固定局面ページは実オンライン接続の証拠ではない。

- 通常リバーシ: 2枚反転の軽い案内、角の主要演出。反転後に発火し、既存1,900msを維持。控えめでは軽い反転案内を抑制。全面中の席吹き出し/案内重複なし。
- 爆裂リバーシ: 公開済み爆弾の再生と主要演出。既存2,800msを維持。reduceでは動く全面を挿入しない。再生フレームの数・順序・ACK/SQLは未変更。
- バックギャモン: 複数ヒットの700ms画像、単ヒットは軽い反応、ダブル提案2,500msと受諾/拒否2,000ms。複数ヒット画像はpointer-events:noneで、表示中に実際のロール操作が届くことを確認。
- マンカラ: 初期盤面から `p1-pit-4 → p2-pit-0 → p1-pit-0` の実3手入力で7石捕獲。石配りと捕獲のto-store再生後に700ms画像が出る。画像中も次手の穴が選択可能で、操作待ちを追加しない。画像終了後に残る反応時間で中立案内が戻る。通常配石のストア増加は捕獲画像にしない。

主要画面のスクリーンショットはこのフォルダ内のPNG。例: `reversi-corner-375.png`、`bakuretsu-390.png`、`mancala-capture-390.png`、`backgammon-hit-375.png`。

## 実オンラインの範囲

固定payload、秘密の値表示、private API書込を使用せず、通常のルーム作成/参加UIと既存.env.local経由で実施。ホスト390×844、ゲスト900×700、別contextのlocalStorage/接続。

- **マンカラ:** 人間2人で上記3手を進め、各手の公開盤面を両画面で比較して一致。両側に同じ `7石を捕獲` が表示され、CPU席画像なし。DOM履歴では大捕獲画像生成から約718ms/704ms後に `ゲーム案内 7石を捕獲` が戻った。各画面を個別に画像出現直後へ撮影した。
- **バックギャモン:** 実オープニングロールで先手を決め、先手がダブル提案、相手がTake。両画面の公開DOUBLE OFFERED/ACCEPTED表示を確認、CPU席なし、両画面を撮影。両contextで盤面から退出した。

`online-mancala-host-capture.png` / `online-mancala-guest-capture.png`、`online-backgammon-host-offer.png` / `online-backgammon-guest-offer.png`、同accept画像を保存。

## 初回差分と再検証

1. 初回375pxマンカラの固定ページでfavicon.icoが404。ゲーム画像ではなく検証HTMLのfavicon指定漏れだった。既存favicon.svgを明示し、同条件で捕獲・表示期間・consoleを再検証して成功。
2. reduced-motion BGでFramer Motionがreduce有効時の既知案内warningを出した。動きを減らす設定が適用されていることを示す診断を説明して分類し、動作・console errorを再検証して成功。未知のwarning/errorをまとめて無視していない。
3. 実Mancalaの初回QAは複数穴へのstrict selector、相手手番の文言待機、両側を待ってから700ms画像を読み取る手順が失敗した。次手穴の操作可能状態を待ち、各側の表示直後に個別取得する手順へ修正。公開盤面進行・DOM履歴を保存し、最終実対局は成功。試行JSONは `online-results-*-attempt.json` に保全。

## 実行コマンドと残る範囲

- `node .../runtime-boards/verify-boards.mjs`。`QA_FILTER` で同じ検証の必要な項目だけ再実行可能。
- `node .../runtime-boards/verify-online-boards.mjs`。既存UIで一時ルームを作成し、終了時に盤面から退出する。
- `node .../runtime-boards/finalize-results.mjs` は今回の実行結果を統合する。

**通常/爆裂リバーシの実2タブオンライン、実端末全機種、長い対局の完走、再接続はこのブラウザ検証では未実施。** ACK/SQLの単体・同期テスト成功を、実対局確認の代わりに扱っていない。
