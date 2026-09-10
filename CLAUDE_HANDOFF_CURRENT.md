## 2026-09-10 �ǋL �o�b�N�M������UI/UX�S�ʃu���b�V���A�b�v���I�����C�������Ή��E�{�Ԍ��J

��ƃu�����`: `claude/backgammon-polish`�iPR #36 �}�[�W�ς݁A�{�ԃR�~�b�g `517bdfc` Vercel�f�v���C�����j�B

�������e:
- **�_�u�����O�L���[�u�ƃ}�b�`�v���C�̎���**:
  - �ݒ��ʂŁu1�Ǌ����v�u3�_���v�u5�_���v��I���\�ɁB
  - �Q�[�����Ɂu�_�u����āv�uTake/Drop�v�̑I�����[�_����ǉ����A���_�v�Z�i�M�������A�o�b�N�M�����������܂ށj�����[���ʂ�Ɏ����B
  - �N���t�H�[�h���[�����K�p�ς݁B
- **UI/UX�ƃA�j���[�V�����̋���**:
  - �e�v���C���[�̃p�l���ɁuPip���i�c��}�X���j�v���펞�\���B
  - �T�C�R�����󒆂ŉ�]���Ă��痎���Ă���3D�A�j���[�V�����i\g-dice-roll\�j��ǉ��B
  - ����̋���q�b�g�����ۂɁA�o�[�ɔ�񂾋�t���b�V�����鉉�o�i\g-checker-hit\�j��ǉ��B
  - ���O�Ɉړ��E�z�u���ꂽ����n�C���C�g���鉉�o��ǉ��B
  - �x�A�I�t�i�オ��j�݂̂̏��������ɂȂ����ہA�����i�s�̃f�B���C��啝�ɒZ�k�i800ms��50ms�j���A�T�N�T�N�I�ǂ���悤�ɉ��P�B
  - �I�[�v�j���O���[����1.5�b�̃E�F�C�g�����A��U����̉ߒ������₷�������B
- **�o�O�C��**:
  - �]���ڂ��o���ہA2��܂ł����A���ړ��ł��Ȃ������o�O���ADFS�i�[���D��T���j�ɂ��o�H�T���ɏC�����A�ő�4���܂ň�C�Ɉړ��\�ɂ����B

����:
- \
pm run build\�A\
px vitest run\�i�S386�e�X�g�����j���m�F�B
- �{�Ԋ��iVercel�j�ւ̃f�v���C�������m�F�ς݁B

## 2026-09-09 追訁E全ゲーム征E��画面のコードコピ�Eボタン完�E配備�E�E��イチERLコピ�E機�E新設

作業ブランチE `feat/online-room-copy-buttons`�E�ER #35 にて `main` へマ�Eジ完亁E��Vercel 本番チE�Eロイ完亁E��、E

実裁E�E容:
- **共通�E有ユーチE��リチE��の整傁E(`src/utils/shareUtils.ts`)**:
  - `copyToClipboard`: モダンブラウザの `navigator.clipboard` とレガシー/セキュリチE��制限環墁E��け�E `document.execCommand` フォールバックを備えた堁E��なクリチE�Eボ�Eドコピ�E関数、E
  - `getGameSiteUrl`: 現在の環墁E��ローカル/本番�E�に応じたクリーンなサイト�EースURLを取得する関数、E
  - 単体テスチE`shareUtils.test.ts` を追加し、EチE��トすべて合格、E
- **全ゲーム征E��画面における「コードをコピ�E」！E��サイチERLをコピ�E」�Eタンの完�E整傁E*:
  - **マンカラ (`MancalaRoomPage.tsx`)**: 欠落してぁE��コードコピ�Eボタンを新設し、さらに「サイチERLをコピ�E」�Eタンを追加、E
  - **リバ�Eシ通常牁E(`ReversiWaitingScreen.tsx`) & 爁E��版 (`BakuretsuReversiWaitingScreen.tsx`)**: 既存�E「コードをコピ�E」に加え、「サイチERLをコピ�E」�Eタンを新設、E
  - **UNO (`UnoOnlineRoomPage.tsx`)**: 征E��枠冁E��「コードをコピ�E」と「サイチERLをコピ�E」�E2ボタンを�E置、E
  - **バックギャモン (`BackgammonPage.tsx`)**: 世界観に合わせた「コードを写す」「サイチERLを�Eす」�Eタンを�E置、E
  - **最弱王ババ抜ぁE(`BabanukiOnlineRoomPage.tsx`)**: 「コードをコピ�E」と「サイチERLをコピ�E」�E2ボタンを並べて配置、E
- **UI共通コンポ�EネンチE`Button.tsx` の拡張**:
  - `style?: React.CSSProperties` および `className?: string` のプロパティを受け取れるよう拡張、E
- **品質・チE��ト検証**:
  - 全38チE��トファイル・386チE��チE100% 合格、E
  - `tsc -b` および `npm run build` エラー0件で完亁E��E

## 2026-09-09 追訁Eマンカラのオンラインゲスト�Eアニメーション完�E同期・対戦終亁E���E移先バグ修正・全ゲーム旧メニュー完�E根絶

作業ブランチE `fix/online-animation-guest-transitions`、E

実裁E�E容:
- **マンカラのオンライン対戦相手�E�E�ゲスト�E�E�アニメーション完�E同期**:
  - `mancalaTypes.ts` の `GameState` に `lastMovePitId?: string` を追加、E
  - `startMove` で着手ピチE��IDめESupabase に保存。相手�E�E�Eealtime UPDATE / `syncLatest`�E�で1手進行！EturnCount === current.turnCount + 1` かつ `lastMovePitId` あり�E�を受信した際、`computeStoneSteps` による1石ずつの配币E��ニメーション、捕獲アニメーション、エクストラターンバナーを手番側と100%同一に同期再生するロジチE��を実裁E��E
  - アニメーション完亁E��に最終状態盤面へ反映する設計により、ゲスト�Eでも敵の石が滑らかに移動する様子がリアルタイムに確認可能、E
- **最弱王ババ抜き�E試合後「設定変更」「ゲーム設定に戻る」�E遷移先バグ修正**:
  - `BabanukiPage.tsx` で `onBackToRoom={() => setScreen('room')}` となってぁE��ため、試合後に旧メニュー画面�E�EBabanukiOnlineRoomPage`�E�へ遷移してぁE��不�E合を修正、E
  - `BabanukiOnlineGame` のプロパティめE`onBackToSetup` に名称・役割を統一し、`BabanukiSettingsScreen`�E�真の初期設定画面�E�へ直帰させる動線を確立。対戦中ヘッダーの「ゲーム設定に戻る」�EタンめE`onBackToSetup` に修正、E
- **全ゲーム�E��Eンカラ・UNO・ババ抜き�E��E `*RoomPage` における旧メニュー�E�二重UI�E��E完�E根絶**:
  - ルーム作�E・参加失敗時めE��ャンセル時に古ぁE��ニュー画面�E�EpageState === 'menu'`�E�へフォールバックしてぁE��不�E合を解消、E
  - `PageState` に `'error'` を新設し、エラー発生時は刁E��りやすいエラー通知カードとともに「ゲーム設定に戻る」�Eタン�E�EonBack`�E�を表示して初期設定画面へ直帰させるフローに統一、E
- **バックギャモンのゲスト�E終局画面の最適匁E*:
  - ゲスト�Eの結果モーダルで `showRematch: iAmHost` とし、「�E戦する」をホスト専用のアクションとして整琁E��E
  - ゲスト�Eには「ルームの主が『�E戦する』を選ぶと、この盤のまま自動で次の対局が始まります」とぁE��征E��案�Eを表示、E
- **品質・チE��ト検証**:
  - 全37チE��トファイル・382チE��チE100% 合格、E
  - `tsc -b` および `npm run build` エラー0件で完亁E��E

## 2026-09-09 追訁Eバックギャモン人数整琁E�Eババ抜きちらつき！E��り�E移修正・リバ�Eシ自動判別案�E・全ゲーム多面チE��チE��完亁E

作業ブランチE `codex/round2-deep-polish-and-ux-perfection`、E

実裁E�E容:
- **バックギャモンの人数表示排除�E�E��行フロー匁E*:
  - 2人固定ゲームの特性に合わせ、CPU対戦時およ�Eオンラインルーム作�E時�E不要な、E人」�EタングリチE��を完�E撤廁E��E
  - ルーム作�E時�E手番・人数などの余計なスチE��プを挟まず、�Eタン1タチE�Eで即座にルームコード発行�E征E��画面へ直行する動線を確立、E
- **ババ抜きのルーム作�E時ちらつき根絶�E�E��ゲーム設定に戻る」�E遷移先修正**:
  - ルーム作�E時�E初期スチE�Eトを `pageState = 'creating'`�E�ローチE��ング画面�E�に改修し、�Eウント時に一瞬古ぁE��数設定�Eージが表示されるちらつきを完�E根絶、E
  - ルーム作�E後�E征E��中・作�E中に上部ヘッダーの「�E ゲーム設定に戻る」を押した際、旧メニューではなく親の `onBack()`�E�最初�E設定画面 `BabanukiSettingsScreen`�E�へ確実に直帰するよう修正。�Eスト征E��時はルームを削除してクリーンに戻す、E
- **リバ�Eシのコード参加における掟選択バイパス化！E�E動判別エラー詳細匁E*:
  - 「遠方の老E��対戦」�E「参加」を選択した瞬間、Step I�E�通常/爁E���E掟選択タブ）を自動的に非表示化し、「✨ 通常版�E爁E��版のどちら�Eコードでも�E動判別して即座に参加します」とぁE��案�Eのみを表示。参加側が掟選択で迷ぁE��地をゼロにした、E
  - `reversiOnlineAuto.ts` において、�E裂版ルームが満員・対局中だった場合�Eエラー判定を詳細化、E
- **全ゲーム共通�E多面皁E��バッグ・モバイル表示崩れ解涁E*:
  - 最弱王ババ抜き！EBabanukiFinale.tsx`�E�およ�Eバックギャモン�E�EBackgammonPlayScreen.tsx`�E��E結果モーダルで、CSS flexbox の "scroll-to-top impossible" バグを解消するためE`margin: auto 0` パターンを適用。小画面端末でも上部の王�EめE��イトルが上端に見�Eれることなく�E領域スクロール可能にした、E
  - バックギャモンの結果モーダルに `overflow-y: auto` を追加し、�Eタン見�Eれを防止、E
  - `GameEndActions` において `onChangeSettings` ぁE`onBackToSetup` と重褁E��る場合に非表示化するロジチE��を導�Eし、デチE��ボタンを排除、E
  - マンカラ征E��画面のコード表示枠めE`clamp()` によるレスポンシブ幁E��改喁E��E60px幁E��末での接触・はみ出しを防止�E�、E
  - `MancalaOnlineGamePage.tsx` の不要な `console.error` をクリーンアチE�E、E
- **品質・チE��ト検証**:
  - 全37チE��トファイル・382チE��チE100% 合格、E
  - `tsc -b` および `npm run build` エラー0件、E

## 2026-09-08 追訁E全ゲームのオンライン設定をセチE��アチE�E画面へ統合�E二重メニュー完�E廁E��・征E��画面直行�E本番公閁E

作業ブランチE `codex/setup-and-room-flow-perfection`�E�ER #32 マ�Eジ済み、本番コミッチE`2c57384` VercelチE�Eロイ完亁E��、E

実裁E�E容:
- **全ゲームのオンライン設定をセチE��アチE�E画面に統合�E二重メニューの完�E撤廁E*:
  - マンカラ・UNO・最弱王ババ抜きにおいて、「ルームを作�E」を選択した段階で同一画面冁E��「対戦人数」およ�E「挑戦老E��ロチE���E�👤 人閁E/ 🐉 CPU難易度選択）」�E設定UIを直接展開、E
  - 末尾の「ルームを作�Eする」�EタンめE度押すだけで、E�E移先で再度名前入力や参加タブが出る中間メニュー�E�二重UI�E�を完�Eバイパスし、即座に大コード表示・席征E��画面へダイレクト�E移するフローを確立、E
  - 征E��画面の「キャンセル」を押した際�E、ルームを破棁E��て自然に最初�E設定画面へ戻るクリーンな動線を確保、E
- **全5ゲーム�E�リバ�Eシ・UNO・マンカラ・バックギャモン・ババ抜き�E��E完�EなUX統一**:
  - 全ゲーム共通で「Step I: ルール選択（褁E��ある場合！EↁE対戦方法選択（ルーム作�E�E�EↁE参加老E�EスロチE��・手番設宁EↁEルームを作�Eする�E�征E��画面直行）」とぁE��人間�E自然な思老E��E��と1アクション完結�Eベスト�EラクチE��スを策定�E実現、E
  - 事前採点ルール�E�E00点満点、合格95点�E�に基づき�E己採点と改喁E��反復し、E9点の極めて高いUXスコアで合格案を実裁E��E
- **チE��ト�E品質拁E��E*:
  - 全体結合チE��チE`src/features/setupScreensFlow.test.tsx` を拡允E��、中間�E移ボタン根絶とダイレクト完結を検証。�E37ファイル・381チE��チE100% 合格、E
  - `tsc -b` および `npm run build`�E�Eite本番ビルド）エラー0件、E
- **本番チE�Eロイ**:
  - `PUBLISHING.md` 手頁E��従い、GitHub REST API経由でPR #32を作�E、Vercel PreviewおよびGitHub Actions CI�E�Ebuild-and-test`�E��E成功�E�Estate=success`�E�を確認後にマ�Eジ。本番URL�E�Ehttps://dragon-game-park.vercel.app/`�E�へのチE�Eロイ完亁E��確認済み、E

## 2026-09-08 追訁E全ゲーム設定フローUX再構築�E重褁E���Eし排除・リバ�Eシ設定同期バグ修正・本番公閁E

作業ブランチE `codex/setup-flow-redesign-all-games`�E�ER #31 マ�Eジ済み、本番コミッチE`80a0318` VercelチE�Eロイ完亁E��、E

実裁E�E容:
- **全ゲームのセチE��アチE�EフローUX統一・自然な動線設訁E*:
  - ルール/バリアントが褁E��存在するゲーム�E�リバ�Eシ�E�通常/爁E��、UNO�E�通常/ハ�Eド）において、�E然な動線として**「Step I: 遊戯の掟を選ぶ�E�ルール選択）」を最優先�E置**、E
  - 全ゲーム�E�リバ�Eシ、UNO、�Eンカラ、バチE��ギャモン、最弱王ババ抜き）かめE*二重・冗長な「コードで参加する」見�Eしやラベルを完�E排除**、E
  - 設定前に中途半端に配置されてぁE��中間�Eタン�E�インラインの「ルーム設定へ進む」など�E�を撤廁E��、E*全設定（手番・人数・難易度など�E�を選択した後に末尾に1つだけ確定アクションボタン�E�「この設定で対戦する」「ルームを作�Eする」「このコードで参加する」）を配置するフローに統一**、E
- **リバ�Eシのルール刁E��替え時のモードリセチE��不�E合解涁E*:
  - ルーム作�E�E�オンライン�E�を選択した状態で通常版と爁E��版を�Eり替えた際に、�E期値のCPU対戦に戻ってしまぁE��態同期バグを完�E修正�E�Emode`、`humanSide`、`name` を両コンフィグ間で同期�E�、E
- **チE��ト�E品質拁E��E*:
  - 新設の全ゲームセチE��アチE�Eフロー統合テスチE`setupScreensFlow.test.tsx` を含む全37ファイル・381チE��チE100% 合格、E
  - `tsc -b` および `npm run build` がエラー0件でパス、E
- **本番チE�Eロイ**:
  - `PUBLISHING.md` 手頁E��従い、GitHub REST API経由でPR #31を作�E、Vercel PreviewおよびGitHub Actions CI�E�Ebuild-and-test`�E��E完亁E�E成功�E�Estate=success`�E�を確認後にマ�Eジ。本番URL�E�Ehttps://dragon-game-park.vercel.app/`�E�へのチE�Eロイ完亁E��確認済み、E

## 2026-09-08 追訁Eリバ�Eシオンライン自動判別・設定変更再戦・UI/UX全面ブラチE��ュアチE�E

作業ブランチE `codex/reversi-online-auto-detect-and-ui-polish`、E

実裁E�E容:
- **コード参加の通常/爁E���E動判別**: `reversiOnlineAuto.ts` の `joinReversiRoomAuto` を実裁E��参加画面で通常版�E爁E��版の事前刁E��替えなしに、�E力された6桁コードをもとにDB側を�E動判定して該当ルーム�E�通常牁E爁E��版�E�へ即座に参加できるようにした、E
- **UI/UXの大幁E��ラチE��ュアチE�E**: `ReversiUnifiedSettingsScreen.tsx` を�E面再設計、E
  - コード参加時�E通常/爁E���E選択やCPU設定などの無駁E��頁E��・二重ボタンを完�Eに排除し、名前�E力�Eコード�E力�E「このコードで参加する」�Eタンのみの直観皁EスチE��プ化、E
  - ルーム作�E時�Eルール選択（通常/爁E��）と手番のみを表示し、CPU設定を非表示化、E
  - CPU対戦時�Eルール・CPU強さ！E段階）�E手番を表示、E
  - オンライン対戦時に無駁E��「対戦相手を決める」スチE��プが表示される混乱を完�E解消、E
- **同一ルーム冁E��の設定変更再戦**:
  - 通常牁E`ReversiOnlineGame.tsx`: ホストが「設定を変更して再戦」を選んだ際、同一ルームのまま先手・後手を交代して即座に新局へ移行すめE`rematchSwapSides` を実裁E��E
  - 爁E��版 `BakuretsuReversiOnlineGame.tsx`: ホストが「設定を変更して再戦」を選んでも同一ルームのまま再戦を継続できるよう改喁E��E
  - ルーム解散・コード�E発行�E手間を解消、E
- **検証結果**:
  - `npx tsc --noEmit` & `tsc -b`: 成功�E�E errors�E�E
  - `npm run build`: 成功�E�Eite本番バンドル正常生�E�E�E
  - `npx vitest run`: 全36ファイル・375チE��チE100% 合格
  - `npx oxlint`: エラー0

## 2026-09-02 追訁E爁E��リバ�Eシー 本番公開とUI統合完亁E

爁E��リバ�Eシーのエンジン、UI、E段階CPU、オンライン対戦の実裁E��完亁E��、本番環墁E��公開しました、E

- **リバ�Eシの設定UI統吁E*: 爁E��版と通常版で別、E��なってぁE��設定画面とルートを `ReversiUnifiedSettingsScreen` に統合し、E`ReversiPage.tsx` が両方のStateを管琁E��るよぁE��全面書き換えました、E
- **全ゲームのローカル対戦廁E��**: ババ抜き、UNO、�Eンカラ、バチE��ギャモン、リバ�Eシの全てのゲームから「同じ盤で対戦する (local)」モードを完�Eに削除しました、E
- **オンライン参加UIの整琁E*: 全ゲームの設定画面で「�Eコードで参加する」とぁE��チE��ストを削除し、コード�E力欁E�E直下に「このコードで参加する」�Eタンをインライン配置するようJSXとCSSを整琁E��ました、E
- **ビルド�EチE��ト�E修正**: 上記�E褁E��な仕様変更に伴ぁE��の不整吁E(ReversiMode / BackgammonMode / MancalaMode) とチE��トエラーをすべて修正し、`tsc -b` と `vitest run` がオールグリーンで通過することを確認しました、E
- **本番チE�Eロイ**: 変更めE`codex/bakuretsu-reversi-final-fixes` ブランチにプッシュし、PR作�EAPIを経由して `main` へマ�Eジ。VercelとGitHub Actions (CI) の成功を確認しました、E

### 検証結果
- `npx tsc --noEmit` と `tsc -b`: 成功
- `npm run build`: 成功
- `npx vitest run`: 全34ファイル・367チE��ト�E劁E
- `npm run lint`: 通過
- PRスータスAPIでの本番チE�Eロイ完亁E��誁E 成功

### 次にすること
- ユーザーにURL (https://dragon-game-park.vercel.app/) と共に完亁E��報告します、E
- 新牁EQLによる実Supabaseでの2タブ対戦確認�E引き続き行う忁E��があります、E


# Dragon Game Park  ECurrent Handoff

## 2026-09-02 追訁E 爁E��リバ�Eシー オンラインをサーバ�E権限へ再設計！EQL反映征E���E�E

作業ブランチE `codex/bakuretsu-reversi-engine`、E
隔離worktree: `C:\Users\ray-0\Dragon-game-park-bakuretsu-engine`。未公開、E

こ�E節が、直下�E2026-09-01節にある旧オンライン実裁E�E実DB検証・2タブ検証の記述より新しい正である、E
旧版�Eクライアント計算済みsnapshotを保存する設計だったため廁E��した。旧SQLでのユーザー `Success` と
ルーム `ZCX52E` / `V7G29M` の検証は、今回のサーバ�E権限版の動作証拠にはならなぁE��E

今回の実裁E

- 通信方式�E既存�ESupabase RPC�E�E秒pollのまま維持し、新しい通信方式やランタイム依存を追加してぁE��ぁE��E
  SQL実行回帰チE��ト専用のdevDependencyとして `@electric-sql/pglite` だけを追加した、E
- `supabase/bakuretsu_reversi_rooms.sql` へ固宁E`DEFAULT_CONFIG` のルール処琁E��PL/pgSQLで移植、E
  初期局面生�E、合法手検証、着手、E��鎖、終局、�E戦をDB冁E��実行する、E
- クライアント�E `Move | null`、時間�Eれフラグ、versionだけを送る。オンライン画面では
  TypeScript側の `applyMove()` を実行せず、サーバ�Eの `TurnResult` を受け取って演�Eだけ�E生する、E
- 全RPC応答�E `view.ts` の `redact()` と同じ墁E��をDB側で適用する。相手�E伏せ特殊種・耐乁E��E
  残り特殊手札、dummy数を�E開しなぁE��テーブル直接アクセスと冁E��関数実行権限も拒否する、E
- 1人20刁E�E持ち時間をサーバ�E時刻で管琁E��次手番本人の演�E完亁Eck後にサーバ�E時計を開始し、E
  最遁E���E時間より早ぁEckと時計開始前の着手をDBで拒否するため、poll受信遁E��中・演�E中は時計を減らさなぁE��E
  poll/通信遁E��用のack猶予�E最大10秒で、それ以上�E遁E��はサーバ�Eが残り時間から控除する、E
  通信遁E��用の無料ACK猶予�E最大10秒で、それを趁E��た遅延はサーバ�Eが持ち時間から控除する、E
  fallback期限後�EACKは時計を再付与せず、そのままサーバ�E時間刁E��自動着手として処琁E��る、E
  時間刁E��は最少反転、次にy/xの通常手を自動着手し、同じ�EぁE回連続すると `ABANDON` 敗北、E
  手番側が�E断した場合�Eみ、相手�E期限30秒後から時間�Eれ解決を代行できる、E
- 旧 `push_bakuretsu_reversi_snapshot` と完�E状態を受け取る旧create RPCは明示皁E��削除した、E
  参加老E��手番、versionを行ロチE��冁E��検証する、E

ローカル検証:

- 開発依存�EPGliteを使ぁE��乁E��ストでSQL全斁E��実行し、TSエンジンとの1局全手�E全状態�E全event一致、E
  特殊手、BLACK/WHITEの全手redact照合、演�E前着手�E早期ack拒否、期限後ackの自動着手化、E
  時間刁E��9手、E回連続敗北、event頁E��持を確認する、E
- edgecases 25/25、golden 300/300、seed 1、E200を各2回�E自動対戦はルール違反0・決定論一致、E
- 全35ファイル370チE��ト、`tsc -b`、製品build、lint終亁E��ーチE。今回のReact hook警告�E0、E
- オンライン独立監査は時計�EACK・timeout競合を含む褁E��回�E持E��修正後、最終P0〜P3すべて0件で合格、E
- Playwright Core + msedge 実ブラウザによる2タブローカル検証で以下�E全11頁E��を確認した、E
  1. ホストがルームを作�Eし、別タブ�Eゲストがコード参加できる、E
  2. 黒�E白それぞれの通常手と特殊手がサーバ�Eで受理される（�E弾使用・通常手受琁E��認）、E
  3. 両画面で盤面、手番、eventsの頁E��が一致する、E
  4. 着手�E反転→特殊発動�E最終盤面の演�E頁E��一致する、E
  5. 演�E中に次手番の時計が減らず、演�E完亁E��に開始する、E
  6. 相手視点のRPC応答に伏せ特殊種・耐乁E�E残り手札・dummy数が含まれなぁE��傍受テスト合格�E�、E
  7. 古いversionの着手、手番外着手、演�E完亁E��着手が拒否される！Euestからのホスト手番着手拒否を確認）、E
  8. 再読み込み・一時�E断後に同じ盤面へ復帰する�E�Euestのリロードとコード�E参加による盤面復帰を確認）、E
  9. 終局後、�Eスト�E戦でmatch_noが進み、�E期盤面へ戻る、E
  10. 検証ルームを最後にホスト権限で削除する�E�ETZWSBP` などの検証用ルーム衁E件をローカルスクリプトで削除完亁E��、E
  11. 1280ÁE20と390ÁE44で横はみ出し、操作不�E、console errorがなぁE���E動�E手動確認済）、E

次の忁E��ゲーチE

1. `PUBLISHING.md` に従ってPR、CI/Vercel、merge SHA、本番2タブを検証する。（ユーザーから公開指示があった場合�Eみ�E�E

## 2026-09-01 追訁E 爁E��リバ�Eシー エンジン�E�UI�E�CPU�E�オンライン対戦�E�未公開！E

作業ブランチE `codex/bakuretsu-reversi-engine`、E
隔離worktree: `C:\Users\ray-0\Dragon-game-park-bakuretsu-engine`。未公開、E

今回の篁E���E�指示書8章スチE��チE、E�E�E

- 既存リバ�Eシの構造を確認し、`src/features/reversi/bakuretsu/` へ
  `types.ts` / `config.ts` / `rules.ts` / `engine.ts` を移植した、E
- 参�E実裁E�EロジチE��は変更してぁE��ぁE��`types.ts` / `config.ts` / `rules.ts` はSHA-256一致、E
  `engine.ts` の差は既存�E厳格buildで未使用ヘルパ�Eを保持するための `@ts-expect-error` コメンチE行だけ、E
- `tests/bakuretsu/` に製品外�E移植検証を追加。参照の `golden.json` はSHA-256一致、E
- リバ�Eシ入口に通常�E��E裂�E選択を追加。通常版�E設定�E盤・ルール・CPU・オンライン実裁E�E変更せず、E
  爁E��版だけを独立した�E部ルーターとローカル2人設定�E対局画面として追加した、E
- `bakuretsu-reference/ai.ts` / `view.ts` を移植。`ai.ts` の差は既存�E厳格buildで移植�Eの
  未使用変数を保持するための `@ts-expect-error` コメンチE行だけで、�E琁E��ジチE��は同一、E
- 爁E��版へCPU対戦を追加、Ev1、E�E��Eビ�Eドラゴン〜ゴチE��ドラゴン�E�と、挑戦老E�E黒／白�E�おまかせめE
  選択できる。ローカル2人対戦も引き続き選べる、E
- 完�E状態を扱ぁE��E��は `createBakuretsuCpuRequest()` だけとし、`view.ts` の `redact()` でCPU視点へ
  遮蔽したコピ�EだけをWorkerへ送る、EI本体�EWorker冁E��動作し、Lv5探索もメインスレチE��を塞がなぁE��E
  request id、手数、ゲームtokenで再戦・画面離脱後�E古ぁE��答を無視する、E
- 爁E��UIは既存リバ�Eシの盤・竜画像�E黒白金深緑�E配色・上部バ�E・プレイヤーパネル・手番トレイを�E利用、E
  爁E��封E��と24枚までの残数、�E開特殊コマ、深度ラベル、同深度の発火允E��壁、双方の20刁E��計を表示する、E
- `FLIP.idxs` を並べ替えずに着手�E近い頁E�E反転→盾�E��E弾�E�感染�E最終盤面の頁E��段階�E生する、E
  低速／標準／高速�E両老E��、演�E中は次手番の時計を開始せず、スキチE�Eでも最終盤面めEフレーム表示後に確定する、E
- 中竁E枚反転、�E風で自軍無傷、中立でライン停止、盾の反転途中停止と通常化を盤上演�E�E�常設説明で可視化した、E
- 爁E��版へオンライン対戦を追加、E桁コード、E��EホスチE/ 白=ゲスト、タブ単位ID、征E��室、E
  1秒poll、version楽観ロチE��、�Eスト�E戦に対応し、`TurnResult` をevents込みで共有して受信側も同頁E�E生する、E
- 専用チE�Eブルは直接読み書き不可とし、参加タブID・version・手番・再戦世代を検証する5つの
  `SECURITY DEFINER` RPCだけを公開、EB期限後�E相手�Eが時間�Eれ�E動着手を代行でき、手番側刁E��でも進行可能、E
  保存競合�E通信失敗時は最後に確認済みの盤面へ強制同期する、E

検証:

- エチE��ケース25/25件成功、E
- seed 1、E00のgolden照吁E00/300件一致�E��E着手�E、最終盤面、勝老E��終局琁E���E�、E
- seed 1、E200めE回、訁E400局実行。両回ルール違反0件、�Eレコードが決定論的一致、E
- 通常リバ�Eシの設定�E盤・対局画面・ルール・CPU・オンライン6ファイルは作業前SHA-256と一致、E
- CPUはLv1、EにつぁE��24局ずつ終局まで進め、�E着手合法�E同一seed同一応答を確認。固宁E0局面では
  5レベルすべての着手signatureが異なる。redact墁E��は相手�E伏せ正体�E耐乁E�E残り手札・dummy数を�E蔽する、E
- `npx tsc -b --pretty false`、製品build、�E34ファイル364チE��トが成功。buildで
  `bakuretsuCpu.worker-*.js` が独立chunkとして生�E。lintはエラー0�E�参照実裁E��既存警告�Eみ�E�、E
- 独立監査の初回P2 2件�E�遠ぁE��を通常反転より先に表示、�E忁E��を破壊枚数から除外）を修正、E
  再監査は合格、P0〜P3すべて0件。距離1通常反転→距離2盾停止と、�E忁E��込み3枚破壊ラベルを独立�E現した、E
- CPU独立監査の初回P2 1件�E�時計�Eれで旧Worker応答を失効せず、次CPU手番へ誤適用し得る�E�を修正、E
  全着手開始時に共通counterで要汁EDを失効するよう変更し、�E監査はP0〜P3すべて0件、E
  独立実行�E爁E��E3ファイル88チE��トと型検査も�E功した、E
- 実ブラウザで通常版�E従来設定、�E裂設定、E��常着手、中竁E枚反転、�E弾の深度1発火、スキチE�Eを操作、E
  1280ÁE20と390ÁE44で横はみ出ぁE、対局画面は `scrollHeight = clientHeight`、新規タブ�Econsole警告�Eエラー0、E
- 実ブラウザでCPU対戦・Lv5・挑戦老E��を選び、CPU黒�E初手後に白の合法手が有効化されること、E
  白 `C3` 着手後にCPUが応手して再�E白の合法手が有効化されることを確認、E280ÁE20と390ÁE44で
  横はみ出ぁE、対局画面は `scrollHeight = clientHeight`、console警告�Eエラー0、E
- 実ブラウザで爁E��版のオンライン選択�Eコード参加を操作。�E力前は参加不可、E斁E���E力後�E参加可能、E
  1280ÁE20と390ÁE44で横はみ出ぁE、新規タブ�Econsole警告�Eエラー0、E
- オンライン独立監査では初回P1 1件�E��E開テーブル全面許可�E�とP2 2件�E�Eersion収束、�E断時時計停止�E�、E
  再監査でP2 1件�E�EurnResult JSONのNULL比輁E��を検�Eして修正。最終�E監査はP0〜P3すべて0件で合格、E
  ユーザーはSupabase SQLの `Success` を報告済み、E
- 実Supabaseルーム `ZCX52E` で作�E、参加、第三老E��否、E��白双方の着手、同一events頁E��version競合拒否、E
  再取得、終局、�E戦、第三老E��除拒否を確認。検証後にホスト権限で削除し、残孁E件を確認した、E
- 実DB検証でPostgreSQL JSONBのobjectキー頁E��規化により同一状態を競合扱ぁE��る問題を発見、E
  objectキーを�E帰sortし�E列頁E��保持する比輁E��修正し、独立�E監査P0〜P3すべて0件、E
- ユーザー承認�E一時Playwright Core�E�既存Edgeで実画面2タブを通し、ルーム `V7G29M` で作�E、参加、E
  黁E`D3` の通常手、白 `C3` の爁E��、両タブで同一の着手�E反転→手番交代表示、盤面同期、�E接続を確認した、E
- 同ルームめE3手で終局まで進め、�Eストだけ�E戦可能、�E戦後�E初期4石、`match_no = 1` を確認、E
  1280ÁE20と390ÁE44�E�EscrollWidth = clientWidth`、`scrollHeight = clientHeight`�E�で表示を確認し、E
  両タブ�Econsole警告�Eエラー0。検証後にルームを削除して残孁E件を確認した。一時Playwright依存も削除済み、E

次に進む場吁E

- ローカル実裁E�E独立監査・実Supabase API・実画面2タブ検証は完亁E��未公開�Eため、次は差刁E��確認して
  `PUBLISHING.md` の手頁E��おりPR、CI/Vercel、merge SHA、本番画面を検証する、E

## 2026-08-31 追訁E リバ�Eシのオンライン対戦と盤上アニメーション�E�本番公開済み�E�E

作業ブランチE `codex/reversi-online-animations`。PR #24を`main`へマ�Eジし、E
マ�EジSHA `94b3caf` を本番公開済み、E

実裁E�E容:

- `supabase/reversi_rooms.sql` と `reversiOnline.ts` を追加、E人用ルームの作�E、E桁コード参加、E
  タブ単位�E参加老ED、E��EホスチE/ 白=ゲスト、Realtime�E�E秒poll、version楽観ロチE��、E
  ホスト�E戦、征E��室、コードコピ�E、ルームを閉じる導線を実裁E��た、E
- 設定画面を既存ゲーム同様�Eオンライン初期表示・コード参加初期タブへ変更した、E
  CPU / 同じ盤 / オンラインの3方式とCPU 5段階�E維持してぁE��、E
- 着手時はまず新しい石が盤へ落ち、その後に着手点からの距離ごとに近い石から波状反転する、E
  CPU着手、ローカル対戦、オンライン受信のすべてで同じ再生処琁E��使ぁE��E
- 終局状態と勝利表示は最後�E反転波が完亁E��てから確定する。低モーション設定では征E��時間と
  CSSモーションを短縮するが、着手�E反転→結果の頁E���E維持する、E

検証:

- `npx tsc --noEmit`、製品build、E5ファイル308チE��トが成功。lintはエラー0で既存警告�Eみ、E
- 実ブラウザでCPUの着手位置 `E3` の石落下と、`E3` / `E4` の反転を別段階として確認、E
- ローカル対戦めE0手で終局まで操作。最終手 `H8` の着手後に `G7` が反転してぁE��間�E
  結果ダイアログぁE件で、反転完亁E��だけ決着カチE��イン→結果表示となることを確認した、E
- 390ÁE44相当でオンライン作�E / コード参加UIを確認し、横はみ出ぁE、console問顁E件、E
- ユーザーがSupabase SQL Editorで `supabase/reversi_rooms.sql` を�E斁E��行し、E
  `Success. No rows returned` を画面で確認した、E
- 実Supabaseの2ブラウザタブでルーム `WGZRVQ` を作�Eし、�Eスト黁E/ ゲスト白、E桁コード参加、E
  相互�E名前と手番制御を確認。黁E`D3` と白 `C3` を双方から着手し、両画面の6石が一致した、E
  受信側でめE`C3` の石配置後に `D4` が反転し、完亁E��にだけ黒�Eの合法手4件が有効になった、E
- PR #24のコミッチE`1d580b0` でGitHub Actions `build-and-test` とVercel Previewが�E功した、E

公開結果:

- マ�EジSHA `94b3caf` のGitHub Actions `build-and-test` とVercel本番チE�Eロイが�E功した、E
- `https://dragon-game-park.vercel.app` の2ブラウザタブで本番ルーム `QEVGCG` を作�Eし、E
  コード参加、E��EホスチE/ 白=ゲスト、両老E�E名前、手番外操作不可を確認した、E
- 本番で黁E`D3` を着手すると、受信側で `D3` の石配置後に `D4` が反転し、白側の合法手3件ぁE
  反転完亁E��だけ有効になった。続く白 `C3` も受信側で石配置→`D4` 反転の頁E��再生し、E
  完亁E���E両画面は6石すべて一致、E���Eの合法手4件だけが有効になった、E
- 390ÁE44持E��！ESS client幁E75px�E��E本番設定画面でオンライン作�E / コード参加UI、E
  5段階CPU表記、横はみ出ぁE、Viteエラー表示なしを確認した、E
- ローカル検証ルーム `WGZRVQ` と本番検証ルーム `QEVGCG` は、参加老E��とversionを�E合後に
  それぞれ削除し、残孁E件を確認した、E

## 2026-08-30 追訁E リバ�Eシを新規実裁E��本番公開済み�E�E

作業ブランチE `codex/reversi`。PR #22を`main`へマ�Eジし、�EージSHA `a90f84e` を本番公開済み、E

実裁E�E容:

- `src/features/reversi/` を新設し、標溁EÁE盤、E���E手、E方向反転、�E動パス、E
  双方着手不�Eまた�E盤面允E��での終局、同数引き刁E��を実裁E��た、E
- CPU対戦とローカル2人対戦を用意した、EPU難易度は既存ゲームに合わせて5段隁E
  �E��Eビ�Eドラゴン / ドラゴン / スーパ�Eドラゴン / ドラゴンキング / ゴチE��ドラゴン�E�、E
  ゴチE��ドラゴンは残り8マス以下を完�E読みする、E
- 合法手ヒント、反転枚数、現在手番、対局ログ、ルール説明、�E戦を追加した、E
- 角獲得�E最初�E5枚以上反転・決着に画像カチE��インを追加した。大量反転演�Eは
  チE��ポを壊さなぁE��ぁEゲーム1回に制限し、`prefers-reduced-motion` にも対応した、E
- ホ�Eム、�E通設定フロー、テーマ、アプリ配線を追加した。リバ�Eシ本体�E遁E��読込にして、E
  初期JSへの増加を抑えた。オンライン対戦 / Supabase対応�E今回の篁E��外、E
- 生�E・検品済み画像�E `docs/design/reversi-primary-concept.png` と
  `src/features/reversi/assets/{corner-capture,grand-flip,finale}.png`、E
  主画面コンセプト初稿の8ÁE盤は採用せず、正確な8ÁE版へ生�Eし直した、E

検証:

- `npx tsc --noEmit`、製品build、E2ファイル297チE��トが成功、E
  lintはエラー0で既存�EMancala / Backgammon警告�Eみ。`git diff --check` も�E功、E
- 実ブラウザで1280ÁE20、E672ÁE41、E90ÁE44を確認、E4マス・初期合法手4件、E
  着手後�ECPU応手、横はみ出しなし、PCで盤面と操作領域ぁE画面冁E��コンソールエラー0件、E
- ローカル対戦めE0手で終局まで自動操作し、盤面允E��・勝敗表示・合法手0件を確認、E
  再戦後�E黁E / 白2 / 空ぁE0 / 合法手4件へ正しく戻ることを確認した、E
- 独立検証で、パス時にも探索深度を減らして終盤完�E読みが不正確になる問題を発見�E修正、E
  7空き�E到達可能30局面で独立完�E探索と一致し、�E発防止チE��トも追加した、E
- 独立�E48対局では合法手違反・石数不変条件違反・終局破綻なし。隣接難易度の対戦は
  上位�E40勁E敁E刁E��、E段階�E強さに明確な差を確認した、E8対局すべてでカチE��インは
  5、E回に収まり、大量反転は吁E��ーム1回だけだった、E

残件:

- 自動対局では破綻とチE��ポ上�E問題を修正済みだが、家族での主観皁E��面白さ�E未評価、E
- `https://dragon-game-park.vercel.app` で、�Eーム表示、E段階CPU設定、�E朁E4マス・合法手4件、E
  着手後�ECPU応手、E90ÁE44での横はみ出ぁE、コンソールエラー0件を確認済み、E

## 2026-08-24 追訁E UNOのPC対戦画面めE画面で操作できる2列構�Eへ変更

作業ブランチE `codex/uno-pc-single-screen`、E

実裁E�E容:

- 幁E00px以上ではUNOのプレイ領域を「左: 冁E��チE�Eブル / 右: 自刁E�E手札」�E2列へ変更した、E
  盤面の高さは画面高に追従し、E��常ターンでは盤面と山札操作を同時に確認できる、E
- PCの手札めE2pxカード�E3列棚へ変更した。�E朁E枚�E一覧でき、E5枚�E24枚などの多い手札は
  ペ�Eジ全体ではなく手札欁E��けを縦スクロールする。色別の並び、�Eせるカード、効果�Eタンは維持した、E
  高さ700px前後では行間を�E動的に詰め、�E朁E枚に不要な手札冁E��クロールが�EなぁE��ぁE��した、E
- ルーレチE��案�EはPCでは右列�E手札上、スマ�Eでは従来どおり盤面直前に置く、E
  スタート�Eレイヤー決定、色選択、E交換�E選択などの操作パネルは左盤面冁E��残した、E
- 6人・10人では相手席を上部2段へ刁E��し、席同士と中央カード�E重なりを解消した、E
- 幁E99px以下�E従来の縦配置と扁E��手札を維持する。画面遷移時�Eペ�Eジ先頭へ戻し、E
  設定画面のスクロール位置が対戦画面へ残らなぁE��ぁE��した、E
- 24枚�E手札でも専用プレイ領域と手札スクロール構造を維持するレンダリング契紁E��ストを追加した、E

検証:

- `npx tsc --noEmit`、製品build、E8ファイル262チE��トが成功。lintはエラー0で既存警告�Eみ、E
- 実ブラウザの900x700、E024x768、E280x800、E920x1080で盤面と手札操作を同時表示し、E
  390x844では従来の縦配置・扁E��手札・横はみ出しなしを確認した、E
- 通常牁E0人、ハード版6人で全席が盤面冁E��収まり、席同士の重なめE件を座標計測した、E
- 実Supabaseの通常牁E人ルームめE27.0.0.1とlocalhostの2画面で開始し、�Eスト�E参加老E��めE
  2列�E置、横はみ出しなし、同一ルーム状態を確認した。SupabaseのSQL変更はなぁE��E

## 2026-08-24 追訁E UNOカラー ルーレチE��演�Eの視認性を改喁E

作業ブランチE `codex/uno-roulette-presentation`、E

実裁E�E容:

- ルーレチE��案�Eを中央モーダルと上部通知から刁E��し、テーブル直前�E完�E不透�Eな固定寸法パネルへ変更した、E
- 見�Eし、主要メチE��ージ、�Eレイヤー名、枚数を別要素にして、E40px以下では名前と枚数を別の行へ配置する、E
- ルーレチE��中はパネルを消さず、山札から対象席へカード裏面めE枚ずつ飛�Eす。指定色では1.2秒�E
  セーフ表示へ刁E��替え、E5枚到達時は既存�E共通アウト演�Eを優先する、E
- オンライン・オフラインとめE极E20msへ統一し、Realtimeとpollが同じ状態を返してめE
  `sequenceKey` / `stepKey` が同じ演�Eを�E生しなぁE��ぁE��した、E
- 読み上げは開始とセーフ／アウトだけにし、毎回の枚数更新は読み上げなぁE��低モーション設定では
  カード飛来、回転、席の揺れを止め、文字と枚数更新だけを残す、E
- 既存�E最弱王ババ抜ぁE60戦シミュレーションは実行環墁E��よって5秒をわずかに趁E��たため、E
  チE��ト�E容を変えず当該チE��トだけタイムアウトを15秒へ安定化した、E

検証:

- `npx tsc --noEmit`、製品build、E7ファイル261チE��トが成功。lintはエラー0で既存警告�Eみ、E
- 実ブラウザの320x844、E90x844、E280x800で、E��ぁE��前、E桁枚数、不�E然な改行、横はみ出し、E
  チE�Eブルとの重なりがなぁE��とを確認した、E
- 実Supabaseのハ�Eド版6人ルームめEタブで操作し、人間�E8枚ルーレチE��とCPUの2枚ルーレチE��ぁE
  両画面で同一の演�EID・頁E��で吁E回だけ表示され、versionも一致することを確認した、E
- console error/warningは両画面0件。確認用ルーム4件は削除し、REST応答で残数0を確認した、E

## 2026-08-24 追訁E UNOドローカチE��インの表示時間を修正�E�未公開！E

作業ブランチE `codex/fix-uno-cinematic-duration`、E

- 全面カチE��インのタイマ�Eは1600msだったが、文字が不透�Eな区間�E30%、E2%で、実際に読める時間ぁE
  紁E32msしかなかった。さらに `prefers-reduced-motion: reduce` ではReact側めESS側めE00msで
  消してぁE��ため、端末設定によってはほぼ視認できなかった、E
- 全面カチE��インめE400msへ変更し、文字�E完�E表示区間を18%、E0%�E�紁E728ms�E�へ拡大した、E
  導�E・退出を含めても画像と斁E��を落ち着ぁE��確認できる、E
- Reactの消去タイマ�EとCSSアニメーションめE`getUnoCinematicDuration` 由来のCSS変数で接続し、E
  時間設定が牁E��だけずれなぁE��ぁE��した、E
- 低モーション設定では移動�E飛来を止める一方、表示時間は2400msのまま維持する、E
- 実ブラウザで強制ドローカチE��インを発生させ、DOM表示2394ms、CSS `2.4s` を確認した、E
  続けて実際のドロー返しも発生させ、DOM表示2263ms、文字�E不透�E度95%以上�E可読時間1640ms、E
  console error/warning 0件を確認した、E
- `npx tsc --noEmit`、製品build、E7ファイル258チE��トが成功。lintはエラー0で既存警告�Eみ、E

## 2026-08-24 追訁E 4ゲームのオンライン参加導線を短縮

実裁E�E容:

- UNO、�Eンカラ、バチE��ギャモン、最弱王ババ抜き�E対戦方法を、�E回表示では
  `遠く�E人とオンライン` に統一した。オンライン冁E�E初期タブも `コードで参加` に統一した、E
- UNO、�Eンカラ、最弱王ババ抜き�E、�E通設定画面で正しい6桁コードを入力して進むと、E
  従来のルーム画面にあっぁE回目の `参加する` 操作を自動実行する、E
- 自動参加中は通信が長ぁE��合だけ征E��表示を�Eす。満員、無効コード、E��信失敗などの場合�E、E
  入力済みコードとエラーを保持した従来の参加画面へ戻るため、手動で再試行できる、E
- バックギャモンは以前から設定画面から直接参加する構�Eだったため、�E期選択だけを共通化した、E
- `gameSetupDefaults.ts` に共通�E期値と自動参加条件を集紁E��、契紁E��ストを追加した、E

検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npm test -- --run`: 17ファイル / 257チE��ト�E劁E
- `npm run lint`: エラー0。既存�EBackgammon/Mancala警告�Eみ
- 実ブラウザ390x844で4ゲームすべてがオンライン�E�コード参加を�E期表示することを確認した、E
- 実SupabaseのUNOルーム `4924EB` を使ぁE���E通設定画面へコードを入力すると2回目の参加ボタンめE
  表示せずホスト�Eゲスト両方が対戦画面へ進むこと、console error/warningぁE件であることを確認した、E
  確認用ルームは削除し、REST応答で残数0を確認した、E

## 2026-08-24 追訁E UNOドロー演�Eを追加

作業ブランチE `codex/uno-standard-draw-stacking`。通常版�Eドロー重�EコミッチE`8ee2cc3` の上に
演�EコミッチE`2bed30b` を追加し、ブランチをpush済み。上記�Eオンライン導線改喁E��同じPRで公開する、E

実裁E�E容:

- ユーザー選択�EB案（赤ぁE��ラゴンがカードを跳ね返す漫画カチE���E�を基準に、縦3:4の
  `draw-counter.webp` / `forced-draw.webp` / `knockout.webp` めE60x1280で追加した、E
- ドローカードを実際に重�Eた時だけ「ドロー返し」、返さず累積枚数を引いた時は
  「ドロー受け取り」、引いた結果25枚へ達した時は受け取りを省略して共通�E「アウト」を表示する、E
- `ワイルチEリバ�Eス ドロー4` は「�Eきを変えて返した！」、E��常の返しはカード名と累積枚数めE
  日本語で画像上へ重�Eる、E.6秒�E間�E人間操作とCPU思老E��止め、状態更新とオンライン同期は先に行う、E
- カラー ルーレチE��は `drawnCount` を保留状態へ保存し、E枚ごとの色の輪・カード飛来・現在枚数と、E
  持E��色が�Eた時のセーフ表示を追加した。ルーレチE��で25枚へ達した時も�E通アウト演�Eを使ぁE��E
- Realtimeと5秒pollで同じ状態を再受信しても、`gameId`・ターン・場札・冁E��から作るイベントキーで
  同じ演�Eを二重再生しなぁE��オフライン、CPU入り、オンラインで共通フチE��を使ぁE��E
- `prefers-reduced-motion` では飛来・ズームを止め、E00msの短ぁE��ェードにする、E
- 演�E専用チE��チE件を追加し、ルーレチE��の保存枚数を既存ルールチE��トにも追加した、E

検証:

- `npm test -- --run`: 17ファイル / 256チE��ト�E劁E
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npm run lint`: エラー0。既存�EBackgammon/Mancala警告�Eみ
- 実ブラウザ390x844で3画像とルーレチE��表示、E280x800でドロー返しを確認。最長チE��ト名と
  2桁�E累積枚数も枠冁E��収まり、console error/warningは0件、E
- 実際のハ�Eド版4人戦で、�EレイヤーのワイルチEドロー4からCPUが連続で返し、累穁E4枚を
  プレイヤーが受け取って25枚アウトになるまで操作。返し演�Eとアウト演�Eが正しい頁E��で1回ずつ表示された、E
- 実Supabaseの通常牁E人ルームめEタブで開始し、ゲストがドロー2、�Eストが累穁E枚を受け取る流れを操作、E
  両タブに同じ受け取り演�EぁE回表示され、versionも一致、console error/warningは0件だった、E
  確認用ルーム `2C3SQ4` は削除し、REST応答で残数0を確認した、E

## 2026-08-23 追訁E UNOのドロー重�Eを通常版へ追加

作業ブランチE `codex/uno-standard-draw-stacking`。コミッチE`8ee2cc3` をpush済み、E

実裁E�E容:

- 通常版でめE`ドロー2` と `ワイルチEドロー4` を重ねられるよぁE��した。直前�Eドローカードと
  同じ枚数か、それ以上�E枚数だけを出せる�E�E2には+2/+4、E4には+4�E�、E
- ハ�Eド版の `ワイルチEリバ�Eス ドロー4` をドロー4として重�EられるよぁE��した、E
  色を選んだ後に進行方向を反転し、反転後�E次プレイヤーへ累積ドローを渡す、E
- 通常版�Eオンライン状態を読み直した際に、正しい累積ドローぁEへ消されなぁE��ぁE��態補正を更新、E
- CPUも�E通�E出せるカード判定を使ぁE��め、E��ねられるカードがあれば出し、なければ累積枚数を受け取る、E
- 通常版ルールパネルとカード効果説明へ、ドロー重�Eの説明を追加、E

検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npx vitest run`: 16ファイル / 248チE��ト�E劁E
- `npm run lint`: エラー0。既存�EBackgammon/Mancala警告�Eみ
- ローカル実ブラウザで通常版ルールの重�E出し説明を確認。console error/warningは0件、E

## 2026-08-22 追訁E UNOのドロー効果と脱落後�E手番を修正�E�ER #16�E�E

実裁ER: [#16](https://github.com/kyouryu888-web/dragon-game-park/pull/16)、E
作業ブランチE `codex/fix-uno-action-effects`、E

修正冁E��:

- 通常版で最後�E1枚として `ドロー2` また�E `ワイルチEドロー4` を�Eすと、勝利判定が先に走り、E
  次のプレイヤーがカードを引かなぁE���E合を修正。�EナルチE��ーを解決してから得点と勝敗を確定する、E
- ハ�Eド版でドローにより25枚へ達した際、脱落処琁E��呼び出し�Eの双方が手番を進めて次の生存老E��
  飛�Eす不�E合、およ�E他人に存在しなぁE��引いたカードを出す」操作征E��を付ける不�E合を修正、E
- カラールーレチE��中に引けるカードがなくなった場合�E停止、存在しなぁE��脱落済みプレイヤーとの
  7交換、E��常版への状態整形時�E山札・場札ID重褁E��無効な保留操作を修正、E
- `unoSimulation.test.ts` を追加。通常牁E人ÁE、ハード版4人ÁE、E��常牁E0人、ハード版6人めE
  CPUだけで決着まで進め、毎手で総カード枚数、ID重褁E��モード外カード、脱落老E�E手番、E
  引いたカード操作征E��の整合性を検査する、E

検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npx vitest run`: 16ファイル / 242チE��ト�E劁E
- `npm run lint`: エラー0。既存�EBackgammon/Mancala警告�Eみ
- 実ブラウザ390x844と1280x800で通常版を開始し、山札クリチE��で山札93ↁE2枚、手札7ↁE枚を確認、E
  横スクロール、Vite error overlay、console errorはぁE��れも0、E
- Supabaseの実ルーム作�Eまで疎通確認。�E動検証で作�Eしたルームはすべて削除済み、E

## 2026-08-15 追訁E ババ抜き改喁E��4ゲーム共通UIを本番反映

実裁ER: [#14](https://github.com/kyouryu888-web/dragon-game-park/pull/14)、E
マ�EジコミッチE `5ed9b32e85240c626052b195216037e96be65dfd`、E
PR先端とマ�Eジコミット�E両方で GitHub Actions `build-and-test` と Vercel が�E功し、E
`https://dragon-game-park.vercel.app/` へ本番反映済み、E

実裁E�E容:

- `GameSetupFlow.tsx` を追加し、�Eンカラ・UNO・バックギャモン・最弱王ババ抜き�E設定画面めE
  共通�E3段階！E. 名を刻む / II. 対戦方法を選ぶ / III. 対戦相手�Eルームを決める�E�へ統一した、E
- 名前欁E�E `挑戦老E�E名（なくてもよぁE��`、オンラインはユーザー持E��どおり
  `遠方の老E��対戦 ONLIE`、`ルームを作�E` / `コードで参加`、参加欁E�E `コードを入力` に統一した、E
- 1台で交互に操作できるマンカラとバックギャモンだけに `同じ盤で対戦` を表示、E
  UNOとババ抜きはカード秘匿が忁E��なため、CPU対戦とオンライン対戦だけを表示する、E
- トップからUNOを選んだ直後�E戻る操作が旧UNO設定画面へ入る�E線を修正し、直接ホ�Eムへ戻すよぁE��した、E
- ホ�Eムへ戻る�Eタン名を `ゲーム選択に戻る`、設定へ戻る�Eタン名を `ゲーム設定に戻る` に統一した、E
- `GameEndActions.tsx` を追加し、Eゲームのローカル・オンライン終亁E��面へ
  `再戦する` / `設定を変更して再戦する` / `ゲーム設定に戻る` / `ゲーム選択に戻る` を接続した、E
- PCでは設定画面を最大1180pxの2カラム、スマ�Eでは1カラムに刁E��替える。�Eレイ画面もPC用に拡張し、E
  マンカラは2人盤900px・3/4人盤620px、バチE��ギャモン920px、ババ抜き盤720px、UNOは
  1120pxのアプリ幁E��使ぁE��スマ�Eでは既存�EタチE��向け寸法を維持する、E

検証:

- `npx tsc --noEmit`: 成功
- `npm test -- --run`: 15ファイル / 219チE��ト�E劁E
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npm run lint`: エラー0。既存�EBackgammon/Mancala警告�Eみ
- `git diff --check`: 成功�E�EindowsのLF→CRLF予告のみ�E�E
- 実ブラウザで幁E440x900と390x844を�Eり替え、Eゲームの設定画面とローカルプレイ画面を確認、E
  設定画面はPCで1180pxの2カラム、スマ�Eで351pxの1カラム。�E画面で横スクロールなし、E
- UNOのホ�Eム→設定�E`ゲーム選択に戻る`が�Eームへ戻ることを実操作で確認、E
  ブラウザconsole error/warningは0件、E

補足:

- 見た目の基準としてダークファンタジー�E���/熾火のPC/スマ�E設定画面案を生�Eし、E段階構�E、E
  配色、パネル形状を反映した。案にあった設定画面冁E�Eゲーム刁E��サイドバーは、�Eームのゲーム選択と
  二重になるため採用してぁE��ぁE��E
- 本番でバックギャモン設定画面のPC 2カラム表示、オンライン作�E/参加タブ、`コードを入力`、E
  UNOのスマ�E1カラム表示、カードゲームに `同じ盤で対戦` が�EなぁE��と、UNOから
  `ゲーム選択に戻る` で直接TOPへ戻ることを確認。横スクロールとconsole error/warningは0件、E

## 2026-08-15 追訁E 最弱王ババ抜き�EシャチE��ル演�Eを強化（未公開！E

作業ブランチE `codex/babanuki-followup-fixes`。前回修正コミット�E上に追加実裁E��。まだpush・PR・本番公開�EしてぁE��ぁE��E

追加冁E��:

- シャチE��ルタイムをゲームの見せ場として、宣言・サイコロ判定�E手札移動�E2段階演�Eへ刷新した、E
  固定パネルに出目、回転方向、実際の移動�E、ブラフ解除�E�維持を表示し、移動中も消さなぁE��E
- 手札移動�E従来の小さな3枚束から、�Eる大きな4枚束へ変更。盤面中央に回転エフェクトを出し、E
  出目3は中央へ雁E��後に再�E币E���E目4はカードを消さずドクロだけを表示する、E
- 表示時間を、サイコロ判宁E`1100ms ↁE1700ms`、E��常移勁E`900ms ↁE1250ms` に延長し、E
  到着後に結果を読める `500ms` の停止時間を追加。�E目3は2段移動＋停止で合訁E000ms、E
- ローカル対戦とオンライン対戦で同じ演�E状態を使ぁE��説明文は `describeDice` で一允E��し、E
  全出目の方向�E効果�Eブラフ扱ぁE��チE��トした、E
- PC幁E280ÁE20とスマ�E幁E90ÁE44の実ブラウザで、サイコロ判定と手札移動�E両段階を確認、E
  固定パネルは画面冁E��収まり、移動中も�E容が読めた。console error/warningは0件、E

検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npx vitest run`: 14ファイル / 217チE��ト�E劁E
- `npm run lint`: エラー0。今回変更したファイルの警告�E0、既存ファイルの警告�Eみ
- 実ブラウザのPC幁E280ÁE20とスマ�E幁E90ÁE44で、サイコロ判定と手札移動�E両段階を撮影確認、E
  出目・方向�E移動�E容・ブラフ解除が移動中も読め、カード束が中央を経由して動く。console error/warningは0件、E

## 2026-08-15 追訁E 最弱王ババ抜き�E操作不�E合と同設定�E戦を修正�E�未公開！E

作業ブランチE `codex/babanuki-followup-fixes`。ローカルコミット済み。まだpush・PR・本番公開�EしてぁE��ぁE��E

修正冁E��:

- シャチE��ルボタンは、�E送E`.btn:active` が絶対配置の `translate(-50%,-50%)` を上書きし、E
  押下中に当たり判定が持E�E下から動ぁE��ぁE��。専用クラスで中央配置を保つ押下変形へ変更し、E
  `z-index` と `aria-label` も追加した、E
- ブラフ中だけ「ブラフを解除」�Eタンを表示し、ダブルタチE�Eが難しい重なった手札でめE
  確実に解除できるようにした、E
- 仕様を更新し、シャチE��ルタイムで手札が動く�E目�E�E・2・3・5・6�E��E全員のブラフを解除、E
  何も動かなぁE�E目4だけ維持する。ルール状態と演�E用表示状態�E両方を同じ挙動にした、E
- `createBabanukiRematchState` を追加。人数・名前・人/CPU・CPU強さを保持し、権利・頁E���E手札めE
  初期化してイベント連番を単調増加させる。これにより前局の盤面が一瞬残らず�E戦へ移れる、E
- オンライン決着後、�Eストに「同じ設定で再戦」「設定を変える」を表示。同じルーム行�E
  `game_state` を更新するので、購読中の参加老E�Eそ�Eまま次局へ移る。ゲストには征E��案�Eを表示する、E
- 人間�EシャチE��ル宣言老E��が、名前未入力時にCPU名で表示されてぁE��既存�E表示ミスも修正した、E

検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npx vitest run`: 13ファイル / 208チE��ト�E劁E
- `npm run lint`: エラー0。既存ファイルの警告�Eみ
- 実ブラウザ�E�Ehttp://127.0.0.1:5175/`�E�でローカル3人対局を決着まで進め、E
  シャチE��ルボタンの実押下、ブラフ設定�E明示解除、同じ設定での再戦を確誁E
- 実Supabaseのオンライン3人�E��Eスト＋CPU2体）を決着まで進め、「同じ設定で再戦」後に
  終亁E��面が消え、同ぁE席で新しい手札・頁E���EシャチE��ル権へ即時リセチE��されることを確誁E
- 実Supabaseの2タチE人�E��Eスト＋ゲスト＋CPU�E�でも決着まで進め、�Eストには再戦ボタン、E
  ゲストには征E��案�Eが�Eることを確認。�Eストが再戦すると両タブが同じ新局へ自動移行しぁE
- 両タブを含めブラウザconsole error/warningは0件。確認用ルーム `JPF5FK` / `4BXVJJ` は
  どちらも削除し、REST応筁E`[]` を確誁E

## 2026-08-15 追訁E 最弱王ババ抜きを本番公閁E

- 実裁ER: [#12](https://github.com/kyouryu888-web/dragon-game-park/pull/12)
- 機�Eのマ�EジコミッチE `55c227996eaa688a4ec0bae8dd2b8a22e4e82f5b`
- PR先端とマ�Eジコミット�E両方で GitHub Actions `build-and-test` と Vercel が�E劁E
- 本番URL: `https://dragon-game-park.vercel.app/`
- 本番でトップ画面の「最弱王ババ抜き」表示、オンラインルーム作�E、E桁コード表示、E
  征E��画面、ルームを閉じて削除できることを確認。ブラウザconsole error/warningは0件
- 本番確認用ルームは削除し、Supabase REST応答が空配�E `[]` であることを確誁E

## 2026-08-15 追訁E 最弱王ババ抜き�Eオンライン疎通確認完亁E

ユーザーぁE`supabase/babanuki_rooms.sql` めESupabase SQL Editor で実行し、E
`Success. No rows returned` を確認した、E

初回の2タブ確認で、�Eストとゲストが同じオンラインIDになり、ゲストがホストとして
再�E室扱ぁE��なる不�E合を再現した。参加老EDを�Eタブ�E通�E `localStorage` に保存してぁE��のが原因、E
`babanukiOnline.ts` をタブ単位�E `sessionStorage`�E�Edgp-babanuki-online-player-id`�E�へ変更し、E
同じタブではIDを維持し、別タブでは別IDになる回帰チE��トを追加した、E
PR #12 の初回CIでは、このチE��トがSupabase環墁E��数の無いCI上で通信クライアントを生�Eして
失敗したため、テスト�EでSupabaseクライアントをモチE��し、外部環墁E��依存しなぁE��へ修正した、E

修正後�E実ブラウザ確認（�Eスト＋ゲスト＋CPUの3人ルーム�E�E

- 6桁コードで作�E・別タブ参加し、E人の人間席が埋まると自動開姁E
- ルーム作�E時に席ごとの人�E�CPU刁E��替えとCPU強さ選択を確誁E
- ホストとゲストが別プレイヤーとして、�E刁E�E手札と手番を正しく表示
- 2段階�E札引き�E�選択�E「この札を引く」）と、引く�E��Eア�E�シャチE��ルタイムの同期を確誁E
- 人閁E手、CPU4手を経て停止めE��重進行なしで決着、EPU処琁E�Eホスト�Eだけで進衁E
- 両画面で同じ最弱王�E頁E��を表示し、「ルーム設定へ」で作�E�E�参加画面へ戻れることを確誁E
- 両タブ�Eブラウザconsole error/warningは0件
- 確認用に作�EしたSupabaseルーム行�E終亁E��に削除済み

最終ローカル検証:

- `npx tsc --noEmit`: 成功
- `npm run build`: 成功�E�英語音声100件検証成功、既存�E500kB趁Ehunk警告�Eみ�E�E
- `npx vitest run`: 12ファイル / 204チE��ト�E劁E

## 2026-08-15 追訁E ババ抜きのチE��チE���E�進行停止バグめE件修正�E�E

**バグ1�E��E命皁E�E修正済み�E�E CPUの手番中に手札を触り続けると進行が永乁E��止まる、E*
CPUの、E秒老E��る」タイマ�Eを張めE`useEffect` の依存�E列に `logic`�E�状態オブジェクト�E体）を
入れてぁE��ため、並べ替えやブラフ�Eた�Eに新しい状態が作られてタイマ�EがリセチE��され、E
CPUが永遠に引かなくなってぁE��、E0msごとに自刁E�E手札をタチE�Eし続ける乱打テストで再現し、E
**局面が本当に変わったときだけ張り直ぁE`turnKey`�E�EcurrentPlayerId:phase:eventSeq`�E�E*へ変更して解消、E
最新状態�E `logicRef` から読む。`BabanukiPlayScreen.tsx` と `BabanukiOnlineGame.tsx` の両方、E

**バグ2�E�オンライン・予防皁E��正�E�E 書き込み中の操作が捨てられて手が消える、E*
`applyAction` ぁE`writingRef` で「書き込み中なら無視」してぁE��ため、並べ替え�E通信中に
CPUの手番が来るとそ�E手が消えて進行が止まりうる、E*書き込みをPromiseで直列につなぁE*方式に変更、E
updater は実行時点の最新状態に対して走る�Eで、E��E��征E��でも結果は正しい、E

**追加した回帰チE��チE*: `babanukiSimulation.test.ts`、E、E人ÁE0シード！E60局をCPUの判断で
最後まで自動対局させ、毎スチE��プで不変条件�E�札は常に53枚�E重褁E��し�Eジョーカーは捨て札に
出なぁE�E頁E���E連番・宣言できるのはジョーカー保持老E��け）を検査する、E
シャチE��ル権ぁE人1回までであること、ブラフが引かれるまで外れなぁE��とも別途検査、E

## 2026-08-14 追訁E 4つ目のゲーム「最弱王ババ抜き」を追加�E�オンラインは未検証�E�E

仕様�E **`docs/babanuki-spec.md` が唯一の正**。新ゲーム追加の手頁E�E `docs/NEW_GAME_CHECKLIST.md`、E

実裁E��たもの�E�Esrc/features/babanuki/`�E�E

- `babanukiRules.ts` / `babanukiCpu.ts` … 純ルールとCPU。テスチE8件�E�Enpm test` 全体で192件パス�E�E
- `useBabanukiPlayback.ts` … `BabanukiState.events` めEつずつ再生する共通フチE��、E
  ローカルもオンラインも同じ演�EになめE
- `BabanukiTable.tsx` … 座席・手札の描画と、カード�E飛行アニメ
  �E�スロチE��の矩形を控えて `position: fixed` めEdouble-RAF �E�ECSS transition で移動！E
- `BabanukiFinale.tsx` … 最弱王�E戴冠式（暗転→スポットライト�Eジョーカー→💀の王�E→称号→頁E��表�E�E
- `babanukiOnline.ts` ほぁE… ルームコード方式。`version` 付き update の楽観ロチE��で
  シャチE��ルタイムの同時宣言を裁定、EPUと締め�Eり判定�Eホスト�Eみ実衁E
- keyframes は `src/styles/global.css` の末尾に `babanuki-` 接頭辞で追加
- 配緁E箁E���E�Egames.ts` / `HomePage.tsx`の3マッチE/ `App.tsx` / featureフォルダ�E��E完亁E

検証済み: ローカル対戦めE人・6人で通しプレイ�E�E75px幁E�E横スクロールなし）、E
引く�E��Eア捨て�E�シャチE��ルタイム�E�宣言→サイコロ→手札移動）／勝ち抜け�E�戴冠式�E演�E、E
`npx tsc -b` と `npm run build` と `npx vitest run`、E

**未検証: オンライン対戦、E* `supabase/babanuki_rooms.sql` をユーザーがSupabaseで実行するまで
チE�Eブルが無ぁE��め、ルーム作�Eが「ルームを開けなかった」で失敗する（クラチE��ュはしなぁE��、E
SQL実行後に2タブで疎通確認すること、E

## 2026-08-14 追訁E UNOスタート�Eレイヤー決定パネルの進行不�E修正

- 人数めE��点再抽選が増えると抽選結果一覧が中央チE�Eブルの外へ伸び、「ゲーム開始」�Eタンが見えず押せなくなる不�E合を修正した、E
- 中央オーバ�Eレイをテーブル冁E�E上下余白つき領域へ変更し、抽選結果一覧だけを縦スクロール可能にした、E
- スタート�Eレイヤー表示と「ゲーム開始」�Eタンはスクロール領域の外へ置き、常に表示されるよぁE��した、E
- プレイヤー名�E引いたカード�E点数の行をコンパクトにし、スマ�Eでも�E容を判別できるようにした、E
- 390x844、E��常牁E0人�E�人閁E人+CPU9人�E�、同点再抽選を含む14結果行で確認した。結果欁E�E `clientHeight: 116 / scrollHeight: 1244` で冁E��スクロールし、「ゲーム開始」�E画面冁E��表示・有効だった、E
- 「ゲーム開始」を実際に押し、抽選パネルが消えて選出プレイヤーのターンが開始すること、ブラウザのconsole error/warningぁE件であることを確認した、E

## 2026-08-14 追訁E UNOルーム再�E室・スターター演�E・通常版カード混入対筁E

今回の作業:

- 通常牁ENOにハ�Eド専用カードが紛れた状態を検�E・除外すめE`sanitizeUnoStateForVariant` と、E��常版ではハ�Eド専用カードを出せなぁE��ードを追加した、E
- ゲーム開始前のスタート�Eレイヤー決定を2段階化した。まず�E員ぁE枚引いた結果をカード画像と点数で表示し、その後「ゲーム開始」�Eタンを押してから `playing` に入る、E
- 手札表示を赤→黁E�E緑�E青�Eワイルド�E頁E��ソートし、多枚数時�E重なりを流E��して数孁E記号ラベルを読みめE��くした、E
- UNOオンライン征E��画面に「コードをコピ�E」�Eタンを追加し、参加コード�E力欁E�E placeholder を「ここにコードを入力」に変更した、E
- オンライン再戦でCPU枠を人間に変えたり人間を追加した場合、ルームコード征E��画面を表示し、相手が参加するまで征E��流れに変更した、E
- ルームが満員扱ぁE��も、同じ名前�E允E��加老E��再�E室する場合�E既存�E人間スロチE��へ復帰できるようにした、E

検証済み:

- `npx tsc --noEmit`: 成功
- `npx vitest run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 33 tests passed
- `npx vitest run`: 8 files / 154 tests passed
- `npm run build`: 成功。Viteの500kB趁Ehunk警告�Eみ
- `npm run lint`: 成功。既存�EMancala/Backgammon警告�Eみ
- `git diff --check`: 成功。Windows改行予告のみ

ブラウザ確認済み:

- ローカルの `http://127.0.0.1:5175/` めEChrome + Playwright で確認した、E
- 通常牁ENOのオンラインルームめEタブで作�E・参加し、両方がスタート�Eレイヤー決定画面へ進むことを確認した、E
- 吁E�Eレイヤーが引いたカードと点数が表示され、�Eストが「ゲーム開始」を押した後に両タブが対戦画面へ進むことを確認した、E
- 3人ルームの征E��画面にルームコードと「コードをコピ�E」が表示されることを確認した、E
- 満員の2人ルームに、別ブラウザ状態から同じ名前で再�E室でき、「満員です」で弾かれなぁE��とを確認した、E
- 上記確認中にブラウザのコンソールエラーは発生しなかった、E

残る注意点:

- 同名再�E室は表示名を照合するカジュアルルーム向けの復旧方法。同じ名前�E参加老E��褁E��ぁE��場合や、�E入室時に名前を変更した場合�E判別できなぁE��め、封E��は再�E室用ト�Eクンを導�Eするとより堁E��になる、E

## 2026-08-13 追訁E UNO改喁E��本番反映済み

- ブランチE`codex/uno-start-draw-polish` の変更めE`main` に `--no-ff` でマ�Eジコミットした、E
- マ�EジコミッチE `ccc728e404e9a0c704607e64580d2eb44548fc0c`
- `git push origin main` 済み。VercelのコミットスチE�Eタスは `success`、E
- 本番URL `https://dragon-game-park.vercel.app/` は HTTP 200 を確認済み、E
- マ�Eジ後�E `main` で以下を再実行済み:
  - `npx tsc --noEmit`: 成功
  - `npx vitest run`: 8 files / 150 tests passed
  - `npm run build`: 成功。Viteの500kB趁Ehunk警告�Eみ
  - `npm run lint`: 成功。既存�EMancala/Backgammon警告�Eみ

## 2026-08-13 追訁E UNO開始判定�E1枚ドロー・再戦設定UI

今回の作業:

- UNOの初期状態を `deciding-starter` に変更し、ゲーム開始前に「カードを引いて決める」パネルを表示するようにした、E
- `applyStarterDraw` を追加。各プレイヤーが山札から1枚引き、数字カード�E数字、記号/ワイルド�E0として最大値の人をスタート�Eレイヤーにする。同点は同点老E��けで再ドローする、E
- 通常ドローを、E枚だけ引く」仕様へ変更。手札に出せるカードがあっても引けるが、引いた後に出せるのは `drawn-card-play` で保持した引いたカードだけ。�EさなぁE��合�E「�Eさずに次へ」でターンが進む、E
- ハ�Eド版の通常ドロー説明から古ぁE���Eげんドロー」を削除。カラールーレチE��は従来どおり専用効果として褁E��ドローする、E
- 中央パネルとプレイヤー惁E��窓を不透�E寁E��にして、暗ぁE��景めE��ード�E上でも読めるようにした、E
- 手札が多い時�E重なり間隔を庁E��、dense表示ではカード上に小さな数孁E記号ラベルを�EすよぁE��した、E
- オンラインUNOの終亁E��面に、同じルームで通常/ハ�Eド、人数、人閁ECPU、CPU強さ、名前を設定して再戦できるホスト用フォームを追加した、E

検証済み:

- `npx tsc --noEmit`: 成功
- `npx vitest run`: 8 files / 150 tests passed
- `npm run build`: 成功。Viteの500kB趁Ehunk警告�Eみ
- `npm run lint`: 成功。既存�EMancala/Backgammon警告�Eみ
- in-app browser `http://127.0.0.1:5175/`
  - UNOオフライン開始時に「スタート�Eレイヤー決定」パネルが�Eることを確誁E
  - 「カードを引いて決める」後にゲームが始まり、山札ボタンが押せることを確誁E
  - 出せるカードがある状態でも山札を引けて、引いたカードだけが出せる保留になることを確誁E
  - 390x844相当で中央パネルが読め、横はみ出しがなぁE��とを確誁E

次に見るとよいこと:

1. Supabaseを使った実際のオンライン2タブで、終亁E���E再戦設定フォームから通常/ハ�Eド�E人数・CPU設定を変えて開始できるか確認する、E
2. 20枚以上�E手札で dense ラベルが十刁E��めるか、実�Eレイまた�EチE��ト用状態で追加確認する、E
3. 本番反映後、`https://dragon-game-park.vercel.app` でUNO画面の初回表示とオンラインルーム作�Eを軽く確認する、E

## 2026-08-12 追訁E UNOオンライン再戦選択�E先手公平化�E手札UI改喁E

今回の作業:

- `src/features/uno/createInitialUnoState.ts`
  - UNO開始時に忁E�� `player-1` から始まる状態をめE��た、E
  - 配币E��、各プレイヤーが数字カードを1枚めくった想定で、最大数字を出したプレイヤーめE`currentPlayerId` にする、E
  - 同点の場合�E同点老E��らランダム。判定に使った数字カード�EシャチE��ルして山札へ戻す、E
- `src/features/uno/unoRules.ts`
  - 出せるカードがなぁE��の山札ドローを、E��常版でも「�Eせるカードが出るまで引き、その場で出す」に変更、E
  - ハ�Eド版の既存挙動に通常版を合わせた形、E
- `src/features/uno/unoRules.test.ts`
  - 通常版で、�EせなぁE��ードを引いた後、�Eせるカードを引いたら即場に出るテストを追加、E
- `src/features/uno/UnoOnlineGamePage.tsx`
  - オンラインUNO終亁E��、ルーム主に「通常版で再戦」「ハード版で再戦」を表示、E
  - 同じ `uno_rooms` の `game_state` を�E期化してルームを作り直さず続行する、E
  - ハ�Eド版は6人までなので、E人以上�Eルームではハ�Eド版再戦ボタンを無効化、E
- `src/features/uno/UnoTableView.tsx`
  - 手札ぁE5枚以上�E時�E扁E��を抑え、横スクロール前提で重なりを流E��する `is-dense` 表示へ刁E��、E
  - 多枚数でもカード�E容と「�Eせる」表示が隠れにくい方向へ調整、E
- `src/styles/global.css`
  - UNO中央選択パネルを不透�E寁E��にし、暗幕�E枠線�E斁E��コントラストを強化、E
  - オンラインUNO再戦パネルと、E��常牁Eハ�Eド版の選択�Eタンを追加、E
  - 多枚数手札用の横スクロールと `is-dense` スタイルを追加、E

検証済み:

- `npx tsc --noEmit`: 成功
- `npx vitest run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts`: 2 files / 25 tests passed
- `npm test -- --run`: 8 files / 146 tests passed
- `npm run build`: 成功。既存�E500kB趁Ehunk警告�Eみ、E
- `npm run lint`: 終亁E��ーチE。既存�EMancala/Backgammon警告�Eみ、E
- `git diff --check`: 成功。Windows改行予告のみ、E

未確誁E

- こ�E実行環墁E��はバックグラウンド�EVite起動がポリシーで止まり、ブラウザ実画面確認まではできてぁE��ぁE��E
- 次に見るべき実画面:
  1. UNOで色選抁E7交揁EルーレチE��の中央パネルが暗ぁE��景でも読めるか、E
  2. 手札15枚以上、E4枚付近で横スクロールしながらカードが読めるか、E
  3. オンラインUNO終亁E��、�Eストに通常牁Eハ�Eド版再戦ボタンが�Eるか、E
  4. 再戦後、`player-1` 固定ではなく別プレイヤーが�E手になることがあるか、E
  5. 通常版でも、�EせなぁE��に山札から出せるカードまで引き、そのカードが即場に出るか、E

更新日: 2026-08-12
ブランチE `main`
実裁ER: [#8](https://github.com/kyouryu888-web/dragon-game-park/pull/8)�E�E026-08-05 マ�Eジ済み�E�E
非�E開化PR: [#9](https://github.com/kyouryu888-web/dragon-game-park/pull/9)�E�E026-08-12 マ�Eジ済み�E�E

## 公開状慁E

- ユーザーから「どれも音声を聞ぁE��選択するだけでワンパターン」と評価され、作り直すまで英語学習ゲームを非公開にした、E
- PR #9のマ�EジコミッチEbc77116`で、トチE�E一覧、App画面遷移、E��延ロード�E線を削除した。英語学習ゲームのソースは再設計用に保持してぁE��、E
- `npx tsc --noEmit`、`npm run build`、`npx vitest run`�E�Eファイル145件�E�、デスクトップと390px相当�E画面確認に合格した、E
- PR #9とマ�Eジコミットで`build-and-test`、Vercelが�E功してぁE��、E

## 現在の目皁E

「イングリチE��ュ ラーニング オチE��セイ」�E非�E開。�E公開前に、E��声選択�E反復ではなく、E��びそ�Eも�Eのルールと英語使用が一体化したゲームへ再設計する、E

## Gameplay v4までに実裁E��たこと

- 英字を読ませなぁE��と音の初回案�EめE問かめE問へ拡張。診断成績で物語を飛�Eさず、経験老E��は難しめの頁E��を混ぜる、E
- 12話すべてに固有�E物語、案�E役、目皁E��報酬、教材を設定、E00教材を重褁E��ぁE2話へ割り当てた、E
- 吁E��の前に絵本型�E`QuestBriefing`を表示し、「次に何をするか」を一つのボタンで案�Eする、E
- 精霁E種を第1、E話で頁E��獲得。獲得前の進化を禁止し、別日3回�E2モード以上�E成功で進化可能にした、E
- 4ゲームを話ごとの教材で動くように変更、E
  - 精霊捕獲: 探索→発見�E音と絵のお供え、E
  - ドラゴンアリーチE 移動�E回避に加え、E��動操作が苦手な子向け�EタチE�E作戦、E
  - ことば錬釁E 音・絵・斁E���Eマッチングと、後半の能動的な語頁E��ズル、E
  - 記�Eの脱出: 看板と音声を集め、E��へ結合して出口を推琁E��E
- 最終章を通常ゲームの再利用から、E部屋�E`FinalDungeon`へ変更�E�音の門、色の橋、語頁E�E炉、予定�E蔵�E�。失敗しても進行を失わなぁE��E
- 物語セチE��ョンを復翁E0%・新出35%・混吁E5%へ寁E��る`composeQuestSession`を追加、E
- 通常4ゲームの誤答�E即時反復せず、決定的な共通キューで3、E問後に一度だけ�E出題する。�E出題では正解対象を発光させ、ヒント正解として記録する。短ぁE��尾は橋渡し問題で間隔を確保し、�E誤答で無限連鎖しなぁE��E
- 保護老E��面にJSONファイルの書き�Eし�E復允E��加え、貼り付け復允E��追加、E
- 13章トラチE��と次の行動を地図に表示。デスクトップ�E黒帯をなくし、E90ÁE44の縦見�Eれを解消、E
- 最終ダンジョンの背景は生�E済みWebP、HUDと操作部はReact/CSSで実裁E��設計原画は`docs/design/english-quest-*-v3.png`、E
- Kokoro-82M `0.9.4` / `af_heart`で第1島100件の米国英語MP3を生成、E4kHz mono・64kbps・音量正規化済みで、モチE��はWebアプリへ含めなぁE���Eニフェストに話老E��モチE��、E��さ、E��量、SHA-256を保存する、E
- 会話8件は孤立した質問から、前置きと応答を含む2往復型へ変更。音声生�Eは既存ハチE��ュを検証して変更刁E��け作り直せる、E
- 保護老E��ニューに100件を頁E��に再生できる音声見本パネルを追加。各音声を「聞き取りOK�E�要�E確認」に刁E��し、確認数を端末冁E��存�EJSON引き継ぎできる。録音・送信・自動採点は行わなぁE��E
- 第5話到達後に「ドラゴン先生」を解禁。ドラゴンの絵が音と合うか子どもが判定し、E��違いなら正しい絵を教える。誤答�E3、E問後に光る支援付きで戻り、E��常ゲームと同じ`Attempt`・習�E状態へ記録する、E
- 連続日数を要求しなぁE��記�Eの星座」を追加。正誤に関係なく�E険へ戻った現地日を最大365日保存し、E日刁E��地図で星として祝う。旧v1保存�E既存試行から�E動移行する、E
- 6問セチE��ョンで選択肢の3つ飛�Eしが同じ候補を循環する停止不�E合を修正し、有限�E重褁E��し�E候補生成と回帰チE��トを追加、E

## 検証済み�E�E4ローカル�E�E

- `npx tsc --noEmit`: 成功、E
- `npm test -- --run`: 8ファイル、E45チE��ト�E功、E
- `npm run build`: 成功。英語RPG遁E��JS 85.21KB、CSS 77.15KB。既存�E期JS 588.54KBのサイズ警告�Eみ、E
- `npm run lint`: 終亁E��ーチE。英語機�Eの新規警呁E件、既存Mancala/Backgammon警呁E0件のみ、E
- `git diff --check`: 成功�E�Eindows改行予告のみ�E�、E
- ブラウザ通し確誁E 6問導�E→第1話捕獲→第2話アリーナ移勁EタチE�E→第3話錬金�EチE��/語頁E�E第4話脱出→最終ダンジョン4部屋�E完亁E��E
- 1440ÁE00: body 1440ÁE00、ダンジョン本体右端1426、操作部右端1311。左右の黒帯・下部見�Eれなし、E
- 390ÁE44: 地図と最終ダンジョンのbody 390ÁE44、横はみ出し�E縦スクロールなし。最下部操作�E734px、E��屋�E836pxまでで画面冁E��E
- ブラウザconsole error/warningは通し確認中0件。�Eイクを使わなくても進行可能、E
- 再�E題�E実画面確誁E 第1問を誤答�E別の5問へ進むↁE問目に同じ頁E��が「おさらぁE��として再登場→正解の絵だけが発光。Viteエラー表示なし、E
- `npm run verify:english-audio`: 100件すべてで教材ID、英斁E��ファイル、モチE��惁E��、E��さ、E��量、SHA-256一致、EP3合計紁E.31MB、E��ぁE.2、E.55秒。`npm run build`の先頭でも�E動実行する、E
- 音声見本パネル: 1280ÁE20と390ÁE44で表示・前後移動�E再生操作を確認、E90px幁E�Eカード右端349pxで横はみ出しなし、Viteエラー表示なし、E
- 音声確認記録: 旧v1保存から�E動移行し、OK�E�要�E確認が排他的に保存されることを�E動検査、E90ÁE44で0/100ↁE/100、状態表示、次頁E��への自動移動、�E読込用localStorage、横はみ出ぁE、console error 0件を確認、E
- ドラゴン先生: 390ÁE44で地図・ゲームともbody幁E90px、横はみ出ぁE。わざと誤答�E別の4問�E7問目に「おさらぁE��と光る正解が�E登場、E280ÁE20も左右の黒帯・下部見�Eれなし。両幁E��遷移と操作を確認し、console/page errorは0件、E
- 記�Eの星座: 連続しなぁE日が`3/7`になること、診断日は除外されること、早朝�EISO時刻ではなく端末の現地日で保存されることを�E動�Eブラウザ双方で確認、E
- 完�E監査: 100教材の空欁E�E選択肢重褁E�E前提ID・前提循環、�E13話の案�E役/精霊参照、E・3・7・14・30日の全復習間隔を自動検査する回帰チE��トを追加、E

## 実裁E��画との照吁E

- 第1島の4地域、E2メインクエスト、最絁E部屋、E精霊と進化、E00教材�E�E6/48/20/8/8�E�、E問導�E、�E通学習記録、版付き保存、JSON復允E��ローカル音声、E��音非保存�E実裁E�E自動検査済み、E
- アリーナと錬金�E当�E案�ECanvasではなく、キーボ�Eド�EタチE�E・読み上げ・ターン制を同じ要素で扱えるセマンチE��チE��DOM�E�純TypeScriptを採用した。ランタイム依存�E追加してぁE��ぁE��E
- 公開判断に忁E��な人間�E全音声確認、家族実機�Eレイ、ユーザーのプレビュー承認だけ�E自動検査で代替しなぁE��E

## 次にすること

1. 既孁Eモードを継ぎ足さず、子どもが英語を使ぁE��E��性のあるゲームループを白紙から設計する、E
2. 画面試作で「聞ぁE��選ぶ」以外�E操作�E判断・発見が中忁E��なってぁE��か確認する、E
3. 家族テストで面白さと定着を確認し、ユーザーの明示承認を得るまで再�E開しなぁE��E

## 未完�E・誤解させてはぁE��なぁE��

- 初版は第1島100頁E��。TOEIC 900点台に忁E��な数十E��E��、�E7 Partの形式演習、E20刁E�E持乁E��訓練は未実裁E��、現状だけではTOEIC 900点対策アプリとして未完�E、E
- Kokoro音声100件の生�E・正規化・自動検査は完亁E���E開前に人間が全100件を実際に聞き、発音・間�E音量を確認する忁E��がある。ファイル不在・再生失敗時だけ端末の`SpeechSynthesis`へフォールバックする、E
- 最終ダンジョン冁E�E固宁Eパズルはそ�E場で安�Eに再挑戦する設計で、E��常4ゲームの3、E問後キューとは別扱ぁE��E
- PR #8で一度公開したが、PR #9でサイトから非公開化済み、E
- 家族実機�Eレイと全100音声の人間による通し聴取�E未確認で、�E開後�E継続観察頁E��、E
- 有料API、ランタイムAI、Supabase同期、ログイン、庁E��、課金、E��音保存�E初版に入れなぁE��E

## 廁E��した方吁E

- どのモードも「音を聞ぁE��同じ選択肢を押す」�E通セチE��ョン、E
- 診断成績で物語や精霊を飛�Eす進行、E
- 固宁E、E教材を�E話で繰り返す実裁E��E
- 最終章で通常モードをもう一度行うだけ�E構�E、E
## 2026-08-12 追訁E オンライン同ルーム再戦とUNO選択パネル改喁E

今回の作業:

- UNO
  - `src/features/uno/UnoGamePage.tsx`
    - 色選択、E交換相手選択、カラー ルーレチE��、UNO自動宣言の中央パネルを専用CSSクラス化、E
    - 選択肢の説明文を追加し、色ボタン・相手選択�Eタンを大きくして視認性と押しやすさを改喁E��E
  - `src/features/uno/UnoOnlineGamePage.tsx`
    - ゲーム終亁E��、�Eストが「同じルームでもう一度遊�E」を押すと同じ `uno_rooms` 行�E `game_state` を新しい初期状態に差し替える、E
    - 参加老E��、CPU設定、CPU強さ、E��常牁Eハ�Eド版を維持して再戦する、E
    - ゲスト�Eには、ルーム主が�E戦開始すると自動で刁E��替わる説明を表示、E
- マンカラ
  - `src/features/mancala/MancalaOnlineGamePage.tsx`
    - ゲーム終亁E��、�Eストが同じルームで再戦できるボタンを追加、E
    - 再戦時に `gameId` が変わった更新は `turnCount` ぁEへ戻っても受け取るよぁE��Realtime/poll受信条件を修正、E
    - プレイヤー名、CPU設定、CPU強さ、人数を維持して再戦する、E
- バックギャモン
  - `src/features/backgammon/BackgammonOnlineGame.tsx`
    - オンライン終亁E��ーバ�Eレイの「もぁE��度戦ぁE��を有効化、E
    - ホスト�E同じ `backgammon_rooms` 行�E `game_state` を�E期化して再戦開始、E
    - ゲストが押した場合�E、ルーム主が開始する忁E��がある旨をトースト表示、E
- 共通CSS
  - `src/styles/global.css`
    - `.uno-pending-panel` 系のスタイルを追加、E
    - 中央パネルの背景、枠、影、説明文、色ボタン、相手選択�Eタンを高コントラスト化、E
    - モバイル幁E��も選択パネルが潰れにくいよう調整、E

検証:

- `npx tsc --noEmit`: 成功
- `npx vitest run src/features/uno/unoRules.test.ts src/features/uno/unoOnline.test.ts src/features/mancala/mancalaRules.test.ts src/features/backgammon/backgammonRules.test.ts`: 4 files / 90 tests passed
- `npm run build`: 成功。英語音声100件検証成功。Viteの500kB趁Ehunk警告�Eみ、E
- `npm test -- --run`: 8 files / 145 tests passed
- `npm run lint`: 終亁E��既存�EBackgammon/Mancala警告�Eみ、E
- `git diff --check`: 成功。Windows改行予告のみ、E
- in-app browserで `http://127.0.0.1:5175/` を開き、トチE�Eペ�EジとUNOオンラインルーム画面の表示、console error 0件を確認、E

未確認�E次に見ること:

- Supabaseを使った実際の2タブ対戦で、各ゲーム終亁E��にホストが再戦ボタンを押し、ゲスト画面が同じルームのまま新しい盤面へ刁E��替わるか確認する、E
- UNOの色選抁E7交換相手選択パネルはコードとビルドで確認済みだが、実�Eレイ中の発生状態で最終的な見た目をユーザーChrome上でも確認する、E

