import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { GameState, PlayerId } from './mancalaTypes';
import { applyMove, getEffectiveOppositePitId } from './mancalaRules';
import { chooseCpuMove } from './mancalaCpu';
import type { CaptureAnimInfo } from './MancalaGamePage';
import { supabase } from '../../lib/supabase';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MancalaBoard } from './MancalaBoard';
import { PLAYER_ACCENT_COLORS } from './MancalaPit';

// ============================================================
// 定数（オフラインと同じ値）
// ============================================================

const STONE_ANIM_MS   = 400;
const CAPTURE_ANIM_MS = 700;

// ============================================================
// computeStoneSteps（MancalaGamePage と同じロジック）
// ============================================================

function computeStoneSteps(state: GameState, pitId: string): {
  steps: GameState[];
  activeIds: string[];
  captureInfo: CaptureAnimInfo | null;
  isExtraTurn: boolean;
} {
  const sourcePit = state.board.find(p => p.id === pitId);
  if (!sourcePit || sourcePit.stones === 0)
    return { steps: [], activeIds: [], captureInfo: null, isExtraTurn: false };

  const playerId = state.currentPlayerId;
  const n        = state.board.length;
  const startIdx = state.board.findIndex(p => p.id === pitId);

  const stoneMap = new Map(state.board.map(p => [p.id, p.stones]));
  stoneMap.set(pitId, 0);

  const makeSnapshot = (): GameState => ({
    ...state,
    board: state.board.map(p => ({ ...p, stones: stoneMap.get(p.id)! })),
  });

  const steps: GameState[]  = [makeSnapshot()];
  const activeIds: string[] = [pitId];

  let i         = (startIdx + 1) % n;
  let remaining = sourcePit.stones;

  while (remaining > 0) {
    const pit = state.board[i];
    if (!state.activePlayerIds.includes(pit.ownerPlayerId as PlayerId)) {
      i = (i + 1) % n; continue;
    }
    if (pit.isStore && pit.ownerPlayerId !== playerId) {
      i = (i + 1) % n; continue;
    }
    stoneMap.set(pit.id, stoneMap.get(pit.id)! + 1);
    remaining--;
    steps.push(makeSnapshot());
    activeIds.push(pit.id);
    i = (i + 1) % n;
  }

  const lastPitId  = activeIds[activeIds.length - 1];
  const myStoreId  = state.board.find(p => p.ownerPlayerId === playerId && p.isStore)!.id;
  const isExtraTurn = lastPitId === myStoreId;

  let captureInfo: CaptureAnimInfo | null = null;
  if (state.activePlayerIds.length === 2) {
    const lastPit = state.board.find(p => p.id === lastPitId);
    if (lastPit && !lastPit.isStore && lastPit.ownerPlayerId === playerId) {
      const oppPitId = getEffectiveOppositePitId(state, lastPit);
      if (oppPitId) {
        const oppBefore  = state.board.find(p => p.id === oppPitId)?.stones ?? 0;
        if (oppBefore > 0) {
          const afterState = applyMove(state, pitId);
          if (afterState.status === 'playing') {
            const oppAfter     = afterState.board.find(p => p.id === oppPitId)!;
            const landingAfter = afterState.board.find(p => p.id === lastPitId)!;
            if (oppAfter.stones === 0 && landingAfter.stones === 0) {
              captureInfo = { landingPitId: lastPitId, oppositePitId: oppPitId, storeId: myStoreId, stoneCount: 1 + oppBefore };
            }
          }
        }
      }
    }
  }

  return { steps, activeIds, captureInfo, isExtraTurn };
}

// ============================================================
// メインコンポーネント
// ============================================================

type MancalaOnlineGamePageProps = {
  roomCode:    string;
  myPlayerId:  PlayerId;
  onBackToHome: () => void;
};

export function MancalaOnlineGamePage({
  roomCode, myPlayerId, onBackToHome,
}: MancalaOnlineGamePageProps) {

  // ── ゲーム状態 ──
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading,   setLoading]   = useState(true);
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  // ── 石アニメーション ──
  const [animSteps,     setAnimSteps]     = useState<GameState[]>([]);
  const [animActiveIds, setAnimActiveIds] = useState<string[]>([]);
  const [animIdx,       setAnimIdx]       = useState(0);
  const [pendingMove,   setPendingMove]   = useState<string | null>(null);

  // ── 捕獲アニメーション ──
  const [captureAnimInfo, setCaptureAnimInfo] = useState<CaptureAnimInfo | null>(null);
  const [capturePhase,    setCapturePhase]    = useState<'gather' | 'to-store' | null>(null);

  // ── バナー ──
  const [showExtraTurn,    setShowExtraTurn]    = useState(false);
  const [extraTurnKey,     setExtraTurnKey]     = useState(0);
  const [showCaptureBanner, setShowCaptureBanner] = useState(false);
  const [captureBannerKey,  setCaptureBannerKey]  = useState(0);

  const isAnimating = animSteps.length > 0;
  // stale closure 対策: Realtime コールバックから最新値を参照するための ref
  const isAnimatingRef = useRef(false);
  isAnimatingRef.current = isAnimating;

  // ============================================================
  // Supabase: 初回ロード & Realtime 購読
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    supabase
      .from('mancala_rooms')
      .select('game_state')
      .eq('room_code', roomCode)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoading(false); // エラーでも loading を解除
          return;
        }
        const gs = data.game_state as GameState | null;
        if (gs) setGameState(gs);
        setLoading(false);
      });

    const channel = supabase
      .channel(`online-game-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mancala_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (cancelled) return;
          const gs = (payload.new as { game_state: GameState }).game_state;
          // 自分のアニメーション中は相手更新を遅延させない（ref で最新値を参照）
          if (!isAnimatingRef.current) {
            setGameState(gs);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ============================================================
  // 石アニメーション進行
  // ============================================================
  useEffect(() => {
    if (!isAnimating || capturePhase !== null) return;

    if (animIdx >= animSteps.length) {
      if (captureAnimInfo) {
        setCapturePhase('gather');
        setCaptureBannerKey(k => k + 1);
        setShowCaptureBanner(true);
        setTimeout(() => setShowCaptureBanner(false), 2000);
        return;
      }
      // アニメーション完了 → Supabase に書き込み
      if (pendingMove && gameStateRef.current) {
        const finalState = applyMove(gameStateRef.current, pendingMove);
        setGameState(finalState);
        void supabase
          .from('mancala_rooms')
          .update({ game_state: finalState })
          .eq('room_code', roomCode);
        setPendingMove(null);
      }
      setAnimSteps([]);
      setAnimActiveIds([]);
      setAnimIdx(0);
      return;
    }

    const id = setTimeout(() => setAnimIdx(p => p + 1), STONE_ANIM_MS);
    return () => clearTimeout(id);
  }, [animIdx, animSteps.length, isAnimating, capturePhase, captureAnimInfo, pendingMove, roomCode]);

  // ============================================================
  // 捕獲アニメーション
  // ============================================================
  useEffect(() => {
    if (!capturePhase) return;

    const id = setTimeout(() => {
      if (capturePhase === 'gather') {
        setCapturePhase('to-store');
      } else {
        // 捕獲完了 → Supabase に書き込み
        if (pendingMove && gameStateRef.current) {
          const finalState = applyMove(gameStateRef.current, pendingMove);
          setGameState(finalState);
          void supabase
            .from('mancala_rooms')
            .update({ game_state: finalState })
            .eq('room_code', roomCode);
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
  }, [capturePhase, pendingMove, roomCode]);

  // ============================================================
  // ピットクリック（自分の手番のみ）
  // ============================================================
  const handlePitClick = useCallback((pitId: string) => {
    if (!gameState || isAnimating || capturePhase !== null) return;
    if (gameState.status !== 'playing') return;
    if (gameState.currentPlayerId !== myPlayerId) return;

    const { steps, activeIds, captureInfo: ci, isExtraTurn } =
      computeStoneSteps(gameState, pitId);
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
  }, [gameState, isAnimating, capturePhase, myPlayerId]);

  // ============================================================
  // CPU自動手番（ホスト＝player-1のみ実行）
  // ============================================================
  useEffect(() => {
    if (!gameState || isAnimating || capturePhase !== null) return;
    if (gameState.status !== 'playing') return;
    if (myPlayerId !== 'player-1') return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer?.isCpu) return;

    const cpuId    = gameState.currentPlayerId as PlayerId;
    const cpuLevel = currentPlayer.cpuLevel;

    const id = setTimeout(() => {
      const state = gameStateRef.current;
      if (!state || state.status !== 'playing') return;
      const cp = state.players.find(p => p.id === state.currentPlayerId);
      if (!cp?.isCpu || state.currentPlayerId !== cpuId) return;

      const pitId = chooseCpuMove(state, cpuId, cpuLevel);
      if (!pitId) return;

      const { steps, activeIds, captureInfo: ci, isExtraTurn } =
        computeStoneSteps(state, pitId);
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
    }, 700);

    return () => clearTimeout(id);
  // gameState.turnCount でターンが変わるたびに再評価
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentPlayerId, (gameState as GameState | null)?.turnCount, isAnimating, capturePhase, myPlayerId]);

  // ============================================================
  // 表示用ゲーム状態（アニメーション中は中間状態を使用）
  // ============================================================
  const boardDisplayState = isAnimating
    ? animSteps[Math.min(animIdx, animSteps.length - 1)]
    : gameState;

  // 2P対戦でゲストの場合、自分が常に下に来るよう activePlayerIds を逆順に
  const displayGameState = useMemo<GameState | null>(() => {
    if (!boardDisplayState) return null;
    if (myPlayerId === 'player-1') return boardDisplayState;
    if (boardDisplayState.activePlayerIds.length !== 2) return boardDisplayState;
    return {
      ...boardDisplayState,
      activePlayerIds: [...boardDisplayState.activePlayerIds].reverse() as PlayerId[],
    };
  }, [boardDisplayState, myPlayerId]);

  // ============================================================
  // ローディング
  // ============================================================
  if (loading) {
    return (
      <Layout>
        <div className="cpu-thinking-pulse" style={{ textAlign: 'center', padding: '60px 20px', fontSize: 15, color: 'var(--text-muted)' }}>
          読み込み中...
        </div>
      </Layout>
    );
  }

  if (!gameState || !displayGameState) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>ルームの取得に失敗しました</p>
          <Button onClick={onBackToHome}>ホームに戻る</Button>
        </div>
      </Layout>
    );
  }

  const isMyTurn   = gameState.currentPlayerId === myPlayerId;
  const isFinished = gameState.status === 'finished';
  const isMoving   = isAnimating || capturePhase !== null;

  // ============================================================
  // ゲーム終了パネル
  // ============================================================
  if (isFinished) {
    const sorted = [...gameState.players].sort((a, b) => {
      const sa = gameState.board.find(p => p.ownerPlayerId === a.id && p.isStore)?.stones ?? 0;
      const sb = gameState.board.find(p => p.ownerPlayerId === b.id && p.isStore)?.stones ?? 0;
      return sb - sa;
    });
    const isWinner = sorted[0].id === myPlayerId;
    const medals   = ['🥇', '🥈', '🥉', '4位'];

    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{isWinner ? '🏆' : '🎮'}</div>
          <h2 style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 20 }}>
            {isWinner ? '勝利！' : '対戦終了'}
          </h2>
          <div style={{ background: '#fffdf8', border: '1.5px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 24 }}>
            {sorted.map((p, i) => {
              const score = gameState.board.find(pit => pit.ownerPlayerId === p.id && pit.isStore)?.stones ?? 0;
              const isMe  = p.id === myPlayerId;
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isMe ? '#fff8e8' : 'transparent',
                  borderRadius: 10, marginBottom: 4,
                  fontWeight: isMe ? 'bold' : 'normal',
                }}>
                  <span>{medals[i] ?? `${i + 1}位`} {p.name}{isMe ? '（あなた）' : ''}</span>
                  <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)' }}>{score}石</span>
                </div>
              );
            })}
          </div>
          <Button onClick={onBackToHome}>ホームに戻る</Button>
        </div>
      </Layout>
    );
  }

  // ============================================================
  // 対局中
  // ============================================================
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  const myPlayer      = gameState.players.find(p => p.id === myPlayerId);
  const opponents     = gameState.players.filter(p => p.id !== myPlayerId);

  // 2P 上下プレイヤー（flip 後の displayGameState を基準）
  const bottomId     = displayGameState.activePlayerIds[0];
  const topId        = displayGameState.activePlayerIds[1];
  const bottomPlayer = gameState.players.find(p => p.id === bottomId);
  const topPlayer    = gameState.players.find(p => p.id === topId);
  const bottomPlayerIdx = gameState.players.findIndex(p => p.id === bottomId);
  const topPlayerIdx    = gameState.players.findIndex(p => p.id === topId);

  const turnLabel = isMoving
    ? `✨ ${currentPlayer?.name ?? '?'}が石を配っています...`
    : isMyTurn
    ? `🎮 あなたの番です`
    : `⏳ ${currentPlayer?.name ?? '相手'}の番です`;

  return (
    <Layout>
      {/* ヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'monospace' }}>
          ルーム: <strong>{roomCode}</strong>　あなた: <strong>{myPlayer?.name ?? myPlayerId}</strong>
        </div>
        {/* ターンバナー */}
        <div style={{
          fontSize: 13, fontWeight: 'bold', padding: '5px 14px', borderRadius: 20,
          background: isMyTurn && !isMoving ? '#e8f5e9' : isMoving ? '#fff3e0' : '#f5f5f5',
          color:      isMyTurn && !isMoving ? '#2e7d32' : isMoving ? '#c06000' : 'var(--text-muted)',
          display: 'inline-block',
        }}>
          {turnLabel}
        </div>
      </div>

      {/* 2P: 上プレイヤーラベル */}
      {displayGameState.activePlayerIds.length === 2 && topPlayer && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '3px 8px', marginBottom: 2,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 'bold',
            color: PLAYER_ACCENT_COLORS[topPlayerIdx],
          }}>
            {topPlayer.name}{topId === myPlayerId ? '（あなた）' : '（相手）'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {displayGameState.board.find(p => p.ownerPlayerId === topId && p.isStore)?.stones ?? 0}石
          </span>
        </div>
      )}

      {/* ボード */}
      <div style={{ position: 'relative' }}>
        <MancalaBoard
          gameState={displayGameState}
          onPitClick={handlePitClick}
          disabled={!isMyTurn || isMoving}
          animActiveIds={animActiveIds}
          animIdx={animIdx}
          animStepMs={STONE_ANIM_MS}
          captureAnimInfo={captureAnimInfo}
          capturePhase={capturePhase}
          captureStepMs={CAPTURE_ANIM_MS}
        />

        {/* 追加ターンバナー */}
        {showExtraTurn && (
          <div key={extraTurnKey} className="extra-turn-banner">⭐ 追加ターン！</div>
        )}
        {/* 捕獲バナー */}
        {showCaptureBanner && (
          <div key={captureBannerKey} className="capture-banner">🔴 捕獲！</div>
        )}
      </div>

      {/* 2P: 下プレイヤーラベル */}
      {displayGameState.activePlayerIds.length === 2 && bottomPlayer && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '3px 8px', marginTop: 2,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 'bold',
            color: PLAYER_ACCENT_COLORS[bottomPlayerIdx],
          }}>
            {bottomPlayer.name}{bottomId === myPlayerId ? '（あなた）' : '（相手）'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {displayGameState.board.find(p => p.ownerPlayerId === bottomId && p.isStore)?.stones ?? 0}石
          </span>
        </div>
      )}

      {/* 3P/4P: 対戦相手一覧 */}
      {displayGameState.activePlayerIds.length > 2 && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          🌐 対戦相手：{opponents.map(p => p.name).join('、')}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Button variant="ghost" fullWidth onClick={onBackToHome}>← ホームに戻る</Button>
      </div>
    </Layout>
  );
}
