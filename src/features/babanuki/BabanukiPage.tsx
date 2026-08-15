import { useCallback, useState } from 'react';
import type { BabanukiConfig } from './babanukiTypes';
import { MAX_PLAYERS, MIN_PLAYERS } from './babanukiTypes';
import { BabanukiSettingsScreen } from './BabanukiSettingsScreen';
import { BabanukiPlayScreen } from './BabanukiPlayScreen';
import { BabanukiOnlineRoomPage } from './BabanukiOnlineRoomPage';
import { BabanukiOnlineGame } from './BabanukiOnlineGame';
import type { BabanukiRoomInfo } from './babanukiOnline';

const CONFIG_KEY = 'dragon-game-park:babanuki-config-v1';

const DEFAULT_CONFIG: BabanukiConfig = {
  playerCount: 4,
  players: [
    { name: '', isCpu: false, cpuLevel: 'normal' },
    { name: '', isCpu: true, cpuLevel: 'normal' },
    { name: '', isCpu: true, cpuLevel: 'normal' },
    { name: '', isCpu: true, cpuLevel: 'normal' },
  ],
};

function loadSavedConfig(): BabanukiConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BabanukiConfig;
    if (
      typeof parsed?.playerCount !== 'number' ||
      parsed.playerCount < MIN_PLAYERS ||
      parsed.playerCount > MAX_PLAYERS ||
      !Array.isArray(parsed.players)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveConfig(config: BabanukiConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // 保存できなくても対戦は続けられるので無視する
  }
}

type Screen = 'settings' | 'play' | 'room' | 'online-play';

type Props = {
  onBackToHome: () => void;
};

export function BabanukiPage({ onBackToHome }: Props) {
  const [screen, setScreen] = useState<Screen>('settings');
  const [config, setConfig] = useState<BabanukiConfig>(() => loadSavedConfig() ?? DEFAULT_CONFIG);
  const [roomInfo, setRoomInfo] = useState<BabanukiRoomInfo | null>(null);

  const updateConfig = (next: BabanukiConfig) => {
    setConfig(next);
    saveConfig(next);
  };

  const handleGameStart = useCallback((info: BabanukiRoomInfo) => {
    setRoomInfo(info);
    setScreen('online-play');
  }, []);

  if (screen === 'room') {
    return <BabanukiOnlineRoomPage onGameStart={handleGameStart} onBack={() => setScreen('settings')} />;
  }

  if (screen === 'online-play' && roomInfo) {
    return (
      <BabanukiOnlineGame
        room={roomInfo}
        onBackToRoom={() => setScreen('room')}
        onBackToHome={onBackToHome}
      />
    );
  }

  if (screen === 'play') {
    return (
      <BabanukiPlayScreen
        config={config}
        onBackToSetup={() => setScreen('settings')}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <BabanukiSettingsScreen
      config={config}
      onChange={updateConfig}
      onStart={() => setScreen('play')}
      onOnlinePlay={() => setScreen('room')}
      onBack={onBackToHome}
    />
  );
}
