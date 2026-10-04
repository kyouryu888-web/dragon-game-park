import type { UnoPlayer } from './unoTypes';
import type { DragonPresentationPreference } from '../../components/dragonReactions';
import { selectGameArt } from '../../assets/dragons/presentation-v2/selectGameArt';

/** Only participating CPU levels; no playback wait and no network request when off. */
export function UnoPresentationPreload({ players, preference }: {
  players: readonly UnoPlayer[];
  preference: DragonPresentationPreference;
}) {
  if (preference === 'off') return null;
  const urls = new Set<string>();
  for (const player of players) {
    if (!player.isCpu) continue;
    const art = selectGameArt('uno', player, 'attack', 'counter-draw2');
    for (const url of Object.values(art)) if (url) urls.add(url);
  }
  return <>{[...urls].map(url => <link key={url} rel="preload" as="image" href={url} />)}</>;
}
