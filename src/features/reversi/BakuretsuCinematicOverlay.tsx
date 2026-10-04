import { GameCutinArt } from '../../components/dragonReactions';
import type { DragonPresentationPreference } from '../../components/dragonReactions';
import type { CutinActor, DragonCutinScene } from '../../assets/dragons/cutins/selectCutinImage';

export type BakuretsuCinematicEvent = {
  key: string;
  kind: 'corner' | 'finale' | 'bomb' | 'shield' | 'infection';
  title: string;
  detail: string;
  imageUrl?: string;
  artActor?: CutinActor;
  artScene?: DragonCutinScene;
};

export function BakuretsuCinematicOverlay({ event, preference = 'lively' }: { event: BakuretsuCinematicEvent; preference?: DragonPresentationPreference }) {
  return (
    <div className={`reversi-cinematic is-${event.kind}`} role="status" aria-live="assertive">
      <div className="reversi-cinematic-vignette" />
      <GameCutinArt game="bakuretsu-reversi" actor={event.artActor} scene={event.artScene ?? 'attack'} variant={event.kind} preference={preference} className="reversi-game-cutin-art" />
      <div className="reversi-cinematic-copy">
        <strong>{event.title}</strong>
        <span>{event.detail}</span>
      </div>
    </div>
  );
}
