import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import type { UnoCard, UnoColor, UnoGameState, UnoPlayerId } from './unoTypes';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyPlayCard,
  applySwapPick,
  applyUnoDeclaration,
  canPlayCard,
  getNextPlayerId,
  getPlayableCards,
} from './unoRules';
import { chooseUnoCpuAction } from './unoCpu';
import { getUnoCardName, UNO_COLOR_LABELS } from './unoCardMeta';
import { UnoTableView } from './UnoTableView';
import { PendingPanel } from './UnoGamePage';
import { UnoRulesPanel } from './UnoRulesPanel';
import {
  canApplyUnoOnlineAction,
  getUnoOnlinePlayerId,
  type UnoRoomRow,
} from './unoOnline';
import { getUnoRankings } from './unoScoring';

type UnoOnlineGamePageProps = {
  roomCode: string;
  myPlayerId: UnoPlayerId;
  onBackToHome: () => void;
};

type UnoRoomGameRow = Pick<UnoRoomRow, 'game_state' | 'version' | 'host_id'>;

export function UnoOnlineGamePage({ roomCode, myPlayerId, onBackToHome }: UnoOnlineGamePageProps) {
  const [gameState, setGameState] = useState<UnoGameState | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);
  const [isHostClient, setIsHostClient] = useState(myPlayerId === 'player-1');
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [message, setMessage] = useState('オンラインルームを読み込み中です。');

  const stateRef = useRef<UnoGameState | null>(null);
  const versionRef = useRef(0);
  const writingRef = useRef(false);
  stateRef.current = gameState;
  versionRef.current = roomVersion;
  writingRef.current = isWriting;

  const fetchLatest = useCallback(async (nextMessage?: string) => {
    const { data, error } = await supabase
      .from('uno_rooms')
      .select('game_state, version, host_id')
      .eq('room_code', roomCode)
      .single();

    if (error || !data?.game_state) {
      setMessage('UNOルームの取得に失敗しました。');
      setLoading(false);
      return;
    }

    const row = data as UnoRoomGameRow;
    setGameState(row.game_state as UnoGameState);
    setRoomVersion(row.version);
    setIsHostClient(row.host_id === getUnoOnlinePlayerId() || myPlayerId === 'player-1');
    if (nextMessage) setMessage(nextMessage);
    setLoading(false);
  }, [myPlayerId, roomCode]);

  const updateRemoteState = useCallback(async (
    updater: (state: UnoGameState) => UnoGameState,
    nextMessage?: string,
  ) => {
    const current = stateRef.current;
    const version = versionRef.current;
    if (!current || writingRef.current) return;

    const next = updater(current);
    if (next === current) return;

    setIsWriting(true);
    const { data, error } = await supabase
      .from('uno_rooms')
      .update({
        game_state: next,
        version: version + 1,
      })
      .eq('room_code', roomCode)
      .eq('version', version)
      .select('game_state, version, host_id')
      .maybeSingle();

    if (error || !data) {
      await fetchLatest('ほかの操作が先に反映されました。最新状態に更新しました。');
      setIsWriting(false);
      return;
    }

    const row = data as UnoRoomGameRow;
    setGameState(row.game_state as UnoGameState);
    setRoomVersion(row.version);
    if (nextMessage) setMessage(nextMessage);
    setIsWriting(false);
  }, [fetchLatest, roomCode]);

  useEffect(() => {
    let cancelled = false;

    void fetchLatest();

    const channel = supabase
      .channel(`uno-online-game-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'uno_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as UnoRoomRow;
          if ((row.version ?? 0) < versionRef.current) return;
          setGameState(row.game_state as UnoGameState);
          setRoomVersion(row.version);
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !cancelled) await fetchLatest();
      });

    const poll = setInterval(() => { void fetchLatest(); }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [fetchLatest, roomCode]);

  const currentPlayer = gameState?.players.find((player) => player.id === gameState.currentPlayerId);
  const myPlayer = gameState?.players.find((player) => player.id === myPlayerId);
  const topCard = gameState?.discardPile[0] ?? null;
  const nextPlayerId = useMemo(() => (gameState ? getNextPlayerId(gameState) : myPlayerId), [gameState, myPlayerId]);
  const myHand = gameState?.hands[myPlayerId] ?? [];
  const playableCards = gameState ? getPlayableCards(gameState, myPlayerId) : [];
  const canTakeTurn = !!gameState && canApplyUnoOnlineAction(gameState, myPlayerId, 'turn') && !isWriting && !isCpuThinking;
  const winner = gameState?.winnerPlayerId ? gameState.players.find((player) => player.id === gameState.winnerPlayerId) : null;
  const rankings = gameState ? getUnoRankings(gameState) : [];

  const handlePlayCard = useCallback((card: UnoCard) => {
    if (!gameState || !canTakeTurn) return;
    if (!canPlayCard(gameState, card)) return;
    void updateRemoteState(
      (state) => applyPlayCard(state, card.id),
      `${myPlayer?.name ?? 'あなた'} が ${getUnoCardName(card)} を出しました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleDraw = useCallback(() => {
    if (!gameState || !canTakeTurn) return;
    void updateRemoteState(
      (state) => applyDrawCard(state),
      gameState.variant === 'hard' ? '出せるカードが出るまで引きます。' : `${myPlayer?.name ?? 'あなた'} が1まい引きました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleAcceptDraw = useCallback(() => {
    if (!gameState || !canTakeTurn || gameState.pendingDrawCount <= 0) return;
    const count = gameState.pendingDrawCount;
    void updateRemoteState(
      (state) => applyAcceptDraw(state),
      `${myPlayer?.name ?? 'あなた'} が${count}まい引きました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleColorChoice = useCallback((color: UnoColor) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'color-pick')) return;
    void updateRemoteState((state) => applyColorChoice(state, color), `${UNO_COLOR_LABELS[color]}をえらびました。`);
  }, [gameState, myPlayerId, updateRemoteState]);

  const handleSwapPick = useCallback((targetPlayerId: UnoPlayerId) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'swap-pick')) return;
    const target = gameState.players.find((player) => player.id === targetPlayerId);
    void updateRemoteState((state) => applySwapPick(state, targetPlayerId), `${target?.name ?? '相手'} と手札をこうかんしました。`);
  }, [gameState, myPlayerId, updateRemoteState]);

  const handleUnoDeclare = useCallback((playerId: UnoPlayerId) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'uno-declare')) return;
    void updateRemoteState((state) => applyUnoDeclaration(state, playerId), 'ウノ! と言いました。');
  }, [gameState, myPlayerId, updateRemoteState]);

  useEffect(() => {
    if (!gameState || !isHostClient || isWriting || gameState.status !== 'playing') {
      setIsCpuThinking(false);
      return;
    }

    const pending = gameState.pendingAction;
    if (pending?.kind === 'color-roulette') {
      setIsCpuThinking(true);
      const id = setTimeout(() => {
        void updateRemoteState((state) => applyColorRouletteStep(state), 'カラー ルーレット中...');
        setIsCpuThinking(false);
      }, 520);
      return () => clearTimeout(id);
    }

    const actingPlayerId =
      pending?.kind === 'color-pick' ? pending.chooserPlayerId
      : pending?.kind === 'swap-pick' ? pending.swapperPlayerId
      : pending?.kind === 'uno-window' ? pending.playerWithOneCard
      : gameState.currentPlayerId;
    const actingPlayer = gameState.players.find((player) => player.id === actingPlayerId);
    if (!actingPlayer?.isCpu) {
      setIsCpuThinking(false);
      return;
    }

    setIsCpuThinking(true);
    const id = setTimeout(() => {
      const state = stateRef.current;
      if (!state) {
        setIsCpuThinking(false);
        return;
      }
      const action = chooseUnoCpuAction(state, actingPlayer.id, actingPlayer.cpuLevel ?? 'normal');
      if (!action) {
        setIsCpuThinking(false);
        return;
      }

      void updateRemoteState((prev) => {
        switch (action.type) {
          case 'play-card':
            return applyPlayCard(prev, action.cardId);
          case 'draw-card':
            return applyDrawCard(prev);
          case 'accept-draw':
            return applyAcceptDraw(prev);
          case 'choose-color':
            return applyColorChoice(prev, action.color);
          case 'choose-swap':
            return applySwapPick(prev, action.targetPlayerId);
          case 'roulette-step':
            return applyColorRouletteStep(prev);
          case 'declare-uno':
            return applyUnoDeclaration(prev, action.playerId);
        }
      }, `${actingPlayer.name} が考えました。`);
      setIsCpuThinking(false);
    }, 760);

    return () => clearTimeout(id);
  }, [gameState, isHostClient, isWriting, updateRemoteState]);

  if (loading) {
    return (
      <Layout>
        <div className="cpu-thinking-pulse" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          UNOルームを読み込み中...
        </div>
      </Layout>
    );
  }

  if (!gameState || !currentPlayer || !myPlayer || !topCard) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>UNOルームの取得に失敗しました。</p>
          <Button onClick={onBackToHome}>ホームへ戻る</Button>
        </div>
      </Layout>
    );
  }

  if (gameState.status === 'finished') {
    return (
      <Layout>
        <div style={{ paddingTop: 32, paddingBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>WIN</div>
          <h1 style={{ fontSize: 22, color: 'var(--brown)', marginBottom: 12 }}>
            {winner ? `${winner.name} の勝ち!` : 'ゲーム終了'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            ルーム: <strong style={{ fontFamily: 'monospace' }}>{roomCode}</strong>
          </p>
          <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
            {rankings.map((entry, index) => (
              <div key={entry.player.id} className="rank-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                background: index === 0 ? '#fff0b8' : '#fffdf8',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                padding: '9px 10px',
                fontSize: 13,
                animationDelay: `${index * 45}ms`,
              }}>
                <strong>{entry.rank}. {entry.player.name}</strong>
                <span>
                  {entry.player.isEliminated ? '脱落 / ' : ''}
                  {entry.score}点
                  <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>残り{entry.cardCount}枚</small>
                </span>
              </div>
            ))}
          </div>
          <Button fullWidth onClick={onBackToHome}>ホームへ戻る</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, color: 'var(--brown)', marginBottom: 3 }}>
            {gameState.variant === 'hard' ? 'ハード版 UNO オンライン' : '通常版 UNO オンライン'}
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            ルーム: <strong>{roomCode}</strong> / あなた: {myPlayer.name} / v{roomVersion}
          </div>
        </div>

        <div style={{
          background: canTakeTurn ? '#e8f5e9' : '#f8f4ec',
          color: canTakeTurn ? '#2e7d32' : 'var(--text-muted)',
          border: `1.5px solid ${canTakeTurn ? '#9ac99b' : 'var(--border)'}`,
          borderRadius: 15,
          padding: '10px 14px',
          marginBottom: 10,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 900,
        }}>
          {canTakeTurn ? 'あなたの番です' : `${currentPlayer.name} の番です`}
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700 }}>
            {isCpuThinking ? 'CPU思考中...' : isWriting ? '同期中...' : message}
          </div>
        </div>

        <UnoTableView
          state={gameState}
          currentPlayer={currentPlayer}
          nextPlayerId={nextPlayerId}
          topCard={topCard}
          currentHand={myHand}
          handPlayer={myPlayer}
          playableIds={new Set(playableCards.map((card) => card.id))}
          canAct={canTakeTurn}
          isCpuThinking={isCpuThinking}
          message={message}
          viewPlayerId={myPlayerId}
          pendingOverlay={gameState.pendingAction ? (
            <PendingPanel
              state={gameState}
              onColorChoice={handleColorChoice}
              onSwapPick={handleSwapPick}
              onUnoDeclare={handleUnoDeclare}
            />
          ) : null}
          onPlay={handlePlayCard}
          onDraw={handleDraw}
          onAcceptDraw={handleAcceptDraw}
        />

        <button
          onClick={() => setShowRules((show) => !show)}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '11px 14px',
            borderRadius: 14,
            border: '1.5px solid var(--border)',
            background: '#faf8f4',
            color: 'var(--text-mid)',
            cursor: 'pointer',
            fontWeight: 900,
          }}
        >
          {showRules ? 'ルール説明を閉じる' : 'ルール説明を開く'}
        </button>
        {showRules && <div style={{ marginTop: 8 }}><UnoRulesPanel variant={gameState.variant} /></div>}

        <div style={{ marginTop: 14 }}>
          <Button variant="ghost" fullWidth onClick={onBackToHome}>ホームへ戻る</Button>
        </div>
      </div>
    </Layout>
  );
}
