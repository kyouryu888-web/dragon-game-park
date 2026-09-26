import type { DragonEmotion, DragonLevel } from './types';

// The 192px display set gives small seat portraits cheap, hashed production URLs.
const reactionImages = import.meta.glob('../../assets/dragons/reactions/display/lv*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function getDragonReactionImageUrl(level: DragonLevel, emotion: DragonEmotion): string | undefined {
  return reactionImages[`../../assets/dragons/reactions/display/lv${level}/${emotion}.webp`];
}
