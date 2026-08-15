import { useEffect, useRef, useState } from 'react';
import type { BabanukiEvent, BabanukiState, Card } from './babanukiTypes';
import type { Flight } from './BabanukiTable';
import {
  DRAW_MS,
  PAIR_MS,
  SHUFFLE_MS,
  applyEventToDisplay,
  eventDuration,
  syncDisplay,
} from './babanukiPlayback';

/**
 * ルール側が一度に進めた結果（events）を、1つずつ演出しながら表示状態へ反映する。
 * ローカル対局とオンライン対局で同じフックを使うので、演出は全員の画面で揃う。
 */

type Effect = {
  flights: Flight[];
  hidden: string[];
  pairFlashPlayerId: string | null;
  leavingPlayerId: string | null;
};

const EMPTY_EFFECT: Effect = { flights: [], hidden: [], pairFlashPlayerId: null, leavingPlayerId: null };

function findCard(state: BabanukiState, playerId: string, cardId: string): Card | null {
  const player = state.players.find((p) => p.id === playerId);
  return player?.hand.find((c) => c.id === cardId) ?? null;
}

function buildEffect(
  event: BabanukiEvent,
  display: BabanukiState,
  viewerId: string,
  nextId: () => string,
): Effect {
  switch (event.kind) {
    case 'draw': {
      const card = findCard(display, event.fromId, event.cardId);
      return {
        flights: [
          {
            id: nextId(),
            fromKey: `card:${event.fromId}:${event.cardId}`,
            toKey: `hand:${event.toId}`,
            card,
            // 引いたカードの中身が見えるのは引いた本人だけ
            faceUp: event.toId === viewerId,
            durationMs: DRAW_MS,
          },
        ],
        hidden: [event.cardId],
        pairFlashPlayerId: null,
        leavingPlayerId: null,
      };
    }
    case 'discard-pair':
    case 'initial-discard': {
      const ids = event.cardIds.slice(0, 6);
      return {
        flights: ids.map((cardId) => ({
          id: nextId(),
          fromKey: `card:${event.playerId}:${cardId}`,
          toKey: 'pile',
          card: findCard(display, event.playerId, cardId),
          faceUp: true,
          durationMs: PAIR_MS,
        })),
        hidden: event.cardIds,
        pairFlashPlayerId: event.playerId,
        leavingPlayerId: null,
      };
    }
    case 'shuffle': {
      const entries = Object.entries(event.mapping);
      const hidden: string[] = [];
      for (const [fromId] of entries) {
        const player = display.players.find((p) => p.id === fromId);
        if (player) hidden.push(...player.hand.map((c) => c.id));
      }

      if (event.dice === 3) {
        // 出目3は「中央に集めてから配り直す」。誰がどこへ行ったか追えないようにするため
        const gather: Flight[] = entries.map(([fromId]) => ({
          id: nextId(),
          fromKey: `hand:${fromId}`,
          toKey: 'pile',
          card: null,
          faceUp: false,
          durationMs: SHUFFLE_MS,
          stack: 3,
        }));
        const deal: Flight[] = entries.map(([, toId]) => ({
          id: nextId(),
          fromKey: 'pile',
          toKey: `hand:${toId}`,
          card: null,
          faceUp: false,
          durationMs: SHUFFLE_MS,
          stack: 3,
          delayMs: SHUFFLE_MS,
        }));
        return { flights: [...gather, ...deal], hidden, pairFlashPlayerId: null, leavingPlayerId: null };
      }

      return {
        flights: entries
          .filter(([fromId, toId]) => fromId !== toId)
          .map(([fromId, toId]) => ({
            id: nextId(),
            fromKey: `hand:${fromId}`,
            toKey: `hand:${toId}`,
            card: null,
            faceUp: false,
            durationMs: SHUFFLE_MS,
            stack: 3,
          })),
        hidden,
        pairFlashPlayerId: null,
        leavingPlayerId: null,
      };
    }
    case 'finish':
      return { ...EMPTY_EFFECT, leavingPlayerId: event.playerId };
    default:
      return EMPTY_EFFECT;
  }
}

export function useBabanukiPlayback(logic: BabanukiState, viewerId: string) {
  const [display, setDisplay] = useState(() => syncDisplay(logic));
  const [queue, setQueue] = useState<BabanukiEvent[]>([]);
  const [effect, setEffect] = useState<Effect>(EMPTY_EFFECT);

  const displayRef = useRef(display);
  displayRef.current = display;
  const logicRef = useRef(logic);
  logicRef.current = logic;
  const seenSeq = useRef(logic.eventSeq);
  const consumedSeq = useRef(logic.eventSeq);
  const flightCounter = useRef(0);
  const nextFlightId = () => {
    flightCounter.current += 1;
    return `flight-${flightCounter.current}`;
  };

  // 新しい events が来たら再生キューに積む
  useEffect(() => {
    if (logic.eventSeq === seenSeq.current) return;
    seenSeq.current = logic.eventSeq;
    if (logic.events.length === 0) {
      consumedSeq.current = logic.eventSeq;
      setDisplay(syncDisplay(logic));
      return;
    }
    setQueue((q) => [...q, ...logic.events]);
  }, [logic]);

  // events を伴わない変化（並べ替え・飛び出し）は即座に反映する
  useEffect(() => {
    if (queue.length > 0) return;
    if (consumedSeq.current !== logic.eventSeq) return;
    setDisplay(syncDisplay(logic));
  }, [logic, queue.length]);

  // キューを1つずつ再生する
  useEffect(() => {
    if (queue.length === 0) return;
    const event = queue[0];
    setEffect(buildEffect(event, displayRef.current, viewerId, nextFlightId));

    const timer = setTimeout(() => {
      setDisplay((current) => applyEventToDisplay(current, event));
      setEffect(EMPTY_EFFECT);
      setQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0) {
          consumedSeq.current = seenSeq.current;
          // 最後まで再生し終えたら、演出で追えなかった差分を最終状態に合わせる
          setTimeout(() => setDisplay(syncDisplay(logicRef.current)), 0);
        }
        return rest;
      });
    }, eventDuration(event));

    return () => clearTimeout(timer);
  }, [queue, viewerId]);

  return {
    display,
    isAnimating: queue.length > 0,
    flights: effect.flights,
    hidden: effect.hidden,
    pairFlashPlayerId: effect.pairFlashPlayerId,
    leavingPlayerId: effect.leavingPlayerId,
  };
}
