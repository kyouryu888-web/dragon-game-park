ドラゴンゲームパーク というWebゲームアプリの開発を引き続き手伝ってください。
Step 7の指示はこのメッセージの後に送ります。まずこの引継ぎ書を読んで内容を把握してください。

【プロジェクト情報】
- 場所: C:\Users\ray-0\Dragon-game-park
- フレームワーク: React 19 + TypeScript + Vite 8.1.0
- Node.js: v24.18.0 / Windows 11 Home / PowerShell
- テスト: npm run test（Vitest 4.1.9、30個・全通過）
- 開発サーバー: npm run dev → localhost:5173

【ユーザーについて】
- プログラミング完全初心者
- ファイル編集はAIが全て行う（自分では編集しない）
- スクリーンショットで動作確認を報告する
- 「どの画面のスクリーンショットを送ればよいか」を毎回明示してほしい
- 日本語でやり取り

【完成済みStepの概要】
- Step 1: プロジェクトセットアップ、共通コンポーネント（Layout / Card / Button）
- Step 2: mancalaTypes.ts（型定義）
- Step 3: mancalaRules.ts + createInitialMancalaState.ts（テスト30個・全通過）
- Step 4: App.tsx（画面ルーティング）、HomePage.tsx
- Step 5: MancalaSetupPage.tsx（モード選択・localStorage保存・ルール説明）
- Step 6: MancalaGamePage.tsx + MancalaBoard.tsx + MancalaPit.tsx（対局画面・動作確認済み）

【ファイル構成】
C:\Users\ray-0\Dragon-game-park\src\
├── App.tsx                              ← 画面ルーティング（完成）
├── main.tsx
├── styles/
│   └── global.css
├── components/
│   ├── Layout.tsx
│   ├── Card.tsx
│   └── Button.tsx
├── data/
│   └── games.ts                         ← ゲーム一覧データ
├── pages/
│   └── HomePage.tsx                     ← ゲーム選択画面（完成）
└── features/
    └── mancala/
        ├── mancalaTypes.ts              ← 型定義（完成・変更不可）
        ├── mancalaRules.ts              ← ルール処理（完成・変更不可）
        ├── createInitialMancalaState.ts ← 初期状態生成（完成・変更不可）
        ├── mancalaCpu.ts                ← CPUロジック（現在スタブ）
        ├── MancalaSetupPage.tsx         ← 設定画面（完成）
        ├── MancalaGamePage.tsx          ← 対局画面（完成）
        ├── MancalaBoard.tsx             ← ボード表示（完成）
        └── MancalaPit.tsx               ← 穴表示（完成）

【重要な型定義 mancalaTypes.ts（変更不可）】
type PlayerId = 'player-1' | 'player-2';
type MancalaMode = 'cpu' | 'local-2p';
type GameStatus = 'playing' | 'finished';
type Player = { id: PlayerId; name: string; isCpu: boolean; };
type Pit = {
  id: string;
  ownerPlayerId: PlayerId;
  stones: number;
  isStore: boolean;
  oppositePitId?: string;
};
type GameState = {
  gameId: string;
  status: GameStatus;
  players: Player[];
  board: Pit[];
  currentPlayerId: PlayerId;
  winnerPlayerId: PlayerId | null;
  isDraw: boolean;
  turnCount: number;
  mode: MancalaMode;
};

【重要な関数 mancalaRules.ts（変更不可）】
canSelectPit(state, pitId): boolean          ← 穴を選べるか判定
getSelectablePits(state): Pit[]              ← 選べる穴の一覧
applyMove(state, pitId): GameState           ← 石を配り新しいGameStateを返す（イミュータブル）
checkGameEnd(state): GameState               ← ゲーム終了チェック（applyMove内で自動呼出）

【盤面配列構造】
インデックス 0〜5  : player-1 の穴（p1-pit-0〜5）
インデックス 6     : player-1 のストア（p1-store）
インデックス 7〜12 : player-2 の穴（p2-pit-0〜5）
インデックス 13    : player-2 のストア（p2-store）

向かいの対応（捕獲ルール用）:
  p1-pit-0 ↔ p2-pit-5
  p1-pit-1 ↔ p2-pit-4
  p1-pit-2 ↔ p2-pit-3
  p1-pit-3 ↔ p2-pit-2
  p1-pit-4 ↔ p2-pit-1
  p1-pit-5 ↔ p2-pit-0

【画面遷移 App.tsx】
type AppScreen = 'home' | 'mancala-setup' | 'mancala-game';

// 遷移の流れ
home → mancala-setup → mancala-game
mancala-game → mancala-setup（設定画面へ戻る）
mancala-game → home（ゲーム選択画面へ戻る）

MancalaGamePage のprops:
  mode: MancalaMode
  onBackToSetup: () => void
  onBackToHome: () => void

【CPU関連の現状】
createInitialMancalaState.ts:
  mode === 'cpu' → player2 = { id: 'player-2', name: 'CPU', isCpu: true }
  mode === 'local-2p' → player2 = { id: 'player-2', name: 'プレイヤー2', isCpu: false }

mancalaCpu.ts（現在スタブ・Step 7で本実装）:
  export function selectCpuMove(_state: GameState): string { return ''; }

MancalaGamePage.tsx の現在のCPU関連コード:
  const isCpuTurn = mode === 'cpu' && currentPlayer.isCpu;

  // Step 6では手番に関わらず手動操作できる状態
  const handlePitClick = useCallback((pitId: string) => {
    if (isFinished) return;
    setGameState((prev) => applyMove(prev, pitId));
  }, [isFinished]);

  // 手番バナー（CPU手番時は案内を表示）
  {isCpuTurn
    ? '🤖 こどもドラゴンCPUの手番です（Step 7でCPUが自動操作します）'
    : `🎮 ${getDisplayName(currentPlayer)}の手番です`}

【実装ルール（必ず守ること）】
- mancalaTypes.ts / mancalaRules.ts / createInitialMancalaState.ts は変更しない
- npm run test の30個のテストを壊さない
- Reactコンポーネントにゲームルールロジックを直接書かない
- gameState を直接変更しない（applyMove は新しいオブジェクトを返す）
- TypeScriptの型エラーを出さない

【デザイン方針】
- 木製ボードゲーム風・かわいいドラゴンゲームパーク感
- スマホ縦向き最優先・最大幅480px中央配置
- 色: クリーム / ベージュ / 茶色系

【起動コマンド（PowerShell）】
cd C:\Users\ray-0\Dragon-game-park
npm run dev      ← 開発サーバー
npm run test     ← テスト実行

【回答スタイルのお願い】
- ユーザーは完全初心者なので手順を非常に丁寧に説明してください
- 動作確認のたびに「どの画面のスクリーンショットを送ればよいか」を毎回明示してください
- PowerShellのコマンドは cd C:\Users\ray-0\Dragon-game-park から始めてください

以上が引継ぎ内容です。Step 7の指示を次のメッセージで送ります。
