import { ITEM_BY_ID } from './englishQuestContent';
import type { LearningItem, LearningMode, PlayerProgress } from './englishQuestTypes';

export type ArenaDirection = 'up' | 'down' | 'left' | 'right';
export type ArenaPoint = { x: number; y: number };
export type PracticeTurnKind = 'main' | 'bridge' | 'retry';
export type PracticeTurn = {
  key: string;
  item: LearningItem;
  hintLevel: 0 | 1;
  kind: PracticeTurnKind;
};

export const BEGINNER_ITEM_IDS = [
  'word-cat',
  'word-dog',
  'word-bird',
  'word-red',
  'word-blue',
  'word-one',
] as const;

export const MODE_UNLOCK_STEP: Record<'capture' | 'arena' | 'merge' | 'escape', number> = {
  capture: 0,
  arena: 1,
  merge: 2,
  escape: 3,
};

export function learningItems(ids: readonly string[]): LearningItem[] {
  return ids.map((id) => ITEM_BY_ID.get(id)).filter((item): item is LearningItem => Boolean(item));
}

export function rotatedChoices(
  items: readonly LearningItem[],
  currentIndex: number,
  count = 3,
): LearningItem[] {
  if (items.length === 0) return [];
  const current = items[currentIndex % items.length];
  const choices = [current];
  for (let offset = 1; choices.length < Math.min(count, items.length); offset += 1) {
    const candidate = items[(currentIndex + offset * 3) % items.length];
    if (!choices.some((item) => item.id === candidate.id)) choices.push(candidate);
  }
  return currentIndex % 2 === 0 ? choices : [...choices.slice(1), current];
}

export function choicesForItem(
  items: readonly LearningItem[],
  current: LearningItem,
  seed: number,
  count = 3,
): LearningItem[] {
  const choices = [current];
  for (let offset = 1; choices.length < Math.min(count, items.length); offset += 1) {
    const candidate = items[(seed + offset * 3) % items.length];
    if (!choices.some((item) => item.id === candidate.id)) choices.push(candidate);
  }
  return seed % 2 === 0 ? choices : [...choices.slice(1), current];
}

export function delayedRetryGap(itemId: string): 3 | 4 | 5 {
  const checksum = Array.from(itemId).reduce((total, character) => total + character.charCodeAt(0), 0);
  return (3 + (checksum % 3)) as 3 | 4 | 5;
}

export function createPracticeTurns(items: readonly LearningItem[]): PracticeTurn[] {
  return items.map((item, index) => ({
    key: `main-${index}-${item.id}`,
    item,
    hintLevel: 0,
    kind: 'main',
  }));
}

/**
 * A first-error item returns after three to five other questions with support.
 * Bridge turns pad a short tail so the retry is never immediate. A bridge or
 * retry error is recorded, but does not create an endless retry chain.
 */
export function advancePracticeTurns(
  turns: readonly PracticeTurn[],
  correct: boolean,
  sourceItems: readonly LearningItem[],
): PracticeTurn[] {
  const [current, ...remaining] = turns;
  if (!current || correct || current.kind !== 'main') return remaining;

  const gap = delayedRetryGap(current.item.id);
  const next = [...remaining];
  const fillers = sourceItems.filter((item) => item.id !== current.item.id);
  const fillerPool = fillers.length > 0 ? fillers : sourceItems;

  for (let index = next.length; index < gap && fillerPool.length > 0; index += 1) {
    const item = fillerPool[index % fillerPool.length];
    next.push({
      key: `bridge-${current.key}-${index}-${item.id}`,
      item,
      hintLevel: 0,
      kind: 'bridge',
    });
  }

  next.splice(gap, 0, {
    key: `retry-${current.key}`,
    item: current.item,
    hintLevel: 1,
    kind: 'retry',
  });
  return next;
}

export function isModeUnlocked(progress: PlayerProgress, mode: LearningMode): boolean {
  if (mode === 'diagnostic' || mode === 'review') return true;
  return progress.questStep >= MODE_UNLOCK_STEP[mode];
}

export function prerequisitesMet(item: LearningItem, progress: PlayerProgress): boolean {
  return item.prerequisites.every((id) => (progress.mastery[id]?.stage ?? 0) >= 1);
}

export function moveArenaPoint(
  point: ArenaPoint,
  direction: ArenaDirection,
  distance = 8,
): ArenaPoint {
  const next = { ...point };
  if (direction === 'up') next.y -= distance;
  if (direction === 'down') next.y += distance;
  if (direction === 'left') next.x -= distance;
  if (direction === 'right') next.x += distance;
  return {
    x: Math.max(5, Math.min(95, next.x)),
    y: Math.max(8, Math.min(92, next.y)),
  };
}

export function arenaTargetAt(point: ArenaPoint, targets: readonly ArenaPoint[], radius = 11): number {
  return targets.findIndex((target) => Math.hypot(point.x - target.x, point.y - target.y) <= radius);
}

export function mergeTokenMatches(tokenItemId: string, expectedItemId: string): boolean {
  return tokenItemId === expectedItemId;
}

export function escapeDoorMatches(door: string, expectedDoor: string, cluesFound: number): boolean {
  return cluesFound >= 2 && door === expectedDoor;
}
