import { publicReactionPresenter } from '../../components/dragonReactions';
import type { PublicDragonReactionInput } from '../../components/dragonReactions';
import { applyMove, getMovePreview } from './mancalaRules';
import type { GameState, Player } from './mancalaTypes';

/** Recorded only when the displayed sowing/capture animation has completed. */
export type CompletedMancalaPlayback = Readonly<{ pitId: string; captureCompleted: boolean }>;

function event(
  next: GameState, player: Player | undefined, kind: string,
  outcome: PublicDragonReactionInput['outcome'], factLabel: string,
  priority: PublicDragonReactionInput['priority'], severity: PublicDragonReactionInput['severity'] = 'normal',
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput | null {
  if (!player || (!player.isCpu && next.players.some(entry => entry.isCpu))) return null;
  return { matchId: next.gameId, sequence: next.turnCount, ...publicReactionPresenter(player),
    kind, outcome: player.isCpu ? outcome : 'neutral', factLabel, priority, severity, cutIn };
}

function completedMove(previous: GameState, next: GameState, playback?: CompletedMancalaPlayback) {
  if (!playback) return null;
  const preview = getMovePreview(previous, playback.pitId);
  if (!preview) return null;
  const expected = applyMove(previous, playback.pitId);
  // A reconnect, queued later move or malformed result is not this completed action.
  if (expected.turnCount !== next.turnCount || expected.status !== next.status
    || expected.currentPlayerId !== next.currentPlayerId || expected.winnerPlayerId !== next.winnerPlayerId
    || expected.board.length !== next.board.length || expected.board.some((pit, index) => {
      const actual = next.board[index];
      return pit.id !== actual.id || pit.stones !== actual.stones
        || pit.isStore !== actual.isStore || pit.ownerPlayerId !== actual.ownerPlayerId;
    })) return null;
  return preview;
}

/** Completed moves only. Capture cues need explicit playback completion and the exact public move result. */
export function detectMancalaDragonReactions(
  previous: GameState, next: GameState, playback?: CompletedMancalaPlayback,
): PublicDragonReactionInput[] {
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
    if (next.isDraw && !next.players.some(player => player.isCpu)) {
      const drawn = event(next, next.players[0], 'mancala-draw', 'neutral', '引き分け', 4, 'major');
      return drawn ? [drawn] : [];
    }
    return [];
  }
  const mover = previous.players.find(player => player.id === previous.currentPlayerId);
  if (!mover || next.status !== 'playing') return [];
  const preview = completedMove(previous, next, playback);
  if (preview?.captureOppositePitId && playback?.captureCompleted) {
    const count = preview.captureCount;
    const major = count >= 6;
    const captured = event(next, mover, major ? 'mancala-large-capture' : 'mancala-capture',
      'advantage', `${count}石を捕獲`, major ? 3 : 2, major ? 'major' : 'normal', major ? 'attack' : undefined);
    if (captured) return [captured];
    const victimId = previous.board.find(pit => pit.id === preview.captureOppositePitId)?.ownerPlayerId;
    const victim = next.players.find(player => player.id === victimId);
    const lost = event(next, victim, major ? 'mancala-large-loss' : 'mancala-capture-loss',
      'disadvantage', `${count}石を捕獲された`, major ? 3 : 2, major ? 'major' : 'normal', major ? 'pressure' : undefined);
    return lost ? [lost] : [];
  }
  if (mover.id === next.currentPlayerId) {
    const extra = event(next, mover, 'mancala-extra-turn', 'advantage', '追加ターン', 2);
    return extra ? [extra] : [];
  }
  // A lightweight public sowing cue fills quiet turns without predicting the next move.
  if (preview && !preview.captureOppositePitId) {
    const count = previous.board.find(pit => pit.id === playback?.pitId)?.stones ?? 0;
    if (count >= 3) {
      const sow = event(next, mover, 'mancala-sow', 'neutral', `${mover.name}が${count}石を配った`, 1);
      return sow ? [sow] : [];
    }
  }
  return [];
}
