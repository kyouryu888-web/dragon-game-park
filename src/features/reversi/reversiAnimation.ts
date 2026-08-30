import { cloneReversiBoard, oppositeColor } from './reversiRules';
import type { DiscColor, ReversiBoard, ReversiMove } from './reversiTypes';

export const REVERSI_PLACE_DURATION_MS = 360;
export const REVERSI_FLIP_WAVE_INTERVAL_MS = 190;
export const REVERSI_FLIP_SETTLE_MS = 420;

export type ReversiPlaybackPhase = 'placing' | 'flipping';

export type ReversiPlaybackVisual = {
  phase: ReversiPlaybackPhase;
  placed: ReversiMove;
  activeFlips: ReversiMove[];
  color: DiscColor;
};

function distanceFromMove(origin: ReversiMove, move: ReversiMove): number {
  return Math.max(Math.abs(move.row - origin.row), Math.abs(move.col - origin.col));
}

/** 着手点に近い石から同心状に返すため、同距離の石を同じ波へまとめる。 */
export function groupReversiFlipsByDistance(
  placed: ReversiMove,
  flips: ReversiMove[],
): ReversiMove[][] {
  const groups = new Map<number, ReversiMove[]>();
  for (const flip of flips) {
    const distance = distanceFromMove(placed, flip);
    const group = groups.get(distance) ?? [];
    group.push(flip);
    groups.set(distance, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, group]) => group.sort((left, right) => left.row - right.row || left.col - right.col));
}

export function createPlacementBoard(
  board: ReversiBoard,
  color: DiscColor,
  move: ReversiMove,
): ReversiBoard {
  const next = cloneReversiBoard(board);
  next[move.row][move.col] = color;
  return next;
}

export function applyFlipWave(
  board: ReversiBoard,
  color: DiscColor,
  flips: ReversiMove[],
): ReversiBoard {
  const next = cloneReversiBoard(board);
  for (const flip of flips) next[flip.row][flip.col] = color;
  return next;
}

export function getReversiPlaybackDuration(placed: ReversiMove, flips: ReversiMove[]): number {
  const waveCount = groupReversiFlipsByDistance(placed, flips).length;
  return REVERSI_PLACE_DURATION_MS
    + Math.max(0, waveCount - 1) * REVERSI_FLIP_WAVE_INTERVAL_MS
    + REVERSI_FLIP_SETTLE_MS;
}

export function getPreviousDiscColor(color: DiscColor): DiscColor {
  return oppositeColor(color);
}
