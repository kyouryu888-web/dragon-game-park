import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MancalaConfig, GameState, Player, PlayerId } from './mancalaTypes';
import { createInitialMancalaState } from './createInitialMancalaState';
import { applyMove, getEffectiveOppositePitId } from './mancalaRules';
import { chooseCpuMove } from './mancalaCpu';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MancalaBoard, PLANK_POSITIONS } from './MancalaBoard';
import type { PlankSlideEntry } from './MancalaBoard';
import { PLAYER_ACCENT_COLORS } from './MancalaPit';

// ============================================================
// 定数
// ============================================================

const STONE_ANIM_MS   = 400;
const CAPTURE_ANIM_MS = 700;
const ELIM_ANIM_MS    = 480; // 脱落プランクのフェードアウト時間
const SLIDE_ANIM_MS   = 580; // スライドアニメーション全体の待機時間（CSS transition より長く）

// ============================================================
// 捕獲アニメーション情報
// ============================================================

export type CaptureAnimInfo = {
  landingPitId: string;
  oppositePitId: string;
  storeId: string;
  stoneCount: number;
};

// ============================================================
// スコアバッジのプレイヤー色
// ============================================================

const PLAYER_SCORE_COLORS = [
  { bg: '#fff3e0', border: '#e0b060', text: '#8a4010' },
  { bg: '#e8f4e8', border: '#80b880', text: '#1a5a1a' },
  { bg: '#f0e8ff', border: '#a880e0', text: '#481090' },
  { bg: '#e0eeff', border: '#6090d0', text: '#0840a0' },
];

const RANK_MEDALS = ['🥇', '🥈', '🥉', '  '];

// ============================================================
// ヘルパー: computeStoneSteps
// ============================================================

function computeStoneSteps(state: GameState, pitId: string): {
  steps: GameState[];
  activeIds: string[];
  captureInfo: CaptureAnimInfo | null;
  isExtraTurn: boolean;
} {
  const sourcePit = state.board.find(p => p.id === pitId);
  if (!sourcePit || sourcePit.stones === 0) return { steps: [], activeIds: [], captureInfo: null, isExtraTurn: false };

  const playerId = state.currentPlayerId;
  const n = state.board.length;
  const startIdx = state.board.findIndex(p => p.id === pitId);

  const stoneMap = new Map(state.board.map(p => [p.id, p.stones]));
  stoneMap.set(pitId, 0);

  const makeSnapshot = (): GameState => ({
    ...state,
    board: state.board.map(p => ({ ...p, stones: stoneMap.get(p.id)! })),
  });

  const steps: GameState[]  = [makeSnapshot()];
  const activeIds: string[] = [pitId];

  let i = (startIdx + 1) % n;
  let remaining = sourcePit.stones;

  while (remaining > 0) {
    const pit = state.board[i];
    if (!state.activePlayerIds.includes(pit.ownerPlayerId as PlayerId)) {
      i = (i + 1) % n;
      continue;
    }
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

  const lastPitId = activeIds[activeIds.length - 1];
  const myStoreId = state.board.find(p => p.ownerPlayerId === playerId && p.isStore)!.id;
  const isExtraTurn = lastPitId === myStoreId;

  let captureInfo: CaptureAnimInfo | null = null;

  if (state.activePlayerIds.length === 2) {
    const lastPit = state.board.find(p => p.id === lastPitId);

    if (lastPit && !lastPit.isStore && lastPit.ownerPlayerId === state.currentPlayerId) {
      const oppPitId = getEffectiveOppositePitId(state, lastPit);
      if (oppPitId) {
        const oppBefore = state.board.find(p => p.id === oppPitId)?.stones ?? 0;
        if (oppBefore > 0) {
          const afterState = applyMove(state, pitId);
          if (afterState.status === 'playing') {
            const oppAfter     = afterState.board.find(p => p.id === oppPitId)!;
            const landingAfter = afterState.board.find(p => p.id === lastPitId)!;
            if (oppAfter.stones === 0 && landingAfter.stones === 0) {
              captureInfo = {
                landingPitId: lastPitId,
                oppositePitId: oppPitId,
                storeId: myStoreId,
                stoneCount: 1 + oppBefore,
              };
            }
          }
        }
      }
    }
  }

  return { steps, activeIds, captureInfo, isExtraTurn };
}

// ============================================================
// 紙吹雪コンポーネント
// ============================================================

const CONFETTI_COLORS = [
  '#e63a2a','#2878cc','#d4a408','#25a855','#8e44c0','#d46018','#12a896','#c81060',
  '#f0a030','#3090e0','#60c040','#c040a0',
];

function Confetti() {
  const dots = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(Math.random() * 1.2).toFixed(2)}s`,
      duration: `${(1.8 + Math.random() * 0.8).toFixed(2)}s`,
      size: `${6 + Math.round(Math.random() * 5)}px`,
      borderRadius: i % 3 === 0 ? '50%' : '2px',
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 10 }}>
      {dots.map(d => (
        <div
          key={d.id}
          className="confetti-dot"
          style={{
            left: d.left,
            width: d.size,
            height: d.size,
            background: d.color,
            borderRadius: d.borderRadius,
            animationDelay: d.delay,
            animationDuration: d.duration,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

type MancalaGamePageProps = {
  config: MancalaConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function MancalaGamePage({ config, onBackToSetup, onBackToHome }: MancalaGamePageProps) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialMancalaState(config)
  );
  const [isCpuThinking, setIsCpuThinking] = useState(false);

  const [animSteps,     setAnimSteps]     = useState<GameState[]>([]);
  const [animActiveIds, setAnimActiveIds] = useState<string[]>([]);
  const [animIdx,       setAnimIdx]       = useState(0);
  const [pendingMove,   setPendingMove]   = useState<string | null>(null);

  const [captureAnimInfo, setCaptureAnimInfo] = useState<CaptureAnimInfo | null>(null);
  const [capturePhase, setCapturePhase]       = useState<'gather' | 'to-store' | null>(null);

  // ---- ボード遷移アニメーション用 ----
  const [boardFading, setBoardFading]       = useState<'none' | 'out' | 'sliding'>('none');
  const [displayActiveIds, setDisplayActiveIds] = useState<PlayerId[]>(
    () => createInitialMancalaState(config).activePlayerIds
  );
  const [eliminatingId, setEliminatingId]   = useState<string | null>(null);
  const [slidingPlanks, setSlidingPlanks]   = useState<PlankSlideEntry[] | null>(null);
  const [slideAtTarget, setSlideAtTarget]   = useState(false);
  const prevActiveCountRef  = useRef(-1);
  const prevActiveIdsRef    = useRef<PlayerId[]>([]);
  const isTransitioningRef  = useRef(false);

  // ---- ゲームプレイバナー ----
  const [extraTurnKey,   setExtraTurnKey]   = useState(0);
  const [showExtraTurn,  setShowExtraTurn]  = useState(false);
  const [captureBannerKey, setCaptureBannerKey] = useState(0);
  const [showCaptureBanner, setShowCaptureBanner] = useState(false);

  const isAnimating = animSteps.length > 0;

  const boardDisplayState: GameState = isAnimating
    ? animSteps[Math.min(animIdx, animSteps.length - 1)]
    : gameState;

  const boardDisplayStateWithIds: GameState = {
    ...boardDisplayState,
    activePlayerIds: displayActiveIds,
  };

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const isFinished      = gameState.status === 'finished';
  const currentPlayerId = gameState.currentPlayerId;
  const status          = gameState.status;
  const turnCount       = gameState.turnCount;

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)!;
  const isCpuTurn = !isFinished && currentPlayer.isCpu;

  // ============================================================
  // 通常アニメーション進行
  // ============================================================
  useEffect(() => {
    if (!isAnimating || capturePhase !== null) return;

    if (animIdx >= animSteps.length) {
      if (captureAnimInfo) {
        setCapturePhase('gather');
        // 捕獲バナー
        setCaptureBannerKey(k => k + 1);
        setShowCaptureBanner(true);
        setTimeout(() => setShowCaptureBanner(false), 2000);
        return;
      }
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
  }, [animIdx, animSteps.length, isAnimating, pendingMove, captureAnimInfo, capturePhase]);

  // ============================================================
  // 捕獲アニメーション
  // ============================================================
  useEffect(() => {
    if (!capturePhase) return;

    const id = setTimeout(() => {
      if (capturePhase === 'gather') {
        setCapturePhase('to-store');
      } else {
        if (pendingMove) {
          setGameState(prev => applyMove(prev, pendingMove));
          setPendingMove(null);
        }
        setCaptureAnimInfo(null);
        setCapturePhase(null);
        setAnimSteps([]);
        setAnimActiveIds([]);
        setAnimIdx(0);
      }
    }, CAPTURE_ANIM_MS);

    return () => clearTimeout(id);
  }, [capturePhase, pendingMove]);

  // ============================================================
  // スライドアニメーション: RAF で CSS transition を発火
  // ============================================================
  useEffect(() => {
    if (!slidingPlanks) {
      setSlideAtTarget(false);
      return;
    }
    // double-RAF: 最初のレンダー（source位置）後に target位置を設定して CSS transition を発火
    let r2: number | undefined;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setSlideAtTarget(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2 !== undefined) cancelAnimationFrame(r2);
    };
  }, [slidingPlanks]);

  // ============================================================
  // ボード遷移アニメーション（脱落検出）
  // フェーズ1 (ELIM_ANIM_MS): 脱落プランクだけフェードアウト（4P時）
  // フェーズ2 (SLIDE_ANIM_MS): 残りプランクがスライド移動して新形成
  // ============================================================
  useEffect(() => {
    const currIds = gameState.activePlayerIds;
    const currLen = currIds.length;
    const prevLen = prevActiveCountRef.current;
    const prevIds = prevActiveIdsRef.current;

    prevActiveCountRef.current = currLen;
    prevActiveIdsRef.current   = [...currIds] as PlayerId[];

    if (prevLen === -1 || currLen >= prevLen) {
      setDisplayActiveIds([...currIds]);
      return;
    }

    // 脱落したプレイヤーを特定
    const eliminatedId = prevIds.find(id => !(currIds as string[]).includes(id));
    const fromCount = prevLen;   // 4 or 3
    const toCount   = currLen;   // 3 or 2

    isTransitioningRef.current = true;
    setBoardFading('out');
    // 4P→3P: 脱落プランクのみフェードアウト（3P→2Pは Board3P が SVG のためスキップ）
    if (fromCount === 4) {
      setEliminatingId(eliminatedId ?? null);
    }

    let t2: ReturnType<typeof setTimeout> | undefined;

    const t1 = setTimeout(() => {
      // フェーズ2: スライドアニメーション開始
      setEliminatingId(null);
      setBoardFading('sliding');

      const fromPositions = PLANK_POSITIONS[String(fromCount)];
      const toPositions   = PLANK_POSITIONS[String(toCount)];
      const allPlayerIds  = gameState.players.map(p => p.id);

      const slides: PlankSlideEntry[] = (currIds as PlayerId[]).map((playerId, newSlot) => {
        const oldSlot = prevIds.indexOf(playerId);
        const src     = fromPositions[oldSlot] ?? fromPositions[0];
        const tgt     = toPositions[newSlot]   ?? toPositions[0];
        const player  = gameState.players.find(p => p.id === playerId)!;
        const pits    = gameState.board.filter(p => p.ownerPlayerId === playerId && !p.isStore);
        const store   = gameState.board.find(p => p.ownerPlayerId === playerId && p.isStore)!;
        return {
          playerId,
          pits,
          store,
          playerName:    player.name,
          colorAccent:   PLAYER_ACCENT_COLORS[allPlayerIds.indexOf(playerId)],
          isCurrentTurn: gameState.currentPlayerId === playerId,
          sourceLeft: src.left, sourceTop: src.top, sourceRot: src.rot,
          targetLeft: tgt.left, targetTop: tgt.top, targetRot: tgt.rot,
        };
      });

      setSlidingPlanks(slides);
      // slideAtTarget は上記 useEffect の double-RAF で true になる

      t2 = setTimeout(() => {
        // スライド完了 → 実際の新ボードに切り替え
        setSlidingPlanks(null);
        setDisplayActiveIds([...currIds]);
        setBoardFading('none');
        isTransitioningRef.current = false;
      }, SLIDE_ANIM_MS);
    }, ELIM_ANIM_MS);

    return () => {
      clearTimeout(t1);
      if (t2 !== undefined) clearTimeout(t2);
    };
  }, [gameState.activePlayerIds.length, gameState.gameId]);

  // ============================================================
  // CPU 自動手番
  // ============================================================
  useEffect(() => {
    if (isAnimating || capturePhase !== null) return;
    if (isTransitioningRef.current) return;

    const currentP = gameStateRef.current.players.find(
      p => p.id === gameStateRef.current.currentPlayerId
    );
    if (!currentP?.isCpu || status !== 'playing') {
      setIsCpuThinking(false);
      return;
    }

    setIsCpuThinking(true);
    let cancelled = false;

    const id = setTimeout(() => {
      if (cancelled) return;
      const currentState = gameStateRef.current;
      const cpuPlayer = currentState.players.find(p => p.id === currentState.currentPlayerId);
      if (!cpuPlayer?.isCpu) return;

      const pitId = chooseCpuMove(currentState, cpuPlayer.id, cpuPlayer.cpuLevel);
      if (!pitId) {
        setIsCpuThinking(false);
        return;
      }
      const { steps, activeIds, captureInfo: ci, isExtraTurn } = computeStoneSteps(currentState, pitId);
      if (steps.length === 0) {
        setGameState(prev => applyMove(prev, pitId));
        setIsCpuThinking(false);
        return;
      }
      if (isExtraTurn) {
        setExtraTurnKey(k => k + 1);
        setShowExtraTurn(true);
        setTimeout(() => setShowExtraTurn(false), 1700);
      }
      setCaptureAnimInfo(ci ?? null);
      setCapturePhase(null);
      setPendingMove(pitId);
      setAnimSteps(steps);
      setAnimActiveIds(activeIds);
      setAnimIdx(0);
      setIsCpuThinking(false);
    }, 700);

    return () => { cancelled = true; clearTimeout(id); };
  }, [status, currentPlayerId, turnCount, isAnimating, capturePhase, boardFading]);

  // ============================================================
  // 人間プレイヤーの操作
  // ============================================================
  const handlePitClick = useCallback(
    (pitId: string) => {
      if (isFinished || isCpuThinking || isAnimating || isTransitioningRef.current) return;
      if (gameState.players.find(p => p.id === gameState.currentPlayerId)?.isCpu) return;
      const { steps, activeIds, captureInfo: ci, isExtraTurn } = computeStoneSteps(gameState, pitId);
      if (steps.length === 0) return;
      if (isExtraTurn) {
        setExtraTurnKey(k => k + 1);
        setShowExtraTurn(true);
        setTimeout(() => setShowExtraTurn(false), 1700);
      }
      setCaptureAnimInfo(ci ?? null);
      setCapturePhase(null);
      setPendingMove(pitId);
      setAnimSteps(steps);
      setAnimActiveIds(activeIds);
      setAnimIdx(0);
    },
    [gameState, isFinished, isCpuThinking, isAnimating]
  );

  function handleRestart() {
    isTransitioningRef.current = false;
    prevActiveCountRef.current = -1;
    prevActiveIdsRef.current   = [];
    setBoardFading('none');
    setEliminatingId(null);
    setSlidingPlanks(null);
    setSlideAtTarget(false);
    setIsCpuThinking(false);
    setAnimSteps([]);
    setAnimActiveIds([]);
    setAnimIdx(0);
    setPendingMove(null);
    setCaptureAnimInfo(null);
    setCapturePhase(null);
    setShowExtraTurn(false);
    setShowCaptureBanner(false);
    const newState = createInitialMancalaState(config);
    setDisplayActiveIds([...newState.activePlayerIds]);
    setGameState(newState);
  }

  // 順位計算（石の数で降順）
  const rankings = useMemo(() => {
    if (!isFinished) return [];
    return [...gameState.players]
      .map(player => ({
        player,
        score: gameState.board.find(p => p.ownerPlayerId === player.id && p.isStore)!.stones,
        playerIdx: gameState.players.indexOf(player),
      }))
      .sort((a, b) => b.score - a.score);
  }, [isFinished, gameState]);

  const isMoving = isAnimating || capturePhase !== null;
  const isTransitioning = boardFading !== 'none';
  const turnBannerLabel: string = isMoving
    ? `✨ ${currentPlayer.name}が石を配っています...`
    : isCpuTurn
    ? `🐉 ${currentPlayer.name}が考え中...`
    : `🎮 ${currentPlayer.name}の番です`;

  const turnBannerVariant: 'human' | 'cpu' = isCpuTurn ? 'cpu' : 'human';

  const bottomPlayerId = displayActiveIds[0] ?? gameState.activePlayerIds[0];
  const topPlayerId    = displayActiveIds[1] ?? gameState.activePlayerIds[1];
  const bottomPlayer   = gameState.players.find(p => p.id === bottomPlayerId);
  const topPlayer      = gameState.players.find(p => p.id === topPlayerId);
  const bottomPlayerIdx = gameState.players.findIndex(p => p.id === bottomPlayerId);
  const topPlayerIdx    = gameState.players.findIndex(p => p.id === topPlayerId);

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb)' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 2 }}>
            🎯 マンカラ
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
            {config.playerCount}人プレイ
          </div>
        </div>

        {/* 手番バナー */}
        {!isFinished && (
          <TurnBanner
            variant={turnBannerVariant}
            label={turnBannerLabel}
            thinking={isMoving || isCpuTurn}
          />
        )}

        {/* 2人プレイ: P上 ラベル */}
        {config.playerCount === 2 && topPlayer && (
          <PlayerLabel
            player={topPlayer}
            score={boardDisplayState.board.find(p => p.ownerPlayerId === topPlayerId && p.isStore)!.stones}
            isCurrentTurn={!isFinished && currentPlayerId === topPlayerId}
            side="top"
            colorIdx={topPlayerIdx}
          />
        )}

        {/* ボード（脱落アニメーション付き） */}
        <div className="board-outer" style={{ position: 'relative' }}>
          <MancalaBoard
            gameState={boardDisplayStateWithIds}
            onPitClick={handlePitClick}
            disabled={isCpuThinking || isAnimating || isTransitioning}
            animActiveIds={animActiveIds}
            animIdx={animIdx}
            animStepMs={STONE_ANIM_MS}
            captureAnimInfo={captureAnimInfo}
            capturePhase={capturePhase}
            captureStepMs={CAPTURE_ANIM_MS}
            eliminatingId={eliminatingId}
            transitionSlides={slidingPlanks}
            slideAtTarget={slideAtTarget}
          />

          {/* 追加ターンバナー */}
          {showExtraTurn && (
            <div key={extraTurnKey} className="extra-turn-banner">
              ⭐ 追加ターン！
            </div>
          )}
          {/* 捕獲バナー */}
          {showCaptureBanner && (
            <div key={captureBannerKey} className="capture-banner">
              🔴 捕獲！
            </div>
          )}
        </div>

        {/* 2人プレイ: P下 ラベル */}
        {config.playerCount === 2 && bottomPlayer && (
          <PlayerLabel
            player={bottomPlayer}
            score={boardDisplayState.board.find(p => p.ownerPlayerId === bottomPlayerId && p.isStore)!.stones}
            isCurrentTurn={!isFinished && currentPlayerId === bottomPlayerId}
            side="bottom"
            colorIdx={bottomPlayerIdx}
          />
        )}

        {/* 3-4人プレイ: 全プレイヤースコアバッジ */}
        {config.playerCount >= 3 && (
          <div style={{
            display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {gameState.players.map((player, idx) => {
              const isActive = gameState.activePlayerIds.includes(player.id);
              const isCurrentTurn = !isFinished && isActive && currentPlayerId === player.id;
              const score = boardDisplayState.board.find(
                p => p.ownerPlayerId === player.id && p.isStore
              )!.stones;
              const colors = PLAYER_SCORE_COLORS[idx];
              return (
                <div key={player.id} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 10,
                  border: `1.5px solid ${isCurrentTurn ? colors.border : isActive ? '#c0b090' : '#d8cbb0'}`,
                  background: isCurrentTurn ? colors.bg : isActive ? '#f7f4ef' : '#ece8e0',
                  transition: 'all 0.2s',
                  opacity: isActive ? 1 : 0.45,
                }}>
                  {!isActive && <span style={{ fontSize: 9, color: '#999' }}>✗</span>}
                  {player.isCpu && isActive && <span style={{ fontSize: 13 }}>🐉</span>}
                  {isCurrentTurn && <span style={{ fontSize: 9, color: colors.text }}>▶</span>}
                  <span style={{
                    fontSize: 11,
                    fontWeight: isCurrentTurn ? 'bold' : 'normal',
                    color: isCurrentTurn ? colors.text : isActive ? 'var(--text-mid)' : 'var(--text-muted)',
                  }}>
                    {player.name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: colors.text }}>
                    {score}石
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ゲーム終了パネル */}
        {isFinished && (
          <RankingPanel
            rankings={rankings}
            isDraw={gameState.isDraw}
            onRestart={handleRestart}
            onBackToSetup={onBackToSetup}
            onBackToHome={onBackToHome}
          />
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
// 順位発表パネル
// ============================================================

function RankingPanel({
  rankings, isDraw, onRestart, onBackToSetup, onBackToHome,
}: {
  rankings: Array<{ player: Player; score: number; playerIdx: number }>;
  isDraw: boolean;
  onRestart: () => void;
  onBackToSetup: () => void;
  onBackToHome: () => void;
}) {
  const winner = rankings[0];
  const isSolo = rankings.length === 1;

  return (
    <div
      className="result-appear"
      style={{
        marginTop: 20, padding: '24px 20px',
        background: 'linear-gradient(135deg, #fffbe8, #fdf5d0)',
        border: '2px solid #e0c060', borderRadius: 22, textAlign: 'center',
        boxShadow: '0 6px 28px rgba(180, 140, 30, 0.20)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* 紙吹雪 */}
      {!isDraw && <Confetti />}

      {/* タイトル */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ゲーム終了！</div>

      {isDraw ? (
        <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 16 }}>
          引き分けです！🤝
        </div>
      ) : (
        <>
          <div className="trophy-bounce" style={{ fontSize: 44, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
            <span className="winner-glow">{winner.player.name}</span> の優勝！
          </div>
        </>
      )}

      {/* 順位リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {rankings.map((entry, rank) => {
          const isWinner = rank === 0 && !isDraw;
          const colors = PLAYER_SCORE_COLORS[entry.playerIdx];
          const accentColor = PLAYER_ACCENT_COLORS[entry.playerIdx];
          return (
            <div
              key={entry.player.id}
              className="rank-card"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 14,
                background: isWinner
                  ? 'linear-gradient(135deg, #fff8d8, #ffeea0)'
                  : colors.bg,
                border: isWinner
                  ? '2px solid #d4a020'
                  : `1.5px solid ${colors.border}`,
                boxShadow: isWinner ? '0 3px 12px rgba(212,160,32,0.30)' : 'none',
                animationDelay: `${rank * 0.12}s`,
              }}
            >
              {/* 左端カラーバー */}
              <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: accentColor, flexShrink: 0 }} />
              {/* メダル */}
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, minWidth: 28 }}>
                {RANK_MEDALS[Math.min(rank, 3)]}
              </span>
              {/* プレイヤー名 */}
              <span style={{
                flex: 1, textAlign: 'left',
                fontSize: 14, fontWeight: isWinner ? 'bold' : 'normal',
                color: isWinner ? '#8a5010' : colors.text,
              }}>
                {entry.player.isCpu ? '🐉 ' : ''}{entry.player.name}
              </span>
              {/* スコア */}
              <span style={{
                fontSize: 15, fontWeight: 'bold',
                color: isWinner ? '#8a5010' : colors.text,
                background: isWinner ? 'rgba(212,160,32,0.20)' : 'rgba(0,0,0,0.06)',
                padding: '3px 10px', borderRadius: 12,
              }}>
                {entry.score}石
              </span>
            </div>
          );
        })}
      </div>

      {/* ボタン */}
      <div className="game-nav-buttons" style={{ marginTop: 0 }}>
        <Button fullWidth onClick={onRestart}>
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
  );
}

// ============================================================
// 手番バナー
// ============================================================

function TurnBanner({
  variant, label, thinking = false,
}: {
  variant: 'human' | 'cpu'; label: string; thinking?: boolean;
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
        borderRadius: 14, padding: '10px 16px', marginBottom: 12,
        boxShadow: isCpu
          ? '0 2px 10px rgba(80,160,80,0.12)'
          : '0 2px 10px rgba(200,160,30,0.12)',
      }}
    >
      <div
        className={thinking ? 'cpu-thinking-pulse' : undefined}
        style={{ fontSize: 13, fontWeight: 'bold', color: isCpu ? '#2a6a2a' : '#7a5010' }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================
// プレイヤーラベル（2人プレイ用）
// ============================================================

function PlayerLabel({
  player, score, isCurrentTurn, side, colorIdx,
}: {
  player: Player; score: number; isCurrentTurn: boolean; side: 'top' | 'bottom'; colorIdx: number;
}) {
  const align = side === 'top' ? 'flex-end' : 'flex-start';
  const colors = PLAYER_SCORE_COLORS[colorIdx] ?? PLAYER_SCORE_COLORS[0];

  return (
    <div style={{
      display: 'flex', justifyContent: align, alignItems: 'center', gap: 6,
      padding: '5px 8px',
      marginTop:    side === 'bottom' ? 5 : 0,
      marginBottom: side === 'top'    ? 5 : 0,
      borderRadius: 10,
      background: isCurrentTurn ? `${colors.bg}88` : 'transparent',
      transition: 'background 0.2s ease',
    }}>
      {isCurrentTurn && side === 'bottom' && (
        <span style={{ fontSize: 11, color: colors.text }}>▶</span>
      )}
      {player.isCpu && <span style={{ fontSize: 15 }}>🐉</span>}
      <span style={{
        fontSize: 12, fontWeight: isCurrentTurn ? 'bold' : 'normal',
        color: isCurrentTurn ? colors.text : 'var(--text-muted)',
      }}>
        {player.name}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 'bold', color: colors.text,
        background: isCurrentTurn ? colors.bg : '#f0e8d4',
        padding: '2px 10px', borderRadius: 20,
        border: isCurrentTurn ? `1.5px solid ${colors.border}` : '1px solid #d8cbb0',
        transition: 'background 0.2s ease',
      }}>
        {score}石
      </span>
      {isCurrentTurn && side === 'top' && (
        <span style={{ fontSize: 11, color: colors.text }}>◀</span>
      )}
    </div>
  );
}
