import type { UnoCard, UnoColor, UnoCpuLevel, UnoGameState, UnoPlayerId } from './unoTypes';
import { getCardDrawValue, getNextPlayerId, getPlayableCards } from './unoRules';

export type UnoCpuAction =
  | { type: 'play-card'; cardId: string; color?: UnoColor }
  | { type: 'draw-card' }
  | { type: 'accept-draw' }
  | { type: 'choose-color'; color: UnoColor }
  | { type: 'choose-swap'; targetPlayerId: UnoPlayerId }
  | { type: 'roulette-step' }
  | { type: 'declare-uno'; playerId: UnoPlayerId }
  | { type: 'penalty-uno'; playerId: UnoPlayerId };

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

export function getUnoCpuDisplayName(level: UnoCpuLevel = 'normal'): string {
  const names: Record<UnoCpuLevel, string> = {
    'very-easy': 'ベビードラゴン',
    easy: 'ドラゴン',
    normal: 'スーパードラゴン',
    hard: 'ドラゴンキング',
    'very-hard': 'ゴッドドラゴン',
  };
  return names[level];
}

export function getUnoCpuLevelLabel(level: UnoCpuLevel): string {
  const labels: Record<UnoCpuLevel, string> = {
    'very-easy': 'とてもよわい',
    easy: 'よわい',
    normal: 'ふつう',
    hard: 'つよい',
    'very-hard': 'さいきょう',
  };
  return labels[level];
}

function randomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

function countColors(hand: UnoCard[]): Record<UnoColor, number> {
  return COLORS.reduce((acc, color) => {
    acc[color] = hand.filter((card) => card.kind !== 'wild' && card.color === color).length;
    return acc;
  }, {} as Record<UnoColor, number>);
}

export function chooseUnoColor(state: UnoGameState, playerId: UnoPlayerId): UnoColor {
  const counts = countColors(state.hands[playerId] ?? []);
  return COLORS.reduce((best, color) => (counts[color] > counts[best] ? color : best), 'red');
}

function scoreCard(state: UnoGameState, playerId: UnoPlayerId, card: UnoCard, level: UnoCpuLevel): number {
  const hand = state.hands[playerId] ?? [];
  const nextId = getNextPlayerId(state);
  const nextHandCount = state.hands[nextId]?.length ?? 0;
  let score = 0;

  if (hand.length === 1) score += 1000;
  if (card.kind === 'wild') score += 18;
  if (card.kind === 'action') score += 8;
  score += getCardDrawValue(card) * 10;

  if (card.kind === 'action' && card.symbol === 'skip') score += 18;
  if (card.kind === 'action' && card.symbol === 'reverse') score += state.players.filter((p) => !p.isEliminated).length === 2 ? 14 : 7;
  if (card.kind === 'action' && card.symbol === 'discard-all') {
    score += hand.filter((c) => c.kind !== 'wild' && c.color === card.color).length * 16;
  }
  if (card.kind === 'number' && card.value === 7 && state.variant === 'hard') {
    const largestOpponent = state.players
      .filter((p) => p.id !== playerId && !p.isEliminated)
      .map((p) => state.hands[p.id]?.length ?? 0)
      .reduce((max, count) => Math.max(max, count), 0);
    score += Math.max(0, largestOpponent - hand.length) * 10;
  }
  if (card.kind === 'number' && card.value === 0 && state.variant === 'hard') score += 10;
  if (card.kind === 'wild' && card.symbol === 'wild-skip-all') score += 25;
  if (card.kind === 'wild' && card.symbol === 'wild-color-roulette') score += 22;

  if (level === 'hard' || level === 'very-hard') {
    if (nextHandCount >= 18) score += getCardDrawValue(card) * 20;
    if (state.pendingDrawCount > 0) score += getCardDrawValue(card) * 25;
  }
  if (level === 'very-hard') {
    const colorCounts = countColors(hand);
    if (card.kind !== 'wild') score += colorCounts[card.color] * 2;
    if (hand.length <= 3) score += getCardDrawValue(card) > 0 ? 12 : 0;
  }

  return score;
}

export function chooseUnoCpuAction(
  state: UnoGameState,
  playerId: UnoPlayerId,
  level: UnoCpuLevel = 'normal',
): UnoCpuAction | null {
  if (state.status !== 'playing') return null;

  const pending = state.pendingAction;
  if (pending?.kind === 'uno-window') {
    if (pending.playerWithOneCard === playerId) return { type: 'declare-uno', playerId };
    return { type: 'penalty-uno', playerId: pending.playerWithOneCard };
  }
  if (pending?.kind === 'color-pick' && pending.chooserPlayerId === playerId) {
    return { type: 'choose-color', color: chooseUnoColor(state, playerId) };
  }
  if (pending?.kind === 'swap-pick' && pending.swapperPlayerId === playerId) {
    const myCount = state.hands[playerId]?.length ?? 0;
    const targets = state.players
      .filter((p) => p.id !== playerId && !p.isEliminated)
      .sort((a, b) => (state.hands[b.id]?.length ?? 0) - (state.hands[a.id]?.length ?? 0));
    const target = targets.find((p) => (state.hands[p.id]?.length ?? 0) < myCount) ?? targets[0];
    return target ? { type: 'choose-swap', targetPlayerId: target.id } : null;
  }
  if (pending?.kind === 'color-roulette') return { type: 'roulette-step' };

  if (state.currentPlayerId !== playerId) return null;

  const playable = getPlayableCards(state, playerId);
  if (state.pendingDrawCount > 0 && playable.length === 0) return { type: 'accept-draw' };
  if (playable.length === 0) return { type: 'draw-card' };

  let card: UnoCard | null;
  if (level === 'very-easy') {
    card = randomItem(playable);
  } else {
    card = [...playable].sort((a, b) => scoreCard(state, playerId, b, level) - scoreCard(state, playerId, a, level))[0] ?? null;
  }
  if (!card) return null;

  return {
    type: 'play-card',
    cardId: card.id,
    color: card.kind === 'wild' ? chooseUnoColor(state, playerId) : undefined,
  };
}
