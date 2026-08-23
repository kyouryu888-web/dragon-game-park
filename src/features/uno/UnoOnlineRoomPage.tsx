import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { DEFAULT_ONLINE_ENTRY_MODE, shouldAutoJoinOnlineRoom } from '../../components/gameSetupDefaults';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { getUnoCpuDisplayName, getUnoCpuLevelLabel } from './unoCpu';
import type { UnoCpuLevel, UnoGameState, UnoPlayerId, UnoVariant } from './unoTypes';
import {
  buildUnoCpuPrefill,
  countUnoJoined,
  createUnoOnlineInitialState,
  findOpenUnoSlot,
  findRejoinPlayerId,
  generateUnoRoomCode,
  getSavedUnoOnlineName,
  getUnoGuestFieldByPlayerIndex,
  getUnoOnlinePlayerId,
  isUnoRoomReady,
  renameUnoPlayer,
  saveUnoOnlineName,
  UNO_CPU_LEVELS,
  type UnoOnlinePlayerSlot,
  type UnoOnlineRoomInfo,
  type UnoRoomRow,
} from './unoOnline';

type PageState = 'menu' | 'creating' | 'joining' | 'waiting';

type UnoOnlineRoomPageProps = {
  initialMode?: 'create' | 'join';
  initialName?: string;
  initialCode?: string;
  onGameStart: (info: UnoOnlineRoomInfo) => void;
  onBack: () => void;
};

function defaultSlots(): UnoOnlinePlayerSlot[] {
  return Array.from({ length: 9 }, (_, index) => ({
    name: '',
    isCpu: false,
    cpuLevel: (index % 2 === 0 ? 'normal' : 'easy') as UnoCpuLevel,
  }));
}

export function UnoOnlineRoomPage({ initialMode = DEFAULT_ONLINE_ENTRY_MODE, initialName = '', initialCode = '', onGameStart, onBack }: UnoOnlineRoomPageProps) {
  const shouldAutoJoin = shouldAutoJoinOnlineRoom(initialMode, initialCode);
  const autoJoinStartedRef = useRef(false);
  const [pageState, setPageState] = useState<PageState>(shouldAutoJoin ? 'joining' : 'menu');
  const [entryMode, setEntryMode] = useState<'create' | 'join'>(initialMode);
  const [variant, setVariant] = useState<UnoVariant>('standard');
  const [playerCount, setPlayerCount] = useState(2);
  const [slots, setSlots] = useState<UnoOnlinePlayerSlot[]>(defaultSlots);
  const [myName, setMyName] = useState(() => initialName || getSavedUnoOnlineName());
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [joinedCount, setJoinedCount] = useState(1);
  const [waitingPlayerCount, setWaitingPlayerCount] = useState(2);
  const [myWaitingPlayerId, setMyWaitingPlayerId] = useState('player-1');
  const [copyMessage, setCopyMessage] = useState('');

  const maxPlayers = variant === 'hard' ? 6 : 10;
  const activeSlots = slots.slice(0, playerCount - 1);

  function updateVariant(nextVariant: UnoVariant) {
    setVariant(nextVariant);
    setPlayerCount((count) => Math.min(count, nextVariant === 'hard' ? 6 : 10));
  }

  function updateSlot(index: number, patch: Partial<UnoOnlinePlayerSlot>) {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function handleNameChange(name: string) {
    setMyName(name);
    saveUnoOnlineName(name);
  }

  async function copyRoomCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyMessage('コピーしました');
    } catch {
      setCopyMessage('コピーできませんでした。コードを選んでコピーしてください。');
    }
  }

  function findNameRejoinSlot(row: UnoRoomRow, currentState: UnoGameState | null, name: string): { playerId: UnoPlayerId; field: string } | null {
    const trimmed = name.trim();
    if (!trimmed || !currentState) return null;
    for (let index = 1; index < row.player_count; index++) {
      const field = getUnoGuestFieldByPlayerIndex(index);
      const player = currentState.players[index];
      const slotValue = field ? row[field] : null;
      if (!field || !player || player.isCpu || !slotValue || slotValue.startsWith('cpu-player-')) continue;
      if (player.name.trim() === trimmed) return { playerId: `player-${index + 1}`, field };
    }
    return null;
  }

  async function handleCreate() {
    setError('');
    setPageState('creating');

    const code = generateUnoRoomCode();
    const hostId = getUnoOnlinePlayerId();
    const hostName = myName.trim() || 'ルームの主';
    const gameState = createUnoOnlineInitialState(variant, playerCount, hostName, activeSlots);
    const cpuPrefill = buildUnoCpuPrefill(playerCount, activeSlots);

    const { data, error: insertError } = await supabase
      .from('uno_rooms')
      .insert({
        room_code: code,
        variant,
        player_count: playerCount,
        host_id: hostId,
        game_state: gameState,
        version: 0,
        ...cpuPrefill,
      })
      .select('*')
      .single();

    if (insertError || !data) {
      setError('ルームを開けなかった。時をおいて再び試されよ');
      setPageState('menu');
      return;
    }

    const row = data as UnoRoomRow;
    setRoomCode(code);
    setMyWaitingPlayerId('player-1');
    setJoinedCount(countUnoJoined(row));
    setWaitingPlayerCount(playerCount);

    if (isUnoRoomReady(row)) {
      onGameStart({ roomCode: code, myPlayerId: 'player-1' });
    } else {
      setPageState('waiting');
    }
  }

  async function handleJoin() {
    setError('');
    setPageState('joining');
    const code = inputCode.trim().toUpperCase();
    const playerId = getUnoOnlinePlayerId();

    if (code.length !== 6) {
      setError('6文字のルームコードを入力してください。');
      setPageState('menu');
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('uno_rooms')
      .select('*')
      .eq('room_code', code)
      .single();

    if (fetchError || !data) {
      setError('UNOルームが見つかりません。コードを確認してください。');
      setPageState('menu');
      return;
    }

    const row = data as UnoRoomRow;
    const currentState = row.game_state as UnoGameState | null;
    const rejoinPlayerId = findRejoinPlayerId(row, playerId);
    if (rejoinPlayerId) {
      setRoomCode(code);
      setMyWaitingPlayerId(rejoinPlayerId);
      setWaitingPlayerCount(row.player_count);
      setJoinedCount(countUnoJoined(row));
      if (isUnoRoomReady(row)) onGameStart({ roomCode: code, myPlayerId: rejoinPlayerId });
      else setPageState('waiting');
      return;
    }

    const nameRejoin = findNameRejoinSlot(row, currentState, myName);
    if (nameRejoin) {
      const { data: updated, error: updateError } = await supabase
        .from('uno_rooms')
        .update({ [nameRejoin.field]: playerId, version: row.version + 1 })
        .eq('room_code', code)
        .eq('version', row.version)
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        setError('再入室の途中で部屋の状態が変わりました。もう一度「参加する」を押してください。');
        setPageState('menu');
        return;
      }

      const updatedRow = updated as UnoRoomRow;
      setRoomCode(code);
      setMyWaitingPlayerId(nameRejoin.playerId);
      setWaitingPlayerCount(updatedRow.player_count);
      setJoinedCount(countUnoJoined(updatedRow));
      if (isUnoRoomReady(updatedRow)) onGameStart({ roomCode: code, myPlayerId: nameRejoin.playerId });
      else setPageState('waiting');
      return;
    }

    const openSlot = findOpenUnoSlot(row);
    if (!openSlot) {
      setError('このUNOルームは満員です。');
      setPageState('menu');
      return;
    }

    const guestName = myName.trim() || `挑戦者${openSlot.playerIndex + 1}`;
    const updatedState = currentState
      ? renameUnoPlayer(currentState, openSlot.playerIndex, guestName)
      : undefined;

    const updatePayload: Record<string, unknown> = {
      [openSlot.field]: playerId,
      version: row.version + 1,
    };
    if (updatedState) updatePayload.game_state = updatedState;

    const { data: updated, error: updateError } = await supabase
      .from('uno_rooms')
      .update(updatePayload)
      .eq('room_code', code)
      .is(openSlot.field, null)
      .select('*')
      .maybeSingle();

    if (updateError || !updated) {
      setError('扉は既に閉ざされていた。別のルームを探されよ');
      setPageState('menu');
      return;
    }

    const updatedRow = updated as UnoRoomRow;
    const myPlayerId = `player-${openSlot.playerIndex + 1}`;
    setRoomCode(code);
    setMyWaitingPlayerId(myPlayerId);
    setWaitingPlayerCount(updatedRow.player_count);
    setJoinedCount(countUnoJoined(updatedRow));

    if (isUnoRoomReady(updatedRow)) {
      onGameStart({ roomCode: code, myPlayerId });
    } else {
      setPageState('waiting');
    }
  }

  useEffect(() => {
    if (!shouldAutoJoin || autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    void handleJoin();
    // 初期コードを1回だけ処理し、Realtimeによる再描画では再参加しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pageState !== 'waiting' || !roomCode) return;
    let cancelled = false;

    void supabase
      .from('uno_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as UnoRoomRow;
        setJoinedCount(countUnoJoined(row));
        if (isUnoRoomReady(row)) onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
      });

    const channel = supabase
      .channel(`uno-room-wait-${roomCode}-${myWaitingPlayerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'uno_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as UnoRoomRow;
          setJoinedCount(countUnoJoined(row));
          if (isUnoRoomReady(row)) onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [pageState, roomCode, myWaitingPlayerId, onGameStart]);

  const cpuCount = useMemo(() => activeSlots.filter((slot) => slot.isCpu).length, [activeSlots]);

  if (pageState === 'joining') {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '72px 20px' }}>
          <div className="cpu-thinking-pulse" style={{ fontSize: 18, fontWeight: 900, color: 'var(--brown)', marginBottom: 10 }}>
            UNOルームへ参加しています...
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>コードを確認しています。少しだけお待ちください。</p>
        </div>
      </Layout>
    );
  }

  if (pageState === 'waiting') {
    const isHost = myWaitingPlayerId === 'player-1';
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>龍</div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
            UNOルーム作成完了
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            相手にこのコードを送ってください。
          </p>
          <div style={{
            display: 'inline-grid',
            gap: 10,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: 10,
            fontFamily: 'monospace',
            color: 'var(--brown)',
            background: 'rgba(201,162,75,.12)',
            border: '2px solid #e8c870',
            borderRadius: 18,
            padding: '18px 32px',
            marginBottom: 20,
          }}>
            <span>{roomCode}</span>
            <button
              type="button"
              onClick={copyRoomCode}
              style={{
                minHeight: 38,
                borderRadius: 12,
                border: '1.5px solid #b88932',
                background: '#fffdf8',
                color: 'var(--brown)',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 0,
                cursor: 'pointer',
              }}
            >
              コードをコピー
            </button>
          </div>
          {copyMessage && (
            <div style={{ fontSize: 12, color: 'var(--brown)', fontWeight: 900, marginTop: -10, marginBottom: 14 }}>
              {copyMessage}
            </div>
          )}
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 900, marginBottom: 20 }}>
            {joinedCount} / {waitingPlayerCount} 人参加済み
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              if (isHost) await supabase.from('uno_rooms').delete().eq('room_code', roomCode);
              setRoomCode('');
              setPageState('menu');
            }}
          >
            キャンセル
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ paddingTop: 16, paddingBottom: 40 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--brown)', textAlign: 'center', marginBottom: 20 }}>
          III. UNOのルーム設定
        </h1>

        <div className="game-setup-tabs" style={{ marginBottom: 14 }}>
          <button type="button" className={entryMode === 'create' ? 'is-selected' : ''} onClick={() => setEntryMode('create')}>ルームを作成</button>
          <button type="button" className={entryMode === 'join' ? 'is-selected' : ''} onClick={() => setEntryMode('join')}>コードで参加</button>
        </div>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>名を刻む（なくてもよい）</h2>
          <input
            type="text"
            value={myName}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="挑戦者の名（なくてもよい）"
            maxLength={12}
            style={inputStyle}
          />
        </section>

        {entryMode === 'create' ? <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>ルームを作る</h2>
          <div className="mode-cards" style={{ marginBottom: 14 }}>
            <ModeButton selected={variant === 'standard'} title="通常版" text="2〜10人" onClick={() => updateVariant('standard')} />
            <ModeButton selected={variant === 'hard'} title="ハード版" text="2〜6人" danger onClick={() => updateVariant('hard')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
            {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                style={{
                  padding: '8px 0',
                  borderRadius: 10,
                  border: `2px solid ${playerCount === count ? '#c9a24b' : 'var(--border)'}`,
                  background: playerCount === count ? 'rgba(201,162,75,.12)' : '#191320',
                  color: playerCount === count ? '#f0dfae' : 'var(--text-mid)',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {count}人
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
            CPU {cpuCount}体 / 人間 {playerCount - cpuCount}人
          </p>

          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {activeSlots.map((slot, index) => (
              <OnlineSlotRow key={index} index={index} slot={slot} onChange={(patch) => updateSlot(index, patch)} />
            ))}
          </div>

          <Button fullWidth onClick={handleCreate} disabled={pageState === 'creating'}>
            {pageState === 'creating' ? '作成中...' : 'ルームを作る'}
          </Button>
        </section> : null}

        {entryMode === 'join' ? <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>ルームに参加</h2>
          <input
            type="text"
            placeholder="コードを入力"
            maxLength={6}
            value={inputCode}
            onChange={(event) => {
              setInputCode(event.target.value.toUpperCase());
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleJoin();
            }}
            style={{ ...inputStyle, fontSize: 22, letterSpacing: inputCode ? 8 : 0, textAlign: 'center', fontFamily: inputCode ? 'monospace' : 'inherit' }}
          />
          <div style={{ marginTop: 12 }}>
            <Button fullWidth variant="secondary" onClick={handleJoin}>
              参加する
            </Button>
          </div>
        </section> : null}

        {error && (
          <div style={{
            color: '#c0392b',
            background: 'rgba(224,115,58,.12)',
            border: '1px solid rgba(224,115,58,.35)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={onBack}>
          ゲーム設定に戻る
        </Button>
      </div>
    </Layout>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#1d1723',
  border: '1.5px solid var(--border)',
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: 'var(--brown)',
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: '#191320',
  color: 'var(--text)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function ModeButton({
  selected,
  title,
  text,
  danger = false,
  onClick,
}: {
  selected: boolean;
  title: string;
  text: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 14,
        border: `2px solid ${selected ? (danger ? '#c83b32' : '#c9a24b') : 'var(--border)'}`,
        background: selected ? (danger ? '#321316' : 'rgba(201,162,75,.12)') : '#191320',
        color: selected && danger ? 'rgba(201,162,75,.12)' : 'var(--text)',
        padding: '12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12, color: selected && danger ? 'rgba(224,115,58,.2)' : 'var(--text-muted)' }}>{text}</div>
    </button>
  );
}

function OnlineSlotRow({
  index,
  slot,
  onChange,
}: {
  index: number;
  slot: UnoOnlinePlayerSlot;
  onChange: (patch: Partial<UnoOnlinePlayerSlot>) => void;
}) {
  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${slot.isCpu ? '#8a6f3a' : 'var(--border)'}`,
      background: slot.isCpu ? 'rgba(138,111,58,.14)' : '#191320',
      padding: 10,
      display: 'grid',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>プレイヤー{index + 2}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => onChange({ isCpu: false })} style={roleButtonStyle(!slot.isCpu)}>人間</button>
          <button type="button" onClick={() => onChange({ isCpu: true })} style={roleButtonStyle(slot.isCpu)}>CPU</button>
        </div>
      </div>
      {slot.isCpu ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {UNO_CPU_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onChange({ cpuLevel: level, name: getUnoCpuDisplayName(level) })}
              style={{
                padding: '4px 7px',
                borderRadius: 8,
                border: `1.5px solid ${slot.cpuLevel === level ? '#8a6f3a' : 'var(--border)'}`,
                background: slot.cpuLevel === level ? 'rgba(138,111,58,.14)' : 'transparent',
                color: slot.cpuLevel === level ? '#1f641f' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {getUnoCpuLevelLabel(level)}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={slot.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={`挑戦者${index + 2}`}
          maxLength={12}
          style={inputStyle}
        />
      )}
    </div>
  );
}

function roleButtonStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: 9,
    border: `1.5px solid ${selected ? '#c9a24b' : 'var(--border)'}`,
    background: selected ? 'rgba(201,162,75,.12)' : 'transparent',
    color: selected ? '#7a3a10' : 'var(--text-muted)',
    fontWeight: 900,
    cursor: 'pointer',
  };
}
