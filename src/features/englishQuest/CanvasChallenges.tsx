import { useEffect, useRef, useState } from 'react';
import forestMap from './assets/forest-island-map.webp';
import dragonSprites from './assets/dragon-sprites.webp';
import type { LearningItem } from './englishQuestTypes';

type Point = { x: number; y: number };

const TARGETS: Point[] = [
  { x: 175, y: 205 },
  { x: 545, y: 205 },
  { x: 175, y: 470 },
  { x: 545, y: 470 },
];

function getCanvasPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function ArenaChallenge({ item, onSelect }: { item: LearningItem; onSelect: (answer: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(null);
    lockedRef.current = false;
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [item.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const map = new Image();
    const dragon = new Image();
    let disposed = false;
    let loaded = 0;

    const paint = () => {
      if (disposed || loaded < 2) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(map, 0, 0, map.width, map.height * 0.62, 0, 0, 720, 720);
      context.fillStyle = 'rgba(23, 16, 34, .34)';
      context.fillRect(0, 0, 720, 720);

      const colors = ['#36b9a3', '#f08b45', '#4a9fe8', '#8d62c6'];
      item.choices.forEach((choice, index) => {
        const target = TARGETS[index];
        context.save();
        context.shadowColor = selected === choice ? '#fff0a6' : 'rgba(0,0,0,.45)';
        context.shadowBlur = selected === choice ? 28 : 12;
        context.fillStyle = selected === choice ? '#ffe982' : colors[index];
        context.beginPath();
        context.arc(target.x, target.y, 78, 0, Math.PI * 2);
        context.fill();
        context.lineWidth = 7;
        context.strokeStyle = '#fff7d6';
        context.stroke();
        context.fillStyle = '#21152d';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `700 ${choice.length > 12 ? 23 : 30}px "Zen Maru Gothic", sans-serif`;
        context.fillText(choice.slice(0, 18), target.x, target.y, 132);
        context.restore();
      });

      const sw = dragon.width / 2;
      const sh = dragon.height / 2;
      context.drawImage(dragon, 0, 0, sw, sh, 275, 485, 170, 170);
    };

    map.onload = () => { loaded += 1; paint(); };
    dragon.onload = () => { loaded += 1; paint(); };
    map.src = forestMap;
    dragon.src = dragonSprites;
    return () => { disposed = true; };
  }, [item, selected]);

  const choose = (choice: string) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setSelected(choice);
    timerRef.current = window.setTimeout(() => onSelect(choice), 260);
  };

  return (
    <div className="eq-canvas-game">
      <canvas
        ref={canvasRef}
        width={720}
        height={720}
        aria-label="4つの魔法から答えを選ぶアリーナ"
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || selected) return;
          const point = getCanvasPoint(canvas, event);
          const hit = TARGETS.findIndex((target) => Math.hypot(point.x - target.x, point.y - target.y) <= 92);
          if (hit >= 0) choose(item.choices[hit]);
        }}
      />
      <div className="eq-canvas-answer-list" aria-label="ゆっくり選ぶ">
        {item.choices.map((choice, index) => (
          <button type="button" key={choice} onClick={() => choose(choice)} disabled={Boolean(selected)}>
            <span>{index + 1}</span>{choice}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MergeChallenge({ item, onSelect }: { item: LearningItem; onSelect: (answer: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(null);
    lockedRef.current = false;
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [item.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let stopped = false;

    const paint = () => {
      if (stopped) return;
      context.clearRect(0, 0, 720, 620);
      const gradient = context.createLinearGradient(0, 0, 0, 620);
      gradient.addColorStop(0, '#132c45');
      gradient.addColorStop(0.62, '#0e6c7d');
      gradient.addColorStop(1, '#25c7bf');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 720, 620);

      context.globalAlpha = 0.34;
      for (let bubble = 0; bubble < 22; bubble += 1) {
        const x = (bubble * 97 + frame * 0.25) % 740;
        const y = 620 - ((bubble * 73 + frame * 0.5) % 670);
        context.strokeStyle = '#d8ffff';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x, y, 8 + (bubble % 5) * 3, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;

      context.fillStyle = '#fff8c7';
      context.textAlign = 'center';
      context.font = '700 66px "Zen Maru Gothic", sans-serif';
      context.fillText(item.emoji, 360, 100);
      context.font = '700 24px "Zen Maru Gothic", sans-serif';
      context.fillText('ぴったりの ことばの玉を マージ！', 360, 152);

      item.choices.forEach((choice, index) => {
        const x = 110 + index * 165;
        const float = Math.sin((frame + index * 25) / 22) * 15;
        const y = 335 + float;
        const isSelected = selected === choice;
        const orb = context.createRadialGradient(x - 18, y - 22, 8, x, y, 76);
        orb.addColorStop(0, '#ffffff');
        orb.addColorStop(0.2, isSelected ? '#ffe466' : '#9cfaff');
        orb.addColorStop(1, isSelected ? '#e98a2d' : '#2474a5');
        context.fillStyle = orb;
        context.beginPath();
        context.arc(x, y, 72, 0, Math.PI * 2);
        context.fill();
        context.lineWidth = 5;
        context.strokeStyle = '#eaffff';
        context.stroke();
        context.fillStyle = '#132238';
        context.font = `800 ${choice.length > 12 ? 19 : 25}px "Zen Maru Gothic", sans-serif`;
        context.fillText(choice.slice(0, 18), x, y + 2, 125);
      });

      roundedRect(context, 185, 505, 350, 72, 34);
      context.fillStyle = 'rgba(8, 31, 50, .72)';
      context.fill();
      context.strokeStyle = '#c9fffb';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#ffffff';
      context.font = '700 25px "Zen Maru Gothic", sans-serif';
      context.fillText('音 ＋ 絵 ＋ ことば', 360, 542);

      frame += 1;
      requestAnimationFrame(paint);
    };
    paint();
    return () => { stopped = true; };
  }, [item, selected]);

  const choose = (choice: string) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setSelected(choice);
    timerRef.current = window.setTimeout(() => onSelect(choice), 300);
  };

  return (
    <div className="eq-canvas-game eq-canvas-game--merge">
      <canvas
        ref={canvasRef}
        width={720}
        height={620}
        aria-label="4つのことばの玉から答えを選ぶマージパズル"
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || selected) return;
          const point = getCanvasPoint(canvas, event);
          const index = Math.round((point.x - 110) / 165);
          if (index >= 0 && index < item.choices.length && point.y > 240 && point.y < 450) {
            choose(item.choices[index]);
          }
        }}
      />
      <div className="eq-canvas-answer-list">
        {item.choices.map((choice) => (
          <button type="button" key={choice} onClick={() => choose(choice)} disabled={Boolean(selected)}>{choice}</button>
        ))}
      </div>
    </div>
  );
}
