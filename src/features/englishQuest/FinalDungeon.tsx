import { useEffect, useMemo, useRef, useState } from 'react';
import dungeonBackground from './assets/final-dungeon-background-v3.webp';
import { playEnglishText, playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { ITEM_BY_ID } from './englishQuestContent';
import { makeAttempt } from './englishQuestEngine';
import { rotatedChoices } from './englishQuestGameplay';
import { DragonSprite, GuideSprite } from './EnglishQuestSprites';
import { QuestComplete } from './QuestGameUI';
import type { Attempt, LearningItem, QuestDefinition } from './englishQuestTypes';

const ROOM_NAMES = ['エコーの門', 'ことばの橋', 'ワードの炉', '予定の蔵'] as const;
const BRIDGE_STEPS = [
  { color: 'red', label: 'あか', direction: '↑', itemId: 'word-red' },
  { color: 'blue', label: 'あお', direction: '←', itemId: 'word-blue' },
  { color: 'yellow', label: 'きいろ', direction: '→', itemId: 'word-yellow' },
] as const;

const byId = (id: string, fallback: LearningItem): LearningItem => ITEM_BY_ID.get(id) ?? fallback;

export function FinalDungeon({
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
  const [room, setRoom] = useState(0);
  const [heard, setHeard] = useState<string[]>([]);
  const [bridgeStep, setBridgeStep] = useState(0);
  const [forgeWords, setForgeWords] = useState<string[]>([]);
  const [vaultClues, setVaultClues] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const startedAt = useRef(performance.now());
  const fallback = items[0] ?? ITEM_BY_ID.get('word-key');
  const echoTarget = fallback ? byId('word-key', fallback) : undefined;
  const echoChoices = useMemo(
    () => echoTarget ? rotatedChoices([echoTarget, ...items.filter((item) => item.id !== echoTarget.id)], 0, 3) : [],
    [echoTarget, items],
  );
  const forgeItem = echoTarget ? byId('chunk-open-door', echoTarget) : undefined;
  const forgeTokens = useMemo(
    () => forgeItem?.answer.split(/\s+/).map((word, index) => ({ id: `${index}-${word}`, word, index })).reverse() ?? [],
    [forgeItem],
  );
  const vaultItem = echoTarget ? byId('reading-library-time', echoTarget) : undefined;

  useEffect(() => {
    startedAt.current = performance.now();
    setMessage('');
    if (room === 0 && echoTarget) {
      const timer = window.setTimeout(() => {
        speakJapanese('三つの台座を調べて、鍵の音を見つけよう', soundOn);
        window.setTimeout(() => playLearningItem(echoTarget, soundOn), 1250);
      }, 250);
      return () => {
        window.clearTimeout(timer);
        stopEnglishAudio();
      };
    }
    if (room === 1) {
      const timer = window.setTimeout(() => playEnglishText('red, blue, yellow', undefined, soundOn), 350);
      return () => {
        window.clearTimeout(timer);
        stopEnglishAudio();
      };
    }
    if (room === 2 && forgeItem) {
      const timer = window.setTimeout(() => playLearningItem(forgeItem, soundOn), 350);
      return () => {
        window.clearTimeout(timer);
        stopEnglishAudio();
      };
    }
    if (room === 3) {
      const timer = window.setTimeout(() => speakJapanese('地図と時計を調べて、開く時間の扉を選ぼう', soundOn), 350);
      return () => {
        window.clearTimeout(timer);
        stopEnglishAudio();
      };
    }
    return () => stopEnglishAudio();
  }, [echoTarget, forgeItem, room, soundOn]);

  if (!echoTarget || !forgeItem || !vaultItem || room >= ROOM_NAMES.length) {
    return (
      <QuestComplete
        title="はじまりの森を 救った！"
        message="音・動き・文・予定表を組み合わせて、四つの部屋を自分の力で突破したよ。"
        reward={`${quest.rewardEmoji} ${quest.reward}`}
        onDone={onComplete}
      />
    );
  }

  const record = (item: LearningItem, correct: boolean, hintLevel: 0 | 1 | 2 = 0) => {
    onAttempt(makeAttempt({
      itemId: item.id,
      mode: 'escape',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel,
    }));
  };
  const clearRoom = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setRoom((value) => value + 1), 900);
  };
  const chooseEcho = (item: LearningItem) => {
    if (!heard.includes(item.id)) {
      setHeard((values) => [...values, item.id]);
      playLearningItem(item, soundOn);
      return;
    }
    const correct = item.id === echoTarget.id;
    record(echoTarget, correct, correct ? 0 : 1);
    if (!correct) {
      setMessage('この音ではないみたい。台座をもう一度聞き比べよう');
      playLearningItem(echoTarget, soundOn);
      return;
    }
    clearRoom('鍵の音が門に届いた！');
  };
  const pressBridge = (step: typeof BRIDGE_STEPS[number]) => {
    const expected = BRIDGE_STEPS[bridgeStep];
    const item = byId(expected.itemId, echoTarget);
    const correct = step.color === expected.color;
    record(item, correct, correct ? 0 : 1);
    if (!correct) {
      setMessage('道は消えないよ。聞こえた色の順をもう一度たどろう');
      playEnglishText(BRIDGE_STEPS.map((entry) => entry.color).join(', '), undefined, soundOn);
      return;
    }
    if (bridgeStep + 1 >= BRIDGE_STEPS.length) {
      clearRoom('三つの足場を渡りきった！');
    } else {
      setBridgeStep((value) => value + 1);
      setMessage('ひとつ進んだ！ 次の色はどれかな？');
    }
  };
  const chooseForgeWord = (token: { id: string; word: string; index: number }) => {
    if (forgeWords.includes(token.id)) return;
    const expectedIndex = forgeWords.length;
    const correct = token.index === expectedIndex;
    if (!correct) {
      record(forgeItem, false, 1);
      setMessage('炉がやさしく光ったよ。聞こえた順を思い出そう');
      playLearningItem(forgeItem, soundOn);
      return;
    }
    const next = [...forgeWords, token.id];
    setForgeWords(next);
    if (next.length === forgeTokens.length) {
      record(forgeItem, true);
      clearRoom('ことばの鍵が完成した！');
    }
  };
  const chooseVault = (time: string) => {
    if (vaultClues.length < 2) {
      setMessage('まだ手がかりが足りないよ。地図と時計を調べよう');
      return;
    }
    const correct = time === vaultItem.answer;
    record(vaultItem, correct, correct ? 0 : 1);
    if (!correct) {
      setMessage('時計と予定表を重ねて、もう一度考えよう');
      return;
    }
    clearRoom('最後の扉が開いた！');
  };

  return (
    <main className="eq-shell eq-final-dungeon" style={{ backgroundImage: `url(${dungeonBackground})` }}>
      <header className="eq-dungeon-header">
        <button className="eq-round-button" type="button" onClick={onExit} aria-label="地図へもどる">←</button>
        <div><small>最終章</small><h1>記憶の脱出ダンジョン</h1></div>
        <strong>💧 {room + 1} / 4</strong>
      </header>
      <ol className="eq-dungeon-route" aria-label="四つの部屋">
        {ROOM_NAMES.map((name, index) => (
          <li key={name} className={index === room ? 'is-current' : index < room ? 'is-done' : ''}>
            <span>{index < room ? '✓' : index + 1}</span><strong>{name}</strong>
          </li>
        ))}
      </ol>

      <section className={`eq-dungeon-room eq-dungeon-room--${room}`}>
        <GuideSprite index={0} label="ミーナ" className="eq-dungeon-guide" />
        {room === 0 && (
          <>
            <div className="eq-dungeon-instruction"><h2>鍵の音を さがそう</h2><p>台座は1回目で音を聞き、2回目で門へ送るよ</p><button type="button" onClick={() => playLearningItem(echoTarget, soundOn)}>🔊 鍵の音</button></div>
            <div className="eq-echo-gate" aria-hidden="true">🔒</div>
            <div className="eq-echo-pedestals">
              {echoChoices.map((item) => (
                <button type="button" key={item.id} className={heard.includes(item.id) ? 'is-heard' : ''} onClick={() => chooseEcho(item)}>
                  <span>{heard.includes(item.id) ? item.emoji : '🔮'}</span><small>{heard.includes(item.id) ? 'もう一度で送る' : '音を調べる'}</small>
                </button>
              ))}
            </div>
          </>
        )}
        {room === 1 && (
          <>
            <div className="eq-dungeon-instruction"><h2>音の順に ドラゴンを動かそう</h2><p>まちがえても 道は消えない</p><button type="button" onClick={() => playEnglishText('red, blue, yellow', undefined, soundOn)}>🔊 もういちど聞く</button></div>
            <div className="eq-bridge-world">
              <div className="eq-bridge-stones" aria-hidden="true">
                {BRIDGE_STEPS.map((step, index) => (
                  <i key={step.color} className={`is-${step.color} ${index < bridgeStep ? 'is-crossed' : ''}`}>
                    <span>{step.direction}</span>
                  </i>
                ))}
              </div>
              <DragonSprite pose={2} className="eq-bridge-dragon" />
            </div>
            <div className="eq-bridge-controls" aria-label="色のついた移動ボタン">
              {BRIDGE_STEPS.map((step) => <button type="button" key={step.color} className={`is-${step.color}`} onClick={() => pressBridge(step)}><span>{step.direction}</span><small>{step.label}</small></button>)}
            </div>
          </>
        )}
        {room === 2 && (
          <>
            <div className="eq-dungeon-instruction"><h2>ことばを 聞こえた順に</h2><p>かけらを炉へ入れて文を作ろう</p><button type="button" onClick={() => playLearningItem(forgeItem, soundOn)}>🔊 もういちど聞く</button></div>
            <div className="eq-word-forge"><span aria-hidden="true">🔥</span><div>{forgeItem.answer.split(/\s+/).map((word, index) => <b key={`${word}-${index}`}>{forgeWords.length > index ? word : '…'}</b>)}</div></div>
            <div className="eq-forge-tokens">
              {forgeTokens.map((token) => <button type="button" key={token.id} disabled={forgeWords.includes(token.id)} onClick={() => chooseForgeWord(token)}>{token.word}</button>)}
            </div>
          </>
        )}
        {room === 3 && (
          <>
            <div className="eq-dungeon-instruction"><h2>図書館が開く時間は？</h2><p>二つの場所を調べて予定表を完成させよう</p></div>
            <div className="eq-vault-clues">
              <button type="button" className={vaultClues.includes('map') ? 'is-found' : ''} onClick={() => setVaultClues((values) => Array.from(new Set([...values, 'map'])))}><span>🗺️</span><strong>{vaultClues.includes('map') ? 'LIBRARY' : '地図を調べる'}</strong></button>
              <button type="button" className={vaultClues.includes('clock') ? 'is-found' : ''} onClick={() => { setVaultClues((values) => Array.from(new Set([...values, 'clock']))); playLearningItem(vaultItem, soundOn); }}><span>🕒</span><strong>{vaultClues.includes('clock') ? vaultItem.answer : '時計を調べる'}</strong></button>
            </div>
            <div className="eq-vault-doors">
              {['2:00', '3:00', '8:00'].map((time) => <button type="button" key={time} onClick={() => chooseVault(time)}><span>{time}</span><small>🚪</small></button>)}
            </div>
          </>
        )}
        {message && <p className="eq-dungeon-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
