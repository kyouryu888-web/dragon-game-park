import type { PublicDragonReactionInput } from '../../components/dragonReactions';
import type { UnoGameState, UnoPlayer } from './unoTypes';

const CPU_LEVELS = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;

function actor(player: UnoPlayer | undefined) {
  if (!player?.isCpu || !player.cpuLevel) return null;
  const index = CPU_LEVELS.indexOf(player.cpuLevel);
  if (index < 0) return null;
  return { id: player.id, name: player.name, level: (index + 1) as 1 | 2 | 3 | 4 | 5 };
}

function count(state: UnoGameState, playerId: string): number {
  // A hand's length is already published next to every player. Its contents
  // are never examined here, so card identities cannot influence acting.
  return state.hands[playerId]?.length ?? 0;
}

function make(
  next: UnoGameState,
  player: UnoPlayer | undefined,
  kind: string,
  outcome: PublicDragonReactionInput['outcome'],
  factLabel: string,
  priority: PublicDragonReactionInput['priority'],
  severity: PublicDragonReactionInput['severity'] = 'normal',
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput | null {
  const cpu = actor(player);
  return cpu ? { matchId: next.gameId, sequence: next.turnCount, cpu, kind, outcome, factLabel, priority, severity, cutIn } : null;
}

/** Derive acting cues from the same published transition seen by both viewers. */
export function detectUnoDragonReactions(previous: UnoGameState, next: UnoGameState): PublicDragonReactionInput[] {
  if (previous.gameId !== next.gameId || next.turnCount < previous.turnCount) return [];
  // After a reconnect or a dropped update the intermediate play is unknown.
  // Do not pretend that a specific card or draw happened in that gap.
  if (next.turnCount > previous.turnCount + 1) return [];

  if (previous.status !== 'finished' && next.status === 'finished') {
    const winner = next.players.find(player => player.id === next.winnerPlayerId);
    const event = make(next, winner, 'uno-victory', 'victory', `${winner?.name ?? 'プレイヤー'}の勝ち`, 4, 'major', 'victory');
    if (event) return [event];
    return next.players.filter(player => player.isCpu && !player.isEliminated).map(player =>
      make(next, player, `uno-defeat:${player.id}`, 'defeat', `${winner?.name ?? 'プレイヤー'}の勝ち`, 4, 'major', 'defeat'),
    ).filter((value): value is PublicDragonReactionInput => value !== null);
  }

  const eliminated = next.players.find(player => player.isEliminated && !previous.players.find(before => before.id === player.id)?.isEliminated);
  if (eliminated) {
    const event = make(next, eliminated, 'uno-knockout', 'defeat', '25まいでアウト', 4, 'major', 'defeat');
    if (event) return [event];
  }

  const events: PublicDragonReactionInput[] = [];
  const add = (event: PublicDragonReactionInput | null) => { if (event) events.push(event); };
  if (previous.pendingDrawCount > 0 && next.pendingDrawCount > previous.pendingDrawCount) {
    const playerId = previous.pendingAction?.kind === 'color-pick'
      ? previous.pendingAction.chooserPlayerId : previous.currentPlayerId;
    const n = next.pendingDrawCount;
    add(make(next, next.players.find(player => player.id === playerId), 'uno-draw-counter', 'advantage', `ドロー合計${n}まい`, 3, n >= 6 ? 'major' : 'normal', 'attack'));
  }

  if (previous.pendingDrawCount > 0 && next.pendingDrawCount === 0) {
    const player = next.players.find(entry => entry.id === previous.currentPlayerId);
    const n = previous.pendingDrawCount;
    add(make(next, player, 'uno-forced-draw', 'disadvantage', `${n}まい引いた`, n >= 6 ? 3 : 2, n >= 6 ? 'major' : 'normal', 'pressure'));
  }

  if (previous.pendingAction?.kind === 'color-roulette') {
    const targetId = previous.pendingAction.targetPlayerId;
    const before = previous.pendingAction.drawnCount ?? 0;
    const now = next.pendingAction?.kind === 'color-roulette' ? next.pendingAction.drawnCount ?? 0 : before;
    if (now > before) add(make(next, next.players.find(player => player.id === targetId), `uno-roulette:${now}`, 'disadvantage', `ルーレットで${now}まい引いた`, 2));
  }

  for (const player of next.players) {
    if (player.isEliminated) continue;
    const before = count(previous, player.id), after = count(next, player.id);
    if (after <= 3 && after >= 1 && after < before) {
      add(make(next, player, `uno-${after}-cards`, 'advantage', `残り${after}まい`, after === 1 ? 3 : 2));
    }
  }

  const beforeCard = previous.discardPile[0], afterCard = next.discardPile[0];
  if (beforeCard?.id !== afterCard?.id && afterCard?.kind === 'action' && afterCard.symbol === 'skip') {
    add(make(next, previous.players.find(player => player.id === previous.currentPlayerId), 'uno-skip', 'advantage', 'スキップ', 2));
  }

  return events;
}
