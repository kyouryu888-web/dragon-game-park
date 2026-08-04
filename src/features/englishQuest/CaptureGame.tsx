import { useEffect, useRef, useState } from 'react';
import forestMap from './assets/forest-island-map.webp';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES, ENGLISH_QUEST_SPIRITS } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { rotatedChoices } from './englishQuestGameplay';
import { SpiritSprite } from './EnglishQuestSprites';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt, LearningItem, QuestDefinition } from './englishQuestTypes';

const HIDING_SPOTS = [
  { icon: '🌳', name: 'おおきな き' },
  { icon: '🍄', name: 'きのこの かげ' },
  { icon: '🪨', name: 'ひかる いわ' },
] as const;

export function CaptureGame({
  soundOn,
  items,
  quest,
  onAttempt,
  onComplete,
  onExit,
}: {
  soundOn: boolean;
  items: LearningItem[];
  quest: QuestDefinition;
  onAttempt: (attempt: Attempt) => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [found, setFound] = useState(false);
  const [searched, setSearched] = useState<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const startedAt = useRef(performance.now());
  const current = items[index];
  const hidingSpot = index % HIDING_SPOTS.length;
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));
  const spirit = ENGLISH_QUEST_SPIRITS.find((candidate) => candidate.id === quest.spiritId);

  useEffect(() => {
    setFound(false);
    setSearched([]);
    setHinted(false);
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => speakJapanese('光のあとを追って、精霊を見つけよう', soundOn), 300);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, soundOn]);

  if (!current) {
    return <QuestComplete title={`${quest.title} クリア！`} message={quest.objective} reward={`${quest.rewardEmoji} ${quest.reward}`} onDone={onComplete} />;
  }

  const offerings = rotatedChoices(items, index, quest.chapter === 1 ? 2 : 3);
  const search = (spot: number) => {
    if (found) return;
    if (spot === hidingSpot) {
      setFound(true);
      playLearningItem(current, soundOn);
      return;
    }
    setSearched((values) => Array.from(new Set([...values, spot])));
    speakJapanese('ここには いないみたい。光のあとを見てね', soundOn);
  };
  const offer = (choice: LearningItem) => {
    const correct = choice.id === current.id;
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'capture',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: hinted ? 1 : 0,
    }));
    if (!correct) {
      setHinted(true);
      speakJapanese('もういちど音を聞いて、ひかる絵をえらぼう', soundOn);
      playLearningItem(current, soundOn);
      return;
    }
    window.setTimeout(() => setIndex((value) => value + 1), 650);
  };

  return (
    <main className="eq-shell eq-game-shell eq-capture-game">
      <QuestGameHeader title={quest.title} instruction={found ? '精霊が好きな絵を あげよう' : '光る足あとを たどろう'} step={index} total={items.length} onExit={onExit} guideIndex={guideIndex} />
      <section className="eq-capture-world" style={{ backgroundImage: `url(${forestMap})` }}>
        <div className="eq-sound-trail" aria-hidden="true"><i /><i /><i /><i /></div>
        {!found ? (
          <>
            <div className="eq-capture-callout"><strong>どこかな？</strong><span>森を さわって さがそう</span></div>
            <div className="eq-hiding-spots">
              {HIDING_SPOTS.map((spot, spotIndex) => (
                <button
                  type="button"
                  key={spot.name}
                  className={spotIndex === hidingSpot ? 'eq-hiding-spot eq-hiding-spot--trail' : 'eq-hiding-spot'}
                  onClick={() => search(spotIndex)}
                  disabled={searched.includes(spotIndex)}
                >
                  <span aria-hidden="true">{searched.includes(spotIndex) ? '🍂' : spot.icon}</span>
                  <small>{searched.includes(spotIndex) ? 'いなかった' : spot.name}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="eq-capture-found">
            <div className="eq-capture-spirit-stage">
              <SpiritSprite index={spirit?.spriteIndex ?? index % 8} label={spirit?.name ?? '見つけた精霊'} className="eq-found-spirit" />
              <button type="button" className="eq-listen-orb" onClick={() => playLearningItem(current, soundOn)} aria-label="精霊の音をもういちど聞く">🔊</button>
            </div>
            <div className="eq-offering-tray" aria-label="精霊へのおくりもの">
              {offerings.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  onClick={() => offer(choice)}
                  className={hinted && choice.id === current.id ? 'eq-offering eq-offering--hint' : 'eq-offering'}
                >
                  <span aria-hidden="true">{choice.emoji}</span><small>{choice.display}</small>
                </button>
              ))}
            </div>
            <div className="eq-capture-meter"><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /><small>なかよしゲージ</small></div>
          </div>
        )}
      </section>
    </main>
  );
}
