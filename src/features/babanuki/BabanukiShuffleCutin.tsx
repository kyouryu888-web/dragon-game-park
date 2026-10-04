import { useEffect, useState } from 'react';
import type { CutinActor } from '../../assets/dragons/cutins/selectCutinImage';
import { GameCutinArt, type DragonPresentationPreference } from '../../components/dragonReactions';
import './BabanukiPresentation.css';

/** Cosmetic only: consumes the opening beat of the existing 3000 ms dice-3 playback. */
export const BABANUKI_SHUFFLE_CUTIN_MS = 700;

export function BabanukiShuffleCutin({ dice, actor, preference = 'lively', onVisibilityChange }: {
  dice: number;
  actor?: CutinActor;
  preference?: DragonPresentationPreference;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), BABANUKI_SHUFFLE_CUTIN_MS);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduceMotion(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const showing = visible && dice === 3 && preference === 'lively' && !reduceMotion;
  useEffect(() => {
    onVisibilityChange?.(showing);
    return () => onVisibilityChange?.(false);
  }, [showing, onVisibilityChange]);
  if (!showing) return null;
  return (
    <div className="babanuki-shuffle-cutin" aria-hidden="true">
      <GameCutinArt game="babanuki" actor={actor} scene="attack" variant="shuffle" preference={preference} />
      <div className="babanuki-shuffle-cutin-shade" />
    </div>
  );
}
