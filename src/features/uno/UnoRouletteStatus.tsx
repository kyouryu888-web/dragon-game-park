import type { CSSProperties } from 'react';
import type { UnoColor } from './unoTypes';
import type { UnoRoulettePresentation } from './unoCinematics';

const COLOR_TEXT: Record<UnoColor, string> = {
  red: '赤色',
  yellow: '黄色',
  green: '緑色',
  blue: '青色',
};

const COLOR_HEX: Record<UnoColor, string> = {
  red: '#df352c',
  yellow: '#f2c436',
  green: '#25a85a',
  blue: '#2581d8',
};

export function UnoRouletteStatus({
  presentation,
}: {
  presentation: UnoRoulettePresentation;
}) {
  const colorText = COLOR_TEXT[presentation.targetColor];
  const isSafe = presentation.phase === 'safe';
  const accessibleMessage = isSafe
    ? `${colorText}が出ました。${presentation.playerName}は合計${presentation.drawnCount}まいでセーフです。`
    : `${presentation.playerName}が${colorText}のカードを引くまで、カラー ルーレットを進めます。`;

  return (
    <div
      className={`uno-roulette-status ${isSafe ? 'is-safe' : 'is-drawing'}`}
      data-roulette-sequence={presentation.sequenceKey}
      data-roulette-step={presentation.stepKey}
      style={{ '--uno-roulette-target-color': COLOR_HEX[presentation.targetColor] } as CSSProperties}
    >
      <div className="uno-roulette-status-visual" aria-hidden="true">
        <span className="uno-roulette-status-wheel" />
        <span className="uno-roulette-status-copy">
          <span className="uno-roulette-status-eyebrow">カラー ルーレット</span>
          <strong>{isSafe ? `${colorText}が出た！ セーフ！` : `${colorText}が出るまで`}</strong>
          <span className="uno-roulette-status-meta">
            <span className="uno-roulette-status-player">{presentation.playerName}</span>
            <span className="uno-roulette-status-count">
              {isSafe
                ? `合計${presentation.drawnCount}まい`
                : presentation.drawnCount === 0
                  ? 'スタート'
                  : `${presentation.drawnCount}まい目`}
            </span>
          </span>
        </span>
      </div>
      <span className="uno-screen-reader-only" role="status" aria-live="polite" aria-atomic="true">
        {accessibleMessage}
      </span>
    </div>
  );
}
