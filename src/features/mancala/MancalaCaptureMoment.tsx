import { useEffect, useState } from 'react';
import { GameCutinArt } from '../../components/dragonReactions';
import type { DragonPresentationPreference, DragonReactionEvent } from '../../components/dragonReactions';
import './MancalaCaptureMoment.css';

export const MANCALA_CAPTURE_MOMENT_MS = 700;

/** Cosmetic window only. It never controls the board's input or animation clocks. */
export function useMancalaCaptureMoment(event: DragonReactionEvent | null, preference: DragonPresentationPreference) {
  const [moment, setMoment] = useState<DragonReactionEvent | null>(null);
  useEffect(() => {
    if (!event || !['mancala-large-capture', 'mancala-large-loss'].includes(event.kind) || preference === 'off') {
      setMoment(null);
      return;
    }
    setMoment(event);
    const timer = window.setTimeout(() => setMoment(null), MANCALA_CAPTURE_MOMENT_MS);
    return () => window.clearTimeout(timer);
  }, [event, preference]);
  return preference === 'off' ? null : moment;
}

export function MancalaCaptureMoment({ event, preference }: {
  event: DragonReactionEvent | null; preference: DragonPresentationPreference;
}) {
  if (!event || preference === 'off') return null;
  const actor = event.presenter === 'narrator' ? undefined : { isCpu: true, cpuLevel: event.cpu.level };
  return (
    <div key={event.key} className="mancala-capture-moment" role="status" aria-live="polite">
      <GameCutinArt game="mancala" actor={actor} scene={event.outcome === 'disadvantage' ? 'pressure' : 'attack'} variant="capture" preference={preference} />
      <strong>{event.factLabel}</strong>
    </div>
  );
}
