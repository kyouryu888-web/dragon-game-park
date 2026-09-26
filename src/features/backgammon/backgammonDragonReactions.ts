import type { DragonCpu, PublicDragonReactionInput } from '../../components/dragonReactions';
import type { GameState } from './backgammonTypes';
import { getLegalMoves } from './backgammonRules';

type Context = Readonly<{
  matchId: string;
  sequence: number;
  cpu: DragonCpu;
}>;

function event(
  context: Context,
  kind: string,
  outcome: PublicDragonReactionInput['outcome'],
  factLabel: string,
  priority: PublicDragonReactionInput['priority'],
  severity: PublicDragonReactionInput['severity'] = 'normal',
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput {
  return { ...context, kind, outcome, factLabel, priority, severity, cutIn };
}

/** Uses only the displayed board, dice, cube and result. The CPU's private evaluation is never read. */
export function detectBackgammonDragonReactions(
  previous: GameState,
  next: GameState,
  context: Context,
): PublicDragonReactionInput[] {
  // A new game in the match is not an action in the old game.
  if (next.turnCount < previous.turnCount || (previous.phase === 'finished' && next.phase === 'opening-roll')) return [];

  if (previous.phase !== 'finished' && next.phase === 'finished' && next.winner) {
    const cpuWon = next.winner === 'black';
    const result = next.winKind === 'drop' ? 'ドロップ' : next.winKind === 'backgammon' ? 'バックギャモン' : next.winKind === 'gammon' ? 'ギャモン' : '通常';
    return [event(context, cpuWon ? 'backgammon-cpu-victory' : 'backgammon-cpu-defeat',
      cpuWon ? 'victory' : 'defeat', `${cpuWon ? 'CPU' : '対戦者'}の${result}勝ち・${next.resultPoints ?? 0}点`, 4, 'major', cpuWon ? 'victory' : 'defeat')];
  }

  if (previous.phase !== 'double-offered' && next.phase === 'double-offered' && next.doubleOfferedBy) {
    const cpuOffered = next.doubleOfferedBy === 'black';
    return [event(context, cpuOffered ? 'backgammon-cpu-double-offer' : 'backgammon-opponent-double-offer',
      cpuOffered ? 'advantage' : 'neutral', `ダブル提案・${next.cube.value * 2}点`, 3, 'major', cpuOffered ? 'attack' : 'pressure')];
  }

  if (previous.phase === 'double-offered' && next.phase === 'rolling' && next.cube.value > previous.cube.value) {
    const cpuAccepted = previous.doubleOfferedBy === 'white';
    return [event(context, cpuAccepted ? 'backgammon-cpu-double-accept' : 'backgammon-opponent-double-accept',
      'advantage', `ダブル受諾・${next.cube.value}点`, 3, 'major', 'attack')];
  }

  const cpuHit = next.bar.white - previous.bar.white;
  const cpuWasHit = next.bar.black - previous.bar.black;
  if (cpuHit > 0) {
    return [event(context, `backgammon-cpu-hit:${cpuHit}`, 'advantage', `白の駒を${cpuHit}個ヒット`, cpuHit > 1 ? 3 : 2,
      cpuHit > 1 ? 'major' : 'normal', cpuHit > 1 ? 'attack' : undefined)];
  }
  if (cpuWasHit > 0) {
    return [event(context, `backgammon-cpu-was-hit:${cpuWasHit}`, 'disadvantage', `黒の駒を${cpuWasHit}個ヒットされた`, cpuWasHit > 1 ? 3 : 2,
      cpuWasHit > 1 ? 'major' : 'normal', cpuWasHit > 1 ? 'pressure' : undefined)];
  }

  if (previous.phase === 'rolling' && next.phase === 'moving' && previous.currentPlayer === 'black'
    && next.rolled && next.rolled[0] === next.rolled[1]) {
    return [event(context, 'backgammon-cpu-doubles-roll', 'advantage', `ゾロ目 ${next.rolled[0]}・${next.rolled[1]}`, 2)];
  }

  if (previous.phase === 'moving' && previous.currentPlayer === 'black' && previous.dice.length > 0
    && next.phase === 'rolling' && next.currentPlayer === 'white' && getLegalMoves(previous).length === 0) {
    return [event(context, 'backgammon-cpu-no-moves', 'disadvantage', '動かせる手がない', 2)];
  }

  return [];
}
