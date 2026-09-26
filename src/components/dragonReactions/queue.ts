import { decideDragonReaction, dragonReactionKey } from './decision';
import type {
  DragonPresentationPreference,
  DragonReactionEvent,
  PublicDragonReactionInput,
} from './types';

export const DRAGON_REACTION_DURATION_MS = 1400;
export const DRAGON_REACTION_WAITING_LIMIT = 2;

export type DragonReactionQueueState = Readonly<{
  matchId: string;
  latestSequence: number;
  seenKeys: ReadonlySet<string>;
  active: DragonReactionEvent | null;
  waiting: readonly DragonReactionEvent[];
}>;

/** Treat anything already present when the screen opens as history, not a fresh reaction. */
export function beginDragonReactionQueue(
  matchId: string,
  initialEvents: readonly PublicDragonReactionInput[],
): DragonReactionQueueState {
  const matching = initialEvents.filter(event => event.matchId === matchId);
  return {
    matchId,
    latestSequence: Math.max(-1, ...matching.map(event => event.sequence)),
    seenKeys: new Set(matching.map(dragonReactionKey)),
    active: null,
    waiting: [],
  };
}

export function clearDragonReactionQueue(state: DragonReactionQueueState): DragonReactionQueueState {
  if (!state.active && state.waiting.length === 0) return state;
  return { ...state, active: null, waiting: [] };
}

function visibleAtPreference(event: DragonReactionEvent, preference: DragonPresentationPreference): boolean {
  if (preference === 'off') return false;
  if (preference === 'subtle') return event.priority >= 3;
  return true;
}

function applyPreference(
  state: DragonReactionQueueState,
  preference: DragonPresentationPreference,
): DragonReactionQueueState {
  if (preference === 'off') return clearDragonReactionQueue(state);
  if (preference === 'lively') return state;
  const waiting = state.waiting.filter(event => event.priority >= 3);
  const active = state.active?.priority && state.active.priority >= 3 ? state.active : waiting.shift() ?? null;
  if (active === state.active && waiting.length === state.waiting.length) return state;
  return { ...state, active, waiting };
}

function addToQueue(state: DragonReactionQueueState, event: DragonReactionEvent): DragonReactionQueueState {
  if (!state.active) return { ...state, active: event };

  // A result takes the screen immediately; a major moment supersedes a light remark.
  if ((event.priority === 4 && state.active.priority < 4)
    || (event.priority >= 3 && state.active.priority <= 1)) {
    return { ...state, active: event, waiting: state.waiting.filter(item => item.priority >= 3) };
  }

  const waiting = [...state.waiting, event];
  if (waiting.length > DRAGON_REACTION_WAITING_LIMIT) {
    const disposableIndex = waiting.reduce((lowestIndex, item, index) => {
      const lowest = waiting[lowestIndex];
      return item.priority < lowest.priority
        || (item.priority === lowest.priority && item.sequence < lowest.sequence)
        ? index : lowestIndex;
    }, 0);
    waiting.splice(disposableIndex, 1);
  }
  waiting.sort((left, right) => left.sequence - right.sequence);
  return { ...state, waiting };
}

export function ingestDragonReactionEvents(
  state: DragonReactionQueueState,
  matchId: string,
  events: readonly PublicDragonReactionInput[],
  preference: DragonPresentationPreference = 'lively',
): DragonReactionQueueState {
  if (state.matchId !== matchId) return beginDragonReactionQueue(matchId, events);

  const matching = events
    .filter(event => event.matchId === matchId && event.sequence >= state.latestSequence)
    .filter(event => !state.seenKeys.has(dragonReactionKey(event)))
    .sort((left, right) => left.sequence - right.sequence
      || (left.cpu.id < right.cpu.id ? -1 : left.cpu.id > right.cpu.id ? 1 : 0));
  let result = applyPreference(state, preference);
  if (matching.length === 0) return result;

  const latestSequence = Math.max(state.latestSequence, ...matching.map(event => event.sequence));
  const seenKeys = new Set(state.seenKeys);
  for (const event of matching) seenKeys.add(dragonReactionKey(event));
  result = { ...result, latestSequence, seenKeys };

  // A poll can deliver several already-resolved events at once. Keep the newest light beat only.
  const delivered = matching.length > 1
    ? matching.filter(input => input.sequence === latestSequence || decideDragonReaction(input).priority >= 3)
    : matching;
  for (const input of delivered) {
    const event = decideDragonReaction(input);
    if (visibleAtPreference(event, preference)) result = addToQueue(result, event);
  }
  return result;
}

export function finishDragonReaction(state: DragonReactionQueueState): DragonReactionQueueState {
  if (!state.active) return state;
  const [active, ...waiting] = state.waiting;
  return { ...state, active: active ?? null, waiting };
}
