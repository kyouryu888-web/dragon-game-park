import { useState } from 'react';
import { selectDragonCutinImage } from '../assets/dragons/cutins/selectCutinImage';
import type { CutinActor } from '../assets/dragons/cutins/selectCutinImage';
import { useDragonReactionPreference } from './dragonReactions';

/** Static result art; it never delays rematch or exit actions. */
export function DragonResultArtwork({ actor, won, name }: {
  actor: CutinActor | undefined;
  won: boolean;
  name: string;
}) {
  const { preference } = useDragonReactionPreference();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = selectDragonCutinImage(actor, won ? 'victory' : 'defeat', 'landscape');
  if (preference === 'off' || !url || url === failedUrl) return null;
  return (
    <img
      src={url}
      alt={`${name}の${won ? '勝利' : '敗北'}のリアクション`}
      onError={() => setFailedUrl(url)}
      style={{ display: 'block', width: 'min(100%, 150px)', height: 96, objectFit: 'contain', margin: '0 auto 6px', pointerEvents: 'none' }}
    />
  );
}
