import { useEffect, useMemo, useRef, useState } from 'react';
import { playEnglishText, playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { makeAttempt } from './englishQuestEngine';
import { learningItems, mergeTokenMatches, MODE_ITEM_IDS } from './englishQuestGameplay';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt, LearningItem } from './englishQuestTypes';

const STAGES = [
  { id: 'sound', label: 'おとの しずく', icon: '🔊' },
  { id: 'picture', label: 'えの しずく', icon: '🖼️' },
  { id: 'word', label: 'もじの しずく', icon: '✨' },
] as const;

export function MergeGame({
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
  const items = useMemo(() => learningItems(MODE_ITEM_IDS.merge), []);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [recipe, setRecipe] = useState(false);
  const startedAt = useRef(performance.now());
  const current = items[index];
  const stageInfo = STAGES[stage];

  useEffect(() => {
    setSelectedId(null);
    setFeedback('');
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => {
      if (stage === 0) playLearningItem(current, soundOn);
      else speakJapanese(`${stageInfo.label}を、泉へ運ぼう`, soundOn);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, soundOn, stage, stageInfo.label]);

  if (!current) {
    return <QuestComplete title="ことば結晶 完成！" message="音・絵・もじを、自分の手でひとつにできたよ。" reward={`${combo} コンボの光を ゲット`} onDone={onComplete} />;
  }

  const tokens = [current, items[(index + 1) % items.length], items[(index + 2) % items.length]];
  const ordered = (index + stage) % 2 === 0 ? tokens : [tokens[1], tokens[0], tokens[2]];
  const tokenContent = (item: LearningItem) => {
    if (stage === 0) return '🔊';
    if (stage === 1) return item.emoji;
    return item.answer;
  };
  const tokenLabel = (item: LearningItem) => {
    if (stage === 0) return `${item.display}の音のしずくを選ぶ`;
    if (stage === 1) return `${item.display}の絵のしずくを選ぶ`;
    return `${item.answer}の文字のしずくを選ぶ`;
  };
  const chooseToken = (item: LearningItem) => {
    setSelectedId(item.id);
    if (stage === 0) playLearningItem(item, soundOn);
  };
  const merge = (itemId: string | null) => {
    if (!itemId || recipe) return;
    const correct = mergeTokenMatches(itemId, current.id);
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'merge',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: correct ? 0 : 1,
    }));
    if (!correct) {
      setCombo(0);
      setFeedback('しずくが ぷるん！ 音と絵を もういちど見よう');
      playLearningItem(current, soundOn);
      return;
    }
    setCombo((value) => value + 1);
    setFeedback('ぴったり！ しずくが光ったよ');
    setSelectedId(null);
    if (stage < STAGES.length - 1) {
      window.setTimeout(() => setStage((value) => value + 1), 550);
      return;
    }
    setRecipe(true);
    const plural = current.answer === 'fish' ? 'fish' : `${current.answer}s`;
    window.setTimeout(() => playEnglishText(`I like ${plural}.`, undefined, soundOn), 300);
    window.setTimeout(() => {
      setRecipe(false);
      setStage(0);
      setIndex((value) => value + 1);
    }, 1450);
  };

  return (
    <main className="eq-shell eq-game-shell eq-merge-game">
      <QuestGameHeader title="ことば錬金パズル" instruction="しずくを運んで 結晶をつくろう" step={index} total={items.length} onExit={onExit} guideIndex={3} />
      <section className="eq-merge-lab">
        <div className="eq-merge-status"><span>{stageInfo.icon} {stageInfo.label}</span><strong>{combo} COMBO</strong></div>
        <div className="eq-droplet-sky" aria-label="運べることばのしずく">
          {ordered.map((item, tokenIndex) => (
            <button
              type="button"
              draggable
              key={`${stageInfo.id}-${item.id}`}
              className={selectedId === item.id ? `eq-droplet eq-droplet--${tokenIndex} eq-droplet--selected` : `eq-droplet eq-droplet--${tokenIndex}`}
              onClick={() => chooseToken(item)}
              onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
              aria-label={tokenLabel(item)}
            >
              <span>{tokenContent(item)}</span>
              {stage === 0 && <small>おとを きく</small>}
            </button>
          ))}
        </div>
        <div className="eq-merge-current"><span>{current.emoji}</span><small>この なかまを つくろう</small></div>
        <button
          type="button"
          className="eq-merge-fountain"
          onClick={() => merge(selectedId)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            merge(event.dataTransfer.getData('text/plain'));
          }}
        >
          <span>💧</span><strong>ここへ はこぶ</strong><small>ドラッグ または タップ</small>
        </button>
        <div className="eq-recipe-rail" aria-label="ことばのレシピ"><span>I</span><b>＋</b><span>❤️</span><b>＋</b><span>{current.emoji}</span></div>
        {feedback && <p className="eq-merge-feedback" role="status">{feedback}</p>}
        {recipe && <div className="eq-recipe-burst" role="status"><span>✨</span><strong>I like {current.answer === 'fish' ? 'fish' : `${current.answer}s`}.</strong><small>ことば結晶 かんせい！</small></div>}
      </section>
    </main>
  );
}
