import forestMap from './assets/forest-island-map.webp';
import { dueCount, masteryPercent } from './englishQuestEngine';
import { isModeUnlocked } from './englishQuestGameplay';
import { ENGLISH_QUEST_GUIDES, ENGLISH_QUEST_SPIRITS, FINAL_QUEST, MAIN_QUESTS, QUEST_REGIONS } from './englishQuestContent';
import type { LearningMode, PlayerProgress } from './englishQuestTypes';
import { DragonSprite, GuideSprite, SpiritSprite } from './EnglishQuestSprites';

const REGION_CLASS: Record<string, string> = {
  capture: 'eq-map-region--forest',
  arena: 'eq-map-region--arena',
  merge: 'eq-map-region--spring',
  escape: 'eq-map-region--library',
};

const PLAY_COPY: Record<string, string> = {
  capture: '森をさがして 精霊をつかまえる',
  arena: 'ドラゴンを自分で動かす',
  merge: 'しずくを運んで ことばを作る',
  escape: '部屋を調べて 手がかりを合わせる',
};

export function QuestMap({
  progress,
  onBack,
  onStart,
  onParent,
  onRecord,
  onTeach,
  onToggleSound,
}: {
  progress: PlayerProgress;
  onBack: () => void;
  onStart: (mode: LearningMode, advancesStory?: boolean) => void;
  onParent: () => void;
  onRecord: () => void;
  onTeach: () => void;
  onToggleSound: () => void;
}) {
  const captured = Object.values(progress.spirits).filter((state) => state !== 'locked').length;
  const storyComplete = progress.questStep > MAIN_QUESTS.length;
  const nextQuest = progress.questStep < MAIN_QUESTS.length ? MAIN_QUESTS[progress.questStep] : FINAL_QUEST;
  const nextSpirit = ENGLISH_QUEST_SPIRITS.find((spirit) => progress.spirits[spirit.id] === 'locked');
  const reviewCount = dueCount(progress);
  const mastery = masteryPercent(progress);
  const focusGuide = ENGLISH_QUEST_GUIDES.find((guide) => guide.id === nextQuest.guideId) ?? ENGLISH_QUEST_GUIDES[0];
  const storyRoute = [...MAIN_QUESTS, FINAL_QUEST];
  const visibleStoryStep = Math.min(progress.questStep, storyRoute.length - 1);
  const constellationStars = Math.min(7, progress.adventureDates.length);
  const teachUnlocked = progress.questStep >= 4;
  const nextLabel = storyComplete
    ? '今日の 思い出し遠征へ'
    : nextQuest.final
      ? '最終ダンジョンへ'
      : `第${nextQuest.chapter}話へ`;
  const startNext = () => onStart(storyComplete ? 'review' : nextQuest.mode, !storyComplete);

  return (
    <main className="eq-shell eq-map-shell eq-map-v2">
      <header className="eq-topbar">
        <button className="eq-round-button" type="button" onClick={onBack} aria-label="ゲーム広場へもどる">←</button>
        <h1>イングリッシュ ラーニング オデッセイ</h1>
        <div className="eq-topbar-actions">
          <button className="eq-round-button" type="button" onClick={onToggleSound} aria-label={progress.settings.soundOn ? '音声をオフにする' : '音声をオンにする'}>{progress.settings.soundOn ? '🔊' : '🔇'}</button>
          <button className="eq-round-button" type="button" onClick={onParent} aria-label="保護者メニュー">⚙</button>
        </div>
      </header>

      <section className="eq-stat-rail" aria-label="冒険の進み具合">
        <div className="eq-stat"><span className="eq-stat-icon" aria-hidden="true">★</span><span><small>ことばの光</small><strong>{progress.light}</strong></span></div>
        <div className="eq-stat">
          <SpiritSprite index={nextSpirit?.spriteIndex ?? 7} label={nextSpirit?.name ?? '精霊'} muted={!nextSpirit} />
          <span><small>集めた精霊</small><strong>{captured}/8</strong></span>
        </div>
        {!storyComplete && <div className="eq-first-route-note"><strong>いまは 第{nextQuest.chapter}話</strong><span>光る「つぎ」だけ進めば大丈夫</span></div>}
      </section>

      <div className="eq-map-layout">
        <section className="eq-adventure-map" style={{ backgroundImage: `url(${forestMap})` }} aria-label="はじまりの森の地図">
          <div className="eq-map-glow" aria-hidden="true" />
          <div className="eq-constellation-badge" aria-label={`記憶の星座 ${constellationStars} / 7`}><small>記憶の星座</small><strong>{'★'.repeat(constellationStars)}{'☆'.repeat(7 - constellationStars)}</strong><span>連続じゃなくてOK</span></div>
          <div className="eq-map-path" aria-hidden="true"><i /><i /><i /><i /></div>
          {QUEST_REGIONS.map((region) => {
            const unlocked = isModeUnlocked(progress, region.mode);
            const isNext = !storyComplete && region.mode === nextQuest.mode;
            return (
              <button
                className={`eq-map-region ${REGION_CLASS[region.id]}${!unlocked ? ' eq-map-region--locked' : ''}${isNext ? ' eq-map-region--next' : ''}`}
                type="button"
                key={region.id}
                disabled={!unlocked}
                onClick={() => onStart(region.mode, isNext)}
              >
                {isNext && <b>つぎ</b>}
                {!unlocked && <b>🔒 あとで ひらくよ</b>}
                <strong>{region.name}</strong>
                <span>{PLAY_COPY[region.id]}</span>
              </button>
            );
          })}
          <DragonSprite pose={1} className="eq-map-dragon" />
          <div className="eq-mobile-guide"><GuideSprite index={focusGuide.spriteIndex} label={focusGuide.name} /><span><strong>{focusGuide.name}</strong><small>{focusGuide.role}</small></span></div>
          <button className="eq-speak-shortcut" type="button" onClick={onRecord}><span aria-hidden="true">🎙️</span> まねして話す</button>
          {teachUnlocked && <button className="eq-teach-shortcut" type="button" onClick={onTeach} aria-label="ドラゴンに英語を教える"><span aria-hidden="true">🐉</span> 先生になる</button>}
          {!storyComplete && <button className="eq-map-next-cta" type="button" onClick={startNext}><span>{focusGuide.name}の おすすめ</span><strong>{nextLabel}</strong><i>▶</i></button>}
        </section>

        <aside className="eq-companion-camp" aria-label="森の案内役">
          <div className="eq-camp-title"><span aria-hidden="true">🧭</span><h2>13話の一本道</h2><small>光る場所から順に進もう</small></div>
          <div className="eq-current-mission"><GuideSprite index={focusGuide.spriteIndex} label={focusGuide.name} /><div><small>{focusGuide.name}から</small><strong>{nextQuest.title}</strong><p>{PLAY_COPY[nextQuest.mode] ?? '前に覚えたことばを思い出そう'}</p></div></div>
          <ol className="eq-chapter-track" aria-label="全13話の進み具合">
            {storyRoute.map((quest, questIndex) => (
              <li key={quest.id} className={visibleStoryStep === questIndex && !storyComplete ? 'is-current' : progress.questStep > questIndex ? 'is-done' : ''} aria-label={`${questIndex + 1} ${quest.title}`}>
                <span>{progress.questStep > questIndex ? '✓' : questIndex + 1}</span><small>{questIndex === visibleStoryStep && !storyComplete ? quest.title : questIndex === 12 ? '最終' : quest.regionName.slice(0, 2)}</small>
              </li>
            ))}
          </ol>
          {teachUnlocked && <button className="eq-teach-camp" type="button" onClick={onTeach}>🐉 きょうは先生になる</button>}
          <div className="eq-memory-card"><div><span>{reviewCount > 0 ? '今日の思い出し' : '島の習熟度'}</span><strong>{reviewCount > 0 ? `${reviewCount}こ` : `${mastery}%`}</strong></div><span className="eq-memory-track"><i style={{ width: `${reviewCount > 0 ? Math.min(100, (reviewCount / 15) * 100) : mastery}%` }} /></span><small>短く何度も会うと、ことばの光が強くなるよ。</small></div>
          <div className="eq-constellation-card"><div><span>記憶の星座</span><strong>{constellationStars}/7</strong></div><p aria-hidden="true">{'★'.repeat(constellationStars)}{'☆'.repeat(7 - constellationStars)}</p><small>連続日数ではなく、戻ってきた日を祝うよ。</small></div>
          <button className="eq-primary-button eq-desktop-continue" type="button" onClick={startNext}>{nextLabel} ▶</button>
        </aside>
      </div>

      <section className="eq-map-footer"><div className="eq-next-copy"><span>{storyComplete ? `思い出すことば ${reviewCount}こ` : `第${nextQuest.chapter}話・${nextQuest.regionName}`}</span><strong>{storyComplete ? '今日の思い出し遠征' : nextQuest.title}</strong></div><button className="eq-primary-button" type="button" onClick={startNext}>{nextLabel} ▶</button></section>
    </main>
  );
}
