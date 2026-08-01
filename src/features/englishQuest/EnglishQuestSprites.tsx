import type { CSSProperties } from 'react';
import dragonSprites from './assets/dragon-sprites.webp';
import forestGuides from './assets/forest-guides.webp';
import spiritSprites from './assets/spirit-sprites.webp';

const DRAGON_POSITIONS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'] as const;

export function DragonSprite({
  pose = 0,
  className = '',
  label = '相棒のドラゴン',
}: {
  pose?: 0 | 1 | 2 | 3;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`eq-dragon-sprite ${className}`}
      role="img"
      aria-label={label}
      style={{
        backgroundImage: `url(${dragonSprites})`,
        backgroundPosition: DRAGON_POSITIONS[pose],
      }}
    />
  );
}

export function SpiritSprite({
  index,
  className = '',
  label,
  muted = false,
}: {
  index: number;
  className?: string;
  label: string;
  muted?: boolean;
}) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const style = {
    backgroundImage: `url(${spiritSprites})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
    filter: muted ? 'grayscale(1) brightness(.45)' : undefined,
  } satisfies CSSProperties;

  return <span className={`eq-spirit-sprite ${className}`} role="img" aria-label={label} style={style} />;
}

export function GuideSprite({
  index,
  className = '',
  label,
}: {
  index: number;
  className?: string;
  label: string;
}) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const style = {
    backgroundImage: `url(${forestGuides})`,
    backgroundPosition: `${(column / 2) * 100}% ${row * 100}%`,
  } satisfies CSSProperties;

  return <span className={`eq-guide-sprite ${className}`} role="img" aria-label={label} style={style} />;
}
