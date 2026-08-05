import { useEffect, useRef, useState } from 'react';
import forestMap from './assets/forest-island-map.webp';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES, ENGLISH_QUEST_SPIRITS } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { advancePracticeTurns, choicesForItem, createPracticeTurns } from './englishQuestGameplay';
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
  const [turns, setTurns] = useState(() => createPracticeTurns(items));
  const [answered, setAnswered] = useState(0);
  const [found, setFound] = useState(false);
  const [searched, setSearched] = useState<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const startedAt = useRef(performance.now());
  const locked = useRef(false);
  const currentTurn = turns[0];
  const current = currentTurn?.item;
  const hidingSpot = answered % HIDING_SPOTS.length;
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));
  const spirit = ENGLISH_QUEST_SPIRITS.find((candidate) => candidate.id === quest.spiritId);

  useEffect(() => {
    setFound(false);
    setSearched([]);
    setHinted(currentTurn?.hintLevel === 1);
    locked.current = false;
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => speakJapanese('光のあとを追って、精霊を見つけよう', soundOn), 300);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, currentTurn?.key, currentTurn?.hintLevel, soundOn]);

  if (!current) {
    return <QuestComplete title={`${quest.title} クリア！`} message={quest.objective} reward={`${quest.rewardEmoji} ${quest.reward}`} onDone={onComplete} />;
  }

  const offerings = choicesForItem(items, current, answered, quest.chapter === 1 ? 2 : 3);
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
    if (locked.current) return;
    locked.current = true;
    const correct = choice.id === current.id;
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'capture',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: hinted || currentTurn.hintLevel === 1 ? 1 : 0,
    }));
    if (!correct) {
      speakJapanese('だいじょうぶ。少し進んだら、光るヒントといっしょにもう一度会えるよ', soundOn);
      playLearningItem(current, soundOn);
    }
    window.setTimeout(() => {
      setTurns((value) => advancePracticeTurns(value, correct, items));
      setAnswered((value) => value + 1);
    }, 650);
  };

  const totalTurns = answered + turns.length;

  return (
    <main className="eq-shell eq-game-shell eq-capture-game">
      <QuestGameHeader title={quest.title} instruction={currentTurn.hintLevel === 1 ? 'おさらい！ 光る絵がヒントだよ' : found ? '精霊が好きな絵を あげよう' : '光る足あとを たどろう'} step={answered} total={totalTurns} onExit={onExit} guideIndex={guideIndex} />
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
              <SpiritSprite index={spirit?.spriteIndex ?? answered % 8} label={spirit?.name ?? '見つけた精霊'} className="eq-found-spirit" />
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
            <div className="eq-capture-meter"><span style={{ width: `${Math.min(100, ((answered + 1) / totalTurns) * 100)}%` }} /><small>なかよしゲージ</small></div>
          </div>
        )}
      </section>
    </main>
  );
}
