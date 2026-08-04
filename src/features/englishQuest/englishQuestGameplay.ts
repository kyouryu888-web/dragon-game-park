import { ITEM_BY_ID } from './englishQuestContent';
import type { LearningItem, LearningMode, PlayerProgress } from './englishQuestTypes';

export type ArenaDirection = 'up' | 'down' | 'left' | 'right';
export type ArenaPoint = { x: number; y: number };

export const BEGINNER_ITEM_IDS = ['word-cat', 'word-dog', 'word-bird'] as const;

export const MODE_ITEM_IDS: Record<'capture' | 'arena' | 'merge' | 'escape', readonly string[]> = {
  capture: ['word-cat', 'word-dog', 'word-bird', 'word-fish'],
  arena: ['word-red', 'word-blue', 'word-green'],
  merge: ['word-cat', 'word-dog', 'word-bird'],
  escape: ['reading-blue-door', 'reading-open-sign', 'reading-bus-eight'],
};

export const MODE_UNLOCK_STEP: Record<'capture' | 'arena' | 'merge' | 'escape', number> = {
  capture: 0,
  arena: 1,
  merge: 2,
  escape: 3,
};

export function learningItems(ids: readonly string[]): LearningItem[] {
  return ids.map((id) => ITEM_BY_ID.get(id)).filter((item): item is LearningItem => Boolean(item));
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
