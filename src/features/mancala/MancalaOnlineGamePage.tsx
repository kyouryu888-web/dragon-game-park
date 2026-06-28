import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { GameState, PlayerId } from './mancalaTypes';
import { applyMove, getEffectiveOppositePitId } from './mancalaRules';
import { chooseCpuMove } from './mancalaCpu';
import type { CaptureAnimInfo } from './MancalaGamePage';
import { supabase } from '../../lib/supabase';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MancalaBoard, PLANK_POSITIONS } from './MancalaBoard';
import type { PlankSlideEntry } from './MancalaBoard';
import { PLAYER_ACCENT_COLORS } from './MancalaPit';

const STONE_ANIM_MS   = 400;
const CAPTURE_ANIM_MS = 700;
const ELIM_ANIM_MS    = 480; // 脱落プランクのフェードアウト
const SLIDE_ANIM_MS   = 580; // スライド全体の待機

// ============================================================
// computeStoneSteps
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

  const lastPitId   = activeIds[activeIds.length - 1];
  const myStoreId   = state.board.find(p => p.ownerPlayerId === playerId && p.isStore)!.id;
  const isExtraTurn = lastPitId === myStoreId;

  let captureInfo: CaptureAnimInfo | null = null;
  if (state.activePlayerIds.length === 2) {
    const lastPit = state.board.find(p => p.id === lastPitId);
    if (lastPit && !lastPit.isStore && lastPit.ownerPlayerId === playerId) {
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
// rotateForDisplay: myPlayerId が先頭に来るよう activePlayerIds を循環シフト
// ============================================================

function rotateForDisplay(ids: PlayerId[], myId: PlayerId): PlayerId[] {
  const myIdx = ids.indexOf(myId);
  if (myIdx <= 0) return [...ids] as PlayerId[];
  return [
    ...ids.slice(myIdx),
    ...ids.slice(0, myIdx),
  ] as PlayerId[];
}

// ============================================================
// メインコンポーネント
// ============================================================

type MancalaOnlineGamePageProps = {
  roomCode:     string;
  myPlayerId:   PlayerId;
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

  // ── 捕獲アニメーション ──
  const [captureAnimInfo, setCaptureAnimInfo] = useState<CaptureAnimInfo | null>(null);
  const [capturePhase,    setCapturePhase]    = useState<'gather' | 'to-store' | null>(null);

  // ── バナー ──
  const [showExtraTurn,     setShowExtraTurn]     = useState(false);
  const [extraTurnKey,      setExtraTurnKey]      = useState(0);
  const [showCaptureBanner, setShowCaptureBanner] = useState(false);
  const [captureBannerKey,  setCaptureBannerKey]  = useState(0);

  // ── 脱落アニメーション ──
  const [boardFading,      setBoardFading]      = useState<'none' | 'out' | 'sliding'>('none');
  const [displayActiveIds, setDisplayActiveIds] = useState<PlayerId[]>([]);
  const [eliminatingId,    setEliminatingId]    = useState<string | null>(null);
  const [slidingPlanks,    setSlidingPlanks]    = useState<PlankSlideEntry[] | null>(null);
  const [slideAtTarget,    setSlideAtTarget]    = useState(false);
  const prevDisplayIdsRef  = useRef<PlayerId[]>([]);
  const isTransitioningRef = useRef(false);

  // ── 名前編集 ──
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');

  const isAnimating = animSteps.length > 0;
  const isAnimatingRef = useRef(false);
  isAnimatingRef.current = isAnimating;

  const pendingFinalStateRef = useRef<GameState | null>(null);

  // ============================================================
  // Supabase: 初回ロード & Realtime 購読
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const syncLatest = async () => {
      const { data } = await supabase
        .from('mancala_rooms')
        .select('game_state')
        .eq('room_code', roomCode)
        .single();
      if (cancelled || !data?.game_state) return;
      if (isAnimatingRef.current || isTransitioningRef.current) return;
      const gs = data.game_state as GameState;
      setGameState(prev =>
        !prev || gs.turnCount > prev.turnCount ? gs : prev
      );
    };

    supabase
      .from('mancala_rooms')
      .select('game_state')
      .eq('room_code', roomCode)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }
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
          if (isAnimatingRef.current || isTransitioningRef.current) return;
          const gs = (payload.new as { game_state: GameState }).game_state;
          setGameState(prev =>
            !prev || gs.turnCount >= prev.turnCount ? gs : prev
          );
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !cancelled) {
          await syncLatest();
        }
      });

    const poll = setInterval(() => { void syncLatest(); }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ============================================================
  // 脱落検出 & スライドアニメーション
  // gameState.activePlayerIds の人数が減ったときに発火
  // ============================================================
  useEffect(() => {
    if (!gameState) return;

    const currRotated = rotateForDisplay(gameState.activePlayerIds, myPlayerId);
    const prevRotated = prevDisplayIdsRef.current;

    // 初回ロード: displayActiveIds を初期化
    if (prevRotated.length === 0) {
      setDisplayActiveIds(currRotated);
      prevDisplayIdsRef.current = currRotated;
      return;
    }

    // 脱落なし（通常の手番進行）
    if (currRotated.length >= prevRotated.length) {
      setDisplayActiveIds(currRotated);
      prevDisplayIdsRef.current = currRotated;
      return;
    }

    // ── 脱落発生 ──
    const eliminatedId = prevRotated.find(id => !currRotated.includes(id));
    const fromCount    = prevRotated.length; // 4 or 3
    const toCount      = currRotated.length; // 3 or 2

    isTransitioningRef.current = true;
    setBoardFading('out');
    // 4P→3P: 脱落プランクのみフェードアウト（3P→2P は SVG三角形のためスキップ）
    if (fromCount === 4) {
      setEliminatingId(eliminatedId ?? null);
    }

    let t2: ReturnType<typeof setTimeout> | undefined;

    const t1 = setTimeout(() => {
      setEliminatingId(null);
      setBoardFading('sliding');

      const fromPositions = PLANK_POSITIONS[String(fromCount)];
      const toPositions   = PLANK_POSITIONS[String(toCount)];
      const allPlayerIds  = gameState.players.map(p => p.id);

      const slides: PlankSlideEntry[] = currRotated.map((playerId, newSlot) => {
        const oldSlot = prevRotated.indexOf(playerId);
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

      t2 = setTimeout(() => {
        setSlidingPlanks(null);
        setDisplayActiveIds(currRotated);
        prevDisplayIdsRef.current = currRotated;
        setBoardFading('none');
        isTransitioningRef.current = false;
      }, SLIDE_ANIM_MS);
    }, ELIM_ANIM_MS);

    return () => {
      clearTimeout(t1);
      if (t2 !== undefined) clearTimeout(t2);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.activePlayerIds.length, (gameState as GameState | null)?.gameId, myPlayerId]);

  // ============================================================
  // double-RAF: slidingPlanks が設定されたら CSS transition を発火
  // ============================================================
  useEffect(() => {
    if (!slidingPlanks) { setSlideAtTarget(false); return; }
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
  // 移動開始ヘルパー
  // ============================================================
  const startMove = useCallback((state: GameState, pitId: string) => {
    const finalState = applyMove(state, pitId);
    if (finalState === state) return;

    supabase
      .from('mancala_rooms')
      .update({ game_state: finalState })
      .eq('room_code', roomCode)
      .then(({ error }) => {
        if (error) console.error('[online] write failed:', error);
      });

    const { steps, activeIds, captureInfo: ci, isExtraTurn } =
      computeStoneSteps(state, pitId);

    if (steps.length === 0) {
      setGameState(finalState);
      return;
    }

    if (isExtraTurn) {
      setExtraTurnKey(k => k + 1);
      setShowExtraTurn(true);
      setTimeout(() => setShowExtraTurn(false), 1700);
    }

    pendingFinalStateRef.current = finalState;
    setCaptureAnimInfo(ci ?? null);
    setCapturePhase(null);
    setAnimSteps(steps);
    setAnimActiveIds(activeIds);
    setAnimIdx(0);
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
      if (pendingFinalStateRef.current) {
        setGameState(pendingFinalStateRef.current);
        pendingFinalStateRef.current = null;
      }
      setAnimSteps([]);
      setAnimActiveIds([]);
      setAnimIdx(0);
      return;
    }

    const id = setTimeout(() => setAnimIdx(p => p + 1), STONE_ANIM_MS);
    return () => clearTimeout(id);
  }, [animIdx, animSteps.length, isAnimating, capturePhase, captureAnimInfo]);

  // ============================================================
  // 捕獲アニメーション
  // ============================================================
  useEffect(() => {
    if (!capturePhase) return;

    const id = setTimeout(() => {
      if (capturePhase === 'gather') {
        setCapturePhase('to-store');
      } else {
        if (pendingFinalStateRef.current) {
          setGameState(pendingFinalStateRef.current);
          pendingFinalStateRef.current = null;
        }
        setCaptureAnimInfo(null);
        setCapturePhase(null);
        setAnimSteps([]);
        setAnimActiveIds([]);
        setAnimIdx(0);
      }
    }, CAPTURE_ANIM_MS);

    return () => clearTimeout(id);
  }, [capturePhase]);

  // ============================================================
  // ピットクリック（自分の手番のみ）
  // ============================================================
  const handlePitClick = useCallback((pitId: string) => {
    if (!gameState || isAnimating || capturePhase !== null) return;
    if (isTransitioningRef.current) return;
    if (gameState.status !== 'playing') return;
    if (gameState.currentPlayerId !== myPlayerId) return;
    startMove(gameState, pitId);
  }, [gameState, isAnimating, capturePhase, myPlayerId, startMove]);

  // ============================================================
  // CPU自動手番（ホスト＝player-1のみ実行）
  // ============================================================
  useEffect(() => {
    if (!gameState || isAnimating || capturePhase !== null) return;
    if (isTransitioningRef.current) return;
    if (gameState.status !== 'playing') return;
    if (myPlayerId !== 'player-1') return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer?.isCpu) return;

    const cpuId    = gameState.currentPlayerId as PlayerId;
    const cpuLevel = currentPlayer.cpuLevel;

    const id = setTimeout(() => {
      const state = gameStateRef.current;
      if (!state || state.status !== 'playing') return;
      if (isTransitioningRef.current) return;
      const cp = state.players.find(p => p.id === state.currentPlayerId);
      if (!cp?.isCpu || state.currentPlayerId !== cpuId) return;
      const pitId = chooseCpuMove(state, cpuId, cpuLevel);
      if (!pitId) return;
      startMove(state, pitId);
    }, 700);

    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentPlayerId, (gameState as GameState | null)?.turnCount, isAnimating, capturePhase, myPlayerId, startMove]);

  // ============================================================
  // 名前の変更
  // ============================================================
  const handleSaveName = useCallback(() => {
    const newName = nameInput.trim();
    setEditingName(false);
    if (!gameState || !newName) return;
    const current = gameState.players.find(p => p.id === myPlayerId);
    if (newName === current?.name) return;

    localStorage.setItem('dgp-online-player-name', newName);

    const updatedGs: GameState = {
      ...gameState,
      players: gameState.players.map(p =>
        p.id === myPlayerId ? { ...p, name: newName } : p
      ),
    };
    setGameState(updatedGs);
    supabase
      .from('mancala_rooms')
      .update({ game_state: updatedGs })
      .eq('room_code', roomCode)
      .then(({ error }) => {
        if (error) console.error('[online] name update failed:', error);
      });
  }, [gameState, myPlayerId, nameInput, roomCode]);

  // ============================================================
  // 表示用ゲーム状態
  // displayActiveIds（脱落アニメーション管理済み）を使用
  // ============================================================
  const boardDisplayState = isAnimating
    ? animSteps[Math.min(animIdx, animSteps.length - 1)]
    : gameState;

  const displayGameState = useMemo<GameState | null>(() => {
    if (!boardDisplayState || displayActiveIds.length === 0) return null;
    return { ...boardDisplayState, activePlayerIds: displayActiveIds };
  }, [boardDisplayState, displayActiveIds]);

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

  const isMyTurn       = gameState.currentPlayerId === myPlayerId;
  const isFinished     = gameState.status === 'finished';
  const isMoving       = isAnimating || capturePhase !== null;
  const isTransitioning = boardFading !== 'none';

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

  const bottomId      = displayActiveIds[0];
  const topId         = displayActiveIds[1];
  const bottomPlayer  = gameState.players.find(p => p.id === bottomId);
  const topPlayer     = gameState.players.find(p => p.id === topId);
  const bottomPlayerIdx = gameState.players.findIndex(p => p.id === bottomId);
  const topPlayerIdx    = gameState.players.findIndex(p => p.id === topId);

  const turnLabel = isMoving
    ? `✨ ${currentPlayer?.name ?? '?'}が石を配っています...`
    : isTransitioning
    ? '🔄 プレイヤーが脱落しました...'
    : isMyTurn
    ? '🎮 あなたの番です'
    : `⏳ ${currentPlayer?.name ?? '相手'}の番です`;

  return (
    <Layout>
      {/* ヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'monospace' }}>
          ルーム: <strong>{roomCode}</strong>
          {editingName ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                autoFocus
                value={nameInput}
                maxLength={12}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{
                  fontSize: 12, padding: '2px 6px', borderRadius: 6,
                  border: '1.5px solid var(--orange)', outline: 'none',
                  fontFamily: 'inherit', width: 80, background: '#fffbe8',
                }}
              />
              <button onClick={handleSaveName}
                style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#2a7a2a', padding: 2 }}>
                ✓
              </button>
              <button onClick={() => setEditingName(false)}
                style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 2 }}>
                ✗
              </button>
            </span>
          ) : (
            <span>
              あなた: <strong>{myPlayer?.name ?? myPlayerId}</strong>
              <button
                onClick={() => { setNameInput(myPlayer?.name ?? ''); setEditingName(true); }}
                title="名前を変更"
                style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 4, padding: '0 2px' }}
              >✏️</button>
            </span>
          )}
        </div>

        <div style={{
          fontSize: 13, fontWeight: 'bold', padding: '5px 14px', borderRadius: 20,
          background: isTransitioning ? '#fce4e4'
            : isMyTurn && !isMoving ? '#e8f5e9'
            : isMoving ? '#fff3e0'
            : '#f5f5f5',
          color: isTransitioning ? '#b22222'
            : isMyTurn && !isMoving ? '#2e7d32'
            : isMoving ? '#c06000'
            : 'var(--text-muted)',
          display: 'inline-block',
          transition: 'background 0.3s, color 0.3s',
        }}>
          {turnLabel}
        </div>
      </div>

      {/* 2P: 上プレイヤーラベル */}
      {displayActiveIds.length === 2 && topPlayer && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '3px 8px', marginBottom: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: PLAYER_ACCENT_COLORS[topPlayerIdx] }}>
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
          disabled={!isMyTurn || isMoving || isTransitioning}
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
        {showExtraTurn    && <div key={extraTurnKey}     className="extra-turn-banner">⭐ 追加ターン！</div>}
        {showCaptureBanner && <div key={captureBannerKey} className="capture-banner">🔴 捕獲！</div>}
      </div>

      {/* 2P: 下プレイヤーラベル */}
      {displayActiveIds.length === 2 && bottomPlayer && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '3px 8px', marginTop: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: PLAYER_ACCENT_COLORS[bottomPlayerIdx] }}>
            {bottomPlayer.name}{bottomId === myPlayerId ? '（あなた）' : '（相手）'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {displayGameState.board.find(p => p.ownerPlayerId === bottomId && p.isStore)?.stones ?? 0}石
          </span>
        </div>
      )}

      {/* 3P/4P: 対戦相手一覧 */}
      {displayActiveIds.length > 2 && (
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
