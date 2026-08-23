import { useEffect, useRef, useState } from 'react';
import { DEFAULT_ONLINE_ENTRY_MODE, shouldAutoJoinOnlineRoom } from '../../components/gameSetupDefaults';
import type { CpuLevel } from './babanukiTypes';
import { MAX_PLAYERS, MIN_PLAYERS } from './babanukiTypes';
import { CPU_LEVELS, getCpuLevelLabel } from './babanukiCpu';
import type { BabanukiRoomInfo, BabanukiRoomRow, OnlineSlot } from './babanukiOnline';
import {
  countHumans,
  createRoom,
  deleteRoom,
  getSavedOnlineName,
  isRoomReady,
  joinRoom,
  saveOnlineName,
  subscribeRoom,
} from './babanukiOnline';

type PageState = 'menu' | 'create' | 'joining' | 'waiting';

type Props = {
  initialMode?: 'create' | 'join';
  initialName?: string;
  initialCode?: string;
  onGameStart: (info: BabanukiRoomInfo) => void;
  onBack: () => void;
};

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

function defaultSlots(): OnlineSlot[] {
  return Array.from({ length: MAX_PLAYERS - 1 }, () => ({ isCpu: false, cpuLevel: 'normal' as CpuLevel }));
}

export function BabanukiOnlineRoomPage({ initialMode = DEFAULT_ONLINE_ENTRY_MODE, initialName = '', initialCode = '', onGameStart, onBack }: Props) {
  const shouldAutoJoin = shouldAutoJoinOnlineRoom(initialMode, initialCode);
  const autoJoinStartedRef = useRef(false);
  const [page, setPage] = useState<PageState>(shouldAutoJoin ? 'joining' : 'menu');
  const [entryMode, setEntryMode] = useState<'create' | 'join'>(initialMode);
  const [myName, setMyName] = useState(() => initialName || getSavedOnlineName());
  const [playerCount, setPlayerCount] = useState(4);
  const [slots, setSlots] = useState<OnlineSlot[]>(defaultSlots);
  const [inputCode, setInputCode] = useState(initialCode);
  const [roomCode, setRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('player-1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingInfo, setWaitingInfo] = useState<{ joined: number; total: number }>({ joined: 1, total: 1 });
  const [copyMessage, setCopyMessage] = useState('');

  // 待機中はルームを購読し、人間の席が全部埋まったら対局へ進む
  useEffect(() => {
    if (page !== 'waiting' || !roomCode) return;
    const handleRow = (row: BabanukiRoomRow) => {
      setWaitingInfo(countHumans(row));
      if (isRoomReady(row)) onGameStart({ roomCode, myPlayerId });
    };
    return subscribeRoom(roomCode, handleRow);
  }, [page, roomCode, myPlayerId, onGameStart]);

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      saveOnlineName(myName);
      const info = await createRoom(playerCount, myName, slots.slice(0, playerCount - 1));
      setRoomCode(info.roomCode);
      setMyPlayerId(info.myPlayerId);
      setPage('waiting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ルームを開けなかった');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('紋章は6文字だ');
      setPage('menu');
      return;
    }
    setPage('joining');
    setBusy(true);
    setError('');
    try {
      saveOnlineName(myName);
      const info = await joinRoom(code, myName);
      setRoomCode(info.roomCode);
      setMyPlayerId(info.myPlayerId);
      setPage('waiting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ルームに入れなかった');
      setPage('menu');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!shouldAutoJoin || autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    void handleJoin();
    // 初期コードを1回だけ処理し、Realtimeによる再描画では再参加しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyMessage('コピーした');
      setTimeout(() => setCopyMessage(''), 1600);
    } catch {
      setCopyMessage('コピーできなかった');
    }
  };

  const handleLeaveWaiting = () => {
    if (myPlayerId === 'player-1' && roomCode) void deleteRoom(roomCode);
    setPage('menu');
    setRoomCode('');
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid rgba(140,120,90,.4)', background: 'rgba(20,17,14,.9)', color: '#e0d3b8',
  } as const;

  const cpuCount = slots.slice(0, playerCount - 1).filter((s) => s.isCpu).length;

  if (page === 'joining') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, color: '#e0d3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cpu-thinking-pulse" style={{ fontSize: 18, fontWeight: 900, color: '#e6c877', marginBottom: 10 }}>
            ババ抜きルームへ参加しています...
          </div>
          <p style={{ fontSize: 13, color: '#b5a68c' }}>コードを確認しています。少しだけお待ちください。</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '14px 16px 32px', color: '#e0d3b8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          className="btn"
          onClick={page === 'menu' ? onBack : () => setPage('menu')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
        >
          ← ゲーム設定に戻る
        </button>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: '.2em', color: '#8a7a58' }}>BABANUKI ONLINE</span>
      </div>

      {error && (
        <div style={{ padding: '9px 12px', marginBottom: 12, borderRadius: 8, background: 'rgba(90,30,30,.5)', border: '1px solid rgba(200,90,90,.4)', fontSize: 12, color: '#f0c8c8' }}>
          {error}
        </div>
      )}

      {page === 'menu' && (
        <>
          <div className="game-setup-tabs" style={{ marginBottom: 16 }}>
            <button type="button" className={entryMode === 'create' ? 'is-selected' : ''} onClick={() => setEntryMode('create')}>ルームを作成</button>
            <button type="button" className={entryMode === 'join' ? 'is-selected' : ''} onClick={() => setEntryMode('join')}>コードで参加</button>
          </div>
          <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>あなたの名前</div>
          <input
            className="bg-dark-input"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="挑戦者の名（なくてもよい）"
            maxLength={10}
            style={{ ...inputStyle, marginBottom: 18 }}
          />

          {entryMode === 'create' ? (
            <button
              type="button"
              className="btn"
              onClick={() => setPage('create')}
              style={{ width: '100%', padding: '13px 0', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(200,140,240,.6)', background: 'linear-gradient(180deg,#5a3478,#3a2050)', color: '#f0dcff', fontSize: 16, fontWeight: 'bold' }}
            >
              対戦人数と席を設定する
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>コードで参加する</div>
              <input
                className="bg-dark-input"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="コードを入力"
                maxLength={6}
                style={{
                  ...inputStyle,
                  letterSpacing: inputCode ? '.3em' : 'normal',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={handleJoin}
                style={{ width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(201,162,75,.5)', background: 'rgba(60,44,30,.8)', color: '#e6c877', fontSize: 14 }}
              >
                参加する
              </button>
            </>
          )}
        </>
      )}

      {page === 'create' && (
        <>
          <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>人数（3〜6人）</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {PLAYER_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className="btn"
                onClick={() => setPlayerCount(count)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                  border: `1px solid ${playerCount === count ? '#b98ad6' : 'rgba(140,120,90,.4)'}`,
                  background: playerCount === count ? 'rgba(90,52,120,.55)' : 'rgba(30,26,22,.8)',
                  color: playerCount === count ? '#f0dcff' : '#c9b48f',
                }}
              >
                {count}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>
            席の割り当て（人が集まらない席はドラゴンで埋められます）
          </div>
          {slots.slice(0, playerCount - 1).map((slot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#9a8d75', width: 44 }}>{i + 2}人目</span>
              <button
                type="button"
                className="btn"
                onClick={() => setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, isCpu: !s.isCpu } : s)))}
                style={{
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  border: `1px solid ${slot.isCpu ? 'rgba(201,162,75,.5)' : '#b98ad6'}`,
                  background: slot.isCpu ? 'rgba(60,44,30,.8)' : 'rgba(90,52,120,.5)',
                  color: slot.isCpu ? '#e6c877' : '#f0dcff',
                  minWidth: 76,
                }}
              >
                {slot.isCpu ? '🐉 ドラゴン' : '👤 人'}
              </button>
              {slot.isCpu && (
                <select
                  value={slot.cpuLevel}
                  onChange={(e) =>
                    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, cpuLevel: e.target.value as CpuLevel } : s)))
                  }
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(20,17,14,.9)', color: '#e0d3b8' }}
                >
                  {CPU_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {getCpuLevelLabel(level)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <p style={{ fontSize: 11, color: '#7a6f5c', margin: '10px 0 16px' }}>
            人が {playerCount - cpuCount} 人、ドラゴンが {cpuCount} 体。
            人の席が全員そろうと自動で対局が始まります。
          </p>

          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={handleCreate}
            style={{ width: '100%', padding: '13px 0', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(200,140,240,.6)', background: 'linear-gradient(180deg,#5a3478,#3a2050)', color: '#f0dcff', fontSize: 16, fontWeight: 'bold' }}
          >
            {busy ? '開いています…' : 'このルームを開く'}
          </button>
        </>
      )}

      {page === 'waiting' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 8 }}>ルームの紋章</div>
          <div style={{ fontSize: 34, letterSpacing: '.35em', color: '#f0dcff', fontFamily: 'Cinzel,serif', marginBottom: 10 }}>
            {roomCode}
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleCopy}
            style={{ padding: '8px 16px', borderRadius: 8, marginBottom: 18, cursor: 'pointer', border: '1px solid rgba(201,162,75,.5)', background: 'rgba(60,44,30,.8)', color: '#e6c877', fontSize: 12 }}
          >
            {copyMessage || 'コードをコピー'}
          </button>

          <div style={{ fontSize: 14, color: '#e0d3b8', marginBottom: 6 }}>
            仲間を待っています… {waitingInfo.joined} / {waitingInfo.total} 人
          </div>
          <div className="cpu-thinking-pulse" style={{ fontSize: 28, marginBottom: 20 }}>🐉</div>

          <button
            type="button"
            className="btn"
            onClick={handleLeaveWaiting}
            style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 13 }}
          >
            {myPlayerId === 'player-1' ? 'ルームを閉じる' : '待機をやめる'}
          </button>
        </div>
      )}
    </div>
  );
}
