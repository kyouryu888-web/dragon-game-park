import type { CSSProperties } from 'react';
import { decideDragonReaction, GameCutinArt, type DragonPresentationPreference, type PublicDragonReactionInput } from '../../components/dragonReactions';
import { getUnoCinematicDuration, type UnoFullScreenCinematicEvent } from './unoCinematics';
import type { UnoPlayer } from './unoTypes';
import './UnoPresentation.css';
export function UnoCinematicOverlay({ event, players, reactionInputs = [], preference = 'lively' }: {
  event: UnoFullScreenCinematicEvent | null;
  players?: UnoPlayer[];
  reactionInputs?: readonly PublicDragonReactionInput[];
  preference?: DragonPresentationPreference;
}) {
  if (!event) return null;

  const actor = players?.find((player) => player.id === event.playerId);
  const scene = event.kind === 'draw-counter' ? 'attack' : event.kind === 'forced-draw' ? 'pressure' : 'defeat';
  const matchingKind = event.kind === 'draw-counter' ? 'uno-draw-counter'
    : event.kind === 'forced-draw' ? 'uno-forced-draw' : 'uno-knockout';
  const matchingReaction = reactionInputs.find(input => input.presenter !== 'narrator' && input.cpu.id === event.playerId && input.kind === matchingKind);
  const actedScene = matchingReaction ? decideDragonReaction(matchingReaction).cutIn : undefined;
  const variant = event.kind === 'draw-counter'
    ? event.addedCount === 2 ? 'counter-draw2' : 'counter'
    : event.kind === 'forced-draw' ? 'draw-rain' : 'knockout-pile';
  const isCounter = event.kind === 'draw-counter';
  const isForcedDraw = event.kind === 'forced-draw';
  const eyebrow = isCounter
    ? event.playerName
    : isForcedDraw
      ? event.playerName
      : knockoutCauseText(event);
  const title = isCounter
    ? event.reversed ? 'むきを変えて返した！' : `${event.cardName}で返した！`
    : isForcedDraw
      ? `合計${event.count}まい引いた！`
      : '25まいでアウト！';
  const detail = isCounter
    ? `合計${event.totalCount}まい`
    : event.kind === 'knockout'
      ? `${event.playerName}　脱落`
      : 'ドローを受け取りました';

  return (
    <div
      key={event.key}
      className={`uno-cinematic-overlay is-${event.kind}`}
      style={({ '--uno-cinematic-duration': `${getUnoCinematicDuration(event)}ms` } as CSSProperties)}
      data-preference={preference}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="uno-cinematic-side-lines" aria-hidden="true" />
      <div className="uno-cinematic-panel">
        <GameCutinArt game="uno" actor={actor} scene={actedScene ?? scene} variant={variant} preference={preference} className="uno-cinematic-image" />
        <div className="uno-cinematic-shade" aria-hidden="true" />
        <div className="uno-cinematic-copy is-top">
          <span>{eyebrow}</span>
        </div>
        <div className="uno-cinematic-copy is-bottom">
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
        <div className="uno-cinematic-flying-cards" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
      </div>
    </div>
  );
}

function knockoutCauseText(event: Extract<UnoFullScreenCinematicEvent, { kind: 'knockout' }>): string {
  if (event.cause === 'color-roulette') {
    return `カラー ルーレット ${event.count ?? 1}まい目`;
  }
  if (event.cause === 'draw-stack') {
    return `合計${event.count ?? 0}まいのドロー`;
  }
  return 'カードを引いた結果';
}
