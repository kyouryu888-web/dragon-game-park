import type { PublicDragonReactionInput } from '../../components/dragonReactions';
import type { CpuLevel, GameState, Player } from './mancalaTypes';

const levels: CpuLevel[] = ['very-easy','easy','normal','hard','very-hard'];
function actor(player: Player | undefined) {
  if (!player?.isCpu) return null;
  const index = levels.indexOf(player.cpuLevel);
  return index < 0 ? null : { id: player.id, name: player.name, level: (index + 1) as 1 | 2 | 3 | 4 | 5 };
}
function score(state: GameState, playerId: string): number {
  return state.board.find(pit => pit.isStore && pit.ownerPlayerId === playerId)?.stones ?? 0;
}
function event(
  next: GameState, player: Player | undefined, kind: string,
  outcome: PublicDragonReactionInput['outcome'], factLabel: string,
  priority: PublicDragonReactionInput['priority'], severity: PublicDragonReactionInput['severity'] = 'normal',
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput | null {
  const cpu = actor(player);
  return cpu ? { matchId: next.gameId, sequence: next.turnCount, cpu, kind, outcome, factLabel, priority, severity, cutIn } : null;
}

/** Completed Mancala moves only; caller invokes after stone/capture playback. */
export function detectMancalaDragonReactions(previous: GameState, next: GameState): PublicDragonReactionInput[] {
  if (previous.gameId !== next.gameId || next.turnCount !== previous.turnCount + 1) return [];
  const winner = next.players.find(player => player.id === next.winnerPlayerId);
  if (previous.status !== 'finished' && next.status === 'finished') {
    if (winner) {
      const won = event(next, winner, 'mancala-victory', 'victory', `${winner.name}の勝ち`, 4, 'major', 'victory');
      if (won) return [won];
      return next.players.filter(player => player.isCpu).map(player =>
        event(next, player, `mancala-defeat:${player.id}`, 'defeat', `${winner.name}の勝ち`, 4, 'major', 'defeat'),
      ).filter((value): value is PublicDragonReactionInput => value !== null);
    }
    return [];
  }
  const mover = previous.players.find(player => player.id === previous.currentPlayerId);
  if (!mover || next.status !== 'playing') return [];
  const gained = score(next, mover.id) - score(previous, mover.id);
  const events: PublicDragonReactionInput[] = [];
  if (gained >= 6) {
    const success = event(next, mover, 'mancala-large-capture', 'advantage', `${gained}石を獲得`, 3, 'major', 'attack');
    if (success) events.push(success);
    if (!mover.isCpu) {
      // Only public pits are compared. The CPU with the largest emptied pit is
      // the direct victim; a score change alone never reveals a hidden plan.
      const losses = previous.players.filter(player => player.isCpu).map(player => ({
        player,
        lost: Math.max(0, ...previous.board.filter(pit => !pit.isStore && pit.ownerPlayerId === player.id).map(pit => {
          const after = next.board.find(entry => entry.id === pit.id)?.stones ?? 0;
          return after === 0 ? pit.stones : 0;
        })),
      })).sort((a,b)=>b.lost-a.lost);
      if (losses[0] && losses[0].lost >= 5) {
        const hurt = event(next, losses[0].player, 'mancala-large-loss', 'disadvantage', `${gained}石を獲得された`, 3, 'major', 'pressure');
        if (hurt) events.push(hurt);
      }
    }
  }
  if (mover.id === next.currentPlayerId) {
    const extra = event(next, mover, 'mancala-extra-turn', 'advantage', '追加ターン', 2);
    if (extra) events.push(extra);
  }
  return events;
}
