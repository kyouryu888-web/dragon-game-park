import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playLearningItem, speakJapanese, stopEnglishAudio } from './englishQuestAudio';
import { makeAttempt } from './englishQuestEngine';
import {
  arenaTargetAt,
  learningItems,
  MODE_ITEM_IDS,
  moveArenaPoint,
  type ArenaDirection,
  type ArenaPoint,
} from './englishQuestGameplay';
import { DragonSprite } from './EnglishQuestSprites';
import { QuestComplete, QuestGameHeader } from './QuestGameUI';
import type { Attempt } from './englishQuestTypes';

const TARGETS: ArenaPoint[] = [{ x: 19, y: 22 }, { x: 81, y: 23 }, { x: 50, y: 48 }];
const CRYSTAL_CLASS = ['red', 'blue', 'green'] as const;

export function ArenaGame({
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
  const items = useMemo(() => learningItems(MODE_ITEM_IDS.arena), []);
  const [index, setIndex] = useState(0);
  const [player, setPlayer] = useState<ArenaPoint>({ x: 50, y: 82 });
  const [timeLeft, setTimeLeft] = useState(45);
  const [slowMode, setSlowMode] = useState(false);
  const [message, setMessage] = useState('');
  const startedAt = useRef(performance.now());
  const locked = useRef(false);
  const playerRef = useRef<ArenaPoint>({ x: 50, y: 82 });
  const current = items[index];

  useEffect(() => {
    if (!current) return;
    startedAt.current = performance.now();
    locked.current = false;
    playerRef.current = { x: 50, y: 82 };
    setPlayer({ x: 50, y: 82 });
    setMessage('');
    const timer = window.setTimeout(() => {
      speakJapanese('聞こえた色の結晶まで、ドラゴンを動かそう', soundOn);
      window.setTimeout(() => playLearningItem(current, soundOn), 1350);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      stopEnglishAudio();
    };
  }, [current, soundOn]);

  useEffect(() => {
    if (!current) return undefined;
    const timer = window.setInterval(() => setTimeLeft((value) => (value <= 1 ? 45 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [current]);

  const move = useCallback((direction: ArenaDirection) => {
    if (!current || locked.current) return;
    const nextPoint = moveArenaPoint(playerRef.current, direction, slowMode ? 6 : 9);
    const hit = arenaTargetAt(nextPoint, TARGETS, 10);
    if (hit < 0) {
      playerRef.current = nextPoint;
      setPlayer(nextPoint);
      return;
    }
    const correct = items[hit]?.id === current.id;
    onAttempt(makeAttempt({
      itemId: current.id,
      mode: 'arena',
      correct,
      latencyMs: performance.now() - startedAt.current,
      hintLevel: slowMode ? 1 : 0,
    }));
    if (!correct) {
      const reset = { x: 50, y: 82 };
      playerRef.current = reset;
      setPlayer(reset);
      setMessage('ちがう色だよ。音をもういちど聞こう！');
      playLearningItem(current, soundOn);
      return;
    }
    playerRef.current = nextPoint;
    setPlayer(nextPoint);
    locked.current = true;
    setMessage('魔法の結晶をゲット！');
    window.setTimeout(() => setIndex((value) => value + 1), 700);
  }, [current, items, onAttempt, slowMode, soundOn]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const directions: Partial<Record<string, ArenaDirection>> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [move]);

  if (!current) {
    return <QuestComplete title="アリーナ勝利！" message="英語の合図を聞いて、自分でドラゴンを動かしたよ。" reward="勇気のほのおを ゲット" onDone={onComplete} />;
  }

  return (
    <main className="eq-shell eq-game-shell eq-arena-game">
      <QuestGameHeader title="ドラゴンアリーナ" instruction="英語を聞いて 結晶まで動こう" step={index} total={items.length} onExit={onExit} guideIndex={2} />
      <section className={slowMode ? 'eq-arena-board eq-arena-board--slow' : 'eq-arena-board'} aria-label="ドラゴンを動かすアリーナ">
        <div className="eq-arena-hud">
          <span>⏱ {timeLeft}</span>
          <button type="button" onClick={() => playLearningItem(current, soundOn)}>🔊 もういちど</button>
          <button type="button" onClick={() => setSlowMode((value) => !value)}>{slowMode ? '▶ ふつう' : '🐢 ゆっくり'}</button>
        </div>
        <div className="eq-arena-goal"><small>ねらう音</small><button type="button" onClick={() => playLearningItem(current, soundOn)}>🔊</button></div>
        {TARGETS.map((target, targetIndex) => (
          <div
            key={CRYSTAL_CLASS[targetIndex]}
            className={`eq-crystal eq-crystal--${CRYSTAL_CLASS[targetIndex]}`}
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            aria-label={`${items[targetIndex].display}の結晶`}
          ><i /><span>{items[targetIndex].emoji}</span></div>
        ))}
        {!slowMode && <><i className="eq-fireball eq-fireball--one" /><i className="eq-fireball eq-fireball--two" /></>}
        <div className="eq-arena-player-hitbox" style={{ left: `${player.x}%`, top: `${player.y}%` }}>
          <DragonSprite pose={2} label="動かすドラゴン" />
        </div>
        {message && <p className="eq-arena-message" role="status">{message}</p>}
      </section>
      <section className="eq-arena-controls" aria-label="ドラゴンの移動ボタン">
        <button type="button" className="eq-dpad-up" onClick={() => move('up')} aria-label="上へ動く">▲</button>
        <button type="button" className="eq-dpad-left" onClick={() => move('left')} aria-label="左へ動く">◀</button>
        <button type="button" className="eq-dpad-down" onClick={() => move('down')} aria-label="下へ動く">▼</button>
        <button type="button" className="eq-dpad-right" onClick={() => move('right')} aria-label="右へ動く">▶</button>
        <div className="eq-shield-button" aria-hidden="true">🛡️<small>ぶつかっても<br />ゲームオーバーなし</small></div>
      </section>
    </main>
  );
}
