import { useEffect, useRef, useState } from 'react';
import type { UnoGameState } from './unoTypes';
import {
  detectUnoCinematicEvents,
  getUnoCinematicDuration,
  isBlockingUnoCinematic,
  type UnoCinematicEvent,
} from './unoCinematics';

export function useUnoCinematics(state: UnoGameState | null) {
  const previousRef = useRef<UnoGameState | null>(null);
  const seenKeysRef = useRef(new Set<string>());
  const [queue, setQueue] = useState<UnoCinematicEvent[]>([]);
  const activeEvent = queue[0] ?? null;

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = state;
    if (!state) return;

    if (!previous || previous.gameId !== state.gameId) {
      seenKeysRef.current.clear();
      setQueue([]);
      return;
    }

    const freshEvents = detectUnoCinematicEvents(previous, state).filter((event) => {
      if (seenKeysRef.current.has(event.key)) return false;
      seenKeysRef.current.add(event.key);
      return true;
    });
    if (freshEvents.length === 0) return;

    if (seenKeysRef.current.size > 200) {
      const recentKeys = [...seenKeysRef.current].slice(-100);
      seenKeysRef.current = new Set(recentKeys);
    }
    setQueue((current) => [...current, ...freshEvents]);
  }, [state]);

  useEffect(() => {
    if (!activeEvent) return;
    const timeoutId = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, getUnoCinematicDuration(activeEvent));
    return () => window.clearTimeout(timeoutId);
  }, [activeEvent]);

  return {
    activeEvent,
    isBlocking: isBlockingUnoCinematic(activeEvent),
  };
}
