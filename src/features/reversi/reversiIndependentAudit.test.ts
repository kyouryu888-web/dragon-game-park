import { describe, expect, it } from 'vitest';
import { chooseReversiCpuMove, evaluateReversiBoard } from './reversiCpu';
import {
  applyReversiMove,
  countReversiDiscs,
  createInitialReversiState,
  getFlipsForMove,
  getValidMoves,
  oppositeColor,
  placeDisc,
} from './reversiRules';
import type {
  DiscColor,
  ReversiBoard,
  ReversiCpuLevel,
  ReversiGameState,
  ReversiMove,
} from './reversiTypes';

const LEVELS: ReversiCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
const LEGACY_POSITION_WEIGHTS = [
  [120, -30, 20, 8, 8, 20, -30, 120],
  [-30, -55, -8, -8, -8, -8, -55, -30],
  [20, -8, 15, 3, 3, 15, -8, 20],
  [8, -8, 3, 3, 3, 3, -8, 8],
  [8, -8, 3, 3, 3, 3, -8, 8],
  [20, -8, 15, 3, 3, 15, -8, 20],
  [-30, -55, -8, -8, -8, -8, -55, -30],
  [120, -30, 20, 8, 8, 20, -30, 120],
] as const;
const CONFIG = {
  mode: 'cpu' as const,
  name: '黒',
  name2: '白',
  cpuLevel: 'normal' as const,
  humanSide: 'black' as const,
};

function randomFor(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function oracleFlips(board: ReversiBoard, color: DiscColor, row: number, col: number): ReversiMove[] {
  if (row < 0 || row >= 8 || col < 0 || col >= 8 || board[row][col] !== null) return [];
  const enemy = oppositeColor(color);
  const result: ReversiMove[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const line: ReversiMove[] = [];
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === enemy) {
        line.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
      if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color) {
        result.push(...line);
      }
    }
  }
  return result.sort((a, b) => a.row - b.row || a.col - b.col);
}

function keyMoves(moves: ReversiMove[]): string[] {
  return moves.map(({ row, col }) => `${row}:${col}`).sort();
}

function randomReachableState(seed: number, targetEmpty: number): ReversiGameState {
  const random = randomFor(seed);
  let state = createInitialReversiState(CONFIG, random);
  while (state.status === 'playing' && countReversiDiscs(state.board).empty > targetEmpty) {
    const moves = getValidMoves(state.board, state.currentColor);
    expect(moves.length).toBeGreaterThan(0);
    state = applyReversiMove(state, moves[Math.floor(random() * moves.length)]);
  }
  return state;
}

function exactValue(board: ReversiBoard, color: DiscColor, perspective: DiscColor): number {
  const moves = getValidMoves(board, color);
  const other = oppositeColor(color);
  if (moves.length === 0) {
    if (getValidMoves(board, other).length === 0) {
      const score = countReversiDiscs(board);
      return score[perspective] - score[oppositeColor(perspective)];
    }
    return exactValue(board, other, perspective);
  }
  const values = moves.map((move) => exactValue(placeDisc(board, color, move)!.board, other, perspective));
  return color === perspective ? Math.max(...values) : Math.min(...values);
}

function legacyMinimax(
  board: ReversiBoard,
  color: DiscColor,
  perspective: DiscColor,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = getValidMoves(board, color);
  const other = oppositeColor(color);
  if (moves.length === 0) {
    if (getValidMoves(board, other).length === 0) {
      const score = countReversiDiscs(board);
      const difference = score[perspective] - score[oppositeColor(perspective)];
      return difference === 0 ? 0 : Math.sign(difference) * 1_000_000 + difference;
    }
    return legacyMinimax(board, other, perspective, depth - 1, alpha, beta);
  }
  if (depth <= 0) return evaluateReversiBoard(board, perspective);
  const maximizing = color === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  const ordered = [...moves].sort((a, b) => LEGACY_POSITION_WEIGHTS[b.row][b.col] - LEGACY_POSITION_WEIGHTS[a.row][a.col]);
  for (const move of ordered) {
    const value = legacyMinimax(placeDisc(board, color, move)!.board, other, perspective, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function legacyVeryHardMove(state: ReversiGameState): ReversiMove {
  const color = state.currentColor;
  const empty = countReversiDiscs(state.board).empty;
  const scored = getValidMoves(state.board, color).map((move) => ({
    move,
    score: legacyMinimax(
      placeDisc(state.board, color, move)!.board,
      oppositeColor(color),
      color,
      empty,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ),
  }));
  const best = Math.max(...scored.map(({ score }) => score));
  return scored.find(({ score }) => score === best)!.move;
}

type Result = { black: number; white: number; cutins: number; corners: number; grandFlips: number; passes: number };

function playFrom(
  start: ReversiGameState,
  blackLevel: ReversiCpuLevel,
  whiteLevel: ReversiCpuLevel,
  seed: number,
): Result {
  const random = randomFor(seed);
  let state = start;
  let cutins = 0;
  let corners = 0;
  let grandFlips = 0;
  let passes = 0;
  let grandFlipShown = false;
  while (state.status === 'playing') {
    const move = chooseReversiCpuMove(state, state.currentColor === 'black' ? blackLevel : whiteLevel, random);
    expect(move).not.toBeNull();
    const next = applyReversiMove(state, move!);
    expect(next).not.toBe(state);
    if (next.passedColor) passes += 1;
    if (next.status === 'finished') {
      cutins += 1;
    } else if ((move!.row === 0 || move!.row === 7) && (move!.col === 0 || move!.col === 7)) {
      cutins += 1;
      corners += 1;
    } else if (next.lastFlipCount >= 5 && !grandFlipShown) {
      cutins += 1;
      grandFlips += 1;
      grandFlipShown = true;
    }
    state = next;
  }
  const score = countReversiDiscs(state.board);
  return { black: score.black, white: score.white, cutins, corners, grandFlips, passes };
}

describe('independent Reversi audit', () => {
  it('matches an independent 8-direction oracle on every cell of reachable games', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const random = randomFor(seed * 7919);
      let state = createInitialReversiState(CONFIG, random);
      while (state.status === 'playing') {
        for (const color of ['black', 'white'] as const) {
          for (let row = 0; row < 8; row += 1) {
            for (let col = 0; col < 8; col += 1) {
              expect(keyMoves(getFlipsForMove(state.board, color, row, col))).toEqual(
                keyMoves(oracleFlips(state.board, color, row, col)),
              );
            }
          }
        }
        const moves = getValidMoves(state.board, state.currentColor);
        state = applyReversiMove(state, moves[Math.floor(random() * moves.length)]);
      }
    }
  }, 30_000);

  it('very-hard agrees with exact endgame search on reachable positions', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = randomReachableState(seed * 104729, 7);
      if (state.status !== 'playing') continue;
      const chosen = chooseReversiCpuMove(state, 'very-hard', randomFor(seed));
      expect(chosen).not.toBeNull();
      const color = state.currentColor;
      const other = oppositeColor(color);
      const options = getValidMoves(state.board, color).map((move) => ({
        move,
        value: exactValue(placeDisc(state.board, color, move)!.board, other, color),
      }));
      const best = Math.max(...options.map(({ value }) => value));
      const selected = options.find(({ move }) => move.row === chosen!.row && move.col === chosen!.col);
      expect(selected?.value, `seed ${seed}: exact best=${best}`).toBe(best);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  }, 30_000);

  it('prints the historical seed-6 endgame regression fixture', () => {
    const state = randomReachableState(6 * 104729, 7);
    const color = state.currentColor;
    const oldMove = legacyVeryHardMove(state);
    const fixedMove = chooseReversiCpuMove(state, 'very-hard', randomFor(6))!;
    const options = getValidMoves(state.board, color).map((move) => ({
      move: `${move.row}:${move.col}`,
      exact: exactValue(placeDisc(state.board, color, move)!.board, oppositeColor(color), color),
    }));
    console.log('REVERSI_SEED_6_FIXTURE', JSON.stringify({
      board: state.board.map((row) => row.map((disc) => disc === 'black' ? 'B' : disc === 'white' ? 'W' : '.').join('')),
      currentColor: color,
      oldMove,
      fixedMove: { row: fixedMove.row, col: fixedMove.col },
      options,
    }));
    expect(options.find(({ move }) => move === `${fixedMove.row}:${fixedMove.col}`)?.exact).toBe(
      Math.max(...options.map(({ exact }) => exact)),
    );
  });

  it('prints paired adjacent-level results and cinematic frequency', () => {
    const stats: Record<string, { upperPoints: number; games: number; upperWins: number; lowerWins: number; draws: number }> = {};
    const cutins: number[] = [];
    const grandFlips: number[] = [];
    const passes: number[] = [];
    for (let pair = 0; pair < LEVELS.length - 1; pair += 1) {
      const lower = LEVELS[pair];
      const upper = LEVELS[pair + 1];
      const label = `${upper} vs ${lower}`;
      stats[label] = { upperPoints: 0, games: 0, upperWins: 0, lowerWins: 0, draws: 0 };
      for (let seed = 1; seed <= 6; seed += 1) {
        const opening = randomReachableState(seed * 15485863 + pair * 97, 54);
        for (const upperColor of ['black', 'white'] as const) {
          const result = playFrom(
            opening,
            upperColor === 'black' ? upper : lower,
            upperColor === 'white' ? upper : lower,
            seed * 1009 + pair * 31 + (upperColor === 'black' ? 0 : 1),
          );
          const upperScore = result[upperColor];
          const lowerScore = result[oppositeColor(upperColor)];
          stats[label].games += 1;
          if (upperScore > lowerScore) {
            stats[label].upperWins += 1;
            stats[label].upperPoints += 1;
          } else if (upperScore < lowerScore) {
            stats[label].lowerWins += 1;
          } else {
            stats[label].draws += 1;
            stats[label].upperPoints += 0.5;
          }
          cutins.push(result.cutins);
          grandFlips.push(result.grandFlips);
          passes.push(result.passes);
        }
      }
    }
    console.log('REVERSI_AUDIT_STATS', JSON.stringify({ stats, cutins, grandFlips, passes }));
    expect(cutins).toHaveLength(48);
  }, 90_000);
});
