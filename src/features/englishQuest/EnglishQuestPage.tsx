import { useEffect, useState } from 'react';
import { ENGLISH_QUEST_ITEMS } from './englishQuestContent';
import {
  applyAttempt,
  completeQuest,
  completeDiagnostic,
  composeSession,
  diagnosticItems,
} from './englishQuestEngine';
import { clearProgress, loadProgress, saveProgress } from './englishQuestStorage';
import type { Attempt, LearningItem, LearningMode, PlayerProgress } from './englishQuestTypes';
import { DragonSprite } from './EnglishQuestSprites';
import { LearningSession } from './LearningSession';
import { ParentDashboard } from './ParentDashboard';
import { PronunciationRecorder } from './PronunciationRecorder';
import { QuestMap } from './QuestMap';
import './englishQuest.css';

type Screen = 'welcome' | 'diagnostic' | 'map' | 'session' | 'parent' | 'record';

function itemsForMode(mode: LearningMode): LearningItem[] {
  if (mode === 'capture') return ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'sound' || item.type === 'word');
  if (mode === 'arena') return ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'word' || item.type === 'chunk');
  if (mode === 'merge') return ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'word' || item.type === 'chunk');
  if (mode === 'escape') return ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'dialogue' || item.type === 'reading');
  return ENGLISH_QUEST_ITEMS;
}

export function EnglishQuestPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>(() => (loadProgress().diagnosticComplete ? 'map' : 'welcome'));
  const [sessionMode, setSessionMode] = useState<LearningMode>('capture');
  const [sessionItems, setSessionItems] = useState<LearningItem[]>([]);
  const [sessionAdvancesStory, setSessionAdvancesStory] = useState(false);

  useEffect(() => saveProgress(progress), [progress]);

  const startSession = (mode: LearningMode, advancesStory = false) => {
    setSessionMode(mode);
    setSessionItems(composeSession(progress, new Date(), 10, itemsForMode(mode)));
    setSessionAdvancesStory(advancesStory);
    setScreen('session');
  };

  const recordAttempt = (attempt: Attempt) => {
    setProgress((current) => applyAttempt(current, attempt));
  };

  if (screen === 'welcome') {
    return (
      <main className="eq-shell eq-welcome-shell">
        <button className="eq-round-button eq-welcome-back" type="button" onClick={onBackToHome} aria-label="ゲーム広場へ戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <div className="eq-welcome-sky" aria-hidden="true"><i /><i /><i /></div>
        <section className="eq-welcome-content">
          <DragonSprite pose={1} className="eq-welcome-dragon" />
          <h1>イングリッシュ ラーニング<br />オデッセイ</h1>
          <p>英語の音を見つけて、ドラゴンといっしょに<br />「はじまりの森」を取りもどそう。</p>
          <button
            className="eq-primary-button eq-welcome-start"
            type="button"
            onClick={() => {
              setSessionMode('diagnostic');
              setSessionItems(diagnosticItems());
              setScreen('diagnostic');
            }}
          >
            はじめての音さがし
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <small>約3分・点数はつきません</small>
        </section>
        <footer className="eq-welcome-privacy">
          <span>広告なし</span><span>ログインなし</span><span>学習データはこの端末だけ</span>
        </footer>
      </main>
    );
  }

  if (screen === 'diagnostic') {
    return (
      <LearningSession
        items={sessionItems}
        mode="diagnostic"
        soundOn={progress.settings.soundOn}
        onAttempt={recordAttempt}
        onComplete={(score) => {
          setProgress((current) => completeDiagnostic(current, score));
          setScreen('map');
        }}
        onExit={() => setScreen('welcome')}
      />
    );
  }

  if (screen === 'session') {
    return (
      <LearningSession
        items={sessionItems}
        mode={sessionMode}
        soundOn={progress.settings.soundOn}
        onAttempt={recordAttempt}
        onComplete={() => {
          if (sessionAdvancesStory) setProgress((current) => completeQuest(current));
          setScreen('map');
        }}
        onExit={() => setScreen('map')}
      />
    );
  }

  if (screen === 'parent') {
    return (
      <ParentDashboard
        progress={progress}
        onChange={setProgress}
        onClose={() => setScreen('map')}
        onReset={() => {
          if (!window.confirm('第1島の学習データをすべて消して、最初から始めますか？')) return;
          setProgress(clearProgress());
          setScreen('welcome');
        }}
      />
    );
  }

  if (screen === 'record') {
    return <PronunciationRecorder soundOn={progress.settings.soundOn} onClose={() => setScreen('map')} />;
  }

  return (
    <QuestMap
      progress={progress}
      onBack={onBackToHome}
      onStart={startSession}
      onParent={() => setScreen('parent')}
      onRecord={() => setScreen('record')}
      onToggleSound={() => setProgress((current) => ({
        ...current,
        settings: { ...current.settings, soundOn: !current.settings.soundOn },
      }))}
    />
  );
}
