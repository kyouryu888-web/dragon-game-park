import { useState } from 'react';
import type { MancalaConfig } from './features/mancala/mancalaTypes';
import { HomePage } from './pages/HomePage';
import { MancalaSetupPage } from './features/mancala/MancalaSetupPage';
import { MancalaGamePage } from './features/mancala/MancalaGamePage';

/**
 * アプリ全体の画面状態
 * 'home'          → ゲーム選択画面
 * 'mancala-setup' → マンカラ設定画面
 * 'mancala-game'  → マンカラ対局画面
 */
type AppScreen = 'home' | 'mancala-setup' | 'mancala-game';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [mancalaConfig, setMancalaConfig] = useState<MancalaConfig>({
    playerCount: 2,
    players: [
      { name: '', isCpu: false, cpuLevel: 'normal' },
      { name: '', isCpu: true,  cpuLevel: 'normal' },
    ],
  });

  if (screen === 'home') {
    return (
      <HomePage
        onSelectGame={(gameId) => {
          if (gameId === 'mancala') setScreen('mancala-setup');
        }}
      />
    );
  }

  if (screen === 'mancala-setup') {
    return (
      <MancalaSetupPage
        onStart={(config) => {
          setMancalaConfig(config);
          setScreen('mancala-game');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'mancala-game') {
    return (
      <MancalaGamePage
        config={mancalaConfig}
        onBackToSetup={() => setScreen('mancala-setup')}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  return null;
}
