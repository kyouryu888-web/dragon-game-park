import { ENGLISH_QUEST_ITEMS, ENGLISH_QUEST_SPIRITS, ITEM_BY_ID, MAIN_QUESTS } from './englishQuestContent';
import type {
  Attempt,
  HintLevel,
  LearningItem,
  LearningMode,
  MasteryState,
  PlayerProgress,
  QuestDefinition,
  SpiritState,
} from './englishQuestTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;

export function localDateKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    adventureDates: [],
    audioReview: { approvedItemIds: [], flaggedItemIds: [] },
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
    ? Array.from(new Set([...(previous?.successfulDates ?? []), localDateKey(attempt.answeredAt)])).slice(-8)
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
  const spirits = { ...progress.spirits };
  const evolvedSupport = Object.values(mastery).filter(
    (state) => state.stage >= 4 && state.successfulDates.length >= 3 && state.successfulModalities.length >= 2,
  ).length;

  for (const spirit of ENGLISH_QUEST_SPIRITS) {
    if (spirits[spirit.id] !== 'locked' && evolvedSupport >= spirit.unlockMasteredCount) {
      spirits[spirit.id] = 'evolved';
    }
  }

  const attempts = [...progress.attempts, attempt].slice(-200);
  const adventureDates = attempt.mode === 'diagnostic'
    ? progress.adventureDates
    : Array.from(new Set([...progress.adventureDates, localDateKey(attempt.answeredAt)])).sort().slice(-365);
  return {
    ...progress,
    mastery,
    spirits,
    attempts,
    adventureDates,
    light: progress.light + (attempt.correct ? Math.max(2, 6 - attempt.hintLevel) : 1),
  };
}

export function completeQuest(progress: PlayerProgress): PlayerProgress {
  const completedQuest = MAIN_QUESTS[progress.questStep];
  const spirits = { ...progress.spirits };
  if (completedQuest?.spiritId && spirits[completedQuest.spiritId] === 'locked') {
    spirits[completedQuest.spiritId] = 'captured';
  }
  return {
    ...progress,
    spirits,
    questStep: Math.min(MAIN_QUESTS.length + 1, progress.questStep + 1),
  };
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
  const eligible = items.filter((item) => item.prerequisites.every(
    (id) => (progress.mastery[id]?.stage ?? 0) >= 1,
  ));
  const due = eligible.filter((item) => {
    const state = progress.mastery[item.id];
    return state && new Date(state.dueAt) <= now;
  });
  const fresh = eligible.filter((item) => !progress.mastery[item.id]);
  const mixed = eligible
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

export function composeQuestSession(
  progress: PlayerProgress,
  quest: QuestDefinition,
  now = new Date(),
  targetSize = quest.itemIds.length,
  items = ENGLISH_QUEST_ITEMS,
): LearningItem[] {
  const eligible = items.filter((item) => item.prerequisites.every(
    (id) => (progress.mastery[id]?.stage ?? 0) >= 1,
  ));
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const storyItems = quest.itemIds
    .map((id) => ITEM_BY_ID.get(id))
    .filter((item): item is LearningItem => item !== undefined)
    .filter((item) => eligibleIds.has(item.id));
  const due = eligible.filter((item) => {
    const state = progress.mastery[item.id];
    return state && new Date(state.dueAt) <= now;
  });
  const storyFresh = storyItems.filter((item) => !progress.mastery[item.id]);
  const storySeen = storyItems.filter((item) => progress.mastery[item.id]);
  const mixed = eligible
    .filter((item) => progress.mastery[item.id] && !due.includes(item) && !storySeen.includes(item))
    .sort((a, b) => (progress.mastery[a.id]?.stage ?? 0) - (progress.mastery[b.id]?.stage ?? 0));
  const freshElsewhere = eligible.filter(
    (item) => !progress.mastery[item.id] && !storyFresh.includes(item),
  );
  const placementStretch = progress.diagnosticScore >= 5
    ? freshElsewhere.filter((item) => item.difficulty >= 2).slice(0, 2)
    : [];

  const dueQuota = Math.ceil(targetSize * 0.5);
  const newQuota = Math.ceil(targetSize * 0.35);
  const mixedQuota = Math.max(1, targetSize - dueQuota - newQuota);
  return unique([
    ...due.slice(0, dueQuota),
    ...storyFresh.slice(0, newQuota),
    ...placementStretch,
    ...storySeen.slice(0, mixedQuota),
    ...mixed.slice(0, mixedQuota),
    ...storyFresh.slice(newQuota),
    ...storySeen.slice(mixedQuota),
    ...due.slice(dueQuota),
    ...freshElsewhere,
    ...mixed.slice(mixedQuota),
  ]).slice(0, targetSize);
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
