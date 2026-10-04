import type { DragonCpu, DragonLevel, DragonReactionPresenter } from './types';

export type PublicReactionPlayer = Readonly<{
  id: string;
  name: string;
  isCpu: boolean;
  cpuLevel?: 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard' | DragonLevel;
}>;

const CPU_LEVELS = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;

/** The mascot announces a public action; it never poses as the human who made it. */
export function publicReactionPresenter(
  player: PublicReactionPlayer | undefined,
  narratorName = 'ゲーム案内',
): Readonly<{ cpu: DragonCpu; presenter: DragonReactionPresenter }> {
  if (player?.isCpu) {
    const index = typeof player.cpuLevel === 'string' ? CPU_LEVELS.indexOf(player.cpuLevel) : -1;
    const level = typeof player.cpuLevel === 'number' ? player.cpuLevel : index >= 0 ? index + 1 : 3;
    return { cpu: { id: player.id, name: player.name, level: level as DragonLevel }, presenter: 'cpu' };
  }
  return {
    cpu: { id: `dragon-narrator:${player?.id ?? 'public'}`, name: narratorName, level: 3 },
    presenter: 'narrator',
  };
}
