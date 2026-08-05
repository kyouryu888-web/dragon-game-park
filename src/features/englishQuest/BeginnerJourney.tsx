import { useEffect, useRef, useState } from 'react';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { makeAttempt } from './englishQuestEngine';
import { BEGINNER_ITEM_IDS, learningItems } from './englishQuestGameplay';
import { DragonSprite, GuideSprite, SpiritSprite } from './EnglishQuestSprites';
import type { Attempt, HintLevel, LearningItem } from './englishQuestTypes';

const PAIRS = [
  ['word-cat', 'word-dog'],
  ['word-dog', 'word-cat'],
  ['word-bird', 'word-fish'],
  ['word-red', 'word-blue'],
  ['word-blue', 'word-yellow'],
  ['word-one', 'word-two'],
] as const;

export function BeginnerJourney({
  soundOn,
  onAttempt,
  onComplete,
  onExit,
}: {
  soundOn: boolean;
  onAttempt: (attempt: Attempt) => void;
  onComplete: (score: number) => void;
  onExit: () => void;
}) {
  const rounds = learningItems(BEGINNER_ITEM_IDS);
  const [index, setIndex] = useState(-1);
  const [hinted, setHinted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(performance.now());
  const current = rounds[index];

  useEffect(() => {
    if (!current) return;
    startedAt.current = performance.now();
    setHinted(false);
    const timer = window.setTimeout(() => {
      speakJapanese('よく聞いて、同じ絵をさわってね', soundOn);
      window.setTimeout(() => playLearningItem(current, soundOn), 1250);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, soundOn]);

  if (index < 0) {
    return (
      <main className="eq-shell eq-beginner-shell">
        <button className="eq-round-button eq-game-back" type="button" onClick={onExit} aria-label="もどる">←</button>
        <section className="eq-beginner-story">
          <GuideSprite index={0} label="案内役のミーナ" className="eq-beginner-guide" />
          <div className="eq-speech-card">
            <small>ミーナと いっしょに</small>
            <h1>いっしょに やってみよう</h1>
            <p>えいごを しらなくても だいじょうぶ。<br />おとを きいて、えを さわるだけだよ。</p>
          </div>
          <div className="eq-model-choice" aria-hidden="true">
            <span>🐱</span><span>🐶</span><i>☝️</i>
          </div>
          <DragonSprite pose={1} className="eq-beginner-dragon" />
          <SpiritSprite index={0} label="音の精霊エコリ" className="eq-beginner-spirit" />
          <button className="eq-primary-button eq-beginner-start" type="button" onClick={() => setIndex(0)}>
            ミーナと はじめる
          </button>
          <p className="eq-beginner-note">もじは まだ よめなくて だいじょうぶ</p>
        </section>
      </main>
    );
  }

  if (!current || finished) {
    return (
      <main className="eq-shell eq-complete-screen">
        <div className="eq-complete-rays" aria-hidden="true" />
        <GuideSprite index={0} label="ミーナ" className="eq-complete-guide" />
        <DragonSprite pose={3} className="eq-complete-dragon" />
        <h1>できたね！</h1>
        <p>どうぶつ・いろ・かずの おとに であえたよ。</p>
        <div className="eq-result-orb"><strong>6</strong><span>この おとに であった</span></div>
        <button className="eq-primary-button" type="button" onClick={() => onComplete(score)}>もりへ しゅっぱつ</button>
      </main>
    );
  }

  const pair = learningItems(PAIRS[index]);
  const answer = current.id;
  const choose = (choice: LearningItem) => {
    const correct = choice.id === answer;
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'diagnostic',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: (hinted ? 2 : 0) as HintLevel,
    }));
    if (!correct) {
      setHinted(true);
      speakJapanese('だいじょうぶ。ひかっている絵をさわってね', soundOn);
      return;
    }
    if (!hinted) setScore((value) => value + 1);
    window.setTimeout(() => {
      if (index + 1 >= rounds.length) setFinished(true);
      else setIndex((value) => value + 1);
    }, 650);
  };

  return (
    <main className="eq-shell eq-beginner-shell eq-beginner-round">
      <header className="eq-kid-header">
        <button className="eq-round-button" type="button" onClick={onExit} aria-label="もどる">←</button>
        <div><small>ミーナと れんしゅう</small><strong>{index + 1} / {rounds.length}</strong></div>
      </header>
      <section className="eq-beginner-task">
        <GuideSprite index={0} label="ミーナ" className="eq-task-guide" />
        <h1>よく きいてね</h1>
        <button className="eq-listen-orb" type="button" onClick={() => playLearningItem(current, soundOn)} aria-label="もういちど聞く">🔊</button>
        <p>おなじ えを さわろう</p>
        <div className="eq-picture-pair">
          {pair.map((choice) => (
            <button
              type="button"
              key={choice.id}
              className={hinted && choice.id === answer ? 'eq-picture-choice eq-picture-choice--hint' : 'eq-picture-choice'}
              onClick={() => choose(choice)}
            >
              <span aria-hidden="true">{choice.emoji}</span>
              <small>{choice.display}</small>
              {hinted && choice.id === answer && <i aria-hidden="true">☝️</i>}
            </button>
          ))}
        </div>
        {hinted && <p className="eq-kind-feedback" role="status">まちがえても だいじょうぶ。いっしょに やってみよう！</p>}
      </section>
    </main>
  );
}
