import { describe, expect, it } from 'vitest';
import { ENGLISH_QUEST_ITEMS, ENGLISH_QUEST_SPIRITS, FINAL_QUEST, ITEM_BY_ID, MAIN_QUESTS } from './englishQuestContent';
import {
  applyAttempt,
  composeQuestSession,
  composeSession,
  completeDiagnostic,
  completeQuest,
  createInitialProgress,
  isMastered,
  makeAttempt,
  nextMasteryState,
} from './englishQuestEngine';
import { loadProgress, normalizeProgress, parseImportedProgress, serializeProgress } from './englishQuestStorage';

describe('English Quest content', () => {
  it('contains exactly 100 unique, answerable items', () => {
    expect(ENGLISH_QUEST_ITEMS).toHaveLength(100);
    expect(new Set(ENGLISH_QUEST_ITEMS.map((item) => item.id)).size).toBe(100);
    for (const item of ENGLISH_QUEST_ITEMS) {
      expect(item.choices).toHaveLength(4);
      expect(item.choices).toContain(item.answer);
      expect(item.audioAsset).toMatch(/^\/audio\/englishQuest\/.+\.mp3$/);
    }
  });

  it('defines twelve story quests and a final escape dungeon', () => {
    expect(MAIN_QUESTS).toHaveLength(12);
    expect(FINAL_QUEST.mode).toBe('escape');
    let progress = createInitialProgress();
    for (let index = 0; index < 20; index += 1) progress = completeQuest(progress);
    expect(progress.questStep).toBe(13);
  });

  it('assigns every one of the 100 items to a story quest exactly once', () => {
    const storyIds = MAIN_QUESTS.flatMap((quest) => quest.itemIds);
    expect(storyIds).toHaveLength(100);
    expect(new Set(storyIds).size).toBe(100);
    expect(new Set(storyIds)).toEqual(new Set(ENGLISH_QUEST_ITEMS.map((item) => item.id)));
    for (const quest of MAIN_QUESTS) {
      expect(quest.story.length).toBeGreaterThan(20);
      expect(quest.objective.length).toBeGreaterThan(10);
      expect(quest.itemIds.every((id) => ITEM_BY_ID.has(id))).toBe(true);
    }
  });

  it('contains the planned 16 sounds, 48 words, 20 chunks, 8 dialogues and 8 readings', () => {
    const count = (type: typeof ENGLISH_QUEST_ITEMS[number]['type']) => ENGLISH_QUEST_ITEMS.filter((item) => item.type === type).length;
    expect([count('sound'), count('word'), count('chunk'), count('dialogue'), count('reading')]).toEqual([16, 48, 20, 8, 8]);
  });

  it('gives all eight original spirits a reachable quest unlock', () => {
    expect(ENGLISH_QUEST_SPIRITS).toHaveLength(8);
    expect(ENGLISH_QUEST_SPIRITS.map((spirit) => spirit.unlockQuestStep)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MAIN_QUESTS.filter((quest) => quest.spiritId)).toHaveLength(8);
  });
});

describe('English Quest scheduler', () => {
  it('schedules an unassisted success for the next day', () => {
    const attempt = makeAttempt({
      itemId: 'word-cat',
      mode: 'capture',
      correct: true,
      latencyMs: 800,
      now: new Date('2026-07-31T00:00:00.000Z'),
    });
    const state = nextMasteryState(undefined, attempt);
    expect(state.stage).toBe(1);
    expect(state.dueAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('keeps the stage when a hint was needed and retries errors shortly', () => {
    const base = nextMasteryState(
      undefined,
      makeAttempt({
        itemId: 'word-cat',
        mode: 'capture',
        correct: true,
        latencyMs: 800,
        now: new Date('2026-07-31T00:00:00.000Z'),
      }),
    );
    const hinted = nextMasteryState(
      base,
      makeAttempt({
        itemId: 'word-cat',
        mode: 'merge',
        correct: true,
        latencyMs: 1000,
        hintLevel: 1,
        now: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
    const missed = nextMasteryState(
      hinted,
      makeAttempt({
        itemId: 'word-cat',
        mode: 'arena',
        correct: false,
        latencyMs: 1200,
        now: new Date('2026-08-02T00:00:00.000Z'),
      }),
    );
    expect(hinted.stage).toBe(1);
    expect(missed.stage).toBe(0);
    expect(missed.dueAt).toBe('2026-08-02T00:03:00.000Z');
  });

  it('requires delayed success in multiple modes for mastery', () => {
    let progress = createInitialProgress();
    const attempts = [
      ['2026-07-31T00:00:00.000Z', 'capture'],
      ['2026-08-01T00:00:00.000Z', 'merge'],
      ['2026-08-04T00:00:00.000Z', 'capture'],
    ] as const;
    for (const [date, mode] of attempts) {
      progress = applyAttempt(
        progress,
        makeAttempt({ itemId: 'word-cat', mode, correct: true, latencyMs: 900, now: new Date(date) }),
      );
    }
    expect(isMastered(progress.mastery['word-cat'])).toBe(true);
  });

  it('does not treat the placement diagnostic as a gameplay modality', () => {
    const state = nextMasteryState(
      undefined,
      makeAttempt({
        itemId: 'word-cat',
        mode: 'diagnostic',
        correct: true,
        latencyMs: 800,
        now: new Date('2026-07-31T00:00:00.000Z'),
      }),
    );
    expect(state.successfulModalities).toEqual([]);
    expect(state.successfulDates).toEqual(['2026-07-31']);
  });

  it('composes a unique ten-item session', () => {
    const session = composeSession(createInitialProgress(), new Date('2026-07-31T00:00:00.000Z'));
    expect(session).toHaveLength(10);
    expect(new Set(session.map((item) => item.id)).size).toBe(10);
  });

  it('does not introduce a phrase before its prerequisite word was met', () => {
    const phrase = ENGLISH_QUEST_ITEMS.find((item) => item.id === 'chunk-i-like-cats');
    expect(phrase).toBeDefined();
    expect(composeSession(createInitialProgress(), new Date(), 100)).not.toContain(phrase);
  });

  it('builds each quest from its own story pack while mixing prior learning', () => {
    let progress = createInitialProgress();
    progress = applyAttempt(progress, makeAttempt({
      itemId: 'word-cat', mode: 'capture', correct: true, latencyMs: 700,
      now: new Date('2026-08-01T00:00:00.000Z'),
    }));
    const session = composeQuestSession(progress, MAIN_QUESTS[1], new Date('2026-08-01T01:00:00.000Z'));
    expect(session).toHaveLength(MAIN_QUESTS[1].itemIds.length);
    expect(session.some((item) => MAIN_QUESTS[1].itemIds.includes(item.id))).toBe(true);
    expect(session.some((item) => item.id === 'word-cat')).toBe(true);
  });

  it('keeps every child in the full story while retaining the diagnostic score for adaptation', () => {
    expect(completeDiagnostic(createInitialProgress(), 0).questStep).toBe(0);
    expect(completeDiagnostic(createInitialProgress(), 5).questStep).toBe(0);
    expect(completeDiagnostic(createInitialProgress(), 6).diagnosticScore).toBe(6);
  });

  it('adds a small stretch item for an experienced child without skipping chapters', () => {
    const experienced = completeDiagnostic(createInitialProgress(), 6);
    const session = composeQuestSession(experienced, MAIN_QUESTS[0]);
    expect(session.some((item) => item.difficulty >= 2)).toBe(true);
    expect(session.filter((item) => MAIN_QUESTS[0].itemIds.includes(item.id)).length).toBeGreaterThanOrEqual(5);
  });
});

describe('English Quest collection', () => {
  it('captures each early spirit from story completion instead of impossible mastery totals', () => {
    let progress = createInitialProgress();
    for (let step = 0; step < 8; step += 1) progress = completeQuest(progress);
    expect(Object.values(progress.spirits).filter((state) => state === 'captured')).toHaveLength(8);
  });

  it('does not evolve a spirit until it was captured and has three-day, two-mode support', () => {
    let progress = createInitialProgress();
    for (const [date, mode] of [
      ['2026-08-01T00:00:00.000Z', 'capture'],
      ['2026-08-02T00:00:00.000Z', 'merge'],
      ['2026-08-05T00:00:00.000Z', 'capture'],
      ['2026-08-12T00:00:00.000Z', 'merge'],
    ] as const) {
      for (const itemId of ['word-cat', 'word-dog']) {
        progress = applyAttempt(progress, makeAttempt({ itemId, mode, correct: true, latencyMs: 700, now: new Date(date) }));
      }
    }
    expect(progress.spirits.echo).toBe('locked');
    progress = completeQuest(progress);
    progress = applyAttempt(progress, makeAttempt({ itemId: 'word-cat', mode: 'capture', correct: true, latencyMs: 700, now: new Date('2026-08-20T00:00:00.000Z') }));
    expect(progress.spirits.echo).toBe('evolved');
  });
});

describe('English Quest persistence', () => {
  it('round-trips a valid export and rejects corrupt data', () => {
    const progress = createInitialProgress('テスト');
    expect(parseImportedProgress(serializeProgress(progress))).toEqual(progress);
    expect(parseImportedProgress('{broken')).toBeNull();
  });

  it('falls back to a fresh profile when stored data is corrupt', () => {
    const storage = { getItem: () => '{broken' };
    expect(loadProgress(storage).schemaVersion).toBe(1);
  });

  it('repairs unsafe nested values without losing a valid profile', () => {
    const candidate = JSON.parse(serializeProgress(createInitialProgress('  ミオ  '))) as Record<string, unknown>;
    candidate.questStep = 999;
    candidate.light = -20;
    candidate.settings = null;
    candidate.mastery = {
      unknown: { stage: 5 },
      'word-cat': {
        stage: 99,
        dueAt: '2026-08-01T00:00:00.000Z',
        lapses: -4,
        lastSeenAt: '2026-07-31T00:00:00.000Z',
        successfulModalities: ['capture', 'not-a-mode'],
        successfulDates: ['2026-07-31', 'bad-date'],
      },
    };
    candidate.spirits = { echo: 'not-a-state' };

    const repaired = normalizeProgress(candidate);
    expect(repaired?.profileName).toBe('ミオ');
    expect(repaired?.questStep).toBe(13);
    expect(repaired?.light).toBe(0);
    expect(repaired?.settings.dailyMinutes).toBe(8);
    expect(repaired?.mastery.unknown).toBeUndefined();
    expect(repaired?.mastery['word-cat']).toMatchObject({
      stage: 5,
      lapses: 0,
      successfulModalities: ['capture'],
      successfulDates: ['2026-07-31'],
    });
    expect(repaired?.spirits.echo).toBe('locked');
  });
});
