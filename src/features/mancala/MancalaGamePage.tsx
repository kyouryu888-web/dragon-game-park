import { useState, useCallback, useEffect, useRef } from 'react';
import type { MancalaMode, GameState, Player } from './mancalaTypes';
import { createInitialMancalaState } from './createInitialMancalaState';
import { applyMove } from './mancalaRules';
import { chooseCpuMove } from './mancalaCpu';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MancalaBoard } from './MancalaBoard';

// ============================================================
// 定数
// ============================================================

/** 石 1 個あたりのアニメーション間隔 (ms) */
const STONE_ANIM_MS = 400;

// ============================================================
// ヘルパー
// ============================================================

const MODE_LABELS: Record<MancalaMode, string> = {
  cpu: '人間 vs CPU',
  'local-2p': '人間 vs 人間',
};

function getDisplayName(player: Player, mode: MancalaMode): string {
  if (player.isCpu) return 'こどもドラゴンCPU';
  if (mode === 'cpu' && player.id === 'player-1') return 'あなた';
  return player.id === 'player-1' ? 'プレイヤー1' : 'プレイヤー2';
}

/**
 * 石を 1 個ずつ配っていくスナップショット配列と、
 * 各ステップで「アクティブ（今動いている）」穴の ID 配列を返す。
 *
 * steps[0] / activeIds[0]: 元の穴が空になった瞬間（石を手に取る）
 * steps[N] / activeIds[N]: N 個目の石が配られた瞬間
 *
 * ゲームロジック（mancalaRules.ts）は一切変更しない。
 */
function computeStoneSteps(state: GameState, pitId: string): {
  steps: GameState[];
  activeIds: string[];
} {
  const sourcePit = state.board.find(p => p.id === pitId);
  if (!sourcePit || sourcePit.stones === 0) return { steps: [], activeIds: [] };

  const playerId = state.currentPlayerId;
  const n = state.board.length;
  const startIdx = state.board.findIndex(p => p.id === pitId);

  const stoneMap = new Map(state.board.map(p => [p.id, p.stones]));
  stoneMap.set(pitId, 0);

  const makeSnapshot = (): GameState => ({
    ...state,
    board: state.board.map(p => ({ ...p, stones: stoneMap.get(p.id)! })),
  });

  const steps: GameState[]   = [makeSnapshot()]; // step 0: 元の穴が空
  const activeIds: string[]  = [pitId];           // step 0: 元の穴がアクティブ

  let i = (startIdx + 1) % n;
  let remaining = sourcePit.stones;

  while (remaining > 0) {
    const pit = state.board[i];
    // 相手のストアはスキップ（ルールと同じ）
    if (pit.isStore && pit.ownerPlayerId !== playerId) {
      i = (i + 1) % n;
      continue;
    }
    stoneMap.set(pit.id, stoneMap.get(pit.id)! + 1);
    remaining--;
    steps.push(makeSnapshot());
    activeIds.push(pit.id);
    i = (i + 1) % n;
  }

  return { steps, activeIds };
}

// ============================================================
// メインコンポーネント
// ============================================================

type MancalaGamePageProps = {
  mode: MancalaMode;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function MancalaGamePage({ mode, onBackToSetup, onBackToHome }: MancalaGamePageProps) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialMancalaState(mode)
  );
  const [isCpuThinking, setIsCpuThinking] = useState(false);

  // ---- アニメーション状態 ----
  const [animSteps,     setAnimSteps]     = useState<GameState[]>([]);
  const [animActiveIds, setAnimActiveIds] = useState<string[]>([]);
  const [animIdx,       setAnimIdx]       = useState(0);
  const [pendingMove,   setPendingMove]   = useState<string | null>(null);

  const isAnimating = animSteps.length > 0;

  /**
   * 表示用ゲーム状態:
   *   アニメーション中 → animSteps の各コマ
   *   通常時          → 実際のゲーム状態
   */
  const boardDisplayState: GameState = isAnimating
    ? animSteps[Math.min(animIdx, animSteps.length - 1)]
    : gameState;

  /** CPU が setTimeout から最新の gameState を参照するための ref */
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const isFinished      = gameState.status === 'finished';
  const currentPlayerId = gameState.currentPlayerId;
  const status          = gameState.status;
  const turnCount       = gameState.turnCount;

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)!;
  const p1Player      = gameState.players.find((p) => p.id === 'player-1')!;
  const p2Player      = gameState.players.find((p) => p.id === 'player-2')!;

  // スコアはアニメーション中も表示用状態から取得（ストアに石が着地した瞬間を反映）
  const p1Score = boardDisplayState.board.find((p) => p.ownerPlayerId === 'player-1' && p.isStore)!.stones;
  const p2Score = boardDisplayState.board.find((p) => p.ownerPlayerId === 'player-2' && p.isStore)!.stones;

  // ============================================================
  // アニメーション進行（石が 1 個ずつ着地するタイマー）
  // ============================================================
  useEffect(() => {
    if (!isAnimating) return;

    if (animIdx >= animSteps.length) {
      // 全コマ表示完了 → 実際にゲーム状態に反映
      if (pendingMove) {
        setGameState(prev => applyMove(prev, pendingMove));
        setPendingMove(null);
      }
      setAnimSteps([]);
      setAnimActiveIds([]);
      setAnimIdx(0);
      return;
    }

    const id = setTimeout(() => setAnimIdx(prev => prev + 1), STONE_ANIM_MS);
    return () => clearTimeout(id);
  }, [animIdx, animSteps.length, isAnimating, pendingMove]);

  // ============================================================
  // CPU 自動手番
  // ============================================================
  useEffect(() => {
    if (mode !== 'cpu' || status !== 'playing' || currentPlayerId !== 'player-2') {
      setIsCpuThinking(false);
      return;
    }

    setIsCpuThinking(true);
    let cancelled = false;

    const id = setTimeout(() => {
      if (cancelled) return;
      const currentState = gameStateRef.current;
      const pitId = chooseCpuMove(currentState);
      if (!pitId) {
        setIsCpuThinking(false);
        return;
      }
      const { steps, activeIds } = computeStoneSteps(currentState, pitId);
      if (steps.length === 0) {
        setGameState(prev => applyMove(prev, pitId));
        setIsCpuThinking(false);
        return;
      }
      // アニメーション開始。isCpuThinking はアニメーション完了後も true のまま
      // → applyMove 完了で currentPlayerId が変わりこの effect が再実行されて false になる
      setPendingMove(pitId);
      setAnimSteps(steps);
      setAnimActiveIds(activeIds);
      setAnimIdx(0);
    }, 700);

    return () => { cancelled = true; clearTimeout(id); };
  }, [mode, status, currentPlayerId, turnCount]);

  // ============================================================
  // 人間プレイヤーの操作
  // ============================================================
  const handlePitClick = useCallback(
    (pitId: string) => {
      if (isFinished || isCpuThinking || isAnimating) return;
      const { steps, activeIds } = computeStoneSteps(gameState, pitId);
      if (steps.length === 0) return;
      setPendingMove(pitId);
      setAnimSteps(steps);
      setAnimActiveIds(activeIds);
      setAnimIdx(0);
    },
    [gameState, isFinished, isCpuThinking, isAnimating]
  );

  function handleRestart() {
    setIsCpuThinking(false);
    setAnimSteps([]);
    setAnimActiveIds([]);
    setAnimIdx(0);
    setPendingMove(null);
    setGameState(createInitialMancalaState(mode));
  }

  function getResultMessage() {
    if (gameState.isDraw) return '引き分けです！';
    const winner = gameState.players.find((p) => p.id === gameState.winnerPlayerId);
    return winner ? `${getDisplayName(winner, mode)}の勝ち！ 🎉` : '';
  }

  const isP1Turn = !isFinished && currentPlayerId === 'player-1';
  const isP2Turn = !isFinished && currentPlayerId === 'player-2';

  // ---- 手番バナーのラベルを決定 ----
  const isCpuTurn = mode === 'cpu' && currentPlayerId === 'player-2';

  const turnBannerVariant: 'human' | 'cpu' = isCpuTurn ? 'cpu' : 'human';

  const turnBannerLabel: string = isAnimating
    ? (isCpuTurn
        ? '🐉 石を配っています...'
        : mode === 'cpu'
        ? '✨ あなたが石を配っています...'
        : `✨ ${getDisplayName(currentPlayer, mode)}が石を配っています...`)
    : isCpuTurn
    ? '🐉 こどもドラゴンCPUが考え中...'
    : mode === 'cpu'
    ? '🎮 あなたの番です'
    : `🎮 ${getDisplayName(currentPlayer, mode)}の番です`;

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb)' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 2 }}>
            🎯 マンカラ
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
            {MODE_LABELS[mode]}
          </div>
        </div>

        {/* 手番バナー */}
        {!isFinished && (
          <TurnBanner
            variant={turnBannerVariant}
            label={turnBannerLabel}
            thinking={isAnimating || isCpuTurn}
          />
        )}

        {/* P2 プレイヤー名（ボードの上） */}
        <PlayerLabel
          name={getDisplayName(p2Player, mode)}
          score={p2Score}
          isCurrentTurn={isP2Turn}
          side="top"
          isCpu={p2Player.isCpu}
        />

        <div className="board-outer">
          <MancalaBoard
            gameState={boardDisplayState}
            onPitClick={handlePitClick}
            disabled={isCpuThinking || isAnimating}
            animActiveIds={animActiveIds}
            animIdx={animIdx}
            animStepMs={STONE_ANIM_MS}
          />
        </div>

        {/* P1 プレイヤー名（ボードの下） */}
        <PlayerLabel
          name={getDisplayName(p1Player, mode)}
          score={p1Score}
          isCurrentTurn={isP1Turn}
          side="bottom"
          isCpu={false}
        />

        {/* ゲーム終了パネル */}
        {isFinished && (
          <div
            className="result-appear"
            style={{
              marginTop: 20,
              padding: '24px 20px',
              background: 'linear-gradient(135deg, #fffbe8, #fdf5d0)',
              border: '2px solid #e0c060',
              borderRadius: 22,
              textAlign: 'center',
              boxShadow: '0 6px 28px rgba(180, 140, 30, 0.20)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 6 }}>🏆</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
              ゲーム終了！
            </div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
              {getResultMessage()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>
              {getDisplayName(p1Player, mode)}：{p1Score}石　／　{getDisplayName(p2Player, mode)}：{p2Score}石
            </div>
            <div className="game-nav-buttons" style={{ marginTop: 0 }}>
              <Button fullWidth onClick={handleRestart}>
                もう一度遊ぶ 🎮
              </Button>
              <div className="game-nav-secondary">
                <Button variant="secondary" fullWidth onClick={onBackToSetup}>
                  マンカラ設定画面へ戻る
                </Button>
                <Button variant="secondary" fullWidth onClick={onBackToHome}>
                  ゲーム選択画面へ戻る
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション（ゲーム中） */}
        {!isFinished && (
          <div className="game-nav-buttons">
            <Button variant="ghost" fullWidth onClick={handleRestart}>
              ↺ リスタート
            </Button>
            <div className="game-nav-secondary">
              <Button variant="secondary" fullWidth onClick={onBackToSetup}>
                マンカラ設定画面へ戻る
              </Button>
              <Button variant="secondary" fullWidth onClick={onBackToHome}>
                ゲーム選択画面へ戻る
              </Button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

// ============================================================
// 手番バナー
// ============================================================

function TurnBanner({
  variant,
  label,
  thinking = false,
}: {
  variant: 'human' | 'cpu';
  label: string;
  thinking?: boolean;
}) {
  const isCpu = variant === 'cpu';

  return (
    <div
      className="turn-slide"
      style={{
        textAlign: 'center',
        background: isCpu
          ? 'linear-gradient(135deg, #e8f4e8, #d0ecd0)'
          : 'linear-gradient(135deg, #fff8e8, #fdf0d0)',
        border: `1.5px solid ${isCpu ? '#90c890' : '#e8d070'}`,
        borderRadius: 14,
        padding: '10px 16px',
        marginBottom: 12,
        boxShadow: isCpu
          ? '0 2px 10px rgba(80,160,80,0.12)'
          : '0 2px 10px rgba(200,160,30,0.12)',
      }}
    >
      <div
        className={thinking ? 'cpu-thinking-pulse' : undefined}
        style={{
          fontSize: 13,
          fontWeight: 'bold',
          color: isCpu ? '#2a6a2a' : '#7a5010',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================
// プレイヤーラベル
// ============================================================

function PlayerLabel({
  name, score, isCurrentTurn, side, isCpu,
}: {
  name: string;
  score: number;
  isCurrentTurn: boolean;
  side: 'top' | 'bottom';
  isCpu: boolean;
}) {
  const align = side === 'top' ? 'flex-end' : 'flex-start';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: align,
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        marginTop:    side === 'bottom' ? 5 : 0,
        marginBottom: side === 'top'    ? 5 : 0,
        borderRadius: 10,
        background: isCurrentTurn
          ? 'rgba(255, 200, 50, 0.18)'
          : 'transparent',
        transition: 'background 0.2s ease',
      }}
    >
      {isCurrentTurn && side === 'bottom' && (
        <span style={{ fontSize: 11, color: '#d08010' }}>▶</span>
      )}
      {isCpu && (
        <span style={{ fontSize: 15 }}>🐉</span>
      )}
      <span
        style={{
          fontSize: 12,
          fontWeight: isCurrentTurn ? 'bold' : 'normal',
          color: isCurrentTurn ? 'var(--brown)' : 'var(--text-muted)',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: 'var(--brown)',
          background: isCurrentTurn ? '#f5e098' : '#f0e8d4',
          padding: '2px 10px',
          borderRadius: 20,
          border: isCurrentTurn ? '1.5px solid #d4b030' : '1px solid #d8cbb0',
          transition: 'background 0.2s ease',
        }}
      >
        {score}石
      </span>
      {isCurrentTurn && side === 'top' && (
        <span style={{ fontSize: 11, color: '#d08010' }}>◀</span>
      )}
    </div>
  );
}
