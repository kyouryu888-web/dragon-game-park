import { useEffect, useRef, useState } from 'react';
import { getDragonReactionImageUrl } from './dragonReactions/assets';
import type { DragonEmotion, DragonLevel } from './dragonReactions/types';
import './CpuWipeReaction.css';

export type CpuEmotion = DragonEmotion;

export type CpuWipeReactionProps = {
  cpuLevel: number;
  emotion: CpuEmotion;
  onComplete?: () => void;
  durationMs?: number;
};

export function CpuWipeReaction({
  cpuLevel,
  emotion,
  onComplete,
  durationMs = 2500,
}: CpuWipeReactionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setIsVisible(false);
    let secondFrame = 0;
    let completionTimer = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setIsVisible(true));
    });
    const outTimer = window.setTimeout(() => {
      setIsVisible(false);
      completionTimer = window.setTimeout(() => onCompleteRef.current?.(), 350);
    }, durationMs);

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(outTimer);
      window.clearTimeout(completionTimer);
    };
  }, [cpuLevel, emotion, durationMs]);

  const level = (cpuLevel >= 1 && cpuLevel <= 5 ? cpuLevel : 1) as DragonLevel;
  const imageUrl = getDragonReactionImageUrl(level, emotion);
  const imageFailed = !imageUrl || failedUrl === imageUrl;

  return (
    <div className={`cpu-wipe-container${isVisible ? ' slide-in' : ''}`}>
      <div className={`cpu-wipe-content${imageFailed ? ' fallback-mode' : ''}`}>
        {!imageFailed && <img
          src={imageUrl}
          alt={`CPU Lv${cpuLevel} - ${emotion}`}
          className="cpu-wipe-image"
          onError={() => setFailedUrl(imageUrl)}
        />}
        <div className="cpu-wipe-fallback-text">Lv{cpuLevel}<br />{emotion}</div>
      </div>
    </div>
  );
}
