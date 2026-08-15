import { describe, expect, it } from 'vitest';
import type { BabanukiState, Card } from './babanukiTypes';
import {
  DICE_MS,
  SHUFFLE_MS,
  SHUFFLE_RESULT_HOLD_MS,
  applyEventToDisplay,
  eventDuration,
} from './babanukiPlayback';

const cards: Card[] = [
  { id: 'spade-1', suit: 'spade', rank: 1 },
  { id: 'heart-2', suit: 'heart', rank: 2 },
  { id: 'joker', suit: 'joker', rank: 0 },
];

function state(): BabanukiState {
  return {
    players: cards.map((card, index) => ({
      id: `player-${index + 1}`,
      name: `P${index + 1}`,
      isCpu: false,
      cpuLevel: 'normal',
      hand: [card],
      spotlightCardId: card.id,
      finishedRank: null,
      shuffleRight: true,
    })),
    seatOrder: ['player-1', 'player-2', 'player-3'],
    currentPlayerId: 'player-1',
    phase: 'rolling',
    shuffleUsedThisTurn: true,
    pendingShuffle: { declarerId: 'player-3', dice: 1 },
    discardPile: [],
    finishOrder: [],
    loserId: null,
    events: [],
    eventSeq: 3,
  };
}

describe('シャッフルの表示状態', () => {
  it('手札移動の表示でもブラフを全解除する', () => {
    const next = applyEventToDisplay(state(), {
      kind: 'shuffle',
      declarerId: 'player-3',
      dice: 1,
      mapping: { 'player-1': 'player-2', 'player-2': 'player-3', 'player-3': 'player-1' },
    });
    expect(next.players.every((player) => player.spotlightCardId === null)).toBe(true);
  });

  it('出目4の表示ではブラフを残す', () => {
    const next = applyEventToDisplay(state(), {
      kind: 'shuffle',
      declarerId: 'player-3',
      dice: 4,
      mapping: { 'player-1': 'player-1', 'player-2': 'player-2', 'player-3': 'player-3' },
    });
    expect(next.players.map((player) => player.spotlightCardId)).toEqual(['spade-1', 'heart-2', 'joker']);
  });
});

describe('シャッフルの演出時間', () => {
  const mapping = { 'player-1': 'player-2', 'player-2': 'player-3', 'player-3': 'player-1' };

  it('サイコロ結果を読める時間を確保する', () => {
    expect(DICE_MS).toBe(1700);
  });

  it('通常移動のあとに結果を読む停止時間を置く', () => {
    expect(eventDuration({ kind: 'shuffle', declarerId: 'player-1', dice: 1, mapping }))
      .toBe(SHUFFLE_MS + SHUFFLE_RESULT_HOLD_MS);
  });

  it('出目3は中央へ集める段階と再配布の2段階を見せる', () => {
    expect(eventDuration({ kind: 'shuffle', declarerId: 'player-1', dice: 3, mapping }))
      .toBe(SHUFFLE_MS * 2 + SHUFFLE_RESULT_HOLD_MS);
  });
});
