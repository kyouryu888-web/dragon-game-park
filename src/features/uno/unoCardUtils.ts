import type { UnoCard, UnoVariant } from './unoTypes';

const COLOR_ORDER = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
} as const;

const ACTION_ORDER = {
  skip: 10,
  reverse: 11,
  draw2: 12,
  draw4: 13,
  'discard-all': 14,
} as const;

const WILD_ORDER = {
  wild: 20,
  'wild-draw4': 21,
  'wild-draw6': 22,
  'wild-draw10': 23,
  'wild-reverse-draw4': 24,
  'wild-color-roulette': 25,
  'wild-skip-all': 26,
} as const;

export function isUnoCardAllowedInVariant(card: UnoCard, variant: UnoVariant): boolean {
  if (variant === 'hard') return true;
  if (card.kind === 'action') return card.symbol !== 'draw4' && card.symbol !== 'discard-all';
  if (card.kind === 'wild') return card.symbol === 'wild' || card.symbol === 'wild-draw4';
  return true;
}

function getCardSortParts(card: UnoCard): [number, number, number, string] {
  if (card.kind === 'number') return [COLOR_ORDER[card.color], 0, card.value, card.id];
  if (card.kind === 'action') return [COLOR_ORDER[card.color], 1, ACTION_ORDER[card.symbol], card.id];
  return [4, 2, WILD_ORDER[card.symbol], card.id];
}

export function sortUnoHandByColor(hand: UnoCard[]): UnoCard[] {
  return [...hand].sort((a, b) => {
    const left = getCardSortParts(a);
    const right = getCardSortParts(b);
    for (let i = 0; i < left.length; i++) {
      const aPart = left[i]!;
      const bPart = right[i]!;
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    return 0;
  });
}
