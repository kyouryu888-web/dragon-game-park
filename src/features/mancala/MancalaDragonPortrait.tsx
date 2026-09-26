import type { CSSProperties } from 'react';
import { DragonReactionWipe } from '../../components/dragonReactions';
import type { DragonPresentationPreference, DragonReactionEvent } from '../../components/dragonReactions';
import type { Player } from './mancalaTypes';
import './MancalaDragonPortrait.css';

const LEVELS = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;

export function MancalaDragonPortrait({ player, reaction, preference, side = 'left', speechPlacement = 'above' }: {
  player: Player;
  reaction: DragonReactionEvent | null;
  preference: DragonPresentationPreference;
  side?: 'left' | 'right';
  speechPlacement?: 'above' | 'left';
}) {
  if (!player.isCpu) return null;
  const index = LEVELS.indexOf(player.cpuLevel);
  if (index < 0) return null;
  return (
    <DragonReactionWipe
      cpu={{ id: player.id, name: player.name, level: (index + 1) as 1 | 2 | 3 | 4 | 5 }}
      event={reaction}
      preference={preference}
      side={side}
      className={`mancala-dragon-portrait${speechPlacement === 'left' ? ' is-speech-left' : ''}`}
      style={{ '--dragon-face-size': '34px' } as CSSProperties}
    />
  );
}
