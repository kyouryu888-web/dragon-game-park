import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createInitialMancalaState } from './createInitialMancalaState';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

export type OnlineRoomInfo = {
  roomCode: string;
  myRole: 'host' | 'guest';
};

type MancalaRoomPageProps = {
  onGameStart: (info: OnlineRoomInfo) => void;
  onBack: () => void;
};

type PageState = 'menu' | 'creating' | 'waiting' | 'joining';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getOnlinePlayerId(): string {
  const key = 'dgp-online-player-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    localStorage.setItem(key, id);
  }
  return id;
}

const ONLINE_CONFIG = {
  playerCount: 2 as const,
  players: [
    { name: 'ホスト', isCpu: false as const, cpuLevel: 'normal' as const },
    { name: 'ゲスト', isCpu: false as const, cpuLevel: 'normal' as const },
  ],
};

export function MancalaRoomPage({ onGameStart, onBack }: MancalaRoomPageProps) {
  const [pageState, setPageState] = useState<PageState>('menu');
  const [roomCode,  setRoomCode]  = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error,     setError]     = useState('');

  // ルームを作成する
  async function handleCreate() {
    setError('');
    setPageState('creating');
    const code     = generateRoomCode();
    const playerId = getOnlinePlayerId();
    const gs       = createInitialMancalaState(ONLINE_CONFIG);

    const { error: err } = await supabase.from('mancala_rooms').insert({
      room_code:    code,
      game_state:   gs,
      player_count: 2,
      host_id:      playerId,
    });

    if (err) {
      setError('ルームの作成に失敗しました。もう一度お試しください。');
      setPageState('menu');
      return;
    }
    setRoomCode(code);
    setPageState('waiting');
  }

  // ゲストが参加するのを監視
  useEffect(() => {
    if (pageState !== 'waiting' || !roomCode) return;

    const channel = supabase
      .channel(`room-wait-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mancala_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if ((payload.new as { guest_id?: string }).guest_id) {
            onGameStart({ roomCode, myRole: 'host' });
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [pageState, roomCode, onGameStart]);

  // ルームに参加する
  async function handleJoin() {
    setError('');
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('6文字のルームコードを入力してください');
      return;
    }

    const playerId = getOnlinePlayerId();

    const { data, error: fetchErr } = await supabase
      .from('mancala_rooms')
      .select('*')
      .eq('room_code', code)
      .single();

    if (fetchErr || !data) {
      setError('ルームが見つかりません。コードを確認してください');
      return;
    }
    if (data.guest_id) {
      setError('このルームはすでに満員です');
      return;
    }
    if (data.host_id === playerId) {
      setError('自分のルームには参加できません');
      return;
    }

    const { error: updateErr } = await supabase
      .from('mancala_rooms')
      .update({ guest_id: playerId })
      .eq('room_code', code);

    if (updateErr) {
      setError('参加に失敗しました。もう一度お試しください。');
      return;
    }

    onGameStart({ roomCode: code, myRole: 'guest' });
  }

  // ルーム待機画面
  if (pageState === 'waiting') {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
            ルーム作成完了！
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
            相手にこのコードを送ってください
          </p>

          {/* ルームコード表示 */}
          <div style={{
            display: 'inline-block',
            fontSize: 36, fontWeight: 'bold', letterSpacing: 10,
            fontFamily: 'monospace',
            color: 'var(--brown)',
            background: '#fffbe8',
            border: '2px solid #e8c870',
            borderRadius: 18,
            padding: '20px 36px',
            marginBottom: 28,
          }}>
            {roomCode}
          </div>

          <div
            className="cpu-thinking-pulse"
            style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}
          >
            相手の参加を待っています...
          </div>

          <Button variant="ghost" onClick={async () => {
            await supabase.from('mancala_rooms').delete().eq('room_code', roomCode);
            setPageState('menu');
            setRoomCode('');
          }}>
            キャンセル
          </Button>
        </div>
      </Layout>
    );
  }

  // メニュー・参加画面
  return (
    <Layout>
      <div style={{ paddingTop: 16, paddingBottom: 40 }}>
        <h1 style={{
          fontSize: 20, fontWeight: 'bold',
          color: 'var(--brown)', textAlign: 'center', marginBottom: 24,
        }}>
          🌐 オンライン対戦
        </h1>

        {/* ルームを作る */}
        <div style={{
          background: '#fffdf8',
          border: '1.5px solid var(--border)',
          borderRadius: 18, padding: '20px', marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            🏠 ルームを作る
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            ルームコードを発行して、相手に送ります
          </p>
          <Button fullWidth onClick={handleCreate} disabled={pageState === 'creating'}>
            {pageState === 'creating' ? '作成中...' : 'ルームを作る'}
          </Button>
        </div>

        {/* ルームに参加する */}
        <div style={{
          background: '#fffdf8',
          border: '1.5px solid var(--border)',
          borderRadius: 18, padding: '20px', marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            🚪 ルームに参加する
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            相手から受け取ったコードを入力してください
          </p>
          <input
            type="text"
            placeholder="例: ABC123"
            maxLength={6}
            value={inputCode}
            onChange={e => { setInputCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void handleJoin(); }}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 22, fontFamily: 'monospace', letterSpacing: 8,
              textAlign: 'center',
              border: '2px solid var(--border)',
              borderRadius: 12,
              marginBottom: 12,
              boxSizing: 'border-box',
              background: '#fffdf8',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <Button fullWidth variant="secondary" onClick={handleJoin}>
            参加する
          </Button>
        </div>

        {error && (
          <div style={{
            color: '#c0392b', background: '#fdf0ef',
            border: '1px solid #f5c6c0',
            borderRadius: 10, padding: '10px 14px',
            fontSize: 13, marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={onBack}>
          ← 戻る
        </Button>
      </div>
    </Layout>
  );
}
