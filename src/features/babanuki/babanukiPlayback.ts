/**
 * アニメーション再生用の「表示状態」の進め方。
 *
 * ルール側（babanukiRules）は一度に最終状態まで進めるが、画面は
 * events を1つずつ表示状態へ適用して演出を挟む。オンラインでも
 * 受信した events を同じ手順で流すことで、全員の画面で同じ演出になる。
 */
import type { BabanukiEvent, BabanukiState, Card } from './babanukiTypes';

export const DRAW_MS = 520;
export const PAIR_MS = 620;
export const SHUFFLE_MS = 900;
export const ELIM_MS = 480;
export const SEAT_SLIDE_MS = 580;
export const DICE_MS = 1100;

export function eventDuration(event: BabanukiEvent): number {
  switch (event.kind) {
    case 'initial-discard':
      return PAIR_MS;
    case 'draw':
      return DRAW_MS;
    case 'discard-pair':
      return PAIR_MS;
    case 'shuffle':
      // 出目3は「中央に集めてから配り直す」2段構えなので長い
      return event.dice === 3 ? SHUFFLE_MS * 2 : SHUFFLE_MS;
    case 'finish':
      return ELIM_MS + SEAT_SLIDE_MS;
    case 'game-end':
      return 0;
    default:
      return 0;
  }
}

function cloneForDisplay(state: BabanukiState): BabanukiState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.slice() })),
    discardPile: state.discardPile.slice(),
    finishOrder: state.finishOrder.slice(),
  };
}

function removeCards(hand: Card[], ids: string[]): { rest: Card[]; removed: Card[] } {
  const target = new Set(ids);
  const rest: Card[] = [];
  const removed: Card[] = [];
  for (const card of hand) {
    if (target.has(card.id)) removed.push(card);
    else rest.push(card);
  }
  return { rest, removed };
}

/** イベント1つぶんだけ表示状態を進める */
export function applyEventToDisplay(state: BabanukiState, event: BabanukiEvent): BabanukiState {
  const draft = cloneForDisplay(state);
  const find = (id: string) => draft.players.find((p) => p.id === id);

  switch (event.kind) {
    case 'initial-discard':
    case 'discard-pair': {
      const player = find(event.playerId);
      if (!player) return draft;
      const ids = event.kind === 'discard-pair' ? event.cardIds : event.cardIds;
      const { rest, removed } = removeCards(player.hand, ids);
      player.hand = rest;
      if (player.spotlightCardId && ids.includes(player.spotlightCardId)) player.spotlightCardId = null;
      draft.discardPile.push(...removed);
      return draft;
    }
    case 'draw': {
      const from = find(event.fromId);
      const to = find(event.toId);
      if (!from || !to) return draft;
      const { rest, removed } = removeCards(from.hand, [event.cardId]);
      from.hand = rest;
      if (from.spotlightCardId === event.cardId) from.spotlightCardId = null;
      to.hand = [...to.hand, ...removed];
      return draft;
    }
    case 'shuffle': {
      const handsById = new Map<string, Card[]>();
      for (const [fromId, toId] of Object.entries(event.mapping)) {
        handsById.set(toId, (find(fromId)?.hand ?? []).slice());
      }
      for (const [id, hand] of handsById.entries()) {
        const player = find(id);
        if (!player) continue;
        player.hand = hand;
        if (event.dice !== 4) player.spotlightCardId = null;
      }
      return draft;
    }
    case 'finish': {
      const player = find(event.playerId);
      if (!player) return draft;
      player.finishedRank = event.rank;
      player.spotlightCardId = null;
      if (!draft.finishOrder.includes(event.playerId)) draft.finishOrder.push(event.playerId);
      return draft;
    }
    case 'game-end': {
      draft.loserId = event.loserId;
      draft.phase = 'finished';
      return draft;
    }
    default:
      return draft;
  }
}

/** 表示状態を最終状態に合わせる（アニメ終了時の同期用） */
export function syncDisplay(logic: BabanukiState): BabanukiState {
  return cloneForDisplay(logic);
}
