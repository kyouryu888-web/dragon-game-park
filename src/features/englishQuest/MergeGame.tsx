import { useEffect, useMemo, useRef, useState } from 'react';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_GUIDES } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { mergeTokenMatches, rotatedChoices } from './englishQuestGameplay';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt, LearningItem, QuestDefinition } from './englishQuestTypes';

const STAGES = [
  { id: 'sound', label: 'おとの しずく', icon: '🔊' },
  { id: 'picture', label: 'えの しずく', icon: '🖼️' },
  { id: 'word', label: 'もじの しずく', icon: '✨' },
] as const;

export function MergeGame({
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [recipe, setRecipe] = useState(false);
  const [phraseDone, setPhraseDone] = useState<string[]>([]);
  const startedAt = useRef(performance.now());
  const current = items[index];
  const stage = index % STAGES.length;
  const stageInfo = STAGES[stage];
  const isPhraseForge = current?.type === 'chunk' || current?.type === 'dialogue';
  const normalTokens = useMemo(() => rotatedChoices(items, index, 3), [index, items]);
  const phraseTokens = useMemo(() => (
    current?.answer.split(/\s+/).map((word, wordIndex) => ({ id: `${wordIndex}-${word}`, word, wordIndex })).reverse() ?? []
  ), [current]);
  const guideIndex = Math.max(0, ENGLISH_QUEST_GUIDES.findIndex((guide) => guide.id === quest.guideId));

  useEffect(() => {
    setSelectedId(null);
    setPhraseDone([]);
    setFeedback('');
    setRecipe(false);
    startedAt.current = performance.now();
    if (!current) return;
    const timer = window.setTimeout(() => {
      if (isPhraseForge) {
        speakJapanese('聞こえた順に、ことばのかけらを炉へ入れよう', soundOn);
        window.setTimeout(() => playLearningItem(current, soundOn), 1250);
      } else if (stage === 0) {
        playLearningItem(current, soundOn);
      } else {
        speakJapanese(`${stageInfo.label}を、泉へ運ぼう`, soundOn);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, isPhraseForge, soundOn, stage, stageInfo.label]);

  if (!current) {
    return <QuestComplete title={`${quest.title} クリア！`} message={quest.objective} reward={`${quest.rewardEmoji} ${quest.reward}・${combo}コンボ`} onDone={onComplete} />;
  }

  const record = (correct: boolean, hintLevel: 0 | 1 = 0) => onAttempt(makeAttempt({
    itemId: current.id,
    mode: 'merge',
    correct,
    latencyMs: performance.now() - startedAt.current,
    hintLevel,
  }));
  const advance = () => {
    setRecipe(true);
    window.setTimeout(() => setIndex((value) => value + 1), 1100);
  };
  const tokenContent = (item: LearningItem) => {
    if (stage === 0) return '🔊';
    if (stage === 1) return item.emoji;
    return item.answer;
  };
  const chooseToken = (item: LearningItem) => {
    setSelectedId(item.id);
    if (stage === 0) playLearningItem(item, soundOn);
  };
  const merge = (itemId: string | null) => {
    if (!itemId || recipe) return;
    const correct = mergeTokenMatches(itemId, current.id);
    record(correct, correct ? 0 : 1);
    if (!correct) {
      setCombo(0);
      setFeedback('しずくが ぷるん！ 音と絵を もういちど見よう');
      playLearningItem(current, soundOn);
      return;
    }
    setCombo((value) => value + 1);
    setFeedback('ぴったり！ 結晶がことばを覚えたよ');
    playLearningItem(current, soundOn);
    advance();
  };
  const choosePhraseToken = (token: typeof phraseTokens[number]) => {
    if (phraseDone.includes(token.id) || recipe) return;
    const correct = token.wordIndex === phraseDone.length;
    if (!correct) {
      record(false, 1);
      setCombo(0);
      setFeedback('炉がやさしく光ったよ。聞こえた順をもう一度ためそう');
      playLearningItem(current, soundOn);
      return;
    }
    const next = [...phraseDone, token.id];
    setPhraseDone(next);
    setFeedback('ことばが ひとつ つながった！');
    if (next.length === phraseTokens.length) {
      record(true);
      setCombo((value) => value + 1);
      playLearningItem(current, soundOn);
      advance();
    }
  };

  return (
    <main className="eq-shell eq-game-shell eq-merge-game">
      <QuestGameHeader title={quest.title} instruction={isPhraseForge ? '聞いた順に 文をつくろう' : 'しずくを運んで 結晶をつくろう'} step={index} total={items.length} onExit={onExit} guideIndex={guideIndex} />
      <section className={isPhraseForge ? 'eq-merge-lab eq-merge-lab--forge' : 'eq-merge-lab'}>
        <div className="eq-merge-status"><span>{isPhraseForge ? '🔥 ことばの炉' : `${stageInfo.icon} ${stageInfo.label}`}</span><strong>{combo} COMBO</strong></div>

        {isPhraseForge ? (
          <>
            <button type="button" className="eq-forge-listen" onClick={() => playLearningItem(current, soundOn)}>🔊 もういちど きく</button>
            <div className="eq-phrase-forge" aria-label="できあがる英文">
              <span aria-hidden="true">🔥</span>
              <div>{current.answer.split(/\s+/).map((word, wordIndex) => <b key={`${word}-${wordIndex}`}>{phraseDone.length > wordIndex ? word : '…'}</b>)}</div>
            </div>
            <div className="eq-phrase-tokens" aria-label="並べることばのかけら">
              {phraseTokens.map((token) => <button type="button" key={token.id} disabled={phraseDone.includes(token.id)} onClick={() => choosePhraseToken(token)}>{token.word}</button>)}
            </div>
          </>
        ) : (
          <>
            <div className="eq-droplet-sky" aria-label="運べることばのしずく">
              {normalTokens.map((item, tokenIndex) => (
                <button
                  type="button"
                  draggable
                  key={`${stageInfo.id}-${item.id}`}
                  className={selectedId === item.id ? `eq-droplet eq-droplet--${tokenIndex} eq-droplet--selected` : `eq-droplet eq-droplet--${tokenIndex}`}
                  onClick={() => chooseToken(item)}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
                  aria-label={`${item.display}の${stageInfo.label}を選ぶ`}
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
            <div className="eq-recipe-rail" aria-label="音と意味のレシピ"><span>🔊</span><b>＋</b><span>{current.emoji}</span><b>＋</b><span>✨</span></div>
          </>
        )}

        {feedback && <p className="eq-merge-feedback" role="status">{feedback}</p>}
        {recipe && <div className="eq-recipe-burst" role="status"><span>✨</span><strong>{current.answer}</strong><small>ことば結晶 かんせい！</small></div>}
      </section>
    </main>
  );
}
