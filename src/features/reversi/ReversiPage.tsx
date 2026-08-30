import { useEffect, useState } from 'react';
import { ReversiGameScreen } from './ReversiGameScreen';
import { ReversiSettingsScreen } from './ReversiSettingsScreen';
import type { ReversiConfig } from './reversiTypes';

const STORAGE_KEY = 'dragon-game-park:reversi-config-v1';
const DEFAULT_CONFIG: ReversiConfig = {
  mode: 'cpu',
  name: '',
  name2: '',
  cpuLevel: 'normal',
  humanSide: 'black',
};

function loadConfig(): ReversiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ReversiConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function ReversiPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [screen, setScreen] = useState<'settings' | 'play'>('settings');
  const [config, setConfig] = useState<ReversiConfig>(loadConfig);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [screen]);

  function updateConfig(patch: Partial<ReversiConfig>) {
    setConfig((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }

  if (screen === 'play') {
    return (
      <ReversiGameScreen
        config={config}
        onBackToSetup={() => setScreen('settings')}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <ReversiSettingsScreen
      config={config}
      onChange={updateConfig}
      onStart={() => setScreen('play')}
      onBackToHome={onBackToHome}
    />
  );
}
