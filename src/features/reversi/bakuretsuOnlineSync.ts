import type { GameState, Side } from './bakuretsu/types.ts';
import type { BakuretsuReversiSnapshot } from './bakuretsuReversiOnline';

export type BakuretsuSyncDecision = 'ignore' | 'queue' | 'refresh' | 'playback' | 'reset';

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalJson(nested)]),
    );
  }
  return value;
}

export function bakuretsuStatesMatch(left: GameState, right: GameState): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

export function decideBakuretsuSync(
  current: GameState,
  currentMatchNo: number,
  pending: GameState | null,
  incoming: BakuretsuReversiSnapshot,
): BakuretsuSyncDecision {
  if (incoming.matchNo < currentMatchNo) return 'ignore';
  if (incoming.matchNo > currentMatchNo) return 'reset';

  if (pending) {
    if (incoming.state.moveNo < pending.moveNo) return 'ignore';
    if (incoming.state.moveNo === pending.moveNo && bakuretsuStatesMatch(incoming.state, pending)) return 'refresh';
    return 'queue';
  }

  if (incoming.state.moveNo < current.moveNo) return 'ignore';
  if (incoming.state.moveNo === current.moveNo) {
    return bakuretsuStatesMatch(incoming.state, current) ? 'refresh' : 'reset';
  }
  if (incoming.state.moveNo === current.moveNo + 1 && incoming.result) return 'playback';
  return 'reset';
}

export function canResolveBakuretsuTimeout(
  viewerSide: Side | undefined,
  currentSide: Side,
  turnDeadline: string | null,
  now = Date.now(),
): boolean {
  if (viewerSide === undefined || viewerSide === currentSide) return true;
  if (!turnDeadline) return false;
  const deadline = Date.parse(turnDeadline);
  return Number.isFinite(deadline) && now >= deadline + 30_000;
}
