export type ShuffleDescription = {
  label: string;
  detail: string;
  route: string;
  symbol: string;
  note: string;
};

export function describeDice(dice: number): ShuffleDescription {
  switch (dice) {
    case 1:
      return { label: '右回り', detail: '全員の手札を、そのまま左隣へ渡す', route: '全員 → 左隣へ', symbol: '↻', note: '手札が動いたので、全員のブラフを解除' };
    case 2:
      return { label: '左回り', detail: '全員の手札を、そのまま右隣へ渡す', route: '全員 → 右隣へ', symbol: '↺', note: '手札が動いたので、全員のブラフを解除' };
    case 3:
      return { label: 'シャッフル交換', detail: '全手札を中央へ集め、誰の手札か分からないように再配布', route: '全員 → 中央 → ランダム再配布', symbol: '✦', note: '手札が動いたので、全員のブラフを解除' };
    case 4:
      return { label: 'ドクロ', detail: '手札は動かない。シャッフルタイムの権利だけを失う', route: '移動なし', symbol: '💀', note: '手札が動かないため、ブラフはそのまま' };
    case 5:
      return { label: '右2回り', detail: '全員の手札を、2つ先の左隣へ渡す', route: '全員 → 左へ2席', symbol: '↻', note: '手札が動いたので、全員のブラフを解除' };
    case 6:
      return { label: '左2回り', detail: '全員の手札を、2つ先の右隣へ渡す', route: '全員 → 右へ2席', symbol: '↺', note: '手札が動いたので、全員のブラフを解除' };
    default:
      return { label: '', detail: '', route: '', symbol: '', note: '' };
  }
}
