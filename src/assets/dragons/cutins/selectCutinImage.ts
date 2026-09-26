export type DragonCutinScene = 'attack' | 'pressure' | 'victory' | 'defeat';

export type CutinActor = {
  isCpu: boolean;
  cpuLevel?: 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard' | 1 | 2 | 3 | 4 | 5;
};

// Vite turns these imported files into production URLs. Missing variants use
// each game's existing image until their approved illustrations are delivered.
const unoImages = import.meta.glob('./uno/lv*-*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const landscapeImages = import.meta.glob('./master/lv*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function levelOf(actor: CutinActor | undefined): number | null {
  if (!actor?.isCpu || actor.cpuLevel === undefined) return null;
  if (typeof actor.cpuLevel === 'number') return actor.cpuLevel;
  const levels = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
  const index = levels.indexOf(actor.cpuLevel);
  return index < 0 ? null : index + 1;
}

export function selectDragonCutinImage(
  actor: CutinActor | undefined,
  scene: DragonCutinScene,
  shape: 'uno' | 'landscape',
): string | undefined {
  const level = levelOf(actor);
  if (level === null) return undefined;
  return shape === 'uno'
    ? unoImages[`./uno/lv${level}-${scene}.webp`]
    : landscapeImages[`./master/lv${level}/${scene}.webp`];
}
