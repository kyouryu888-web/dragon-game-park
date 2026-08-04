import { useEffect } from 'react';
import forestMap from './assets/forest-island-map.webp';
import { speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES, ENGLISH_QUEST_SPIRITS } from './englishQuestContent';
import { DragonSprite, GuideSprite, SpiritSprite } from './EnglishQuestSprites';
import type { LearningItem, QuestDefinition } from './englishQuestTypes';

const MODE_STEPS = {
  capture: [
    ['👂', 'きく'],
    ['🔎', 'さがす'],
    ['🤝', 'なかま'],
  ],
  arena: [
    ['👂', 'きく'],
    ['🐉', 'うごかす'],
    ['✨', 'たどりつく'],
  ],
  merge: [
    ['💧', 'えらぶ'],
    ['☝️', 'はこぶ'],
    ['💎', 'つくる'],
  ],
  escape: [
    ['🔎', 'しらべる'],
    ['🧩', 'かさねる'],
    ['🚪', 'ぬけだす'],
  ],
} as const;

export function QuestBriefing({
  quest,
  items,
  soundOn,
  onStart,
  onExit,
}: {
  quest: QuestDefinition;
  items: LearningItem[];
  soundOn: boolean;
  onStart: () => void;
  onExit: () => void;
}) {
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));
  const guide = ENGLISH_QUEST_GUIDES[guideIndex];
  const spirit = ENGLISH_QUEST_SPIRITS.find((candidate) => candidate.id === quest.spiritId);
  const steps = MODE_STEPS[quest.mode === 'review' || quest.mode === 'diagnostic' ? 'capture' : quest.mode];

  useEffect(() => {
    const timer = window.setTimeout(() => speakJapanese(quest.story, soundOn), 350);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [quest.story, soundOn]);

  return (
    <main className="eq-shell eq-briefing-shell" style={{ backgroundImage: `url(${forestMap})` }}>
      <header className="eq-briefing-header">
        <button className="eq-round-button" type="button" onClick={onExit} aria-label="地図へもどる">←</button>
        <div><small>{quest.final ? '最終章' : `第${quest.chapter}話`}</small><h1>{quest.title}</h1></div>
        <span>{Math.min(quest.chapter, 13)} / 13</span>
      </header>

      <section className="eq-briefing-stage">
        <div className="eq-briefing-party" aria-label={`${guide.name}とドラゴン`}>
          <GuideSprite index={guideIndex} label={guide.name} className="eq-briefing-guide" />
          <DragonSprite pose={1} className="eq-briefing-dragon" />
        </div>
        <div className="eq-briefing-dialogue">
          <small>{guide.name}と {quest.regionName}へ</small>
          <p>{quest.story}</p>
          <button type="button" onClick={() => speakJapanese(quest.story, soundOn)}>🔊 もういちど きく</button>
        </div>
        <div className="eq-briefing-magic" aria-label="今回の目標">
          {spirit ? <SpiritSprite index={spirit.spriteIndex} label={spirit.name} /> : <span aria-hidden="true">{quest.rewardEmoji}</span>}
          <strong>{quest.reward}</strong>
          <small>{quest.objective}</small>
        </div>
      </section>

      <section className="eq-briefing-steps" aria-label="遊び方の三つの手順">
        {steps.map(([icon, label], index) => (
          <div key={label}><b>{index + 1}</b><span aria-hidden="true">{icon}</span><strong>{label}</strong></div>
        ))}
      </section>

      <footer className="eq-briefing-footer">
        <p><span aria-hidden="true">🌱</span> きょう出会う音 {items.length}こ <small>英語の文字が読めなくても進めるよ</small></p>
        <button className="eq-primary-button" type="button" onClick={onStart}>冒険を はじめる ▶</button>
      </footer>
    </main>
  );
}
