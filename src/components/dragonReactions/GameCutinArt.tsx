import { useState } from 'react';
import type { CutinActor } from '../../assets/dragons/cutins/selectCutinImage';
import { selectGameArt } from '../../assets/dragons/presentation-v2/selectGameArt';
import type { DragonCutIn, DragonPresentationPreference } from './types';
import './GameCutinArt.css';

export type DragonPresentationGame = 'uno' | 'babanuki' | 'reversi' | 'bakuretsu-reversi' | 'backgammon' | 'mancala';
export type GameCutinArtProps = Readonly<{
  game: DragonPresentationGame;
  actor?: CutinActor;
  scene: DragonCutIn;
  variant?: string;
  preference?: DragonPresentationPreference;
  className?: string;
}>;

/** Art only: the game keeps ownership of fact labels, playback windows and input. */
export function GameCutinArt({ game, actor, scene, variant, preference = 'lively', className = '' }: GameCutinArtProps) {
  const [failedScene, setFailedScene] = useState<string>();
  const art = selectGameArt(game, actor, scene, variant);
  if (preference === 'off' || (!art.image && !art.background && !art.character)) return null;
  const showScene = art.image && art.image !== failedScene;
  return (
    <div
      className={`game-cutin-art game-cutin-art--${game}${className ? ` ${className}` : ''}`}
      data-game={game}
      data-scene={scene}
      data-art-fallback={art.image && !showScene ? 'true' : undefined}
      aria-hidden="true"
    >
      {showScene ? <img className="game-cutin-art-scene" src={art.image} alt="" onError={() => setFailedScene(art.image)} /> : (
        <>
          {art.background && <img className="game-cutin-art-backdrop" src={art.background} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
          {art.character && <img className="game-cutin-art-character" src={art.character} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
        </>
      )}
    </div>
  );
}
