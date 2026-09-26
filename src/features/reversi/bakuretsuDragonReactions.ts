import { selectDragonCutinImage } from '../../assets/dragons/cutins/selectCutinImage';
import type { DragonCpu, PublicDragonReactionInput } from '../../components/dragonReactions';
import type { BoardCell, GameState, PlayerId, Side } from './bakuretsu/types.ts';
import type { BakuretsuPlaybackStep } from './bakuretsuPlayback';
import { playerName, type BakuretsuReversiConfig } from './bakuretsuUi';

export function bakuretsuDragonCpu(config: BakuretsuReversiConfig, cpuSide: Side | null): DragonCpu | null {
  if (!cpuSide) return null;
  return { id: cpuSide, name: playerName(config, cpuSide, cpuSide), level: config.cpuLevel as DragonCpu['level'] };
}

type PublicStepContext = Readonly<{
  matchId: string;
  moveNo: number;
  stepIndex: number;
  step: BakuretsuPlaybackStep;
  beforeBoard: readonly BoardCell[];
  cpu: DragonCpu | null;
  winner?: PlayerId;
  passedSide?: Side;
}>;

function visibleOwner(cell: BoardCell | undefined): PlayerId {
  return cell?.state === 'FACEUP' ? cell.owner : 'NONE';
}

function other(side: Side): Side { return side === 'BLACK' ? 'WHITE' : 'BLACK'; }

function effectOwner(step: BakuretsuPlaybackStep): PlayerId {
  return visibleOwner(step.board[step.activeIndices[0] ?? step.placedIdx]);
}

function event(
  context: PublicStepContext,
  kind: string,
  outcome: PublicDragonReactionInput['outcome'],
  factLabel: string,
  priority: PublicDragonReactionInput['priority'] = 3,
  cutIn?: PublicDragonReactionInput['cutIn'],
): PublicDragonReactionInput | null {
  if (!context.cpu) return null;
  return {
    matchId: context.matchId,
    sequence: context.moveNo * 10_000 + context.stepIndex,
    kind,
    cpu: context.cpu,
    outcome,
    factLabel,
    priority,
    severity: priority && priority >= 3 ? 'major' : 'normal',
    cutIn,
  };
}

/** Called only when the exact playback frame is painted. No unrevealed chain result is examined. */
export function detectBakuretsuDragonReactionForStep(context: PublicStepContext): PublicDragonReactionInput | null {
  const { step, beforeBoard, cpu } = context;
  if (!cpu) return null;
  const cpuSide = cpu.id as Side;

  if (step.phase === 'placing' && step.cinematic === 'corner') {
    const owner = visibleOwner(step.board[step.placedIdx]);
    if (owner !== 'BLACK' && owner !== 'WHITE') return null;
    const outcome = owner === cpuSide ? 'advantage' : 'disadvantage';
    return event(context, 'corner', outcome, `${owner === 'BLACK' ? '黒炎' : '白銀'}が角を獲得`, 3,
      outcome === 'advantage' ? 'attack' : 'pressure');
  }

  if (step.phase === 'shield' && step.cinematic === 'shield') {
    const owner = effectOwner(step);
    if (owner !== 'BLACK' && owner !== 'WHITE') return null;
    const outcome = owner === cpuSide ? 'advantage' : 'disadvantage';
    return event(context, 'shield-defense', outcome, '盾が反転を防いだ', 3,
      outcome === 'advantage' ? 'attack' : 'pressure');
  }

  if (step.phase === 'special-resolve' && step.special === 'BOMB' && step.destroyedIndices.length > 0) {
    // A later hold frame repeats the same visual metadata; it must not react twice.
    if (!step.destroyedIndices.some(index => beforeBoard[index]?.state !== 'EMPTY' && step.board[index]?.state === 'EMPTY')) return null;
    const visibleLosses = { BLACK: 0, WHITE: 0 };
    for (const index of step.destroyedIndices) {
      const owner = visibleOwner(beforeBoard[index]);
      if (owner === 'BLACK' || owner === 'WHITE') visibleLosses[owner] += 1;
    }
    const cpuLoss = visibleLosses[cpuSide];
    const rivalLoss = visibleLosses[other(cpuSide)];
    const outcome = cpuLoss === rivalLoss ? 'neutral' : cpuLoss < rivalLoss ? 'advantage' : 'disadvantage';
    return event(context, `bomb:${step.depth ?? 0}:${step.activeIndices[0] ?? -1}`, outcome,
      `爆弾で${step.destroyedIndices.length}枚破壊`, step.destroyedIndices.length >= 4 ? 3 : 2,
      outcome === 'advantage' ? 'attack' : outcome === 'disadvantage' ? 'pressure' : undefined);
  }

  if (step.phase === 'special-resolve' && step.special === 'INFECT' && step.activeIndices.length > 1) {
    if (!step.activeIndices.slice(1).some(index => visibleOwner(beforeBoard[index]) !== visibleOwner(step.board[index]))) return null;
    let cpuGained = 0;
    let cpuLost = 0;
    for (const index of step.activeIndices.slice(1)) {
      const before = visibleOwner(beforeBoard[index]);
      const after = visibleOwner(step.board[index]);
      if (before !== cpuSide && after === cpuSide) cpuGained += 1;
      if (before === cpuSide && after !== cpuSide) cpuLost += 1;
    }
    const outcome = cpuGained === cpuLost ? 'neutral' : cpuGained > cpuLost ? 'advantage' : 'disadvantage';
    return event(context, `infection:${step.depth ?? 0}:${step.activeIndices[0] ?? -1}`, outcome,
      `感染で${step.activeIndices.length - 1}枚奪取`, step.activeIndices.length >= 4 ? 3 : 2,
      outcome === 'advantage' ? 'attack' : outcome === 'disadvantage' ? 'pressure' : undefined);
  }

  if (step.phase === 'final' && context.winner !== undefined) {
    const outcome = context.winner === 'NONE' ? 'neutral' : context.winner === cpuSide ? 'victory' : 'defeat';
    return event(context, 'result', outcome,
      context.winner === 'NONE' ? '引き分け' : `${context.winner === 'BLACK' ? '黒炎' : '白銀'}の勝利`, 4,
      outcome === 'victory' || outcome === 'defeat' ? outcome : undefined);
  }

  if (step.phase === 'final' && context.passedSide) {
    const passed = context.passedSide;
    return event(context, 'pass', passed === cpuSide ? 'disadvantage' : 'advantage',
      `${passed === 'BLACK' ? '黒炎' : '白銀'}がパス`, 2);
  }
  return null;
}

export function bakuretsuCinematicImage(
  step: BakuretsuPlaybackStep,
  resultState: GameState,
  cpu: DragonCpu | null,
): string | undefined {
  if (!cpu || !step.cinematic) return undefined;
  if (step.cinematic === 'finale') {
    if (resultState.winner !== 'BLACK' && resultState.winner !== 'WHITE') return undefined;
    return selectDragonCutinImage({ isCpu: true, cpuLevel: cpu.level },
      resultState.winner === cpu.id ? 'victory' : 'defeat', 'landscape');
  }
  const owner = effectOwner(step);
  if (owner !== 'BLACK' && owner !== 'WHITE') return undefined;
  return selectDragonCutinImage({ isCpu: true, cpuLevel: cpu.level },
    owner === cpu.id ? 'attack' : 'pressure', 'landscape');
}
