import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getDragonReactionImageUrl } from './assets';
import { DRAGON_REACTION_DURATION_MS } from './queue';
import type { DragonCpu, DragonPresentationPreference, DragonReactionEvent } from './types';
import './DragonReactionWipe.css';

export type DragonReactionWipeProps = Readonly<{
  cpu: DragonCpu;
  event?: DragonReactionEvent | null;
  preference?: DragonPresentationPreference;
  side?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
}>;

export function DragonReactionWipe({
  cpu,
  event,
  preference = 'lively',
  side = 'left',
  className = '',
  style,
}: DragonReactionWipeProps) {
  const reaction = event?.cpu.id === cpu.id ? event : null;
  const reactionKey = reaction?.key;
  const hasSecondStage = (reaction?.stages.length ?? 0) > 1;
  const [stageState, setStageState] = useState<{ key: string; index: number }>({ key: '', index: 0 });
  const [failedUrl, setFailedUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!reactionKey || !hasSecondStage) return;
    const timeout = window.setTimeout(() => {
      setStageState({ key: reactionKey, index: 1 });
    }, DRAGON_REACTION_DURATION_MS / 2);
    return () => window.clearTimeout(timeout);
  }, [reactionKey, hasSecondStage]);

  if (preference === 'off') return null;

  const stageIndex = stageState.key === reaction?.key ? stageState.index : 0;
  const stage = reaction?.stages[stageIndex];
  const emotion = stage?.emotion ?? 'joy';
  const imageUrl = getDragonReactionImageUrl(cpu.level, emotion);
  const imageFailed = !imageUrl || failedUrl === imageUrl;

  return (
    <div
      className={`dragon-reaction-wipe is-${side}${reaction ? ' is-reacting' : ''}${className ? ` ${className}` : ''}`}
      data-cpu-id={cpu.id}
      data-cpu-level={cpu.level}
      style={style}
      aria-label={`${cpu.name} Lv${cpu.level}${reaction ? `: ${stage?.speech ?? reaction.speech}` : ''}`}
    >
      {stage?.speech && (
        <div className="dragon-reaction-speech" role="status" aria-live="polite">
          {stage.speech}
        </div>
      )}
      <div className="dragon-reaction-face">
        {imageFailed ? <span className="dragon-reaction-image-fallback">Lv{cpu.level}</span> : (
          <img src={imageUrl} alt="" onError={() => setFailedUrl(imageUrl)} />
        )}
      </div>
    </div>
  );
}
