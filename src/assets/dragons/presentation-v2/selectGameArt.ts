import type { CutinActor, DragonCutinScene } from '../cutins/selectCutinImage';
import { selectDragonCutinImage } from '../cutins/selectCutinImage';

export type DragonGame = 'uno' | 'babanuki' | 'reversi' | 'bakuretsu-reversi' | 'backgammon' | 'mancala';
export type GameArt = Readonly<{ image?: string; background?: string; character?: string }>;
const sceneImages = import.meta.glob('./scenes/*/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const backdrops = import.meta.glob('./backdrops/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const levels = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;
function levelOf(actor: CutinActor | undefined): number | undefined {
  if (!actor?.isCpu || actor.cpuLevel === undefined) return undefined;
  if (typeof actor.cpuLevel === 'number') return actor.cpuLevel >= 1 && actor.cpuLevel <= 5 ? actor.cpuLevel : undefined;
  const index = levels.indexOf(actor.cpuLevel);
  return index < 0 ? undefined : index + 1;
}

/** Painted props are symbolic scenery. Actual cards, scores and die/cube values stay in the game's factual UI. */
export function selectGameArt(game: DragonGame, actor: CutinActor | undefined, scene: DragonCutinScene, variant?: string): GameArt {
  const level = levelOf(actor);
  const character = level ? selectDragonCutinImage(actor, scene, game === 'uno' ? 'uno' : 'landscape') : undefined;
  const backdrop = game === 'uno'
    ? variant === 'draw-rain' || variant === 'knockout-pile' || scene === 'pressure' || scene === 'defeat' ? 'uno-draw-rain' : 'uno-counter'
    : game;
  const background = backdrops[`./backdrops/${backdrop}.webp`];
  const fullScene = level && scene === 'attack'
    ? game === 'uno' && variant === 'counter-draw2'
      ? `./scenes/uno/lv${level}-counter.webp`
      : game === 'babanuki' && variant === 'shuffle'
        ? `./scenes/babanuki/lv${level}-shuffle.webp`
        : undefined
    : undefined;
  const image = fullScene ? sceneImages[fullScene] : undefined;
  return { image, background, character };
}
