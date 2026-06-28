import type { UnoCard, UnoColor } from './unoTypes';

export const UNO_COLOR_LABELS: Record<UnoColor, string> = {
  red: '赤',
  yellow: '黄',
  green: '緑',
  blue: '青',
};

export function getUnoCardName(card: UnoCard): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'action') {
    const names = {
      skip: 'スキップ',
      reverse: 'リバース',
      draw2: 'ドロー2',
      draw4: 'ドロー4',
      'discard-all': 'ぜんぶすてる',
    } as const;
    return names[card.symbol];
  }
  const names = {
    wild: 'ワイルド',
    'wild-draw4': 'ワイルド ドロー4',
    'wild-draw6': 'ワイルド ドロー6',
    'wild-draw10': 'ワイルド ドロー10',
    'wild-reverse-draw4': 'ワイルド リバース ドロー4',
    'wild-color-roulette': 'カラー ルーレット',
    'wild-skip-all': 'みんなスキップ',
  } as const;
  return names[card.symbol];
}

export function getUnoCardHelp(card: UnoCard): string {
  if (card.kind === 'number') {
    if (card.value === 7) return 'ハード版: えらんだ人と手札をぜんぶこうかん';
    if (card.value === 0) return 'ハード版: 全員がとなりの人に手札をわたす';
    return '同じ色か同じ数字に出せる';
  }
  if (card.kind === 'action') {
    const helps = {
      skip: 'つぎの人が1回おやすみ',
      reverse: 'じゅんばんが反対になる',
      draw2: 'つぎの人が2まいひく',
      draw4: 'つぎの人が4まいひく',
      'discard-all': '同じ色の手札をぜんぶすてる',
    } as const;
    return helps[card.symbol];
  }
  const helps = {
    wild: '好きな色をえらぶ',
    'wild-draw4': '好きな色をえらんで、つぎの人が4まいひく',
    'wild-draw6': 'つぎの人が6まいひく。色もえらぶ',
    'wild-draw10': 'つぎの人が10まいひく。色もえらぶ',
    'wild-reverse-draw4': 'むきをかえて、つぎの人が4まいひく',
    'wild-color-roulette': 'えらんだ色が出るまでひきつづける',
    'wild-skip-all': '自分いがい全員を1回おやすみ',
  } as const;
  return helps[card.symbol];
}
