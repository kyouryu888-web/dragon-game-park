import { useEffect, useRef, useState } from 'react';
import type { UnoGameState } from './unoTypes';
import {
  detectUnoCinematicEvents,
  getUnoCinematicDuration,
  isBlockingUnoCinematic,
  UNO_ROULETTE_SAFE_MS,
  type UnoFullScreenCinematicEvent,
  type UnoRoulettePresentation,
} from './unoCinematics';

function getPendingRoulettePresentation(
  state: UnoGameState,
  sequenceKeyOverride?: string,
): UnoRoulettePresentation | null {
  const pending = state.pendingAction?.kind === 'color-roulette'
    ? state.pendingAction
    : null;
  if (!pending) return null;

  const sequenceKey = sequenceKeyOverride ?? [
    state.gameId,
    state.turnCount,
    'color-roulette',
    pending.targetPlayerId,
    pending.targetColor,
    state.discardPile[0]?.id ?? 'none',
  ].join(':');
  const player = state.players.find((entry) => entry.id === pending.targetPlayerId);
  const drawnCount = pending.drawnCount ?? 0;
  return {
    sequenceKey,
    stepKey: `${sequenceKey}:${drawnCount}`,
    phase: 'drawing',
    playerId: pending.targetPlayerId,
    playerName: player?.name || 'プレイヤー',
    targetColor: pending.targetColor,
    drawnCount,
  };
}

export function useUnoCinematics(state: UnoGameState | null) {
  const previousRef = useRef<UnoGameState | null>(null);
  const seenKeysRef = useRef(new Set<string>());
  const safeTimeoutRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<UnoFullScreenCinematicEvent[]>([]);
  const [roulettePresentation, setRoulettePresentation] = useState<UnoRoulettePresentation | null>(null);
  const activeEvent = queue[0] ?? null;

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = state;
    if (!state) return;

    if (!previous || previous.gameId !== state.gameId) {
      if (safeTimeoutRef.current !== null) window.clearTimeout(safeTimeoutRef.current);
      safeTimeoutRef.current = null;
      seenKeysRef.current.clear();
      setQueue([]);
      setRoulettePresentation(getPendingRoulettePresentation(state));
      return;
    }

    const freshEvents = detectUnoCinematicEvents(previous, state).filter((event) => {
      if (seenKeysRef.current.has(event.key)) return false;
      seenKeysRef.current.add(event.key);
      return true;
    });

    const pendingRoulette = state.pendingAction?.kind === 'color-roulette'
      ? state.pendingAction
      : null;
    const rouletteEvent = freshEvents.find(
      (event) => event.kind === 'roulette-step' || event.kind === 'roulette-safe',
    );

    if (pendingRoulette) {
      if (safeTimeoutRef.current !== null) window.clearTimeout(safeTimeoutRef.current);
      safeTimeoutRef.current = null;
      const next = getPendingRoulettePresentation(
        state,
        rouletteEvent?.kind === 'roulette-step' ? rouletteEvent.sequenceKey : undefined,
      );
      if (!next) return;
      setRoulettePresentation((current) => {
        if (
          current?.phase === next.phase &&
          current.stepKey === next.stepKey &&
          current.playerName === next.playerName
        ) return current;
        return next;
      });
    } else if (rouletteEvent?.kind === 'roulette-safe') {
      if (safeTimeoutRef.current !== null) window.clearTimeout(safeTimeoutRef.current);
      setRoulettePresentation({
        sequenceKey: rouletteEvent.sequenceKey,
        stepKey: `${rouletteEvent.sequenceKey}:safe:${rouletteEvent.drawnCount}`,
        phase: 'safe',
        playerId: rouletteEvent.playerId,
        playerName: rouletteEvent.playerName,
        targetColor: rouletteEvent.targetColor,
        drawnCount: rouletteEvent.drawnCount,
      });
      safeTimeoutRef.current = window.setTimeout(() => {
        setRoulettePresentation(null);
        safeTimeoutRef.current = null;
      }, UNO_ROULETTE_SAFE_MS);
    } else if (previous.pendingAction?.kind === 'color-roulette') {
      setRoulettePresentation(null);
    }

    if (seenKeysRef.current.size > 200) {
      const recentKeys = [...seenKeysRef.current].slice(-100);
      seenKeysRef.current = new Set(recentKeys);
    }
    const fullScreenEvents = freshEvents.filter(
      (event): event is UnoFullScreenCinematicEvent =>
        event.kind !== 'roulette-step' && event.kind !== 'roulette-safe',
    );
    if (fullScreenEvents.length > 0) {
      setQueue((current) => [...current, ...fullScreenEvents]);
    }
  }, [state]);

  useEffect(() => () => {
    if (safeTimeoutRef.current !== null) window.clearTimeout(safeTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!activeEvent) return;
    const timeoutId = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, getUnoCinematicDuration(activeEvent));
    return () => window.clearTimeout(timeoutId);
  }, [activeEvent]);

  return {
    activeEvent,
    isBlocking: isBlockingUnoCinematic(activeEvent),
    roulettePresentation,
  };
}
