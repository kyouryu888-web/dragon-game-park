import { useEffect, useState } from 'react';
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from '../../components/gameSetupDefaults';
import { ReversiGameScreen } from './ReversiGameScreen';
import { ReversiOnlineGame } from './ReversiOnlineGame';
import {
  createReversiRoom,
  deleteReversiRoom,
  isReversiRoomReady,
  joinReversiRoom,
  subscribeReversiRoom,
  type ReversiRoomInfo,
  type ReversiRoomRow,
} from './reversiOnline';
import { ReversiSettingsScreen } from './ReversiSettingsScreen';
import { ReversiWaitingScreen } from './ReversiWaitingScreen';
import type { ReversiConfig } from './reversiTypes';

const STORAGE_KEY = 'dragon-game-park:reversi-config-v2';
const DEFAULT_CONFIG: ReversiConfig = {
  mode: DEFAULT_SETUP_MODE,
  name: '',
  name2: '',
  cpuLevel: 'normal',
  humanSide: 'black',
};

type Screen = 'settings' | 'play' | 'waiting' | 'online-play';

function loadConfig(): ReversiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ReversiConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, mode: DEFAULT_SETUP_MODE };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function ReversiPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [screen, setScreen] = useState<Screen>('settings');
  const [config, setConfig] = useState<ReversiConfig>(loadConfig);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<ReversiRoomInfo | null>(null);
  const [roomRow, setRoomRow] = useState<ReversiRoomRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [screen]);

  useEffect(() => {
    if (screen !== 'waiting' || !room?.isHost) return;
    const unsubscribe = subscribeReversiRoom(room.roomCode, (incoming) => {
      setRoomRow((current) => !current || incoming.version > current.version ? incoming : current);
      if (isReversiRoomReady(incoming)) {
        setRoomRow(incoming);
        setScreen('online-play');
        setMessage(`${incoming.guest_name ?? '挑戦者'}が盤の前に現れました`);
      }
    });
    return unsubscribe;
  }, [room, screen]);

  function updateConfig(patch: Partial<ReversiConfig>) {
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
        const session = await createReversiRoom(config.name);
        setRoom(session.room);
        setRoomRow(session.row);
        setCopied(false);
        setScreen('waiting');
      } else {
        if (joinCode.length !== 6) throw new Error('コードは6文字で入力してください');
        const session = await joinReversiRoom(joinCode, config.name);
        setRoom(session.room);
        setRoomRow(session.row);
        if (session.room.isHost && !isReversiRoomReady(session.row)) {
          setScreen('waiting');
          setMessage('作成したルームへ戻りました');
        } else {
          setScreen('online-play');
          setMessage('ルームへ参加しました');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'オンライン対戦を開始できませんでした');
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
    if (room?.isHost) void deleteReversiRoom(room.roomCode);
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
      <ReversiGameScreen
        config={config}
        onBackToSetup={backToSettings}
        onBackToHome={onBackToHome}
      />
    );
  }

  if (screen === 'waiting' && room) {
    return (
      <ReversiWaitingScreen
        roomCode={room.roomCode}
        copied={copied}
        onCopy={copyRoomCode}
        onCancel={closeWaitingRoom}
      />
    );
  }

  if (screen === 'online-play' && room && roomRow) {
    return (
      <ReversiOnlineGame
        room={room}
        initialRow={roomRow}
        onBackToSetup={backToSettings}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <>
      <ReversiSettingsScreen
        config={config}
        onChange={updateConfig}
        onlineTab={onlineTab}
        onOnlineTabChange={setOnlineTab}
        joinCode={joinCode}
        onJoinCodeChange={(code) => setJoinCode(code.slice(0, 6))}
        onStart={() => { void handleStart(); }}
        onBackToHome={onBackToHome}
      />
      {busy ? <div className="reversi-online-toast" role="status">ルームを確認しています…</div> : null}
      {!busy && message ? <div className="reversi-online-toast is-error" role="alert">{message}</div> : null}
    </>
  );
}
