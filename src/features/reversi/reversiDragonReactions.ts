import { selectDragonCutinImage } from '../../assets/dragons/cutins/selectCutinImage';
import type { DragonCpu, PublicDragonReactionInput } from '../../components/dragonReactions';
import { isCornerMove } from './reversiRules';
import type { DiscColor, ReversiGameState, ReversiPlayer } from './reversiTypes';

const CPU_LEVELS = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;

export function reversiDragonCpu(player: ReversiPlayer): DragonCpu | null {
  if (!player.isCpu || !player.cpuLevel) return null;
  const index = CPU_LEVELS.indexOf(player.cpuLevel);
  return index < 0 ? null : { id: player.color, name: player.name, level: (index + 1) as DragonCpu['level'] };
}

function opposite(color: DiscColor): DiscColor { return color === 'black' ? 'white' : 'black'; }

function reaction(
  state: ReversiGameState,
  color: DiscColor,
  sequence: number,
  kind: string,
  outcome: PublicDragonReactionInput['outcome'],
  factLabel: string,
  priority: PublicDragonReactionInput['priority'],
  severity: PublicDragonReactionInput['severity'] = 'normal',
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput | null {
  const cpu = reversiDragonCpu(state.players[color]);
  return cpu ? { matchId: state.gameId, sequence, kind, cpu, outcome, factLabel, priority, severity, cutIn } : null;
}

/** Only revealed board changes and the public winner enter the cosmetic decision layer. */
export function detectReversiDragonReactions(
  previous: ReversiGameState,
  next: ReversiGameState,
): PublicDragonReactionInput[] {
  if (previous.gameId !== next.gameId || next.turnCount !== previous.turnCount + 1 || !next.lastMove) return [];
  const actor = next.lastMoveColor ?? previous.currentColor;
  const opponent = opposite(actor);
  const sequence = next.turnCount * 10;
  const events: PublicDragonReactionInput[] = [];
  const add = (value: PublicDragonReactionInput | null) => { if (value) events.push(value); };

  if (next.status === 'finished') {
    for (const color of ['black', 'white'] as const) {
      const outcome = next.winner === 'draw' ? 'neutral' : next.winner === color ? 'victory' : 'defeat';
      add(reaction(next, color, sequence + 9, 'result', outcome,
        next.winner === 'draw' ? '引き分け' : `${next.players[next.winner!].name}の勝利`, 4,
        'major', outcome === 'victory' || outcome === 'defeat' ? outcome : undefined));
    }
    return events;
  }

  if (next.lastFlipCount >= 3) {
    const count = next.lastFlipCount;
    const fact = `${previous.players[actor].name}が${count}枚反転`;
    const major = count >= 6;
    add(reaction(next, actor, sequence + 1, 'large-flip', 'advantage', fact, major ? 3 : 1,
      major ? 'major' : 'normal', count >= 5 ? 'attack' : undefined));
    add(reaction(next, opponent, sequence + 1, 'large-flip', 'disadvantage', fact, major ? 3 : 1,
      major ? 'major' : 'normal', count >= 5 ? 'pressure' : undefined));
  }

  if (isCornerMove(next.lastMove)) {
    const fact = `${previous.players[actor].name}が角を獲得`;
    add(reaction(next, actor, sequence + 2, 'corner', 'advantage', fact, 3, 'major', 'attack'));
    add(reaction(next, opponent, sequence + 2, 'corner', 'disadvantage', fact, 3, 'major', 'pressure'));
  }

  if (next.passedColor) {
    const passed = next.passedColor;
    const fact = `${next.players[passed].name}がパス`;
    add(reaction(next, passed, sequence + 3, 'pass', 'disadvantage', fact, 2));
    add(reaction(next, opposite(passed), sequence + 3, 'pass', 'advantage', fact, 2));
  }
  return events;
}

export function reversiCinematicImage(
  previous: ReversiGameState,
  next: ReversiGameState,
): string | undefined {
  if (next.status === 'finished') {
    const cpu = (['black', 'white'] as const).map(color => previous.players[color]).find(player => player.isCpu);
    if (!cpu || next.winner === 'draw') return undefined;
    return selectDragonCutinImage(cpu, next.winner === cpu.color ? 'victory' : 'defeat', 'landscape');
  }
  const actor = previous.players[next.lastMoveColor ?? previous.currentColor];
  if (actor.isCpu) return selectDragonCutinImage(actor, 'attack', 'landscape');
  const opponent = previous.players[opposite(actor.color)];
  return opponent.isCpu ? selectDragonCutinImage(opponent, 'pressure', 'landscape') : undefined;
}
