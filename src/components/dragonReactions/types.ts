export type DragonLevel = 1 | 2 | 3 | 4 | 5;

export type DragonEmotion = 'joy' | 'smug' | 'crying' | 'angry' | 'laughing' | 'scared';

export type DragonOutcome = 'advantage' | 'disadvantage' | 'neutral' | 'victory' | 'defeat';

export type DragonCutIn = 'attack' | 'pressure' | 'victory' | 'defeat';

export type DragonPresentationPreference = 'lively' | 'subtle' | 'off';

export type DragonCpu = Readonly<{
  id: string;
  name: string;
  level: DragonLevel;
}>;

/** A public, already-revealed game event. Never put hands, joker locations or CPU evaluations here. */
export type PublicDragonReactionInput = Readonly<{
  matchId: string;
  sequence: number;
  kind: string;
  cpu: DragonCpu;
  outcome: DragonOutcome;
  factLabel: string;
  severity?: 'normal' | 'major';
  priority?: 1 | 2 | 3 | 4;
  cutIn?: DragonCutIn;
}>;

export type DragonReactionStage = Readonly<{
  emotion: DragonEmotion;
  speech: string;
}>;

/** Acting is cosmetic. The separate factLabel must always describe the true public game event. */
export type DragonReactionEvent = Readonly<{
  key: string;
  matchId: string;
  sequence: number;
  kind: string;
  cpu: DragonCpu;
  outcome: DragonOutcome;
  factLabel: string;
  acting: 'sincere' | 'bluff';
  emotion: DragonEmotion;
  speech: string;
  stages: readonly DragonReactionStage[];
  priority: 1 | 2 | 3 | 4;
  cutIn?: DragonCutIn;
}>;
