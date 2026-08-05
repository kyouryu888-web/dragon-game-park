import { createInitialProgress, localDateKey } from './englishQuestEngine';
import { ENGLISH_QUEST_SPIRITS, ITEM_BY_ID, MAIN_QUESTS } from './englishQuestContent';
import type { Attempt, LearningMode, MasteryState, PlayerProgress, SpiritState } from './englishQuestTypes';

export const ENGLISH_QUEST_STORAGE_KEY = 'dgp-english-quest-v1';

const MODES = new Set<LearningMode>(['diagnostic', 'capture', 'arena', 'merge', 'escape', 'review']);
const SPIRIT_STATES = new Set<SpiritState>(['locked', 'captured', 'evolved']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const finiteNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

const validIso = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function normalizeMastery(value: unknown): MasteryState | null {
  if (!isRecord(value) || !validIso(value.dueAt) || !validIso(value.lastSeenAt)) return null;
  const modalities = Array.isArray(value.successfulModalities)
    ? value.successfulModalities.filter((mode): mode is LearningMode => typeof mode === 'string' && MODES.has(mode as LearningMode))
    : [];
  const dates = Array.isArray(value.successfulDates)
    ? value.successfulDates.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)).slice(-8)
    : [];
  return {
    stage: finiteNumber(value.stage, 0, 0, 5),
    dueAt: value.dueAt,
    lapses: finiteNumber(value.lapses, 0, 0, 9999),
    lastSeenAt: value.lastSeenAt,
    successfulModalities: Array.from(new Set(modalities)),
    successfulDates: Array.from(new Set(dates)),
  };
}

function normalizeAttempt(value: unknown): Attempt | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.itemId !== 'string') return null;
  if (!ITEM_BY_ID.has(value.itemId) || typeof value.mode !== 'string' || !MODES.has(value.mode as LearningMode)) return null;
  if (typeof value.correct !== 'boolean' || !validIso(value.answeredAt)) return null;
  return {
    id: value.id.slice(0, 120),
    itemId: value.itemId,
    mode: value.mode as LearningMode,
    correct: value.correct,
    latencyMs: finiteNumber(value.latencyMs, 0, 0, 60 * 60 * 1000),
    hintLevel: finiteNumber(value.hintLevel, 0, 0, 3) as Attempt['hintLevel'],
    answeredAt: value.answeredAt,
  };
}

export function normalizeProgress(value: unknown): PlayerProgress | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (typeof value.profileName !== 'string' || typeof value.diagnosticComplete !== 'boolean') return null;
  if (!isRecord(value.mastery) || !isRecord(value.spirits) || !Array.isArray(value.attempts)) return null;

  const initial = createInitialProgress();
  const mastery: Record<string, MasteryState> = {};
  for (const [itemId, state] of Object.entries(value.mastery)) {
    if (!ITEM_BY_ID.has(itemId)) continue;
    const normalized = normalizeMastery(state);
    if (normalized) mastery[itemId] = normalized;
  }

  const spirits = { ...initial.spirits };
  for (const spirit of ENGLISH_QUEST_SPIRITS) {
    const state = value.spirits[spirit.id];
    if (typeof state === 'string' && SPIRIT_STATES.has(state as SpiritState)) spirits[spirit.id] = state as SpiritState;
  }

  const settings = isRecord(value.settings) ? value.settings : {};
  const attempts = value.attempts.map(normalizeAttempt).filter((attempt): attempt is Attempt => Boolean(attempt)).slice(-200);
  const importedAdventureDates = Array.isArray(value.adventureDates)
    ? value.adventureDates.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
    : attempts.filter((attempt) => attempt.mode !== 'diagnostic').map((attempt) => localDateKey(attempt.answeredAt));
  const audioReview = isRecord(value.audioReview) ? value.audioReview : {};
  const approvedItemIds = Array.isArray(audioReview.approvedItemIds)
    ? audioReview.approvedItemIds.filter((id): id is string => typeof id === 'string' && ITEM_BY_ID.has(id))
    : [];
  const approvedSet = new Set(approvedItemIds);
  const flaggedItemIds = Array.isArray(audioReview.flaggedItemIds)
    ? audioReview.flaggedItemIds.filter((id): id is string => typeof id === 'string' && ITEM_BY_ID.has(id) && !approvedSet.has(id))
    : [];
  return {
    schemaVersion: 1,
    profileName: value.profileName.trim().slice(0, 16) || initial.profileName,
    diagnosticComplete: value.diagnosticComplete,
    diagnosticScore: finiteNumber(value.diagnosticScore, 0, 0, 10),
    questStep: finiteNumber(value.questStep, 0, 0, MAIN_QUESTS.length + 1),
    light: finiteNumber(value.light, 0, 0, 9_999_999),
    mastery,
    spirits,
    attempts,
    adventureDates: Array.from(new Set(importedAdventureDates)).sort().slice(-365),
    audioReview: {
      approvedItemIds: Array.from(new Set(approvedItemIds)),
      flaggedItemIds: Array.from(new Set(flaggedItemIds)),
    },
    settings: {
      soundOn: typeof settings.soundOn === 'boolean' ? settings.soundOn : initial.settings.soundOn,
      reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : initial.settings.reducedMotion,
      dailyMinutes: finiteNumber(settings.dailyMinutes, initial.settings.dailyMinutes, 5, 20),
    },
  };
}

export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): PlayerProgress {
  try {
    const raw = storage.getItem(ENGLISH_QUEST_STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed: unknown = JSON.parse(raw);
    return normalizeProgress(parsed) ?? createInitialProgress();
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(
  progress: PlayerProgress,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(ENGLISH_QUEST_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or a full storage quota must not block play.
  }
}

export function serializeProgress(progress: PlayerProgress): string {
  return JSON.stringify(progress, null, 2);
}

export function parseImportedProgress(raw: string): PlayerProgress | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeProgress(parsed);
  } catch {
    return null;
  }
}

export function clearProgress(storage: Pick<Storage, 'removeItem'> = localStorage): PlayerProgress {
  try {
    storage.removeItem(ENGLISH_QUEST_STORAGE_KEY);
  } catch {
    // Reset still returns a clean in-memory profile.
  }
  return createInitialProgress();
}
