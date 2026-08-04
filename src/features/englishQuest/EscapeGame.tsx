import { useEffect, useMemo, useRef, useState } from 'react';
import { playEnglishText, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { makeAttempt } from './englishQuestEngine';
import { escapeDoorMatches, learningItems, MODE_ITEM_IDS } from './englishQuestGameplay';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt } from './englishQuestTypes';

const SCENARIOS = [
  {
    expected: 'blue', sign: 'BLUE DOOR', voice: 'Open the blue door.', world: 'まほうの とびら',
    exits: [{ id: 'red', label: 'あか', mark: '🔴' }, { id: 'blue', label: 'あお', mark: '🔵' }, { id: 'green', label: 'みどり', mark: '🟢' }],
  },
  {
    expected: 'open', sign: 'OPEN', voice: 'The shop is open.', world: 'よるの おみせ',
    exits: [{ id: 'closed', label: 'しまっている', mark: '🌙' }, { id: 'open', label: 'ひらいている', mark: '💡' }, { id: 'staff', label: 'おみせの人', mark: '🧹' }],
  },
  {
    expected: '8', sign: 'BUS 8', voice: 'Take bus eight.', world: 'もりの バスてい',
    exits: [{ id: '3', label: '3', mark: '🚌' }, { id: '8', label: '8', mark: '🚌' }, { id: '12', label: '12', mark: '🚌' }],
  },
] as const;

export function EscapeGame({
  soundOn,
  onAttempt,
  onComplete,
  onExit,
}: {
  soundOn: boolean;
  onAttempt: (attempt: Attempt) => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const items = useMemo(() => learningItems(MODE_ITEM_IDS.escape), []);
  const [index, setIndex] = useState(0);
  const [clues, setClues] = useState<number[]>([]);
  const [combined, setCombined] = useState(false);
  const [message, setMessage] = useState('');
  const startedAt = useRef(performance.now());
  const current = items[index];
  const scenario = SCENARIOS[index];

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

  if (!current || !scenario) {
    return <QuestComplete title="脱出 大成功！" message="看板と会話を組み合わせて、自分で出口を見つけたよ。" reward="ひらめきの鍵を ゲット" onDone={onComplete} />;
  }

  const collect = (clue: number) => {
    setClues((values) => Array.from(new Set([...values, clue])));
    if (clue === 1) playEnglishText(scenario.voice, undefined, soundOn);
    else speakJapanese('看板の手がかりを見つけたよ', soundOn);
  };
  const tryExit = (exitId: string) => {
    if (!combined) {
      setMessage('まだ鍵がないよ。二つの手がかりを かさねよう');
      return;
    }
    const correct = escapeDoorMatches(exitId, scenario.expected, combined ? 2 : 0);
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'escape',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: correct ? 0 : 1,
    }));
    if (!correct) {
      setMessage('この出口ではないみたい。看板と声を もういちど見よう');
      playEnglishText(scenario.voice, undefined, soundOn);
      return;
    }
    setMessage('鍵が光った！ 出口がひらくよ');
    window.setTimeout(() => setIndex((value) => value + 1), 800);
  };

  return (
    <main className="eq-shell eq-game-shell eq-escape-game">
      <QuestGameHeader title="記憶の脱出迷宮" instruction="手がかりを集めて 出口をひらこう" step={index} total={items.length} onExit={onExit} guideIndex={1} />
      <section className="eq-escape-room">
        <div className="eq-room-title"><span>🗝️</span><strong>{scenario.world}</strong><small>へやの中を さわって しらべよう</small></div>
        <button className={clues.includes(0) ? 'eq-clue-hotspot eq-clue-hotspot--sign eq-clue-hotspot--found' : 'eq-clue-hotspot eq-clue-hotspot--sign'} type="button" onClick={() => collect(0)}>
          <span>{clues.includes(0) ? scenario.sign : '📜'}</span><small>{clues.includes(0) ? '看板を見つけた' : '巻物をしらべる'}</small>
        </button>
        <button className={clues.includes(1) ? 'eq-clue-hotspot eq-clue-hotspot--voice eq-clue-hotspot--found' : 'eq-clue-hotspot eq-clue-hotspot--voice'} type="button" onClick={() => collect(1)}>
          <span>🔊</span><small>{clues.includes(1) ? '声を聞いた' : '光る石をしらべる'}</small>
        </button>
        <div className="eq-world-exits">
          {scenario.exits.map((exit) => (
            <button type="button" key={exit.id} className={`eq-world-exit eq-world-exit--${exit.id}`} onClick={() => tryExit(exit.id)}>
              <span>{exit.mark}</span><strong>{exit.label}</strong><i aria-hidden="true">🚪</i>
            </button>
          ))}
        </div>
        <div className="eq-clue-tray">
          <div className={clues.includes(0) ? 'eq-clue-piece eq-clue-piece--ready' : 'eq-clue-piece'}>{clues.includes(0) ? scenario.sign : '？'}</div>
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
