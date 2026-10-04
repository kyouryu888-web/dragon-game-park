import { publicReactionPresenter } from '../../components/dragonReactions';
import type { DragonCpu, PublicDragonReactionInput } from '../../components/dragonReactions';
import type { GameState, PlayerId } from './backgammonTypes';
import { getLegalMoves } from './backgammonRules';

type Context = Readonly<{
  matchId: string;
  sequence: number;
  cpu?: DragonCpu;
  names?: Partial<Record<PlayerId, string>>;
  actor?: PlayerId;
}>;
const opposite = (color: PlayerId): PlayerId => color === 'white' ? 'black' : 'white';

function event(
  context: Context, kind: string, outcome: PublicDragonReactionInput['outcome'],
  factLabel: string, priority: PublicDragonReactionInput['priority'],
  severity: PublicDragonReactionInput['severity'] = 'normal', cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput {
  const presenter = context.cpu ? { cpu: context.cpu, presenter: 'cpu' as const }
    : publicReactionPresenter({ id: context.actor ?? 'white', name: context.names?.[context.actor ?? 'white'] ?? '対戦者', isCpu: false });
  return { matchId: context.matchId, sequence: context.sequence, ...presenter,
    kind: context.cpu ? kind : kind.replace('-cpu-', '-').replace('-opponent-', '-'),
    outcome: context.cpu ? outcome : 'neutral', factLabel, priority, severity, cutIn };
}

/** Uses only the displayed board, dice, cube and result, never a player's evaluation. */
export function detectBackgammonDragonReactions(
  previous: GameState, next: GameState, input: Context,
): PublicDragonReactionInput[] {
  if (next.turnCount > previous.turnCount + 1 || next.turnCount < previous.turnCount
    || (previous.phase === 'finished' && next.phase === 'opening-roll')) return [];
  const context = { ...input, actor: previous.currentPlayer };
  const name = (color: PlayerId) => context.names?.[color] ?? (color === 'black' ? '緋' : '金');
  if (previous.phase !== 'finished' && next.phase === 'finished' && next.winner) {
    const cpuWon = next.winner === context.cpu?.id;
    const result = next.winKind === 'drop' ? 'ドロップ' : next.winKind === 'backgammon' ? 'バックギャモン' : next.winKind === 'gammon' ? 'ギャモン' : '通常';
    return [event({ ...context, actor: next.winner }, context.cpu ? cpuWon ? 'backgammon-cpu-victory' : 'backgammon-cpu-defeat' : 'backgammon-result',
      cpuWon ? 'victory' : 'defeat', `${context.cpu ? cpuWon ? 'CPU' : '対戦者' : name(next.winner)}の${result}勝ち・${next.resultPoints ?? 0}点`,
      4, 'major', !context.cpu || cpuWon ? 'victory' : 'defeat')];
  }
  if (previous.phase !== 'double-offered' && next.phase === 'double-offered' && next.doubleOfferedBy) {
    const cpuOffered = next.doubleOfferedBy === context.cpu?.id;
    return [event({ ...context, actor: next.doubleOfferedBy }, cpuOffered ? 'backgammon-cpu-double-offer' : 'backgammon-opponent-double-offer',
      cpuOffered ? 'advantage' : 'neutral', `ダブル提案・${next.cube.value * 2}点`, 3, 'major', !context.cpu || cpuOffered ? 'attack' : 'pressure')];
  }
  if (previous.phase === 'double-offered' && next.phase === 'rolling' && next.cube.value > previous.cube.value && previous.doubleOfferedBy) {
    const accepter = opposite(previous.doubleOfferedBy);
    const cpuAccepted = accepter === context.cpu?.id;
    return [event({ ...context, actor: accepter }, cpuAccepted ? 'backgammon-cpu-double-accept' : 'backgammon-opponent-double-accept',
      'advantage', `ダブル受諾・${next.cube.value}点`, 3, 'major', 'attack')];
  }
  const mover = previous.currentPlayer;
  const victim = opposite(mover);
  const hit = next.bar[victim] - previous.bar[victim];
  if (hit > 0) {
    const cpuMoved = mover === context.cpu?.id;
    const kind = context.cpu ? cpuMoved ? `backgammon-cpu-hit:${hit}` : `backgammon-cpu-was-hit:${hit}` : `backgammon-hit:${hit}`;
    const victimName = context.cpu ? victim === 'white' ? '白' : '黒' : name(victim);
    return [event(context, kind, cpuMoved ? 'advantage' : 'disadvantage',
      `${victimName}の駒${context.cpu && !cpuMoved ? 'が' : 'を'}${hit}個ヒット${context.cpu && !cpuMoved ? 'された' : ''}`, hit > 1 ? 3 : 2,
      hit > 1 ? 'major' : 'normal', hit > 1 ? !context.cpu || cpuMoved ? 'attack' : 'pressure' : undefined)];
  }
  if (previous.phase === 'rolling' && next.phase === 'moving' && next.rolled && next.rolled[0] === next.rolled[1]) {
    const cpuRolled = mover === context.cpu?.id;
    return [event(context, cpuRolled ? 'backgammon-cpu-doubles-roll' : 'backgammon-opponent-doubles-roll', cpuRolled ? 'advantage' : 'neutral', `ゾロ目 ${next.rolled[0]}・${next.rolled[1]}`, 2)];
  }
  if (previous.phase === 'moving' && previous.dice.length > 0
    && next.phase === 'rolling' && next.currentPlayer !== previous.currentPlayer && getLegalMoves(previous).length === 0) {
    const cpuPassed = mover === context.cpu?.id;
    return [event(context, cpuPassed ? 'backgammon-cpu-no-moves' : 'backgammon-opponent-no-moves', cpuPassed ? 'disadvantage' : 'neutral', '動かせる手がない', 2)];
  }
  const returned = previous.bar[mover] - next.bar[mover];
  const borneOff = next.borneOff[mover] - previous.borneOff[mover];
  if (returned > 0) return [event(context, context.cpu && mover !== context.cpu.id ? 'backgammon-opponent-return' : 'backgammon-return', mover === context.cpu?.id ? 'advantage' : 'neutral', `${name(mover)}の駒がバーから復帰`, 1)];
  if (borneOff > 0) return [event(context, context.cpu && mover !== context.cpu.id ? 'backgammon-opponent-bearoff' : 'backgammon-bearoff', mover === context.cpu?.id ? 'advantage' : 'neutral', `${name(mover)}が${borneOff}個ベアオフ`, 1)];
  return [];
}
