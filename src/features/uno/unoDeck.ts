import type { UnoCard, UnoColor, UnoActionSymbol, UnoWildSymbol } from './unoTypes';

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

function uid(): string {
  return crypto.randomUUID();
}

/**
 * 標準 UNO デッキを生成する（108枚）
 *
 * 内訳:
 *   0 (×1/色) × 4色 = 4
 *   1–9 (×2/色) × 4色 = 72
 *   skip/reverse/draw2 (×2/色) × 4色 = 24
 *   wild (×4) = 4
 *   wild-draw4 (×4) = 4
 *   合計 108 枚
 */
export function createStandardDeck(): UnoCard[] {
  const cards: UnoCard[] = [];

  for (const color of COLORS) {
    // 0 は 1枚
    cards.push({ kind: 'number', color, value: 0, id: uid() });

    // 1-9 は 2枚ずつ
    for (let v = 1; v <= 9; v++) {
      const value = v as (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9);
      cards.push({ kind: 'number', color, value, id: uid() });
      cards.push({ kind: 'number', color, value, id: uid() });
    }

    // skip / reverse / draw2 は 2枚ずつ
    const actionSymbols: UnoActionSymbol[] = ['skip', 'reverse', 'draw2'];
    for (const symbol of actionSymbols) {
      cards.push({ kind: 'action', color, symbol, id: uid() });
      cards.push({ kind: 'action', color, symbol, id: uid() });
    }
  }

  // ワイルド系 4枚ずつ
  const wildSymbols: UnoWildSymbol[] = ['wild', 'wild-draw4'];
  for (const symbol of wildSymbols) {
    for (let i = 0; i < 4; i++) {
      cards.push({ kind: 'wild', symbol, id: uid() });
    }
  }

  return cards; // 108 枚
}

/**
 * ハード UNO デッキを生成する（標準 108 枚 + 追加 36 枚 = 144 枚）
 *
 * 追加カード:
 *   draw4（色付き） ×2/色 × 4色 = 8
 *   discard-all      ×2/色 × 4色 = 8
 *   wild-draw6 / wild-draw10 / wild-reverse-draw4
 *   wild-color-roulette / wild-skip-all  各 ×4 = 20
 */
export function createHardDeck(): UnoCard[] {
  const cards = createStandardDeck();

  for (const color of COLORS) {
    // 色付き draw4（hard のみ）
    cards.push({ kind: 'action', color, symbol: 'draw4', id: uid() });
    cards.push({ kind: 'action', color, symbol: 'draw4', id: uid() });

    // discard-all（hard のみ）
    cards.push({ kind: 'action', color, symbol: 'discard-all', id: uid() });
    cards.push({ kind: 'action', color, symbol: 'discard-all', id: uid() });
  }

  // ハード専用ワイルド
  const hardWilds: UnoWildSymbol[] = [
    'wild-draw6',
    'wild-draw10',
    'wild-reverse-draw4',
    'wild-color-roulette',
    'wild-skip-all',
  ];
  for (const symbol of hardWilds) {
    for (let i = 0; i < 4; i++) {
      cards.push({ kind: 'wild', symbol, id: uid() });
    }
  }

  return cards; // 144 枚
}

/** Fisher-Yates シャッフル（新しい配列を返す）*/
export function shuffleDeck<T>(deck: T[]): T[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}
