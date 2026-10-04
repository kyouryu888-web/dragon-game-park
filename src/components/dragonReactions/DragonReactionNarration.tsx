import { useState, type CSSProperties } from 'react';
import { getDragonReactionImageUrl } from './assets';
import type { DragonPresentationPreference, DragonReactionEvent } from './types';
import './DragonReactionWipe.css';

export type DragonReactionNarrationProps = Readonly<{
  event?: DragonReactionEvent | null;
  preference?: DragonPresentationPreference;
  className?: string;
  style?: CSSProperties;
}>;

/** Board-side public commentary. Never rendered inside a human player's CPU seat. */
export function DragonReactionNarration({
  event,
  preference = 'lively',
  className = '',
  style,
}: DragonReactionNarrationProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl = getDragonReactionImageUrl(3, event?.emotion ?? 'joy');
  if (event?.presenter !== 'narrator' || preference === 'off'
    || (preference === 'subtle' && event.priority < 3)) return null;

  return (
    <div
      key={event.key}
      className={`dragon-reaction-narration is-reacting${className ? ` ${className}` : ''}`}
      data-presenter="narrator"
      data-emotion={event.emotion}
      style={style}
      aria-label="ドラゴンのゲーム案内"
    >
      <div className="dragon-reaction-face" aria-hidden="true">
        {failedUrl === imageUrl ? <span className="dragon-reaction-image-fallback">🐲</span> : <img src={imageUrl} alt="" onError={() => setFailedUrl(imageUrl)} />}
      </div>
      <div className="dragon-narration-speech" role="status" aria-live="polite">
        <span className="dragon-narration-label">ゲーム案内</span>
        {event.factLabel}
      </div>
    </div>
  );
}
