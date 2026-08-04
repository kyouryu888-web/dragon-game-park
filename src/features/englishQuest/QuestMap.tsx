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
  const focusGuide = ENGLISH_QUEST_GUIDES[Math.min(progress.questStep, 3)];
  const firstLap = progress.questStep < 4;
  const nextLabel = storyComplete ? '今日の ふくしゅうへ' : firstLap ? `つぎは「${nextQuest.regionName}」` : 'つづきの 冒険へ';
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
        {firstLap && <div className="eq-first-route-note"><strong>いまは ここ！</strong><span>一つずつ遊び方を覚えよう</span></div>}
      </section>

      <div className="eq-map-layout">
        <section className="eq-adventure-map" style={{ backgroundImage: `url(${forestMap})` }} aria-label="はじまりの森の地図">
          <div className="eq-map-glow" aria-hidden="true" />
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
          {firstLap && <button className="eq-map-next-cta" type="button" onClick={startNext}><span>ミーナの おすすめ</span><strong>{nextLabel}</strong><i>▶</i></button>}
        </section>

        <aside className="eq-companion-camp" aria-label="森の案内役">
          <div className="eq-camp-title"><span aria-hidden="true">🧭</span><h2>迷わない冒険ルート</h2><small>最初は1つの遊びだけ選べます</small></div>
          <div className="eq-current-mission"><GuideSprite index={focusGuide.spriteIndex} label={focusGuide.name} /><div><small>{focusGuide.name}から</small><strong>{nextQuest.title}</strong><p>{PLAY_COPY[nextQuest.mode] ?? '前に覚えたことばを思い出そう'}</p></div></div>
          <ol className="eq-route-list">
            {QUEST_REGIONS.map((region, regionIndex) => (
              <li key={region.id} className={progress.questStep === regionIndex ? 'eq-route-list--current' : progress.questStep > regionIndex ? 'eq-route-list--done' : ''}>
                <span>{progress.questStep > regionIndex ? '✓' : regionIndex + 1}</span><div><strong>{region.name}</strong><small>{PLAY_COPY[region.id]}</small></div>
              </li>
            ))}
          </ol>
          <div className="eq-memory-card"><div><span>{reviewCount > 0 ? '今日の思い出し' : '島の習熟度'}</span><strong>{reviewCount > 0 ? `${reviewCount}こ` : `${mastery}%`}</strong></div><span className="eq-memory-track"><i style={{ width: `${reviewCount > 0 ? Math.min(100, (reviewCount / 15) * 100) : mastery}%` }} /></span><small>短く何度も会うと、ことばの光が強くなるよ。</small></div>
          <button className="eq-primary-button eq-desktop-continue" type="button" onClick={startNext}>{nextLabel} ▶</button>
        </aside>
      </div>

      <section className="eq-map-footer"><div className="eq-next-copy"><span>{reviewCount > 0 ? `思い出すことば ${reviewCount}こ` : `島の習熟度 ${mastery}%`}</span><strong>{nextQuest.title}</strong></div><button className="eq-primary-button" type="button" onClick={startNext}>{nextLabel} ▶</button></section>
    </main>
  );
}
