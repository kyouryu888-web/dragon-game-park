import { useState } from 'react';
import type { MancalaConfig } from './features/mancala/mancalaTypes';
import { HomePage } from './pages/HomePage';
import { MancalaSetupPage } from './features/mancala/MancalaSetupPage';
import { MancalaGamePage } from './features/mancala/MancalaGamePage';
import { MancalaRoomPage } from './features/mancala/MancalaRoomPage';
import type { OnlineRoomInfo } from './features/mancala/MancalaRoomPage';
import { MancalaOnlineGamePage } from './features/mancala/MancalaOnlineGamePage';
import type { UnoConfig } from './features/uno/unoTypes';
import { UnoSetupPage } from './features/uno/UnoSetupPage';
import { UnoGamePage } from './features/uno/UnoGamePage';

type AppScreen =
  | 'home'
  | 'mancala-setup'
  | 'mancala-game'
  | 'mancala-room'
  | 'mancala-online-game'
  | 'uno-setup'
  | 'uno-game';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [mancalaConfig, setMancalaConfig] = useState<MancalaConfig>({
    playerCount: 2,
    players: [
      { name: '', isCpu: false, cpuLevel: 'normal' },
      { name: '', isCpu: true,  cpuLevel: 'normal' },
    ],
  });
  const [unoConfig, setUnoConfig] = useState<UnoConfig>({
    variant: 'standard',
    playerConfigs: [
      { name: '', isCpu: false, cpuLevel: 'normal' },
      { name: '', isCpu: true, cpuLevel: 'normal' },
    ],
  });
  const [onlineRoomInfo, setOnlineRoomInfo] = useState<OnlineRoomInfo | null>(null);

  if (screen === 'home') {
    return (
      <HomePage
        onSelectGame={(gameId) => {
          if (gameId === 'mancala') setScreen('mancala-setup');
          if (gameId === 'uno') setScreen('uno-setup');
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
        onOnlinePlay={() => setScreen('mancala-room')}
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

  if (screen === 'mancala-room') {
    return (
      <MancalaRoomPage
        onGameStart={(info) => {
          setOnlineRoomInfo(info);
          setScreen('mancala-online-game');
        }}
        onBack={() => setScreen('mancala-setup')}
      />
    );
  }

  if (screen === 'mancala-online-game' && onlineRoomInfo) {
    return (
      <MancalaOnlineGamePage
        roomCode={onlineRoomInfo.roomCode}
        myPlayerId={onlineRoomInfo.myPlayerId}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  if (screen === 'uno-setup') {
    return (
      <UnoSetupPage
        onStart={(config) => {
          setUnoConfig(config);
          setScreen('uno-game');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'uno-game') {
    return (
      <UnoGamePage
        config={unoConfig}
        onBackToSetup={() => setScreen('uno-setup')}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  return null;
}
