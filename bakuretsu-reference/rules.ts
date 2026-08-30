import type {
  BoardCell, GameState, Move, PlayerId, Side, SpecialType, BlastRange,
} from './types.ts';
import { SPECIAL_KINDS } from './types.ts';
import type { RuleConfig } from './config.ts';

export const SIZE = 8;
export const idx = (x: number, y: number) => y * SIZE + x;
export const xOf = (i: number) => i % SIZE;
export const yOf = (i: number) => (i / SIZE) | 0;
export const inBoard = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
export const opponent = (p: Side): Side => (p === 'BLACK' ? 'WHITE' : 'BLACK');

export const DIRS8: [number, number][] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];
export const DIRS4: [number, number][] = [[0, -1], [-1, 0], [1, 0], [0, 1]];

export const chebyshev = (a: number, b: number) =>
  Math.max(Math.abs(xOf(a) - xOf(b)), Math.abs(yOf(a) - yOf(b)));

/** mulberry32: 決定論的RNG（同一シード→同一棋譜を保証） */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyCell(): BoardCell {
  return { state: 'EMPTY', owner: 'NONE', specialType: 'NONE', durability: 0, isQueued: false, activated: false };
}

/** 4種から重複なしで3種を配る（1種類だけ欠ける） */
export function dealHand(rng: () => number, count: number, poolIn?: SpecialType[]): SpecialType[] {
  const pool = [...(poolIn ?? SPECIAL_KINDS)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort();
}

export function initGame(cfg: RuleConfig, rng: () => number): GameState {
  const board = Array.from({ length: 64 }, emptyCell);
  const set = (x: number, y: number, o: Side) => {
    const c = board[idx(x, y)];
    c.state = 'FACEUP'; c.owner = o;
  };
  set(3, 3, 'WHITE'); set(4, 4, 'WHITE');
  set(3, 4, 'BLACK'); set(4, 3, 'BLACK');

  const mk = (p: Side): PlayerHand => {
    const deal = dealHand(rng, Math.min(cfg.specialCount, cfg.dealPool.length), cfg.dealPool);
    return { playerId: p, initialSpecials: [...deal], specialPieces: [...deal], dummyCount: cfg.dummyCount };
  };
  return {
    board,
    currentTurn: 'BLACK',
    hands: { BLACK: mk('BLACK'), WHITE: mk('WHITE') },
    activeQuestionCount: 0,
    status: 'PLAYING',
    passStreak: 0,
    moveNo: 0,
  };
}
type PlayerHand = GameState['hands']['BLACK'];

/**
 * 1方向の挟み込み判定。
 * 端になれるのは mover 所有のコマのみ（中立は owner='NONE' なので自動的に端不可）。
 * 中間には相手コマと中立コマが混在可。相手コマ0枚のラインは cfg で制御。
 */
export function lineCaptures(
  board: BoardCell[], x: number, y: number, dx: number, dy: number, mover: Side, cfg: RuleConfig,
): number[] {
  const acc: number[] = [];
  let oppCount = 0;
  let cx = x + dx, cy = y + dy;
  while (inBoard(cx, cy)) {
    const c = board[idx(cx, cy)];
    if (c.state === 'EMPTY') return [];
    if (c.owner === mover) {
      if (!cfg.neutralCanBeEndpoint && c.specialType === 'NEUTRAL') return [];
      if (acc.length === 0) return [];
      if (oppCount === 0 && !cfg.neutralOnlyLineFlips) return [];
      return acc;
    }
    // 相手コマ or 中立コマ → 中間として蓄積
    acc.push(idx(cx, cy));
    if (c.owner !== 'NONE') oppCount++;
    cx += dx; cy += dy;
  }
  return [];
}

/** 方向別の裏返し対象（DIRS8 と同じ並び） */
export function capturesByDir(board: BoardCell[], x: number, y: number, mover: Side, cfg: RuleConfig): number[][] {
  if (board[idx(x, y)].state !== 'EMPTY') return DIRS8.map(() => []);
  return DIRS8.map(([dx, dy]) => lineCaptures(board, x, y, dx, dy, mover, cfg));
}

/** その方向が「？」を含み、辞退可能か */
export function skippableDirs(board: BoardCell[], byDir: number[][], mover: Side): number[] {
  const foe = opponent(mover);
  const out: number[] = [];
  byDir.forEach((arr, d) => {
    if (arr.some((j) => board[j].state === 'FACEDOWN' && board[j].owner === foe)) out.push(d);
  });
  return out;
}

export function capturesFor(board: BoardCell[], x: number, y: number, mover: Side, cfg: RuleConfig): number[] {
  if (board[idx(x, y)].state !== 'EMPTY') return [];
  const out: number[] = [];
  for (const [dx, dy] of DIRS8) out.push(...lineCaptures(board, x, y, dx, dy, mover, cfg));
  return out;
}

/** 合法マス（通常リバーシと同一。中立コマもこのマスにしか置けない） */
export function legalSquares(s: GameState, cfg: RuleConfig, who: Side = s.currentTurn): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (s.board[i].state !== 'EMPTY') continue;
    if (capturesFor(s.board, xOf(i), yOf(i), who, cfg).length > 0) out.push(i);
  }
  return out;
}

/** 配置手の全列挙（通常／ダミー／特殊各種） */
export function legalMoves(s: GameState, cfg: RuleConfig): Move[] {
  const sq = legalSquares(s, cfg);
  const hand = s.hands[s.currentTurn];
  const canHide = s.activeQuestionCount < cfg.maxQuestionMarks;
  const kinds = new Set(hand.specialPieces);
  const moves: Move[] = [];
  for (const i of sq) {
    const x = xOf(i), y = yOf(i);
    moves.push({ x, y, kind: 'NORMAL' });
    if (!cfg.openSpecials && hand.dummyCount > 0 && canHide) moves.push({ x, y, kind: 'DUMMY' });
    for (const k of kinds) {
      if (k === 'NEUTRAL') continue; // 下で別枠に列挙
      if (cfg.openSpecials || canHide) moves.push({ x, y, kind: 'SPECIAL', special: k });
    }
  }
  // 中立コマ: 裏返しが一切発生しない配置のため、合法手の制約を課さない（Ver1.6）
  if (kinds.has('NEUTRAL')) {
    const pool = cfg.neutralFreePlacement
      ? [...Array(64).keys()].filter((i) => s.board[i].state === 'EMPTY')
      : sq;
    for (const i of pool) moves.push({ x: xOf(i), y: yOf(i), kind: 'SPECIAL', special: 'NEUTRAL' });
  }
  return moves;
}

/** パス判定: 通常の合法手が無くても中立コマを置けるなら手番は成立する */
export function canMove(s: GameState, cfg: RuleConfig): boolean {
  if (legalSquares(s, cfg).length > 0) return true;
  if (cfg.neutralFreePlacement
      && s.hands[s.currentTurn].specialPieces.includes('NEUTRAL')
      && s.board.some((c) => c.state === 'EMPTY')) return true;
  return false;
}

export function blastModeFor(n: number, cfg: RuleConfig): BlastRange {
  return n < cfg.blastThreshold ? cfg.blastRangeEarly : cfg.blastRangeLate;
}

export function rangeCells(center: number, range: BlastRange): number[] {
  const dirs = range === 'CROSS' ? DIRS4 : DIRS8;
  const out = [center];
  const x = xOf(center), y = yOf(center);
  for (const [dx, dy] of dirs) if (inBoard(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
  return out;
}

export function countPieces(board: BoardCell[]) {
  let black = 0, white = 0, neutral = 0, empty = 0;
  for (const c of board) {
    if (c.state === 'EMPTY') empty++;
    else if (c.specialType === 'NEUTRAL') neutral++;
    else if (c.owner === 'BLACK') black++;
    else if (c.owner === 'WHITE') white++;
  }
  return { black, white, neutral, empty };
}

export const CORNERS = [idx(0, 0), idx(7, 0), idx(0, 7), idx(7, 7)];
export function cornerCount(board: BoardCell[], p: Side) {
  return CORNERS.filter((i) => board[i].state !== 'EMPTY' && board[i].owner === p).length;
}

export function decideWinner(board: BoardCell[]): PlayerId {
  const { black, white } = countPieces(board);
  if (black !== white) return black > white ? 'BLACK' : 'WHITE';
  const cb = cornerCount(board, 'BLACK'), cw = cornerCount(board, 'WHITE');
  if (cb !== cw) return cb > cw ? 'BLACK' : 'WHITE';
  return 'NONE';
}
