import { useEffect, useState } from 'react';
import { applyAttempt, completeDiagnostic, completeQuest, composeQuestSession, composeSession } from './englishQuestEngine';
import { FINAL_QUEST, MAIN_QUESTS } from './englishQuestContent';
import { clearProgress, loadProgress, saveProgress } from './englishQuestStorage';
import type { Attempt, LearningItem, LearningMode, PlayerProgress, QuestDefinition } from './englishQuestTypes';
import { ArenaGame } from './ArenaGame';
import { BeginnerJourney } from './BeginnerJourney';
import { CaptureGame } from './CaptureGame';
import { DragonSprite, GuideSprite } from './EnglishQuestSprites';
import { EscapeGame } from './EscapeGame';
import { FinalDungeon } from './FinalDungeon';
import { MergeGame } from './MergeGame';
import { ParentDashboard } from './ParentDashboard';
import { PronunciationRecorder } from './PronunciationRecorder';
import { QuestBriefing } from './QuestBriefing';
import { QuestMap } from './QuestMap';
import { TeachDragonGame } from './TeachDragonGame';
import './englishQuest.css';

type PlayableMode = 'capture' | 'arena' | 'merge' | 'escape';
type RunMode = PlayableMode | 'teach';
type Screen = 'welcome' | 'beginner' | 'map' | 'briefing' | 'capture' | 'arena' | 'merge' | 'escape' | 'teach' | 'final' | 'parent' | 'record';
type ActiveRun = {
  mode: RunMode;
  quest: QuestDefinition;
  items: LearningItem[];
  advancesStory: boolean;
};

const REVIEW_MODES: PlayableMode[] = ['capture', 'arena', 'merge', 'escape'];

export function EnglishQuestPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>(() => (progress.diagnosticComplete ? 'map' : 'welcome'));
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  useEffect(() => saveProgress(progress), [progress]);

  const recordAttempt = (attempt: Attempt) => setProgress((current) => applyAttempt(current, attempt));
  const startGame = (mode: LearningMode, story = false) => {
    const reviewIndex = (new Date().getDate() + progress.light) % REVIEW_MODES.length;
    const playableMode: PlayableMode = mode === 'review' || mode === 'diagnostic' ? REVIEW_MODES[reviewIndex] : mode;
    const storyQuest = progress.questStep < MAIN_QUESTS.length ? MAIN_QUESTS[progress.questStep] : FINAL_QUEST;
    const template = MAIN_QUESTS.find((quest) => quest.mode === playableMode) ?? MAIN_QUESTS[0];
    const quest: QuestDefinition = story ? storyQuest : {
      ...template,
      id: `practice-${playableMode}`,
      chapter: Math.min(13, progress.questStep + 1),
      title: mode === 'review' ? '今日の思い出し遠征' : `${template.regionName}の自由探検`,
      story: '前に出会ったことばと、これから出会うことばを混ぜた短い遠征だよ。',
      objective: 'ちがう遊び方で思い出し、ことばの記憶を強くする',
      reward: '思い出しの光',
      rewardEmoji: '✨',
      spiritId: undefined,
      final: false,
    };
    const items = story
      ? composeQuestSession(progress, quest)
      : composeSession(progress, new Date(), 8);
    setActiveRun({ mode: playableMode, quest, items, advancesStory: story });
    setScreen(story ? 'briefing' : playableMode);
  };
  const finishGame = () => {
    if (activeRun?.advancesStory) setProgress((current) => completeQuest(current));
    setActiveRun(null);
    setScreen('map');
  };
  const startTeaching = () => {
    const items = composeSession(progress, new Date(), 6);
    const template = MAIN_QUESTS[4] ?? MAIN_QUESTS[0];
    const quest: QuestDefinition = {
      ...template,
      id: 'teach-the-dragon',
      chapter: Math.min(13, progress.questStep + 1),
      title: 'ドラゴン先生のお願い',
      mode: 'review',
      guideId: 'tick',
      story: 'ドラゴンが覚えた英語を、今度はきみが先生になって確かめよう。',
      objective: 'お手本の音とドラゴンの絵を比べ、間違いをやさしく直す',
      reward: '記憶の星',
      rewardEmoji: '🌟',
      itemIds: items.map((item) => item.id),
      spiritId: undefined,
      final: false,
    };
    setActiveRun({ mode: 'teach', quest, items, advancesStory: false });
    setScreen('teach');
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

  if (screen === 'briefing' && activeRun) {
    return <QuestBriefing quest={activeRun.quest} items={activeRun.items} soundOn={progress.settings.soundOn} onStart={() => setScreen(activeRun.quest.final ? 'final' : activeRun.mode)} onExit={() => { setActiveRun(null); setScreen('map'); }} />;
  }

  if (screen === 'final' && activeRun) return <FinalDungeon soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'capture' && activeRun) return <CaptureGame soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'arena' && activeRun) return <ArenaGame soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'merge' && activeRun) return <MergeGame soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'escape' && activeRun) return <EscapeGame soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;
  if (screen === 'teach' && activeRun) return <TeachDragonGame soundOn={progress.settings.soundOn} items={activeRun.items} quest={activeRun.quest} onAttempt={recordAttempt} onComplete={finishGame} onExit={() => setScreen('map')} />;

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
      onTeach={startTeaching}
      onToggleSound={() => setProgress((current) => ({
        ...current,
        settings: { ...current.settings, soundOn: !current.settings.soundOn },
      }))}
    />
  );
}
