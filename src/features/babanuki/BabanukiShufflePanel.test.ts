import { describe, expect, it } from 'vitest';
import { describeDice } from './babanukiShuffleDescription';

describe('シャッフル結果の説明', () => {
  it.each([
    [1, '全員 → 左隣へ', 'ブラフを解除'],
    [2, '全員 → 右隣へ', 'ブラフを解除'],
    [3, '全員 → 中央 → ランダム再配布', 'ブラフを解除'],
    [5, '全員 → 左へ2席', 'ブラフを解除'],
    [6, '全員 → 右へ2席', 'ブラフを解除'],
  ] as const)('出目%dは移動方向とブラフ解除を説明する', (dice, route, note) => {
    const description = describeDice(dice);
    expect(description.route).toBe(route);
    expect(description.note).toContain(note);
  });

  it('出目4は手札が動かず権利だけ消えると説明する', () => {
    const description = describeDice(4);
    expect(description.route).toBe('移動なし');
    expect(description.detail).toContain('権利だけ');
    expect(description.note).toContain('ブラフはそのまま');
  });
});
