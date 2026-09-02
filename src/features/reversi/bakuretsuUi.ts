import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { capturesFor, countPieces, idx, legalMoves, opponent } from './bakuretsu/rules.ts';
import type { BoardCell, GameState, Move, Side, SpecialType, TurnResult } from './bakuretsu/types.ts';
import type { Level } from './bakuretsu/ai.ts';
import { BAKURETSU_CPU_NAME } from './bakuretsuCpu';
import type { BakuretsuPlaybackSpeed } from './bakuretsuPlayback';

export type BakuretsuPieceChoice = 'NORMAL' | Exclude<SpecialType, 'NONE' | 'DUMMY'>;
export type BakuretsuTimeBanks = Record<Side, number>;
export type BakuretsuAutoMoveCounts = Record<Side, number>;

export const BAKURETSU_INITIAL_TIME_MS = 20 * 60 * 1000;

export type BakuretsuReversiConfig = {
  name: string;
  name2: string;
  mode: 'cpu' | 'online';
  cpuLevel: Level;
  humanSide: Side | 'RANDOM';
};

export const DEFAULT_BAKURETSU_REVERSI_CONFIG: BakuretsuReversiConfig = {
  name: '',
  name2: '',
  mode: 'cpu',
  cpuLevel: 3,
  humanSide: 'BLACK',
};

export const BAKURETSU_SPEED_LABEL: Record<BakuretsuPlaybackSpeed, string> = {
  slow: '低速',
  normal: '標準',
  fast: '高速',
};

export const BAKURETSU_SPECIAL_LABEL: Record<Exclude<SpecialType, 'NONE' | 'DUMMY'>, string> = {
  BOMB: '爆',
  INFECT: '染',
  SHIELD: '盾',
  NEUTRAL: '壁',
};

export const BAKURETSU_SPECIAL_NAME: Record<Exclude<SpecialType, 'NONE' | 'DUMMY'>, string> = {
  BOMB: '爆弾',
  INFECT: '感染',
  SHIELD: '盾',
  NEUTRAL: '中立',
};

export function isPublicSpecial(special: SpecialType): special is Exclude<SpecialType, 'NONE' | 'DUMMY'> {
  return special !== 'NONE' && special !== 'DUMMY';
}

export function playerName(config: BakuretsuReversiConfig, side: Side, cpuSide: Side | null = null): string {
  if (config.mode === 'cpu') {
    return side === cpuSide ? BAKURETSU_CPU_NAME[config.cpuLevel] : config.name.trim() || '挑戦者';
  }
  const value = side === 'BLACK' ? config.name : config.name2;
  return value.trim() || (side === 'BLACK' ? '黒炎の挑戦者' : '白銀の挑戦者');
}

export function resolveBakuretsuCpuSide(
  config: BakuretsuReversiConfig,
  random: () => number = Math.random,
): Side | null {
  if (config.mode !== 'cpu') return null;
  const humanSide = config.humanSide === 'RANDOM'
    ? random() < 0.5 ? 'BLACK' : 'WHITE'
    : config.humanSide;
  return opponent(humanSide);
}

export function formatTimeBank(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function movesForChoice(state: GameState, choice: BakuretsuPieceChoice): Move[] {
  const moves = legalMoves(state, DEFAULT_CONFIG);
  if (choice === 'NORMAL') return moves.filter((move) => move.kind === 'NORMAL');
  return moves.filter((move) => move.kind === 'SPECIAL' && move.special === choice);
}

export function hintCountForChoice(state: GameState, choice: BakuretsuPieceChoice, x: number, y: number): number {
  if (choice === 'NEUTRAL') return 0;
  return capturesFor(state.board, x, y, state.currentTurn, DEFAULT_CONFIG).length;
}

export function chooseBakuretsuAutoMove(state: GameState): Move | null {
  const moves = legalMoves(state, DEFAULT_CONFIG).filter((move) => move.kind === 'NORMAL');
  return [...moves].sort((left, right) => {
    const leftFlips = capturesFor(state.board, left.x, left.y, state.currentTurn, DEFAULT_CONFIG).length;
    const rightFlips = capturesFor(state.board, right.x, right.y, state.currentTurn, DEFAULT_CONFIG).length;
    return leftFlips - rightFlips || left.y - right.y || left.x - right.x;
  })[0] ?? null;
}

export function forceAutoMoveLoss(result: TurnResult, loser: Side): TurnResult {
  const winner = opponent(loser);
  const counts = countPieces(result.state.board);
  return {
    ...result,
    state: {
      ...result.state,
      status: 'FINISHED',
      endReason: 'ABANDON',
      winner,
    },
    events: [
      ...result.events.filter((event) => event.t !== 'END'),
      { t: 'END', reason: 'ABANDON', winner, black: counts.black, white: counts.white },
    ],
  };
}

/** 中立が自色の端石の代わりになれず、候補線がそこで閉じられない方向を示す。 */
export function neutralWallBlockers(board: BoardCell[], x: number, y: number, mover: Side): number[] {
  const directions: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
  ];
  const blockers: number[] = [];
  for (const [dx, dy] of directions) {
    let cx = x + dx;
    let cy = y + dy;
    let sawOpponent = false;
    while (cx >= 0 && cx < 8 && cy >= 0 && cy < 8) {
      const index = idx(cx, cy);
      const cell = board[index];
      if (cell.state === 'EMPTY') break;
      if (cell.specialType === 'NEUTRAL') {
        if (sawOpponent) blockers.push(index);
        break;
      }
      if (cell.owner === mover) break;
      if (cell.owner !== 'NONE') sawOpponent = true;
      cx += dx;
      cy += dy;
    }
  }
  return [...new Set(blockers)];
}
