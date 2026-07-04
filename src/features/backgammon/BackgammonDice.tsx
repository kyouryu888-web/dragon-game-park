// サイコロの描画（ピップをCSSグリッドで配置）＋転がり演出

/** 出目ごとのピップ位置（3x3グリッドのセル番号 0-8） */
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

type DieProps = {
  value: number;
  used?: boolean;
  rolling?: boolean;
};

export function Die({ value, used, rolling }: DieProps) {
  const pips = PIP_LAYOUT[value] ?? [];
  return (
    <div className={`bg-die${used ? ' used' : ''}${rolling ? ' rolling' : ''}`}>
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={pips.includes(cell) ? 'pip' : undefined} />
      ))}
    </div>
  );
}

type DiceRowProps = {
  /** 振った生の出目（ゾロ目なら4個に展開して表示） */
  rolled: [number, number];
  /** まだ使っていない出目 */
  remaining: number[];
  rolling: boolean;
};

export function DiceRow({ rolled, remaining, rolling }: DiceRowProps) {
  const expanded = rolled[0] === rolled[1]
    ? [rolled[0], rolled[0], rolled[0], rolled[0]]
    : [rolled[0], rolled[1]];

  // 後ろから remaining 個が「未使用」になるように使用済みフラグを付ける
  const counts = new Map<number, number>();
  for (const d of remaining) counts.set(d, (counts.get(d) ?? 0) + 1);
  const usedFlags = expanded.map((d) => {
    const left = counts.get(d) ?? 0;
    if (left > 0) {
      counts.set(d, left - 1);
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {expanded.map((d, i) => (
        <Die key={i} value={d} used={usedFlags[i]} rolling={rolling} />
      ))}
    </div>
  );
}
