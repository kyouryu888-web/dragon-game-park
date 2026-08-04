export type LearningType = 'sound' | 'word' | 'chunk' | 'dialogue' | 'reading';

export type LearningMode =
  | 'diagnostic'
  | 'capture'
  | 'arena'
  | 'merge'
  | 'escape'
  | 'review';

export type HintLevel = 0 | 1 | 2 | 3;

export type SkillTag =
  | 'phonics'
  | 'listening'
  | 'vocabulary'
  | 'speaking'
  | 'grammar'
  | 'conversation'
  | 'reading'
  | 'inference';

export interface LearningItem {
  id: string;
  type: LearningType;
  promptJa: string;
  display: string;
  answer: string;
  choices: string[];
  audioText: string;
  audioAsset: string;
  emoji: string;
  skillTags: SkillTag[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
}

export interface Attempt {
  id: string;
  itemId: string;
  mode: LearningMode;
  correct: boolean;
  latencyMs: number;
  hintLevel: HintLevel;
  answeredAt: string;
}

export interface MasteryState {
  stage: number;
  dueAt: string;
  lapses: number;
  lastSeenAt: string;
  successfulModalities: LearningMode[];
  successfulDates: string[];
}

export interface GameResult {
  attempts: Attempt[];
  lightEarned: number;
  completed: boolean;
}

export interface SpiritDefinition {
  id: string;
  name: string;
  evolvedName: string;
  description: string;
  spriteIndex: number;
  unlockQuestStep: number;
  unlockMasteredCount: number;
}

export interface GuideDefinition {
  id: string;
  name: string;
  role: string;
  message: string;
  spriteIndex: number;
}

export interface QuestDefinition {
  id: string;
  chapter: number;
  title: string;
  regionName: string;
  mode: LearningMode;
  guideId: string;
  spiritId?: string;
  story: string;
  objective: string;
  reward: string;
  rewardEmoji: string;
  itemIds: string[];
  final?: boolean;
}

export type SpiritState = 'locked' | 'captured' | 'evolved';

export interface PlayerProgress {
  schemaVersion: 1;
  profileName: string;
  diagnosticComplete: boolean;
  diagnosticScore: number;
  questStep: number;
  light: number;
  mastery: Record<string, MasteryState>;
  spirits: Record<string, SpiritState>;
  attempts: Attempt[];
  adventureDates: string[];
  settings: {
    soundOn: boolean;
    reducedMotion: boolean;
    dailyMinutes: number;
  };
}

export interface AudioManifest {
  itemId: string;
  transcript: string;
  asset: string;
  voice: string;
  model: string;
  generatorVersion: string;
  sampleRate: number;
  bitrateKbps: number;
  durationSeconds: number;
  rmsDbfs: number;
  peakDbfs: number;
  sha256: string;
}
