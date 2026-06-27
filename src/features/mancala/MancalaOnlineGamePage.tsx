import { useState, useEffect, useRef, useMemo } from 'react';
import type { GameState, PlayerId } from './mancalaTypes';
import { applyMove } from './mancalaRules';
import { supabase } from '../../lib/supabase';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MancalaBoard } from './MancalaBoard';

type MancalaOnlineGamePageProps = {
  roomCode: string;
  myPlayerId: PlayerId;
  onBackToHome: () => void;
};

export function MancalaOnlineGamePage({
  roomCode,
  myPlayerId,
  onBackToHome,
}: MancalaOnlineGamePageProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [moving,    setMoving]    = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 2P対戦でゲスト（player-2）の場合、自分が下になるよう activePlayerIds を逆順にする
  const displayGameState = useMemo<GameState | null>(() => {
    if (!gameState) return null;
    if (myPlayerId === 'player-1') return gameState;
    if (gameState.activePlayerIds.length !== 2) return gameState;
    return {
      ...gameState,
      activePlayerIds: [...gameState.activePlayerIds].reverse() as PlayerId[],
    };
  }, [gameState, myPlayerId]);

  // ───── 初回ロード & Realtime 購読 ─────
  useEffect(() => {
    let cancelled = false;

    void supabase
      .from('mancala_rooms')
      .select('game_state')
      .eq('room_code', roomCode)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.game_state) {
          setGameState(data.game_state as GameState);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`online-game-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mancala_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (!cancelled) {
            const gs = (payload.new as { game_state: GameState }).game_state;
            setGameState(gs);
            setMoving(false);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // ───── ピットクリック ─────
  async function handlePitClick(pitId: string) {
    if (!gameState || moving) return;
    if (gameState.status !== 'playing') return;
    if (gameState.currentPlayerId !== myPlayerId) return;

    setMoving(true);
    const newState = applyMove(gameState, pitId);
    setGameState(newState);

    const { error } = await supabase
      .from('mancala_rooms')
      .update({ game_state: newState, updated_at: new Date().toISOString() })
      .eq('room_code', roomCode);

    if (error) {
      setGameState(gameState);
      setMoving(false);
    }
  }

  // ───── ローディング ─────
  if (loading) {
    return (
      <Layout>
        <div className="cpu-thinking-pulse" style={{
          textAlign: 'center', padding: '60px 20px',
          fontSize: 15, color: 'var(--text-muted)',
        }}>
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

  // ───── ゲーム終了パネル ─────
  if (isFinished) {
    const sorted = [...gameState.players].sort((a, b) => {
      const sa = gameState.board.find(p => p.ownerPlayerId === a.id && p.isStore)?.stones ?? 0;
      const sb = gameState.board.find(p => p.ownerPlayerId === b.id && p.isStore)?.stones ?? 0;
      return sb - sa;
    });
    const myRank    = sorted.findIndex(p => p.id === myPlayerId);
    const isWinner  = myRank === 0;
    const medals    = ['🥇', '🥈', '🥉', '4位'];

    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {isWinner ? '🏆' : '🎮'}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 20 }}>
            {isWinner ? '勝利！' : '対戦終了'}
          </h2>
          <div style={{
            background: '#fffdf8', border: '1.5px solid var(--border)',
            borderRadius: 16, padding: '16px', marginBottom: 24,
          }}>
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
                  <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)' }}>
                    {score}石
                  </span>
                </div>
              );
            })}
          </div>
          <Button onClick={onBackToHome}>ホームに戻る</Button>
        </div>
      </Layout>
    );
  }

  // ───── 対局中 ─────
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  const myPlayer      = gameState.players.find(p => p.id === myPlayerId);
  const opponents     = gameState.players.filter(p => p.id !== myPlayerId);

  return (
    <Layout>
      {/* ヘッダー：ルームコード＋ターン表示 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, padding: '6px 2px',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          ルーム: <strong>{roomCode}</strong>
          {' '}（{myPlayer?.name ?? 'あなた'}）
        </span>
        <span style={{
          fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 'bold',
          background: isMyTurn ? '#e8f5e9' : '#fff3e0',
          color:      isMyTurn ? '#2e7d32' : '#e65100',
        }}>
          {isMyTurn ? 'あなたの番' : `${currentPlayer?.name ?? '相手'}の番`}
        </span>
      </div>

      {/* ボード（displayGameState を使って自分が常に下側） */}
      <MancalaBoard
        gameState={displayGameState}
        onPitClick={handlePitClick}
        disabled={!isMyTurn || moving}
      />

      {/* 対戦相手リスト */}
      <div style={{
        textAlign: 'center', marginTop: 10,
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        🌐 対戦相手：{opponents.map(p => p.name).join('、')}
      </div>

      <div style={{ marginTop: 16 }}>
        <Button variant="ghost" fullWidth onClick={onBackToHome}>
          ← ホームに戻る
        </Button>
      </div>
    </Layout>
  );
}
