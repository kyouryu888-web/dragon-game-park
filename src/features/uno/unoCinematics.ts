import type { UnoColor, UnoGameState, UnoPlayer, UnoPlayerId } from './unoTypes';
import { getUnoCardName } from './unoCardMeta';
import { getCardDrawValue } from './unoRules';

type UnoCinematicBase = {
  key: string;
  playerId: UnoPlayerId;
  playerName: string;
};

export type UnoDrawCounterEvent = UnoCinematicBase & {
  kind: 'draw-counter';
  addedCount: number;
  totalCount: number;
  cardName: string;
  reversed: boolean;
};

export type UnoForcedDrawEvent = UnoCinematicBase & {
  kind: 'forced-draw';
  count: number;
};

export type UnoKnockoutEvent = UnoCinematicBase & {
  kind: 'knockout';
  cause: 'draw-stack' | 'color-roulette' | 'draw';
  count?: number;
};

type UnoRouletteBase = UnoCinematicBase & {
  targetColor: UnoColor;
  drawnCount: number;
};

export type UnoRouletteEvent =
  | (UnoRouletteBase & { kind: 'roulette-step' })
  | (UnoRouletteBase & { kind: 'roulette-safe' });

export type UnoCinematicEvent =
  | UnoDrawCounterEvent
  | UnoForcedDrawEvent
  | UnoKnockoutEvent
  | UnoRouletteEvent;

function getPlayer(state: UnoGameState, playerId: UnoPlayerId): UnoPlayer | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getPlayerName(state: UnoGameState, playerId: UnoPlayerId): string {
  return getPlayer(state, playerId)?.name || 'プレイヤー';
}

function getHandSize(state: UnoGameState, playerId: UnoPlayerId): number {
  return state.hands[playerId]?.length ?? 0;
}

function eventKey(
  state: UnoGameState,
  kind: UnoCinematicEvent['kind'],
  playerId: UnoPlayerId,
  detail: string,
): string {
  return [state.gameId, state.turnCount, kind, playerId, state.discardPile[0]?.id ?? 'none', detail].join(':');
}

/** 連続する2状態から、このクライアントで再生すべき演出を判定する。 */
export function detectUnoCinematicEvents(
  previous: UnoGameState,
  next: UnoGameState,
): UnoCinematicEvent[] {
  if (previous.gameId !== next.gameId) return [];

  const newlyEliminated = next.players.filter((player) => {
    const before = getPlayer(previous, player.id);
    return player.isEliminated && before && !before.isEliminated;
  });

  // 脱落は同じ更新で発生した「引いた」演出より優先する。
  if (newlyEliminated.length > 0) {
    return newlyEliminated.map((player) => {
      const rouletteAction = previous.pendingAction?.kind === 'color-roulette'
        ? previous.pendingAction
        : null;
      const stackedDraw = previous.pendingDrawCount > 0;
      const cause: UnoKnockoutEvent['cause'] = rouletteAction
        ? 'color-roulette'
        : stackedDraw
          ? 'draw-stack'
          : 'draw';
      const count = stackedDraw
        ? previous.pendingDrawCount
        : rouletteAction
          ? (rouletteAction.drawnCount ?? 0) + 1
          : undefined;
      return {
        kind: 'knockout',
        key: eventKey(next, 'knockout', player.id, `${cause}-${count ?? 25}`),
        playerId: player.id,
        playerName: player.name || 'プレイヤー',
        cause,
        count,
      };
    });
  }

  // 保留中のドローへ同じか大きいカードを重ねた。
  if (
    previous.pendingDrawCount > 0 &&
    next.pendingDrawCount > previous.pendingDrawCount
  ) {
    const playerId = previous.pendingAction?.kind === 'color-pick'
      ? previous.pendingAction.chooserPlayerId
      : previous.currentPlayerId;
    const card = next.discardPile[0];
    const addedCount = next.pendingDrawCount - previous.pendingDrawCount;
    return [{
      kind: 'draw-counter',
      key: eventKey(next, 'draw-counter', playerId, `${addedCount}-${next.pendingDrawCount}`),
      playerId,
      playerName: getPlayerName(previous, playerId),
      addedCount,
      totalCount: next.pendingDrawCount,
      cardName: card ? getUnoCardName(card) : `ドロー${addedCount}`,
      reversed: card?.kind === 'wild' && card.symbol === 'wild-reverse-draw4',
    }];
  }

  // カラー ルーレットはカードの表を公開せず、回数だけを共有する。
  if (previous.pendingAction?.kind === 'color-roulette') {
    const { targetPlayerId, targetColor } = previous.pendingAction;
    const previousCount = previous.pendingAction.drawnCount ?? 0;
    const nextRoulette = next.pendingAction?.kind === 'color-roulette'
      ? next.pendingAction
      : null;
    const nextCount = nextRoulette?.drawnCount ?? previousCount;

    if (nextRoulette && nextCount > previousCount) {
      return [{
        kind: 'roulette-step',
        key: eventKey(next, 'roulette-step', targetPlayerId, `${targetColor}-${nextCount}`),
        playerId: targetPlayerId,
        playerName: getPlayerName(previous, targetPlayerId),
        targetColor,
        drawnCount: nextCount,
      }];
    }

    if (
      !nextRoulette &&
      getHandSize(next, targetPlayerId) > getHandSize(previous, targetPlayerId)
    ) {
      const drawnCount = previousCount + 1;
      return [{
        kind: 'roulette-safe',
        key: eventKey(next, 'roulette-safe', targetPlayerId, `${targetColor}-${drawnCount}`),
        playerId: targetPlayerId,
        playerName: getPlayerName(previous, targetPlayerId),
        targetColor,
        drawnCount,
      }];
    }
  }

  // 累積ドローを受け入れた。
  if (previous.pendingDrawCount > 0 && next.pendingDrawCount === 0) {
    const playerId = previous.currentPlayerId;
    return [{
      kind: 'forced-draw',
      key: eventKey(next, 'forced-draw', playerId, String(previous.pendingDrawCount)),
      playerId,
      playerName: getPlayerName(previous, playerId),
      count: previous.pendingDrawCount,
    }];
  }

  // 最後のドローカードで上がった時はペナルティーが即時適用される。
  if (next.status === 'finished' && next.winnerPlayerId) {
    const topCard = next.discardPile[0];
    const drawValue = topCard ? getCardDrawValue(topCard) : 0;
    if (drawValue > 0) {
      const target = next.players.find((player) =>
        player.id !== next.winnerPlayerId &&
        getHandSize(next, player.id) > getHandSize(previous, player.id),
      );
      if (target) {
        return [{
          kind: 'forced-draw',
          key: eventKey(next, 'forced-draw', target.id, `final-${drawValue}`),
          playerId: target.id,
          playerName: target.name || 'プレイヤー',
          count: drawValue,
        }];
      }
    }
  }

  return [];
}

export function getUnoCinematicDuration(event: UnoCinematicEvent): number {
  if (event.kind === 'roulette-step') return 350;
  if (event.kind === 'roulette-safe') return 800;
  return 1600;
}

export function isBlockingUnoCinematic(event: UnoCinematicEvent | null): boolean {
  return event !== null && event.kind !== 'roulette-step' && event.kind !== 'roulette-safe';
}
