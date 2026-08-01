import { useEffect, useMemo, useRef, useState } from 'react';
import { ArenaChallenge, MergeChallenge } from './CanvasChallenges';
import { ENGLISH_QUEST_SPIRITS } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { playLearningItem, stopEnglishAudio } from './englishQuestAudio';
import { DragonSprite, SpiritSprite } from './EnglishQuestSprites';
import type { Attempt, HintLevel, LearningItem, LearningMode } from './englishQuestTypes';

const MODE_COPY: Record<LearningMode, { title: string; instruction: string }> = {
  diagnostic: { title: 'はじめての音さがし', instruction: 'わかるものだけ、ゆっくり選ぼう' },
  capture: { title: 'ささやきの森', instruction: '音を聞いて、精霊のことばを見つけよう' },
  arena: { title: 'ほのおの闘技場', instruction: '英語の合図と同じ魔法をタップ！' },
  merge: { title: 'ことばの泉', instruction: '音・絵・ことばをひとつにしよう' },
  escape: { title: '記憶の図書館', instruction: '手がかりを読んで、扉を開こう' },
  review: { title: '記憶の小道', instruction: '前に会ったことばを思い出そう' },
};

export function LearningSession({
  items,
  mode,
  soundOn,
  onAttempt,
  onComplete,
  onExit,
}: {
  items: LearningItem[];
  mode: LearningMode;
  soundOn: boolean;
  onAttempt: (attempt: Attempt) => void;
  onComplete: (correctCount: number) => void;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const startedAt = useRef(performance.now());
  const answeredRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const current = queue[index];
  const copy = MODE_COPY[mode];

  useEffect(() => {
    startedAt.current = performance.now();
    setHintLevel(0);
    setFeedback(null);
    setAnswered(false);
    setSelectedAnswer(null);
    answeredRef.current = false;
    if (!current || current.type === 'reading') return;
    const timer = window.setTimeout(() => playLearningItem(current, soundOn), 320);
    return () => {
      window.clearTimeout(timer);
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
      stopEnglishAudio();
    };
  }, [current, soundOn]);

  const visibleHint = useMemo(() => {
    if (!current || hintLevel === 0) return '';
    if (hintLevel === 1) return `絵のヒント：${current.emoji}`;
    if (hintLevel === 2) return `最初の文字：${current.answer.slice(0, 1).toUpperCase()}`;
    return `ことばの形：${current.answer.slice(0, Math.max(2, Math.ceil(current.answer.length / 2)))}…`;
  }, [current, hintLevel]);

  const choose = (answer: string) => {
    if (!current || answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    setSelectedAnswer(answer);
    const correct = answer === current.answer;
    const attempt = makeAttempt({
      itemId: current.id,
      mode,
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel,
    });
    onAttempt(attempt);
    setFeedback(correct ? 'correct' : 'retry');
    if (correct) setCorrectCount((count) => count + 1);
    if (!correct && queue.length < items.length + 4) {
      setQueue((previous) => {
        const next = [...previous];
        next.splice(Math.min(next.length, index + 4), 0, current);
        return next;
      });
    }
    advanceTimerRef.current = window.setTimeout(() => setIndex((value) => value + 1), correct ? 700 : 1050);
  };

  if (!current) {
    const total = Math.max(1, queue.length);
    const percent = Math.round((correctCount / total) * 100);
    return (
      <main className="eq-shell eq-session-shell eq-complete-screen">
        <div className="eq-complete-rays" aria-hidden="true" />
        <DragonSprite pose={3} className="eq-complete-dragon" />
        <h1>{mode === 'diagnostic' ? '音さがし、できたね！' : '冒険クリア！'}</h1>
        <p>{mode === 'diagnostic' ? 'きみの知っている音を、ドラゴンが覚えたよ。' : '思い出すたびに、ことばの光は強くなるよ。'}</p>
        <div className="eq-result-orb">
          <strong>{correctCount}</strong>
          <span>こ 思い出せた</span>
          <small>{percent}%のチャレンジに成功</small>
        </div>
        <button className="eq-primary-button" type="button" onClick={() => {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete(correctCount);
        }}>
          {mode === 'diagnostic' ? 'はじまりの森へ' : '地図へもどる'}
        </button>
      </main>
    );
  }

  const sessionProgress = Math.min(100, Math.round((index / queue.length) * 100));
  const captureSpirit = ENGLISH_QUEST_SPIRITS[index % ENGLISH_QUEST_SPIRITS.length];

  return (
    <main className={`eq-shell eq-session-shell eq-mode-${mode}`}>
      <header className="eq-session-header">
        <button className="eq-round-button" type="button" onClick={onExit} aria-label="地図へ戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.instruction}</p>
        </div>
        <span className="eq-question-count">{Math.min(index + 1, queue.length)}/{queue.length}</span>
      </header>
      <div className="eq-progress-track" aria-label={`進み具合 ${sessionProgress}%`}>
        <span style={{ width: `${sessionProgress}%` }} />
      </div>

      <section className="eq-challenge-stage">
        {mode === 'capture' && (
          <SpiritSprite index={captureSpirit.spriteIndex} label={captureSpirit.name} className="eq-capture-spirit" />
        )}
        {mode === 'escape' && (
          <div className="eq-clue-board" aria-hidden="true">
            <span>CLUE</span>
            <b>{current.emoji}</b>
            <i>?</i>
          </div>
        )}

        <div className="eq-prompt-panel">
          <button className="eq-audio-button" type="button" onClick={() => playLearningItem(current, soundOn)}>
            <span aria-hidden="true">🔊</span>
            もういちど聞く
          </button>
          <span className="eq-prompt-emoji" aria-hidden="true">{current.emoji}</span>
          <h2>{current.promptJa}</h2>
          {visibleHint && <p className="eq-hint-copy">{visibleHint}</p>}
        </div>

        {mode === 'arena' ? (
          <ArenaChallenge item={current} onSelect={choose} />
        ) : mode === 'merge' ? (
          <MergeChallenge item={current} onSelect={choose} />
        ) : (
          <div className="eq-choice-grid">
            {current.choices.map((choice) => (
              <button
                type="button"
                key={choice}
                onClick={() => choose(choice)}
                disabled={answered}
                className={feedback && choice === current.answer
                  ? 'eq-choice--correct'
                  : feedback === 'retry' && choice === selectedAnswer
                    ? 'eq-choice--wrong'
                    : undefined}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {mode !== 'arena' && mode !== 'merge' && hintLevel < 3 && !answered && (
          <button
            className="eq-hint-button"
            type="button"
            onClick={() => setHintLevel((level) => Math.min(3, level + 1) as HintLevel)}
          >
            ヒントをひとつ見る
          </button>
        )}

        {feedback && (
          <div className={`eq-feedback eq-feedback--${feedback}`} role="status">
            {feedback === 'correct' ? `せいかい！「${current.answer}」をゲット` : `だいじょうぶ。答えは「${current.answer}」`}
          </div>
        )}
      </section>
    </main>
  );
}
