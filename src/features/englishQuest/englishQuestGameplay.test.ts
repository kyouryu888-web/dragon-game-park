import { describe, expect, it } from 'vitest';
import { createInitialProgress } from './englishQuestEngine';
import {
  BEGINNER_ITEM_IDS,
  arenaTargetAt,
  escapeDoorMatches,
  isModeUnlocked,
  learningItems,
  mergeTokenMatches,
  moveArenaPoint,
  rotatedChoices,
} from './englishQuestGameplay';

describe('English Quest beginner journey', () => {
  it('opens one genuinely guided region at a time', () => {
    const progress = createInitialProgress();
    expect(isModeUnlocked(progress, 'capture')).toBe(true);
    expect(isModeUnlocked(progress, 'arena')).toBe(false);
    expect(isModeUnlocked({ ...progress, questStep: 1 }, 'arena')).toBe(true);
    expect(isModeUnlocked({ ...progress, questStep: 2 }, 'merge')).toBe(true);
    expect(isModeUnlocked({ ...progress, questStep: 3 }, 'escape')).toBe(true);
  });

  it('uses a tiny known-item set for the first experience', () => {
    expect(BEGINNER_ITEM_IDS).toHaveLength(6);
    expect(learningItems(BEGINNER_ITEM_IDS).map((item) => item.answer)).toEqual(['cat', 'dog', 'bird', 'red', 'blue', 'one']);
  });
});

describe('English Quest distinct game rules', () => {
  it('moves the arena player and clamps it inside the board', () => {
    expect(moveArenaPoint({ x: 50, y: 50 }, 'left')).toEqual({ x: 42, y: 50 });
    expect(moveArenaPoint({ x: 6, y: 9 }, 'up', 20)).toEqual({ x: 6, y: 8 });
    expect(arenaTargetAt({ x: 20, y: 20 }, [{ x: 22, y: 21 }, { x: 80, y: 80 }])).toBe(0);
  });

  it('matches merge tokens by learning item instead of answer-button position', () => {
    expect(mergeTokenMatches('word-cat', 'word-cat')).toBe(true);
    expect(mergeTokenMatches('word-dog', 'word-cat')).toBe(false);
  });

  it('rotates the correct target through changing positions instead of a fixed slot', () => {
    const items = learningItems(['word-cat', 'word-dog', 'word-bird', 'word-fish']);
    expect(rotatedChoices(items, 0, 3)[0].id).toBe('word-cat');
    expect(rotatedChoices(items, 1, 3).at(-1)?.id).toBe('word-dog');
  });

  it('keeps an escape door locked until two clues are combined', () => {
    expect(escapeDoorMatches('blue', 'blue', 1)).toBe(false);
    expect(escapeDoorMatches('red', 'blue', 2)).toBe(false);
    expect(escapeDoorMatches('blue', 'blue', 2)).toBe(true);
  });
});
