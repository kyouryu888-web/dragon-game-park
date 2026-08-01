import { ENGLISH_QUEST_ITEMS, ENGLISH_QUEST_SPIRITS, MAIN_QUESTS } from './englishQuestContent';
import type {
  Attempt,
  HintLevel,
  LearningItem,
  LearningMode,
  MasteryState,
  PlayerProgress,
  SpiritState,
} from './englishQuestTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;

const dateKey = (iso: string) => iso.slice(0, 10);

export function createInitialProgress(profileName = 'ちいさな冒険者'): PlayerProgress {
  return {
    schemaVersion: 1,
    profileName,
    diagnosticComplete: false,
    diagnosticScore: 0,
    questStep: 0,
    light: 0,
    mastery: {},
    spirits: Object.fromEntries(ENGLISH_QUEST_SPIRITS.map((spirit) => [spirit.id, 'locked'])) as Record<string, SpiritState>,
    attempts: [],
    settings: {
      soundOn: true,
      reducedMotion: false,
      dailyMinutes: 8,
    },
  };
}

export function makeAttempt(input: {
  itemId: string;
  mode: LearningMode;
  correct: boolean;
  latencyMs: number;
  hintLevel?: HintLevel;
  now?: Date;
}): Attempt {
  const now = input.now ?? new Date();
  return {
    id: `${input.itemId}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: input.itemId,
    mode: input.mode,
    correct: input.correct,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    hintLevel: input.hintLevel ?? 0,
    answeredAt: now.toISOString(),
  };
}

export function nextMasteryState(
  previous: MasteryState | undefined,
  attempt: Attempt,
): MasteryState {
  const nowMs = new Date(attempt.answeredAt).getTime();
  const oldStage = previous?.stage ?? 0;
  const stage = attempt.correct
    ? attempt.hintLevel === 0
      ? Math.min(REVIEW_INTERVAL_DAYS.length - 1, oldStage + 1)
      : oldStage
    : Math.max(0, oldStage - 1);
  const delay = attempt.correct
    ? Math.max(1, REVIEW_INTERVAL_DAYS[stage]) * DAY_MS
    : 3 * 60 * 1000;
  const successfulModalities = attempt.correct && attempt.mode !== 'diagnostic'
    ? Array.from(new Set([...(previous?.successfulModalities ?? []), attempt.mode]))
    : previous?.successfulModalities ?? [];
  const successfulDates = attempt.correct
    ? Array.from(new Set([...(previous?.successfulDates ?? []), dateKey(attempt.answeredAt)])).slice(-8)
    : previous?.successfulDates ?? [];

  return {
    stage,
    dueAt: new Date(nowMs + delay).toISOString(),
    lapses: (previous?.lapses ?? 0) + (attempt.correct ? 0 : 1),
    lastSeenAt: attempt.answeredAt,
    successfulModalities,
    successfulDates,
  };
}

export function isMastered(state: MasteryState | undefined): boolean {
  return Boolean(
    state &&
      state.stage >= 3 &&
      state.successfulDates.length >= 2 &&
      state.successfulModalities.length >= 2,
  );
}

export function applyAttempt(progress: PlayerProgress, attempt: Attempt): PlayerProgress {
  const mastery = {
    ...progress.mastery,
    [attempt.itemId]: nextMasteryState(progress.mastery[attempt.itemId], attempt),
  };
  const masteredCount = Object.values(mastery).filter(isMastered).length;
  const spirits = { ...progress.spirits };

  for (const spirit of ENGLISH_QUEST_SPIRITS) {
    if (masteredCount >= spirit.unlockMasteredCount) spirits[spirit.id] = 'captured';
    const support = Object.values(mastery).filter(
      (state) => state.stage >= 4 && state.successfulDates.length >= 3 && state.successfulModalities.length >= 2,
    ).length;
    if (support >= spirit.unlockMasteredCount) spirits[spirit.id] = 'evolved';
  }

  const attempts = [...progress.attempts, attempt].slice(-200);
  return {
    ...progress,
    mastery,
    spirits,
    attempts,
    light: progress.light + (attempt.correct ? Math.max(2, 6 - attempt.hintLevel) : 1),
  };
}

export function completeQuest(progress: PlayerProgress): PlayerProgress {
  return { ...progress, questStep: Math.min(MAIN_QUESTS.length + 1, progress.questStep + 1) };
}

const unique = (items: LearningItem[]): LearningItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export function composeSession(
  progress: PlayerProgress,
  now = new Date(),
  targetSize = 10,
  items = ENGLISH_QUEST_ITEMS,
): LearningItem[] {
  const due = items.filter((item) => {
    const state = progress.mastery[item.id];
    return state && new Date(state.dueAt) <= now;
  });
  const fresh = items.filter((item) => !progress.mastery[item.id]);
  const mixed = items
    .filter((item) => progress.mastery[item.id] && !due.includes(item))
    .sort((a, b) => (progress.mastery[a.id]?.stage ?? 0) - (progress.mastery[b.id]?.stage ?? 0));

  const dueCount = Math.min(due.length, Math.ceil(targetSize * 0.5));
  const freshCount = Math.min(fresh.length, Math.ceil(targetSize * 0.35));
  const mixedCount = Math.min(mixed.length, Math.max(1, targetSize - dueCount - freshCount));
  const session = unique([
    ...due.slice(0, dueCount),
    ...fresh.slice(0, freshCount),
    ...mixed.slice(0, mixedCount),
    ...due.slice(dueCount),
    ...mixed.slice(mixedCount),
    ...fresh.slice(freshCount),
  ]);
  return session.slice(0, targetSize);
}

export function diagnosticItems(): LearningItem[] {
  return [
    ...ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'sound').slice(0, 4),
    ...ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'word').slice(0, 4),
    ...ENGLISH_QUEST_ITEMS.filter((item) => item.type === 'chunk').slice(0, 2),
  ];
}

export function completeDiagnostic(progress: PlayerProgress, score: number): PlayerProgress {
  return {
    ...progress,
    diagnosticComplete: true,
    diagnosticScore: score,
    light: progress.light + score * 2,
  };
}

export function dueCount(progress: PlayerProgress, now = new Date()): number {
  return Object.values(progress.mastery).filter((state) => new Date(state.dueAt) <= now).length;
}

export function masteryPercent(progress: PlayerProgress): number {
  const weighted = ENGLISH_QUEST_ITEMS.reduce(
    (sum, item) => sum + Math.min(5, progress.mastery[item.id]?.stage ?? 0),
    0,
  );
  return Math.round((weighted / (ENGLISH_QUEST_ITEMS.length * 5)) * 100);
}
