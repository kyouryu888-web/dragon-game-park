import { lazy, Suspense, useEffect, useState } from 'react';
import type { MancalaConfig } from './features/mancala/mancalaTypes';
import { HomePage } from './pages/HomePage';
import { MancalaSetupPage, type MancalaOnlineEntry } from './features/mancala/MancalaSetupPage';
import { MancalaGamePage } from './features/mancala/MancalaGamePage';
import { MancalaRoomPage } from './features/mancala/MancalaRoomPage';
import type { OnlineRoomInfo } from './features/mancala/MancalaRoomPage';
import { MancalaOnlineGamePage } from './features/mancala/MancalaOnlineGamePage';
import type { UnoConfig } from './features/uno/unoTypes';
import { UnoSetupPage, type UnoOnlineEntry } from './features/uno/UnoSetupPage';
import { UnoGamePage } from './features/uno/UnoGamePage';
import { UnoOnlineRoomPage } from './features/uno/UnoOnlineRoomPage';
import { UnoOnlineGamePage } from './features/uno/UnoOnlineGamePage';
import type { UnoOnlineRoomInfo } from './features/uno/unoOnline';
import { BackgammonPage } from './features/backgammon/BackgammonPage';
import { BabanukiPage } from './features/babanuki/BabanukiPage';
import { DEFAULT_ONLINE_ENTRY_MODE } from './components/gameSetupDefaults';

const ReversiPage = lazy(() => import('./features/reversi/ReversiPage').then((module) => ({
  default: module.ReversiPage,
})));

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
  | 'babanuki'
  | 'reversi';

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
  const [mancalaOnlineEntry, setMancalaOnlineEntry] = useState<MancalaOnlineEntry>({ mode: DEFAULT_ONLINE_ENTRY_MODE, name: '', code: '' });
  const [unoOnlineRoomInfo, setUnoOnlineRoomInfo] = useState<UnoOnlineRoomInfo | null>(null);
  const [unoOnlineEntry, setUnoOnlineEntry] = useState<UnoOnlineEntry>({ mode: DEFAULT_ONLINE_ENTRY_MODE, name: '', code: '' });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [screen]);

  if (screen === 'home') {
    return (
      <HomePage
        onSelectGame={(gameId) => {
          if (gameId === 'mancala') setScreen('mancala-setup');
          if (gameId === 'uno') setScreen('uno-setup');
          if (gameId === 'backgammon') setScreen('backgammon');
          if (gameId === 'babanuki') setScreen('babanuki');
          if (gameId === 'reversi') setScreen('reversi');
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
        onOnlinePlay={(entry) => {
          setMancalaOnlineEntry(entry);
          setScreen('mancala-room');
        }}
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
        initialMode={mancalaOnlineEntry.mode}
        initialName={mancalaOnlineEntry.name}
        initialCode={mancalaOnlineEntry.code}
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
        onBackToSetup={() => setScreen('mancala-setup')}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  if (screen === 'backgammon') {
    return <BackgammonPage onBackToHome={() => setScreen('home')} />;
  }

  if (screen === 'babanuki') {
    return <BabanukiPage onBackToHome={() => setScreen('home')} />;
  }

  if (screen === 'reversi') {
    return (
      <Suspense fallback={<div className="feature-loading">竜陣を開いています…</div>}>
        <ReversiPage onBackToHome={() => setScreen('home')} />
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
        onOnlinePlay={(entry) => {
          setUnoOnlineEntry(entry);
          setScreen('uno-room');
        }}
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
        initialMode={unoOnlineEntry.mode}
        initialName={unoOnlineEntry.name}
        initialCode={unoOnlineEntry.code}
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
        onBackToSetup={() => setScreen('uno-setup')}
        onBackToHome={() => setScreen('home')}
      />
    );
  }

  return null;
}
