import { describe, expect, it } from 'vitest';
import {
  applyFlipWave,
  createPlacementBoard,
  groupReversiFlipsByDistance,
} from './reversiAnimation';
import { createInitialReversiBoard } from './reversiRules';

describe('Reversi move playback', () => {
  it('shows the placed disc before any captured disc changes color', () => {
    const initial = createInitialReversiBoard();
    const placed = createPlacementBoard(initial, 'black', { row: 2, col: 3 });

    expect(placed[2][3]).toBe('black');
    expect(placed[3][3]).toBe('white');
    expect(initial[2][3]).toBeNull();
  });

  it('groups flips from the placed disc outward', () => {
    const waves = groupReversiFlipsByDistance(
      { row: 4, col: 4 },
      [
        { row: 1, col: 4 },
        { row: 3, col: 4 },
        { row: 2, col: 4 },
        { row: 4, col: 3 },
        { row: 2, col: 2 },
      ],
    );

    expect(waves).toEqual([
      [{ row: 3, col: 4 }, { row: 4, col: 3 }],
      [{ row: 2, col: 2 }, { row: 2, col: 4 }],
      [{ row: 1, col: 4 }],
    ]);
  });

  it('changes only the discs in the current flip wave', () => {
    const initial = createInitialReversiBoard();
    const placed = createPlacementBoard(initial, 'black', { row: 2, col: 3 });
    const flipped = applyFlipWave(placed, 'black', [{ row: 3, col: 3 }]);

    expect(flipped[3][3]).toBe('black');
    expect(flipped[4][4]).toBe('white');
  });
});
