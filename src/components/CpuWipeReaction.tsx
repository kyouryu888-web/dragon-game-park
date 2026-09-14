import { useEffect, useState } from 'react';
import './CpuWipeReaction.css';

export type CpuEmotion = 'joy' | 'angry' | 'smug' | 'crying' | 'scared' | 'laughing';

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
  durationMs = 2500 
}: CpuWipeReactionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mount時にスライドイン
    const inTimer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });

    const outTimer = setTimeout(() => {
      setIsVisible(false);
      // スライドアウトが終わる頃合いで親に通知
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 350);
    }, durationMs);

    return () => {
      cancelAnimationFrame(inTimer);
      clearTimeout(outTimer);
    };
  }, [durationMs, onComplete]);

  const [imageSrc, setImageSrc] = useState(`/src/assets/dragons/reactions/lv${cpuLevel}/${emotion}.webp`);
  const [hasFallbackPngFailed, setHasFallbackPngFailed] = useState(false);

  useEffect(() => {
    setImageSrc(`/src/assets/dragons/reactions/lv${cpuLevel}/${emotion}.webp`);
    setHasFallbackPngFailed(false);
  }, [cpuLevel, emotion]);

  return (
    <div className={`cpu-wipe-container ${isVisible ? 'visible' : ''}`}>
      <div className="cpu-wipe-content">
        <img 
          src={imageSrc} 
          alt={`CPU Lv${cpuLevel} - ${emotion}`} 
          className="cpu-wipe-image" 
          onError={(e) => {
            const target = e.currentTarget;
            if (!hasFallbackPngFailed && imageSrc.endsWith('.webp')) {
              setHasFallbackPngFailed(true);
              setImageSrc(`/src/assets/dragons/reactions/lv${cpuLevel}/${emotion}.png`);
            } else {
              target.style.display = 'none';
              target.parentElement?.classList.add('fallback-mode');
            }
          }}
        />
        <div className="cpu-wipe-fallback-text">
          Lv{cpuLevel}<br/>{emotion}
        </div>
      </div>
    </div>
  );
}
