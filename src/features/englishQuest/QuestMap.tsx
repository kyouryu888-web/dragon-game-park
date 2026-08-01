import forestMap from './assets/forest-island-map.webp';
import { dueCount, masteryPercent } from './englishQuestEngine';
import { ENGLISH_QUEST_GUIDES, ENGLISH_QUEST_SPIRITS, FINAL_QUEST, MAIN_QUESTS, QUEST_REGIONS } from './englishQuestContent';
import type { LearningMode, PlayerProgress } from './englishQuestTypes';
import { DragonSprite, GuideSprite, SpiritSprite } from './EnglishQuestSprites';

const REGION_CLASS: Record<string, string> = {
  capture: 'eq-map-region--forest',
  arena: 'eq-map-region--arena',
  merge: 'eq-map-region--spring',
  escape: 'eq-map-region--library',
};

export function QuestMap({
  progress,
  onBack,
  onStart,
  onParent,
  onRecord,
  onToggleSound,
}: {
  progress: PlayerProgress;
  onBack: () => void;
  onStart: (mode: LearningMode, advancesStory?: boolean) => void;
  onParent: () => void;
  onRecord: () => void;
  onToggleSound: () => void;
}) {
  const captured = Object.values(progress.spirits).filter((state) => state !== 'locked').length;
  const storyComplete = progress.questStep > MAIN_QUESTS.length;
  const nextQuest = progress.questStep < MAIN_QUESTS.length ? MAIN_QUESTS[progress.questStep] : FINAL_QUEST;
  const nextSpirit = ENGLISH_QUEST_SPIRITS.find((spirit) => progress.spirits[spirit.id] === 'locked');
  const reviewCount = dueCount(progress);
  const mastery = masteryPercent(progress);
  const focusGuide = ENGLISH_QUEST_GUIDES[progress.questStep % ENGLISH_QUEST_GUIDES.length];
  const nextLabel = storyComplete ? '自由に復習する' : nextQuest.final ? '最後の迷宮へ' : '冒険をつづける';
  const startNext = () => onStart(storyComplete ? 'review' : nextQuest.mode, !storyComplete);

  return (
    <main className="eq-shell eq-map-shell">
      <header className="eq-topbar">
        <button className="eq-round-button" type="button" onClick={onBack} aria-label="ゲーム広場へ戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <h1>イングリッシュ ラーニング オデッセイ</h1>
        <div className="eq-topbar-actions">
          <button className="eq-round-button" type="button" onClick={onToggleSound} aria-label={progress.settings.soundOn ? '音声をオフにする' : '音声をオンにする'}>
            {progress.settings.soundOn ? '🔊' : '🔇'}
          </button>
          <button className="eq-round-button" type="button" onClick={onParent} aria-label="保護者メニュー">⚙</button>
        </div>
      </header>

      <section className="eq-stat-rail" aria-label="冒険の進み具合">
        <div className="eq-stat">
          <span className="eq-stat-icon" aria-hidden="true">☀</span>
          <span><small>ことばの光</small><strong>{progress.light}</strong></span>
        </div>
        <div className="eq-stat">
          <SpiritSprite
            index={nextSpirit?.spriteIndex ?? 7}
            label={nextSpirit?.name ?? '精霊'}
            muted={!nextSpirit}
          />
          <span><small>集めた精霊</small><strong>{captured}/8</strong></span>
        </div>
      </section>

      <div className="eq-map-layout">
        <section className="eq-adventure-map" style={{ backgroundImage: `url(${forestMap})` }} aria-label="はじまりの森の地図">
          <div className="eq-map-glow" aria-hidden="true" />
          {QUEST_REGIONS.map((region) => (
            <button
              className={`eq-map-region ${REGION_CLASS[region.id]}`}
              type="button"
              key={region.id}
              onClick={() => onStart(region.mode, false)}
            >
              <strong>{region.name}</strong>
              <span>{region.description}</span>
            </button>
          ))}
          <DragonSprite pose={1} className="eq-map-dragon" />
          <div className="eq-mobile-guide">
            <GuideSprite index={focusGuide.spriteIndex} label={focusGuide.name} />
            <span><strong>{focusGuide.name}</strong><small>{focusGuide.role}</small></span>
          </div>
          <button className="eq-speak-shortcut" type="button" onClick={onRecord}>
            <span aria-hidden="true">🎙</span> まねして話す
          </button>
        </section>

        <aside className="eq-companion-camp" aria-label="森のガイドたち">
          <div className="eq-camp-title"><span aria-hidden="true">🍃</span><h2>今日の仲間</h2><small>6人が交代で冒険を案内</small></div>
          <div className="eq-guide-party">
            {ENGLISH_QUEST_GUIDES.map((guide) => (
              <figure className={guide.id === focusGuide.id ? 'eq-guide-card eq-guide-card--active' : 'eq-guide-card'} key={guide.id}>
                <GuideSprite index={guide.spriteIndex} label={guide.name} />
                <figcaption><strong>{guide.name}</strong><small>{guide.role}</small></figcaption>
              </figure>
            ))}
          </div>
          <div className="eq-guide-message">
            <strong>{focusGuide.name}からのヒント</strong>
            <p>{focusGuide.message}</p>
          </div>
          <div className="eq-memory-card">
            <div><span>{reviewCount > 0 ? '今日の記憶チャレンジ' : 'はじまりの森の習熟度'}</span><strong>{reviewCount > 0 ? `${reviewCount}こ` : `${mastery}%`}</strong></div>
            <span className="eq-memory-track"><i style={{ width: `${reviewCount > 0 ? Math.min(100, (reviewCount / 15) * 100) : mastery}%` }} /></span>
            <small>{reviewCount > 0 ? '忘れかけのことばを助けに行こう' : '次の復習日まで冒険を楽しもう'}</small>
          </div>
          <button className="eq-primary-button eq-desktop-continue" type="button" onClick={startNext}>
            {nextLabel}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        </aside>
      </div>

      <section className="eq-map-footer">
        <div className="eq-next-copy">
          <span>{reviewCount > 0 ? `思い出すことば ${reviewCount}こ` : `島の習熟度 ${mastery}%`}</span>
          <strong>{storyComplete ? 'はじまりの森に朝が戻った！' : `${progress.questStep < MAIN_QUESTS.length ? `第${progress.questStep + 1}話` : '最終章'}「${nextQuest.title}」`}</strong>
        </div>
        <button className="eq-primary-button" type="button" onClick={startNext}>
          {nextLabel}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>
      </section>
    </main>
  );
}
