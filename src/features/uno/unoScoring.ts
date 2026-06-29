import type { UnoCard, UnoGameState, UnoPlayer, UnoPlayerId } from './unoTypes';

export type UnoRankingEntry = {
  player: UnoPlayer;
  score: number;
  cardCount: number;
  rank: number;
};

export function getUnoCardScore(card: UnoCard): number {
  if (card.kind === 'number') return card.value;
  if (card.kind === 'action') return 20;
  return 50;
}

export function getUnoHandScore(hand: UnoCard[]): number {
  return hand.reduce((total, card) => total + getUnoCardScore(card), 0);
}

export function getUnoCurrentScores(state: UnoGameState): Record<UnoPlayerId, number> {
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      state.eliminatedScores[player.id] ?? getUnoHandScore(state.hands[player.id] ?? []),
    ]),
  );
}

export function getUnoFinalScores(state: UnoGameState): Record<UnoPlayerId, number> {
  return state.finalScores ?? getUnoCurrentScores(state);
}

export function getUnoRankings(state: UnoGameState): UnoRankingEntry[] {
  const scores = getUnoFinalScores(state);
  const winnerId = state.winnerPlayerId;

  return [...state.players]
    .sort((a, b) => {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      const scoreDiff = (scores[a.id] ?? 0) - (scores[b.id] ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (state.hands[a.id]?.length ?? 0) - (state.hands[b.id]?.length ?? 0);
    })
    .map((player, index) => ({
      player,
      score: scores[player.id] ?? 0,
      cardCount: state.hands[player.id]?.length ?? 0,
      rank: index + 1,
    }));
}
