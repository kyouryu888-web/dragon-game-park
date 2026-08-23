import drawCounterImage from './assets/draw-counter.webp';
import forcedDrawImage from './assets/forced-draw.webp';
import knockoutImage from './assets/knockout.webp';
import { UNO_COLOR_LABELS } from './unoCardMeta';
import type { UnoCinematicEvent } from './unoCinematics';

const IMAGE_BY_KIND = {
  'draw-counter': drawCounterImage,
  'forced-draw': forcedDrawImage,
  knockout: knockoutImage,
} as const;

export function UnoCinematicOverlay({ event }: { event: UnoCinematicEvent | null }) {
  if (!event) return null;

  if (event.kind === 'roulette-step' || event.kind === 'roulette-safe') {
    const colorLabel = UNO_COLOR_LABELS[event.targetColor];
    return (
      <div
        key={event.key}
        className={`uno-roulette-cinematic ${event.kind === 'roulette-safe' ? 'is-safe' : ''}`}
        role="status"
        aria-live="assertive"
      >
        <span className="uno-roulette-cinematic-wheel" aria-hidden="true" />
        <span className="uno-roulette-cinematic-card" aria-hidden="true" />
        <strong>
          {event.kind === 'roulette-safe' ? `${colorLabel}が出た！ セーフ！` : `${colorLabel}が出るまで…`}
        </strong>
        <span>{event.playerName}　{event.drawnCount}まい目</span>
      </div>
    );
  }

  const image = IMAGE_BY_KIND[event.kind];
  const isCounter = event.kind === 'draw-counter';
  const isForcedDraw = event.kind === 'forced-draw';
  const eyebrow = isCounter
    ? event.playerName
    : isForcedDraw
      ? event.playerName
      : knockoutCauseText(event);
  const title = isCounter
    ? event.reversed ? 'むきを変えて返した！' : `${event.cardName}で返した！`
    : isForcedDraw
      ? `合計${event.count}まい引いた！`
      : '25まいでアウト！';
  const detail = isCounter
    ? `合計${event.totalCount}まい`
    : event.kind === 'knockout'
      ? `${event.playerName}　脱落`
      : 'ドローを受け取りました';

  return (
    <div
      key={event.key}
      className={`uno-cinematic-overlay is-${event.kind}`}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="uno-cinematic-side-lines" aria-hidden="true" />
      <div className="uno-cinematic-panel">
        <img src={image} alt="" className="uno-cinematic-image" />
        <div className="uno-cinematic-shade" aria-hidden="true" />
        <div className="uno-cinematic-copy is-top">
          <span>{eyebrow}</span>
        </div>
        <div className="uno-cinematic-copy is-bottom">
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
        <div className="uno-cinematic-flying-cards" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
      </div>
    </div>
  );
}

function knockoutCauseText(event: Extract<UnoCinematicEvent, { kind: 'knockout' }>): string {
  if (event.cause === 'color-roulette') {
    return `カラー ルーレット ${event.count ?? 1}まい目`;
  }
  if (event.cause === 'draw-stack') {
    return `合計${event.count ?? 0}まいのドロー`;
  }
  return 'カードを引いた結果';
}
