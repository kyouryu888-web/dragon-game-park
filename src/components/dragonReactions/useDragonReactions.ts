import { useCallback, useEffect, useState } from 'react';
import {
  beginDragonReactionQueue,
  clearDragonReactionQueue,
  DRAGON_REACTION_DURATION_MS,
  finishDragonReaction,
  ingestDragonReactionEvents,
} from './queue';
import type { DragonPresentationPreference, PublicDragonReactionInput } from './types';

export type UseDragonReactionsOptions = Readonly<{
  matchId: string;
  events: readonly PublicDragonReactionInput[];
  preference?: DragonPresentationPreference;
}>;

export function useDragonReactions({
  matchId,
  events,
  preference = 'lively',
}: UseDragonReactionsOptions) {
  const [queue, setQueue] = useState(() => beginDragonReactionQueue(matchId, events));

  useEffect(() => {
    setQueue(previous => ingestDragonReactionEvents(previous, matchId, events, preference));
  }, [matchId, events, preference]);

  const active = queue.matchId === matchId && preference !== 'off' ? queue.active : null;
  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => {
      setQueue(previous => previous.active?.key === active.key ? finishDragonReaction(previous) : previous);
    }, DRAGON_REACTION_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [active]);

  const clear = useCallback(() => setQueue(clearDragonReactionQueue), []);
  return { active, clear } as const;
}
