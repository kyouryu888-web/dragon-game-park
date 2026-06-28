import type { UnoCard, UnoConfig, UnoGameState, UnoPlayer, UnoPlayerId } from './unoTypes';
import { createHardDeck, createStandardDeck, shuffleDeck } from './unoDeck';
import { getUnoCpuDisplayName } from './unoCpu';

const INITIAL_HAND_SIZE = 7;

function createPlayerIds(count: number): UnoPlayerId[] {
  return Array.from({ length: count }, (_, index) => `player-${index + 1}`);
}

function takeFirstNumberCard(deck: UnoCard[]): { topCard: UnoCard; deck: UnoCard[] } {
  const idx = deck.findIndex((card) => card.kind === 'number');
  const cardIdx = idx >= 0 ? idx : 0;
  const topCard = deck[cardIdx]!;
  return {
    topCard,
    deck: deck.filter((_, index) => index !== cardIdx),
  };
}

export function createInitialUnoState(config: UnoConfig): UnoGameState {
  const rawDeck = config.variant === 'hard' ? createHardDeck() : createStandardDeck();
  let deck = shuffleDeck(rawDeck);
  const { topCard, deck: deckAfterTop } = takeFirstNumberCard(deck);
  deck = deckAfterTop;

  const playerConfigs = config.playerConfigs;
  const playerIds = createPlayerIds(playerConfigs.length);
  const players: UnoPlayer[] = playerIds.map((id, index) => {
    const cfg = playerConfigs[index] ?? { name: '', isCpu: false, cpuLevel: 'normal' as const };
    const cpuLevel = cfg.cpuLevel ?? 'normal';
    return {
      id,
      name: cfg.name.trim() || (cfg.isCpu ? getUnoCpuDisplayName(cpuLevel) : `プレイヤー${index + 1}`),
      isCpu: cfg.isCpu,
      cpuLevel,
      isEliminated: false,
    };
  });

  const hands: Record<UnoPlayerId, UnoCard[]> = {};
  for (const playerId of playerIds) {
    hands[playerId] = deck.slice(0, INITIAL_HAND_SIZE);
    deck = deck.slice(INITIAL_HAND_SIZE);
  }

  return {
    gameId: crypto.randomUUID(),
    variant: config.variant,
    status: 'playing',
    players,
    hands,
    deck,
    discardPile: [topCard],
    currentPlayerId: playerIds[0]!,
    direction: 'clockwise',
    activeColor: topCard.kind === 'wild' ? 'red' : topCard.color,
    pendingDrawCount: 0,
    lastDrawCardValue: 0,
    pendingAction: null,
    winnerPlayerId: null,
    turnCount: 0,
    unoDeclaredIds: [],
  };
}
