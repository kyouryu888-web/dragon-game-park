import { lazy, Suspense, useState } from 'react';
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
import { UnoOnlineRoomPage } from './features/uno/UnoOnlineRoomPage';
import { UnoOnlineGamePage } from './features/uno/UnoOnlineGamePage';
import type { UnoOnlineRoomInfo } from './features/uno/unoOnline';
import { BackgammonPage } from './features/backgammon/BackgammonPage';

const EnglishQuestPage = lazy(() =>
  import('./features/englishQuest/EnglishQuestPage').then((module) => ({ default: module.EnglishQuestPage })),
);

type AppScreen =
  | 'home'
  | 'mancala-setup'
  | 'mancala-game'
  | 'mancala-room'
  | 'mancala-online-game'
  | 'uno-setup'
  | 'uno-game'
  | 'uno-room'
  | 'uno-online-game'
  | 'backgammon'
  | 'english-quest';

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
  const [unoOnlineRoomInfo, setUnoOnlineRoomInfo] = useState<UnoOnlineRoomInfo | null>(null);

  if (screen === 'home') {
    return (
      <HomePage
        onSelectGame={(gameId) => {
          if (gameId === 'mancala') setScreen('mancala-setup');
          if (gameId === 'uno') setScreen('uno-room');
          if (gameId === 'backgammon') setScreen('backgammon');
          if (gameId === 'english-quest') setScreen('english-quest');
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

  if (screen === 'backgammon') {
    return <BackgammonPage onBackToHome={() => setScreen('home')} />;
  }

  if (screen === 'english-quest') {
    return (
      <Suspense fallback={(
        <main
          role="status"
          aria-live="polite"
          style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#ffe7a0', background: '#160f1c', fontWeight: 700 }}
        >
          🐉 英語の島を準備中…
        </main>
      )}>
        <EnglishQuestPage onBackToHome={() => setScreen('home')} />
      </Suspense>
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
        onOnlinePlay={() => setScreen('uno-room')}
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

  if (screen === 'uno-room') {
    return (
      <UnoOnlineRoomPage
        onGameStart={(info) => {
          setUnoOnlineRoomInfo(info);
          setScreen('uno-online-game');
        }}
        onBack={() => setScreen('uno-setup')}
      />
    );
  }

  if (screen === 'uno-online-game' && unoOnlineRoomInfo) {
    return (
      <UnoOnlineGamePage
        roomCode={unoOnlineRoomInfo.roomCode}
        myPlayerId={unoOnlineRoomInfo.myPlayerId}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  return null;
}
