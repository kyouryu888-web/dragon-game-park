import { useEffect, useMemo, useRef, useState } from 'react';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { escapeDoorMatches, rotatedChoices } from './englishQuestGameplay';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt, LearningItem, QuestDefinition } from './englishQuestTypes';

const ROOM_BY_TYPE: Record<LearningItem['type'], string> = {
  sound: '音の回廊',
  word: '絵の小部屋',
  chunk: 'ことばの食堂',
  dialogue: '会話の広間',
  reading: '予定表の書庫',
};

export function EscapeGame({
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
  const [clues, setClues] = useState<number[]>([]);
  const [combined, setCombined] = useState(false);
  const [message, setMessage] = useState('');
  const startedAt = useRef(performance.now());
  const current = items[index];
  const exits = useMemo(() => rotatedChoices(items, index, 3), [index, items]);
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));

  useEffect(() => {
    setClues([]);
    setCombined(false);
    setMessage('');
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => speakJapanese('部屋をさわって、二つの手がかりを見つけよう', soundOn), 300);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, soundOn]);

  if (!current) {
    return <QuestComplete title={`${quest.title} クリア！`} message={quest.objective} reward={`${quest.rewardEmoji} ${quest.reward}`} onDone={onComplete} />;
  }

  const collect = (clue: number) => {
    setClues((values) => Array.from(new Set([...values, clue])));
    if (clue === 1) playLearningItem(current, soundOn);
    else speakJapanese('絵と看板の手がかりを見つけたよ', soundOn);
  };
  const tryExit = (item: LearningItem) => {
    if (!combined) {
      setMessage('まだ鍵がないよ。二つの手がかりを かさねよう');
      return;
    }
    const correct = escapeDoorMatches(item.id, current.id, combined ? 2 : 0);
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'escape',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: correct ? 0 : 1,
    }));
    if (!correct) {
      setMessage('この出口ではないみたい。看板と声を もういちど見よう');
      playLearningItem(current, soundOn);
      return;
    }
    setMessage('鍵が光った！ 出口がひらくよ');
    window.setTimeout(() => setIndex((value) => value + 1), 800);
  };
  const visibleClue = current.type === 'reading' ? current.answer : current.emoji;

  return (
    <main className="eq-shell eq-game-shell eq-escape-game">
      <QuestGameHeader title={quest.title} instruction="手がかりを集めて 出口をひらこう" step={index} total={items.length} onExit={onExit} guideIndex={guideIndex} />
      <section className="eq-escape-room">
        <div className="eq-room-title"><span>🗝️</span><strong>{ROOM_BY_TYPE[current.type]}</strong><small>へやの中を さわって しらべよう</small></div>
        <button className={clues.includes(0) ? 'eq-clue-hotspot eq-clue-hotspot--sign eq-clue-hotspot--found' : 'eq-clue-hotspot eq-clue-hotspot--sign'} type="button" onClick={() => collect(0)}>
          <span>{clues.includes(0) ? visibleClue : '📜'}</span><small>{clues.includes(0) ? '絵と看板を見つけた' : '巻物をしらべる'}</small>
        </button>
        <button className={clues.includes(1) ? 'eq-clue-hotspot eq-clue-hotspot--voice eq-clue-hotspot--found' : 'eq-clue-hotspot eq-clue-hotspot--voice'} type="button" onClick={() => collect(1)}>
          <span>🔊</span><small>{clues.includes(1) ? '声を聞いた' : '光る石をしらべる'}</small>
        </button>
        <div className="eq-world-exits">
          {exits.map((item, exitIndex) => (
            <button type="button" key={item.id} className={`eq-world-exit eq-world-exit--choice-${exitIndex}`} onClick={() => tryExit(item)}>
              <span>{item.emoji}</span><strong>{item.type === 'reading' || item.type === 'dialogue' ? item.answer : item.display}</strong><i aria-hidden="true">🚪</i>
            </button>
          ))}
        </div>
        <div className="eq-clue-tray">
          <div className={clues.includes(0) ? 'eq-clue-piece eq-clue-piece--ready' : 'eq-clue-piece'}>{clues.includes(0) ? visibleClue : '？'}</div>
          <b>＋</b>
          <div className={clues.includes(1) ? 'eq-clue-piece eq-clue-piece--ready' : 'eq-clue-piece'}>{clues.includes(1) ? '🔊' : '？'}</div>
          <button type="button" disabled={clues.length < 2 || combined} onClick={() => {
            setCombined(true);
            setMessage('二つの手がかりが、ひとつの鍵になった！');
          }}>{combined ? '🗝️ 鍵ができた' : 'かさねて 鍵にする'}</button>
        </div>
        {message && <p className="eq-escape-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
