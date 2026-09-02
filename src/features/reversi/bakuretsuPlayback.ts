import { DEFAULT_CONFIG, type RuleConfig } from './bakuretsu/config.ts';
import { emptyCell, opponent, rangeCells } from './bakuretsu/rules.ts';
import type {
  BlastRange,
  BoardCell,
  ChainEvent,
  GameState,
  PlayerId,
  Side,
  SpecialType,
  TurnResult,
} from './bakuretsu/types.ts';

export type BakuretsuPlaybackSpeed = 'slow' | 'normal' | 'fast';

export type BakuretsuPlaybackPhase =
  | 'placing'
  | 'flipping'
  | 'shield'
  | 'special-highlight'
  | 'special-resolve'
  | 'rescue'
  | 'final';

export type BakuretsuPlaybackStep = {
  phase: BakuretsuPlaybackPhase;
  board: BoardCell[];
  durationMs: number;
  label: string;
  placedIdx: number;
  activeIndices: number[];
  destroyedIndices: number[];
  shieldIndices: number[];
  sparedIndices: number[];
  special?: SpecialType;
  flipFrom?: PlayerId;
  flipTo?: Side;
  depth?: number;
  blast?: BlastRange;
  cinematic?: 'corner' | 'finale' | 'bomb' | 'shield' | 'infection';
};

const SPEED_FACTOR: Record<BakuretsuPlaybackSpeed, number> = {
  slow: 2,
  normal: 1,
  fast: 0.5,
};

function cloneBoard(board: BoardCell[]): BoardCell[] {
  return board.map((cell) => ({ ...cell }));
}

function makeStep(
  board: BoardCell[],
  placedIdx: number,
  patch: Partial<Omit<BakuretsuPlaybackStep, 'board' | 'placedIdx'>> & Pick<BakuretsuPlaybackStep, 'phase' | 'durationMs' | 'label'>,
): BakuretsuPlaybackStep {
  return {
    board: cloneBoard(board),
    placedIdx,
    activeIndices: [],
    destroyedIndices: [],
    shieldIndices: [],
    sparedIndices: [],
    ...patch,
  };
}

function applyPlacement(board: BoardCell[], event: Extract<ChainEvent, { t: 'PLACE' }>, cfg: RuleConfig) {
  const cell = board[event.idx];
  if (event.kind === 'SPECIAL' && event.special === 'NEUTRAL') {
    cell.state = 'FACEUP';
    cell.owner = 'NONE';
    cell.specialType = 'NEUTRAL';
    return;
  }
  cell.state = 'FACEUP';
  cell.owner = event.by;
  cell.specialType = event.kind === 'SPECIAL' ? (event.special ?? 'NONE') : 'NONE';
  cell.durability = event.special === 'SHIELD' ? cfg.shieldDurability : 0;
}

function compareRipplePosition(left: number, right: number, origin: number): number {
  const originX = origin % 8;
  const originY = Math.floor(origin / 8);
  const distance = (index: number) => Math.max(
    Math.abs(index % 8 - originX),
    Math.abs(Math.floor(index / 8) - originY),
  );
  return distance(left) - distance(right)
    || Math.floor(left / 8) - Math.floor(right / 8)
    || left % 8 - right % 8;
}

function specialEventsByDepth(events: ChainEvent[]) {
  const grouped = new Map<number, Array<Extract<ChainEvent, { t: 'BOMB' | 'INFECT' }>>>();
  for (const event of events) {
    if (event.t !== 'BOMB' && event.t !== 'INFECT') continue;
    const group = grouped.get(event.depth) ?? [];
    group.push(event);
    grouped.set(event.depth, group);
  }
  return [...grouped.entries()].sort(([left], [right]) => left - right);
}

/**
 * エンジンの確定イベント列を表示用フレームへ変換する。
 * FLIP.idxs は参照実装が保証する波紋順をそのまま走査し、UI側では並べ替えない。
 */
export function createBakuretsuPlaybackSteps(
  previous: GameState,
  result: TurnResult,
  cfg: RuleConfig = DEFAULT_CONFIG,
): BakuretsuPlaybackStep[] {
  const place = result.events.find((event): event is Extract<ChainEvent, { t: 'PLACE' }> => event.t === 'PLACE');
  if (!place) return [makeStep(result.state.board, -1, { phase: 'final', durationMs: 16, label: '盤面を確定しました' })];

  const shownCinematics = new Set<string>();
  if (place.idx === 0 || place.idx === 7 || place.idx === 56 || place.idx === 63) {
    shownCinematics.add('CORNER');
  }

  const steps: BakuretsuPlaybackStep[] = [];
  const board = cloneBoard(previous.board);
  applyPlacement(board, place, cfg);
  const isCorner = shownCinematics.has('CORNER');
  steps.push(makeStep(board, place.idx, {
    phase: 'placing',
    durationMs: 250,
    label: place.special === 'NEUTRAL' ? '中立の壁を設置 → 反転0枚' : '着手しました',
    activeIndices: [place.idx],
    special: place.special,
    blast: place.blast,
    cinematic: isCorner ? 'corner' : undefined,
  }));

  const flipShields = result.events.filter(
    (event): event is Extract<ChainEvent, { t: 'SHIELD_ABSORB' }> => event.t === 'SHIELD_ABSORB' && event.cause === 'FLIP',
  ).sort((left, right) => compareRipplePosition(left.idx, right.idx, place.idx));
  let shieldCursor = 0;
  const pushShield = (event: Extract<ChainEvent, { t: 'SHIELD_ABSORB' }>) => {
    const isFirstShield = !shownCinematics.has('SHIELD');
    if (isFirstShield) shownCinematics.add('SHIELD');
    
    const cell = board[event.idx];
    cell.durability = Math.max(0, cell.durability - 1);
    cell.specialType = 'NONE';
    steps.push(makeStep(board, place.idx, {
      phase: 'shield',
      durationMs: 700,
      label: '盾 耐久1消費 → 通常コマ化',
      activeIndices: [event.idx],
      shieldIndices: [event.idx],
      special: 'SHIELD',
      cinematic: isFirstShield ? 'shield' : undefined,
    }));
    steps.push(makeStep(board, place.idx, {
      phase: 'shield',
      durationMs: 400,
      label: '盾 耐久1消費 → 通常コマ化',
      activeIndices: [event.idx],
      shieldIndices: [event.idx],
      special: 'SHIELD',
    }));
  };

  const flipEvents = result.events.filter(
    (event): event is Extract<ChainEvent, { t: 'FLIP' }> => event.t === 'FLIP',
  );
  for (const event of flipEvents) {
    for (const index of event.idxs) {
      while (
        shieldCursor < flipShields.length
        && compareRipplePosition(flipShields[shieldCursor].idx, index, place.idx) < 0
      ) {
        pushShield(flipShields[shieldCursor]);
        shieldCursor += 1;
      }
      const before = board[index].owner;
      const beforeSpecial = board[index].specialType;
      board[index].state = 'FACEUP';
      board[index].owner = event.to;
      board[index].specialType = 'NONE';
      board[index].durability = 0;
      steps.push(makeStep(board, place.idx, {
        phase: 'flipping',
        durationMs: 90,
        label: '着手点に近い石から反転しています',
        activeIndices: [index],
        flipFrom: before,
        flipTo: event.to,
        special: beforeSpecial === 'NONE' ? undefined : beforeSpecial,
      }));
    }
  }
  while (shieldCursor < flipShields.length) {
    pushShield(flipShields[shieldCursor]);
    shieldCursor += 1;
  }

  const blastShields = new Set(result.events.filter(
    (event): event is Extract<ChainEvent, { t: 'SHIELD_ABSORB' }> => event.t === 'SHIELD_ABSORB' && event.cause === 'BLAST',
  ).map((event) => event.idx));

  for (const [depth, events] of specialEventsByDepth(result.events)) {
    const activationDuration = Math.max(240, Math.floor(700 / events.length));
    for (const event of events) {
      const isFirstOfKind = !shownCinematics.has(event.t);
      if (isFirstOfKind) shownCinematics.add(event.t);
      
      steps.push(makeStep(board, place.idx, {
        phase: 'special-highlight',
        durationMs: Math.floor(activationDuration * 0.42),
        label: `連鎖 深度${depth}：${event.t === 'BOMB' ? '爆心地' : '感染源'}を確認`,
        activeIndices: [event.idx],
        special: event.t,
        depth,
        blast: event.t === 'BOMB' ? event.range : undefined,
        cinematic: isFirstOfKind ? (event.t === 'BOMB' ? 'bomb' : 'infection') : undefined,
      }));

      if (event.t === 'BOMB') {
        const spared = rangeCells(event.idx, event.range).filter((index) => (
          index !== event.idx
          && board[index].state !== 'EMPTY'
          && board[index].owner === event.planter
        ));
        const removed = [...new Set([event.idx, ...event.destroyed, ...event.chained])];
        for (const index of removed) board[index] = emptyCell();
        for (const index of event.absorbed) {
          const cell = board[index];
          cell.durability = Math.max(0, cell.durability - 1);
          cell.specialType = 'NONE';
        }
        const shielded = event.absorbed.filter((index) => blastShields.has(index));
        const shieldLabel = shielded.length ? '／盾 耐久1消費 → 通常コマ化' : '';
        steps.push(makeStep(board, place.idx, {
          phase: 'special-resolve',
          durationMs: activationDuration - Math.floor(activationDuration * 0.42),
          label: `爆弾発動 → ${event.destroyed.length + event.chained.length + 1}枚破壊${shieldLabel}`,
          activeIndices: [event.idx],
          destroyedIndices: removed,
          shieldIndices: shielded,
          sparedIndices: spared,
          special: 'BOMB',
          depth,
          blast: event.range,
        }));
      } else {
        const sourceOwner = previous.board[event.idx]?.owner;
        const infectOwner = sourceOwner === 'BLACK' || sourceOwner === 'WHITE'
          ? sourceOwner
          : opponent(place.by);
        for (const index of event.stolen) {
          board[index].state = 'FACEUP';
          board[index].owner = infectOwner;
          board[index].specialType = 'NONE';
        }
        steps.push(makeStep(board, place.idx, {
          phase: 'special-resolve',
          durationMs: activationDuration - Math.floor(activationDuration * 0.42),
          label: `感染 → ${event.stolen.length}枚奪取`,
          activeIndices: [event.idx, ...event.stolen],
          special: 'INFECT',
          depth,
        }));
      }
    }
    const latest = steps.at(-1)!;
    steps.push(makeStep(board, place.idx, {
      phase: 'special-resolve',
      durationMs: 400,
      label: latest.label,
      activeIndices: latest.activeIndices,
      destroyedIndices: latest.destroyedIndices,
      shieldIndices: latest.shieldIndices,
      sparedIndices: latest.sparedIndices,
      special: latest.special,
      depth,
      blast: latest.blast,
    }));
  }

  for (const event of result.events) {
    if (event.t !== 'RESCUE') continue;
    board[event.idx] = {
      state: 'FACEUP', owner: event.player, specialType: 'NONE', durability: 0, isQueued: false, activated: false,
    };
    steps.push(makeStep(board, place.idx, {
      phase: 'rescue',
      durationMs: 400,
      label: `${event.player === 'BLACK' ? '黒炎' : '白銀'}を中央へ救済配置`,
      activeIndices: [event.idx],
    }));
  }

  const isFinale = result.state.status === 'FINISHED';
  steps.push(makeStep(result.state.board, place.idx, {
    phase: 'final',
    durationMs: 16,
    label: isFinale ? '最終盤面を確定しました' : '手番を交代します',
    cinematic: isFinale ? 'finale' : undefined,
  }));
  return steps;
}

export function getBakuretsuStepDuration(
  step: BakuretsuPlaybackStep,
  speed: BakuretsuPlaybackSpeed,
  reducedMotion: boolean,
): number {
  const scaled = Math.max(16, Math.round(step.durationMs * SPEED_FACTOR[speed]));
  if (!reducedMotion) return scaled;
  if (step.phase === 'final') return 16;
  if (step.phase === 'special-resolve' || step.phase === 'shield') return Math.min(scaled, 240);
  return Math.min(scaled, 120);
}

export function playbackFlipOrder(steps: BakuretsuPlaybackStep[]): number[] {
  return steps.filter((step) => step.phase === 'flipping').flatMap((step) => step.activeIndices);
}
