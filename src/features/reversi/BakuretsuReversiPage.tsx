import { useEffect, useState } from 'react';
import { DEFAULT_ONLINE_ENTRY_MODE } from '../../components/gameSetupDefaults';
import { BakuretsuReversiGameScreen } from './BakuretsuReversiGameScreen';
import { BakuretsuReversiOnlineGame } from './BakuretsuReversiOnlineGame';
import { BakuretsuReversiSettingsScreen } from './BakuretsuReversiSettingsScreen';
import { BakuretsuReversiWaitingScreen } from './BakuretsuReversiWaitingScreen';
import {
  createBakuretsuReversiRoom,
  deleteBakuretsuReversiRoom,
  isBakuretsuReversiRoomReady,
  joinBakuretsuReversiRoom,
  subscribeBakuretsuReversiRoom,
  type BakuretsuReversiRoomInfo,
  type BakuretsuReversiRoomRow,
} from './bakuretsuReversiOnline';
import {
  DEFAULT_BAKURETSU_REVERSI_CONFIG,
  type BakuretsuReversiConfig,
} from './bakuretsuUi';

const STORAGE_KEY = 'dragon-game-park:bakuretsu-reversi-config-v1';
type Screen = 'settings' | 'play' | 'waiting' | 'online-play';

function loadConfig(): BakuretsuReversiConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<BakuretsuReversiConfig>;
    return {
      ...DEFAULT_BAKURETSU_REVERSI_CONFIG,
      ...parsed,
      playbackSpeed: {
        ...DEFAULT_BAKURETSU_REVERSI_CONFIG.playbackSpeed,
        ...parsed.playbackSpeed,
      },
    };
  } catch {
    return DEFAULT_BAKURETSU_REVERSI_CONFIG;
  }
}

export function BakuretsuReversiPage({
  onBackToVariant,
  onBackToHome,
}: {
  onBackToVariant: () => void;
  onBackToHome: () => void;
}) {
  const [screen, setScreen] = useState<Screen>('settings');
  const [config, setConfig] = useState<BakuretsuReversiConfig>(loadConfig);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<BakuretsuReversiRoomInfo | null>(null);
  const [roomRow, setRoomRow] = useState<BakuretsuReversiRoomRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [screen]);

  useEffect(() => {
    if (screen !== 'waiting' || !room?.isHost) return;
    const unsubscribe = subscribeBakuretsuReversiRoom(room.roomCode, room.myOnlineId, (incoming) => {
      setRoomRow((current) => !current || incoming.version > current.version ? incoming : current);
      if (isBakuretsuReversiRoomReady(incoming)) {
        setRoomRow(incoming);
        setScreen('online-play');
        setMessage(`${incoming.guest_name ?? '挑戦者'}が爆裂盤の前に現れました`);
      }
    });
    return unsubscribe;
  }, [room, screen]);

  function updateConfig(patch: Partial<BakuretsuReversiConfig>) {
    setConfig((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }

  async function handleStart() {
    if (config.mode !== 'online') {
      setScreen('play');
      setMessage('');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      if (onlineTab === 'create') {
        const session = await createBakuretsuReversiRoom(config.name);
        setRoom(session.room);
        setRoomRow(session.row);
        setCopied(false);
        setScreen('waiting');
      } else {
        if (joinCode.length !== 6) throw new Error('コードは6文字で入力してください');
        const session = await joinBakuretsuReversiRoom(joinCode, config.name);
        setRoom(session.room);
        setRoomRow(session.row);
        if (session.room.isHost && !isBakuretsuReversiRoomReady(session.row)) {
          setScreen('waiting');
          setMessage('作成した爆裂ルームへ戻りました');
        } else {
          setScreen('online-play');
          setMessage('爆裂ルームへ参加しました');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'オンライン爆裂対戦を開始できませんでした');
      setScreen('settings');
    } finally {
      setBusy(false);
    }
  }

  function backToSettings() {
    setScreen('settings');
    setRoom(null);
    setRoomRow(null);
    setBusy(false);
  }

  function closeWaitingRoom() {
    if (room?.isHost) void deleteBakuretsuReversiRoom(room.roomCode, room.myOnlineId);
    backToSettings();
  }

  function copyRoomCode() {
    if (!room) return;
    void navigator.clipboard.writeText(room.roomCode)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setMessage('コードをコピーできませんでした'));
  }

  if (screen === 'play') {
    return (
      <BakuretsuReversiGameScreen
        config={config}
        onBackToSetup={backToSettings}
        onBackToHome={onBackToHome}
      />
    );
  }

  if (screen === 'waiting' && room) {
    return (
      <BakuretsuReversiWaitingScreen
        roomCode={room.roomCode}
        copied={copied}
        onCopy={copyRoomCode}
        onCancel={closeWaitingRoom}
      />
    );
  }

  if (screen === 'online-play' && room && roomRow) {
    return (
      <BakuretsuReversiOnlineGame
        room={room}
        initialRow={roomRow}
        playbackSpeed={config.playbackSpeed}
        onBackToSetup={backToSettings}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <>
      <BakuretsuReversiSettingsScreen
        config={config}
        onChange={updateConfig}
        onlineTab={onlineTab}
        onOnlineTabChange={setOnlineTab}
        joinCode={joinCode}
        onJoinCodeChange={(code) => setJoinCode(code.slice(0, 6))}
        onStart={() => { void handleStart(); }}
        onBack={onBackToVariant}
      />
      {busy ? <div className="reversi-online-toast" role="status">爆裂ルームを確認しています…</div> : null}
      {!busy && message ? <div className="reversi-online-toast is-error" role="alert">{message}</div> : null}
    </>
  );
}
