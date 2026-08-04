import { useEffect, useState } from 'react';
import { applyAttempt, completeDiagnostic, completeQuest } from './englishQuestEngine';
import { clearProgress, loadProgress, saveProgress } from './englishQuestStorage';
import type { Attempt, LearningMode, PlayerProgress } from './englishQuestTypes';
import { ArenaGame } from './ArenaGame';
import { BeginnerJourney } from './BeginnerJourney';
import { CaptureGame } from './CaptureGame';
import { DragonSprite, GuideSprite } from './EnglishQuestSprites';
import { EscapeGame } from './EscapeGame';
import { MergeGame } from './MergeGame';
import { ParentDashboard } from './ParentDashboard';
import { PronunciationRecorder } from './PronunciationRecorder';
import { QuestMap } from './QuestMap';
import './englishQuest.css';

type Screen = 'welcome' | 'beginner' | 'map' | 'capture' | 'arena' | 'merge' | 'escape' | 'parent' | 'record';

export function EnglishQuestPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>(() => (progress.diagnosticComplete ? 'map' : 'welcome'));
  const [advancesStory, setAdvancesStory] = useState(false);

  useEffect(() => saveProgress(progress), [progress]);

  const recordAttempt = (attempt: Attempt) => setProgress((current) => applyAttempt(current, attempt));
  const startGame = (mode: LearningMode, story = false) => {
    setAdvancesStory(story);
    setScreen(mode === 'review' || mode === 'diagnostic' ? 'capture' : mode);
  };
  const finishGame = () => {
    if (advancesStory) setProgress((current) => completeQuest(current));
    setScreen('map');
  };

  if (screen === 'welcome') {
    return (
      <main className="eq-shell eq-welcome-shell eq-welcome-v2">
        <button className="eq-round-button eq-welcome-back" type="button" onClick={onBackToHome} aria-label="ゲーム広場へもどる">←</button>
        <div className="eq-welcome-sky" aria-hidden="true"><i /><i /><i /></div>
        <section className="eq-welcome-content">
          <div className="eq-welcome-party">
            <GuideSprite index={0} label="案内役のミーナ" className="eq-welcome-guide" />
            <DragonSprite pose={1} className="eq-welcome-dragon" />
          </div>
          <p className="eq-title-kicker">あそんで つながる ことばの冒険</p>
          <h1>イングリッシュ ラーニング<br />オデッセイ</h1>
          <p>英語を ぜんぜん知らなくても だいじょうぶ。<br />ミーナとドラゴンが、絵と音から案内するよ。</p>
          <button className="eq-primary-button eq-welcome-start" type="button" onClick={() => setScreen('beginner')}>
            ミーナと はじめる <span aria-hidden="true">▶</span>
          </button>
          <small>最初は英語の文字を読ませません ・ まちがえても進めます</small>
        </section>
        <footer className="eq-welcome-privacy"><span>広告なし</span><span>ログインなし</span><span>学習データはこの端末だけ</span></footer>
      </main>
    );
  }

  if (screen === 'beginner') {
    return (
      <BeginnerJourney
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

  if (screen === 'capture') return <CaptureGame soundOn={progress.settings.soundOn} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'arena') return <ArenaGame soundOn={progress.settings.soundOn} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'merge') return <MergeGame soundOn={progress.settings.soundOn} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'escape') return <EscapeGame soundOn={progress.settings.soundOn} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;

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

  if (screen === 'record') return <PronunciationRecorder soundOn={progress.settings.soundOn} onClose={() => setScreen('map')} />;

  return (
    <QuestMap
      progress={progress}
      onBack={onBackToHome}
      onStart={startGame}
      onParent={() => setScreen('parent')}
      onRecord={() => setScreen('record')}
      onToggleSound={() => setProgress((current) => ({
        ...current,
        settings: { ...current.settings, soundOn: !current.settings.soundOn },
      }))}
    />
  );
}
