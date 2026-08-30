import cornerCaptureImage from './assets/corner-capture.png';
import grandFlipImage from './assets/grand-flip.png';
import finaleImage from './assets/finale.png';

export type ReversiCinematicEvent = {
  key: string;
  kind: 'corner' | 'grand-flip' | 'finale';
  title: string;
  detail: string;
};

const IMAGE_BY_KIND = {
  corner: cornerCaptureImage,
  'grand-flip': grandFlipImage,
  finale: finaleImage,
} satisfies Record<ReversiCinematicEvent['kind'], string>;

export function ReversiCinematicOverlay({ event }: { event: ReversiCinematicEvent }) {
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
