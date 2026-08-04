import { describe, expect, it } from 'vitest';
import { createInitialProgress } from './englishQuestEngine';
import {
  BEGINNER_ITEM_IDS,
  advancePracticeTurns,
  arenaTargetAt,
  choicesForItem,
  createPracticeTurns,
  delayedRetryGap,
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
    expect(choicesForItem(items, items[0], 1, 3).at(-1)?.id).toBe('word-cat');
  });

  it('keeps an escape door locked until two clues are combined', () => {
    expect(escapeDoorMatches('blue', 'blue', 1)).toBe(false);
    expect(escapeDoorMatches('red', 'blue', 2)).toBe(false);
    expect(escapeDoorMatches('blue', 'blue', 2)).toBe(true);
  });

  it('returns a wrong item after three to five other questions with a hint', () => {
    const items = learningItems(['word-cat', 'word-dog', 'word-bird', 'word-fish', 'word-red', 'word-blue']);
    const turns = advancePracticeTurns(createPracticeTurns(items), false, items);
    const retryIndex = turns.findIndex((turn) => turn.kind === 'retry');

    expect(delayedRetryGap('word-cat')).toBeGreaterThanOrEqual(3);
    expect(delayedRetryGap('word-cat')).toBeLessThanOrEqual(5);
    expect(retryIndex).toBe(delayedRetryGap('word-cat'));
    expect(turns[retryIndex]).toMatchObject({ item: items[0], hintLevel: 1, kind: 'retry' });
  });

  it('pads a short session tail and never creates an endless retry chain', () => {
    const items = learningItems(['word-cat', 'word-dog']);
    const firstRun = advancePracticeTurns(createPracticeTurns(items), false, items);
    const retryIndex = firstRun.findIndex((turn) => turn.kind === 'retry');
    expect(retryIndex).toBeGreaterThanOrEqual(3);

    const retryFirst = [firstRun[retryIndex], ...firstRun.slice(0, retryIndex), ...firstRun.slice(retryIndex + 1)];
    expect(advancePracticeTurns(retryFirst, false, items).some((turn) => turn.key.startsWith(`retry-${retryFirst[0].key}`))).toBe(false);
  });
});
