import cornerCaptureImage from './assets/corner-capture.png';
import finaleImage from './assets/finale.png';
import specialBombImage from './assets/special-bomb.jpg';
import specialShieldImage from './assets/special-shield.jpg';
import specialInfectionImage from './assets/special-infection.jpg';

export type BakuretsuCinematicEvent = {
  key: string;
  kind: 'corner' | 'finale' | 'bomb' | 'shield' | 'infection';
  title: string;
  detail: string;
};

const IMAGE_BY_KIND = {
  corner: cornerCaptureImage,
  finale: finaleImage,
  bomb: specialBombImage,
  shield: specialShieldImage,
  infection: specialInfectionImage,
} satisfies Record<BakuretsuCinematicEvent['kind'], string>;

export function BakuretsuCinematicOverlay({ event }: { event: BakuretsuCinematicEvent }) {
  return (
    <div className={`reversi-cinematic is-${event.kind}`} role="status" aria-live="assertive">
      <div className="reversi-cinematic-vignette" />
      <img src={IMAGE_BY_KIND[event.kind]} alt="" aria-hidden="true" />
      <div className="reversi-cinematic-copy">
        <strong>{event.title}</strong>
        <span>{event.detail}</span>
      </div>
    </div>
  );
}
