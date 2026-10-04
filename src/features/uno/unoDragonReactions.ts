import { publicReactionPresenter, type PublicDragonReactionInput } from '../../components/dragonReactions';
import { UNO_COLOR_LABELS } from './unoCardMeta';
import type { UnoGameState, UnoPlayer } from './unoTypes';

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
  if (!player) return null;
  const presenter = publicReactionPresenter(player);
  return presenter ? { matchId: next.gameId, sequence: next.turnCount, ...presenter, kind, outcome, factLabel, priority, severity, cutIn } : null;
}

/** Derive acting cues from the same published transition seen by both viewers. */
export function detectUnoDragonReactions(previous: UnoGameState, next: UnoGameState): PublicDragonReactionInput[] {
  if (previous.gameId !== next.gameId || next.turnCount < previous.turnCount || previous.status !== 'playing') return [];
  // After a reconnect or a dropped update the intermediate play is unknown.
  // Do not pretend that a specific card or draw happened in that gap.
  if (next.turnCount > previous.turnCount + 1) return [];

  if (next.status === 'finished') {
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
    // The stop is public; the final card's identity remains private.
    if (next.pendingAction?.kind !== 'color-roulette' && count(next, targetId) > count(previous, targetId)) {
      add(make(next, next.players.find(player => player.id === targetId), 'uno-roulette-stop', 'advantage', `ルーレットが止まった・${before + 1}まい`, 3));
    }
  }

  const beforeCard = previous.discardPile[0], afterCard = next.discardPile[0];
  if (beforeCard?.id !== afterCard?.id && afterCard?.kind === 'action' && afterCard.symbol === 'skip') {
    add(make(next, previous.players.find(player => player.id === previous.currentPlayerId), 'uno-skip', 'advantage', 'スキップ', 2));
  }

  if (previous.direction !== next.direction) {
    const playerId = previous.pendingAction?.kind === 'color-pick'
      ? previous.pendingAction.chooserPlayerId : previous.currentPlayerId;
    add(make(next, next.players.find(player => player.id === playerId), 'uno-reverse', 'advantage', 'リバース・順番が逆に', 2));
  }

  // Wait for the chooser's public confirmation, including choosing the same
  // colour. Merely placing a wild or opening the colour picker is not a cue.
  if (previous.pendingAction?.kind === 'color-pick' && next.pendingAction?.kind !== 'color-pick') {
    const chooserId = previous.pendingAction.chooserPlayerId;
    add(make(next, next.players.find(player => player.id === chooserId),
      'uno-color-picked', 'advantage', `${UNO_COLOR_LABELS[next.activeColor]}に決定`, 2));
  }

  for (const player of next.players) {
    if (player.isEliminated) continue;
    const before = count(previous, player.id), after = count(next, player.id);
    if (after <= 3 && after >= 1 && after < before) {
      add(make(next, player, `uno-${after}-cards`, 'advantage', `残り${after}まい`, after === 1 ? 3 : 2));
    }
  }
  // One brief beat per update; major public moments take precedence over
  // remaining-card or colour chatter that would otherwise arrive too late.
  return events.sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1)).slice(0, 1);
}
