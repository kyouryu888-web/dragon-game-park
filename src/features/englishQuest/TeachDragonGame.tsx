import { useEffect, useMemo, useRef, useState } from 'react';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { advancePracticeTurns, choicesForItem, createPracticeTurns } from './englishQuestGameplay';
import { DragonSprite } from './EnglishQuestSprites';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt, LearningItem, QuestDefinition } from './englishQuestTypes';

export function TeachDragonGame({
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
  const [phase, setPhase] = useState<'judge' | 'correct'>('judge');
  const [message, setMessage] = useState('');
  const startedAt = useRef(performance.now());
  const locked = useRef(false);
  const currentTurn = turns[0];
  const current = currentTurn?.item;
  const choices = useMemo(() => current ? choicesForItem(items, current, answered, 3) : [], [answered, current, items]);
  const proposal = useMemo(() => {
    if (!current) return undefined;
    if (currentTurn.hintLevel === 1) return choices.find((item) => item.id !== current.id) ?? current;
    return choices[(answered * 2 + 1) % choices.length] ?? current;
  }, [answered, choices, current, currentTurn?.hintLevel]);
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));

  useEffect(() => {
    setPhase('judge');
    setMessage('');
    locked.current = false;
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => {
      speakJapanese('ドラゴンが音と絵を覚えられるように、先生になって教えてあげよう', soundOn);
      window.setTimeout(() => playLearningItem(current, soundOn), 1350);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, currentTurn?.key, soundOn]);

  if (!current || !proposal) {
    return <QuestComplete title="ドラゴン先生 クリア！" message="教えると、自分の記憶ももっと強くなるよ。" reward="🌟 記憶の星" onDone={onComplete} />;
  }

  const finishTurn = (correct: boolean) => {
    if (locked.current) return;
    locked.current = true;
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'review',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: currentTurn.hintLevel,
    }));
    setMessage(correct ? '教えてくれてありがとう！ ドラゴンが覚えたよ。' : 'だいじょうぶ。あとで光るヒントと一緒に教え直そう！');
    if (correct) playLearningItem(current, soundOn);
    window.setTimeout(() => {
      setTurns((value) => advancePracticeTurns(value, correct, items));
      setAnswered((value) => value + 1);
    }, 850);
  };

  const judgeProposal = (agrees: boolean) => {
    const proposalIsCorrect = proposal.id === current.id;
    if (!agrees && !proposalIsCorrect) {
      setPhase('correct');
      setMessage('そのとおり！ では、正しい絵をドラゴンに教えてね。');
      playLearningItem(current, soundOn);
      return;
    }
    finishTurn(agrees === proposalIsCorrect);
  };
  const totalTurns = answered + turns.length;

  return (
    <main className="eq-shell eq-game-shell eq-teach-game">
      <QuestGameHeader
        title="ドラゴン先生のお願い"
        instruction={currentTurn.hintLevel === 1 ? 'おさらい！ 光る絵を教えてあげよう' : '音とドラゴンの絵が合うか教えよう'}
        step={answered}
        total={totalTurns}
        onExit={onExit}
        guideIndex={guideIndex}
      />
      <section className="eq-teach-stage">
        <div className="eq-teach-stars" aria-label={`教えた数 ${answered}`}><span>教えた数</span><strong>{'★'.repeat(Math.min(6, answered))}{'☆'.repeat(Math.max(0, 6 - answered))}</strong></div>
        <button className="eq-teach-listen" type="button" onClick={() => playLearningItem(current, soundOn)}>🔊 お手本を聞く</button>
        <div className="eq-teach-bubble">
          <small>ドラゴンの こたえ</small>
          <span aria-hidden="true">{proposal.emoji}</span>
          <strong>{proposal.display}</strong>
          <p>この絵で あってる？</p>
        </div>
        <DragonSprite pose={phase === 'correct' ? 3 : 0} label="教えてもらうドラゴン" className="eq-teach-dragon" />

        {phase === 'judge' ? (
          <div className="eq-teach-judge" aria-label="ドラゴンの答えを判定する">
            <button type="button" className="is-yes" onClick={() => judgeProposal(true)}>⭕ そうだよ</button>
            <button type="button" className="is-no" onClick={() => judgeProposal(false)}>🙅 ちがうよ</button>
          </div>
        ) : (
          <div className="eq-teach-corrections" aria-label="ドラゴンに教える正しい絵">
            {choices.map((item) => (
              <button
                type="button"
                key={item.id}
                className={currentTurn.hintLevel === 1 && item.id === current.id ? 'is-hint' : ''}
                onClick={() => finishTurn(item.id === current.id)}
              >
                <span aria-hidden="true">{item.emoji}</span><small>{item.display}</small>
              </button>
            ))}
          </div>
        )}
        {message && <p className="eq-teach-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
