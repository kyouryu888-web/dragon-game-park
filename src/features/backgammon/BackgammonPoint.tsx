import type { Point } from './backgammonTypes';

type BackgammonPointProps = {
  index: number;          // 0-23
  point: Point;
  row: 'top' | 'bottom';
  selectable: boolean;    // 移動元として選べる
  selected: boolean;      // 選択中
  isDest: boolean;        // 移動先候補
  onTap: () => void;
  registerRef: (el: HTMLElement | null) => void;
};

const MAX_VISIBLE = 5;

export function BackgammonPoint({
  index, point, row, selectable, selected, isDest, onTap, registerRef,
}: BackgammonPointProps) {
  const triClass = index % 2 === 0 ? 'tri-a' : 'tri-b';
  const classes = [
    'bg-point', row, triClass,
    selectable ? 'selectable' : '',
    selected ? 'selected' : '',
    isDest ? 'dest' : '',
  ].filter(Boolean).join(' ');

  const count = point?.count ?? 0;
  const visible = Math.min(count, MAX_VISIBLE);
  // top: 中央寄り（積みの先端）が最後の子 / bottom: 最初の子
  const labelIndex = row === 'top' ? visible - 1 : 0;

  return (
    <button
      ref={registerRef}
      className={classes}
      onClick={onTap}
      disabled={!selectable && !isDest}
      aria-label={`ポイント${index + 1}`}
    >
      {point && (
        <div className="bg-stack">
          {Array.from({ length: visible }, (_, i) => (
            <div key={i} className={`bg-checker ${point.owner}`}>
              {count > MAX_VISIBLE && i === labelIndex && (
                <span className="bg-count">{count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
