import { useState, useEffect } from 'react';
import type { PlayerId } from './mancalaTypes';
import { supabase } from '../../lib/supabase';
import { createInitialMancalaState } from './createInitialMancalaState';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

export type OnlineRoomInfo = {
  roomCode: string;
  myPlayerId: PlayerId;
};

type MancalaRoomPageProps = {
  onGameStart: (info: OnlineRoomInfo) => void;
  onBack: () => void;
};

type PageState = 'menu' | 'creating' | 'waiting' | 'select-role';

type RoomRow = {
  room_code: string;
  player_count: number;
  host_id: string | null;
  guest_id: string | null;
  guest2_id: string | null;
  guest3_id: string | null;
  game_state?: { status: string } | null;
};

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

function isRoomReady(row: Partial<RoomRow>): boolean {
  const n = row.player_count ?? 2;
  if (n === 2) return !!row.guest_id;
  if (n === 3) return !!row.guest_id && !!row.guest2_id;
  return !!row.guest_id && !!row.guest2_id && !!row.guest3_id;
}

function countJoined(row: Partial<RoomRow>): number {
  let c = 1;
  if (row.guest_id)  c++;
  if (row.guest2_id) c++;
  if (row.guest3_id) c++;
  return c;
}

const PLAYER_NAMES = ['ホスト', 'ゲスト1', 'ゲスト2', 'ゲスト3'];

export function MancalaRoomPage({ onGameStart, onBack }: MancalaRoomPageProps) {
  const [pageState,          setPageState]          = useState<PageState>('menu');
  const [playerCount,        setPlayerCount]        = useState<2 | 3 | 4>(2);
  const [roomCode,           setRoomCode]           = useState('');
  const [inputCode,          setInputCode]          = useState('');
  const [error,              setError]              = useState('');
  const [myWaitingPlayerId,  setMyWaitingPlayerId]  = useState<PlayerId>('player-1');
  const [joinedCount,        setJoinedCount]        = useState(1);
  const [selectRoleCode,     setSelectRoleCode]     = useState('');
  const [selectRoleCount,    setSelectRoleCount]    = useState(2);
  const [waitingPlayerCount, setWaitingPlayerCount] = useState(2);

  // ───── ルームを作る ─────
  async function handleCreate() {
    setError('');
    setPageState('creating');
    const code     = generateRoomCode();
    const hostId   = getOnlinePlayerId();
    const config   = {
      playerCount,
      players: Array.from({ length: playerCount }, (_, i) => ({
        name:     PLAYER_NAMES[i],
        isCpu:    false as const,
        cpuLevel: 'normal' as const,
      })),
    };
    const gs = createInitialMancalaState(config);

    const { error: err } = await supabase.from('mancala_rooms').insert({
      room_code:    code,
      game_state:   gs,
      player_count: playerCount,
      host_id:      hostId,
    });

    if (err) {
      setError('ルームの作成に失敗しました。もう一度お試しください。');
      setPageState('menu');
      return;
    }

    setRoomCode(code);
    setMyWaitingPlayerId('player-1');
    setJoinedCount(1);
    setWaitingPlayerCount(playerCount);
    setPageState('waiting');
  }

  // ───── 全員参加を監視（ホスト・ゲスト共通） ─────
  useEffect(() => {
    if (pageState !== 'waiting' || !roomCode) return;

    // 初回チェック（再参加で既に揃っているケース）
    void supabase
      .from('mancala_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setJoinedCount(countJoined(data as RoomRow));
        if (isRoomReady(data as RoomRow)) {
          onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
        }
      });

    // リアルタイム監視
    const channel = supabase
      .channel(`room-wait-${roomCode}-${myWaitingPlayerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mancala_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const row = payload.new as RoomRow;
          setJoinedCount(countJoined(row));
          if (isRoomReady(row)) {
            onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [pageState, roomCode, myWaitingPlayerId, onGameStart]);

  // ───── ルームに参加する ─────
  async function handleJoin() {
    setError('');
    const code     = inputCode.trim().toUpperCase();
    const playerId = getOnlinePlayerId();

    if (code.length !== 6) {
      setError('6文字のルームコードを入力してください');
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from('mancala_rooms')
      .select('*')
      .eq('room_code', code)
      .single();

    if (fetchErr || !data) {
      setError('ルームが見つかりません。コードを確認してください');
      return;
    }

    const row = data as RoomRow;

    // ── 再参加チェック ──
    const rejoinMap: Array<{ field: string | null; pid: PlayerId }> = [
      { field: row.host_id,   pid: 'player-1' },
      { field: row.guest_id,  pid: 'player-2' },
      { field: row.guest2_id, pid: 'player-3' },
      { field: row.guest3_id, pid: 'player-4' },
    ];
    for (const { field, pid } of rejoinMap) {
      if (field === playerId) {
        setRoomCode(code);
        setMyWaitingPlayerId(pid);
        setWaitingPlayerCount(row.player_count);
        setJoinedCount(countJoined(row));
        if (isRoomReady(row)) {
          onGameStart({ roomCode: code, myPlayerId: pid });
        } else {
          setPageState('waiting');
        }
        return;
      }
    }

    // ── 新規参加：空きスロットを探す ──
    // 空きスロットがある場合は新規参加として処理（UUIDを登録）
    // 空きスロットがない場合のみ「再参加」として役割選択を表示
    let myPlayerId: PlayerId;
    let updatePayload: Record<string, string>;

    if (!row.guest_id) {
      myPlayerId    = 'player-2';
      updatePayload = { guest_id: playerId };
    } else if (!row.guest2_id && row.player_count >= 3) {
      myPlayerId    = 'player-3';
      updatePayload = { guest2_id: playerId };
    } else if (!row.guest3_id && row.player_count >= 4) {
      myPlayerId    = 'player-4';
      updatePayload = { guest3_id: playerId };
    } else {
      // 全スロット埋まり & UUID不一致 → ゲーム進行中なら役割選択で再参加
      if (row.game_state?.status === 'playing') {
        setSelectRoleCode(code);
        setSelectRoleCount(row.player_count);
        setPageState('select-role');
      } else {
        setError('このルームはすでに満員です。新しいルームを作成してください。');
      }
      return;
    }

    const { error: updateErr } = await supabase
      .from('mancala_rooms')
      .update(updatePayload)
      .eq('room_code', code);

    if (updateErr) {
      setError('参加に失敗しました。もう一度お試しください。');
      return;
    }

    const updatedRow = { ...row, ...updatePayload } as RoomRow;
    setRoomCode(code);
    setMyWaitingPlayerId(myPlayerId);
    setWaitingPlayerCount(row.player_count);
    setJoinedCount(countJoined(updatedRow));

    if (isRoomReady(updatedRow)) {
      onGameStart({ roomCode: code, myPlayerId });
    } else {
      setPageState('waiting');
    }
  }

  // ───── 役割選択画面（UUID不一致の再参加） ─────
  if (pageState === 'select-role') {
    const allRoles: Array<{ pid: PlayerId; label: string }> = [
      { pid: 'player-1', label: '🏠 ホスト（プレイヤー1）' },
      { pid: 'player-2', label: '🚪 ゲスト1（プレイヤー2）' },
      { pid: 'player-3', label: '🚪 ゲスト2（プレイヤー3）' },
      { pid: 'player-4', label: '🚪 ゲスト3（プレイヤー4）' },
    ];
    const roles = allRoles.slice(0, selectRoleCount);

    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
            再入室
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            ゲームが進行中のルーム <strong style={{ fontFamily: 'monospace', color: 'var(--brown)' }}>{selectRoleCode}</strong> が見つかりました。<br />
            あなたはどのプレイヤーでしたか？
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {roles.map(({ pid, label }) => (
              <Button key={pid} fullWidth onClick={() => onGameStart({ roomCode: selectRoleCode, myPlayerId: pid })}>
                {label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" fullWidth onClick={() => setPageState('menu')}>← キャンセル</Button>
        </div>
      </Layout>
    );
  }

  // ───── 待機画面 ─────
  if (pageState === 'waiting') {
    const isHost = myWaitingPlayerId === 'player-1';

    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {isHost ? '🏠' : '🚪'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            {isHost ? 'ルーム作成完了！' : 'ルームに参加しました'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {isHost ? '相手にこのコードを送ってください' : '残りのプレイヤーを待っています'}
          </p>

          {/* ルームコード */}
          <div style={{
            display: 'inline-block',
            fontSize: 34, fontWeight: 'bold', letterSpacing: 10,
            fontFamily: 'monospace', color: 'var(--brown)',
            background: '#fffbe8', border: '2px solid #e8c870',
            borderRadius: 18, padding: '18px 32px', marginBottom: 20,
          }}>
            {roomCode}
          </div>

          {/* 参加人数バッジ */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              {Array.from({ length: waitingPlayerCount }, (_, i) => (
                <div key={i} style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: i < joinedCount ? 'var(--brown)' : '#ddd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: '#fff',
                  transition: 'background 0.3s',
                }}>
                  {i < joinedCount ? '👤' : ''}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 'bold' }}>
              {joinedCount} / {waitingPlayerCount} 人参加済み
            </div>
          </div>

          <div className="cpu-thinking-pulse" style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
            全員の参加を待っています...
          </div>

          <Button variant="ghost" onClick={async () => {
            if (isHost) {
              await supabase.from('mancala_rooms').delete().eq('room_code', roomCode);
            }
            setPageState('menu');
            setRoomCode('');
            setJoinedCount(1);
          }}>
            {isHost ? 'キャンセル（ルーム削除）' : 'キャンセル'}
          </Button>
        </div>
      </Layout>
    );
  }

  // ───── メイン画面 ─────
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
          background: '#fffdf8', border: '1.5px solid var(--border)',
          borderRadius: 18, padding: '20px', marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            🏠 ルームを作る
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            人数を選んでルームコードを発行します
          </p>

          {/* プレイヤー数選択 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>人数：</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontWeight: 'bold',
                    fontSize: 15, cursor: 'pointer',
                    border: `2px solid ${playerCount === n ? '#c87028' : 'var(--border)'}`,
                    background: playerCount === n ? '#fff3e0' : '#faf8f5',
                    color: playerCount === n ? '#8a4010' : 'var(--text)',
                    transition: 'all 0.12s',
                  }}
                >
                  {n}人
                </button>
              ))}
            </div>
          </div>

          <Button fullWidth onClick={handleCreate} disabled={pageState === 'creating'}>
            {pageState === 'creating' ? '作成中...' : 'ルームを作る'}
          </Button>
        </div>

        {/* ルームに参加する */}
        <div style={{
          background: '#fffdf8', border: '1.5px solid var(--border)',
          borderRadius: 18, padding: '20px', marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            🚪 ルームに参加する
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            コードを入力（再参加にも使えます）
          </p>
          <input
            type="text"
            placeholder="例: ABC123"
            maxLength={6}
            value={inputCode}
            onChange={e => { setInputCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void handleJoin(); }}
            style={{
              width: '100%', padding: '12px 16px',
              fontSize: 22, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center',
              border: '2px solid var(--border)', borderRadius: 12, marginBottom: 12,
              boxSizing: 'border-box', background: '#fffdf8', color: 'var(--text)', outline: 'none',
            }}
          />
          <Button fullWidth variant="secondary" onClick={handleJoin}>
            参加する
          </Button>
        </div>

        {error && (
          <div style={{
            color: '#c0392b', background: '#fdf0ef', border: '1px solid #f5c6c0',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16,
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
