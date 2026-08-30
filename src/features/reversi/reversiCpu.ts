import {
  countReversiDiscs,
  getValidMoves,
  oppositeColor,
  placeDisc,
} from './reversiRules';
import type {
  DiscColor,
  ReversiBoard,
  ReversiCpuLevel,
  ReversiGameState,
  ReversiMoveOption,
} from './reversiTypes';

const POSITION_WEIGHTS = [
  [120, -30, 20, 8, 8, 20, -30, 120],
  [-30, -55, -8, -8, -8, -8, -55, -30],
  [20, -8, 15, 3, 3, 15, -8, 20],
  [8, -8, 3, 3, 3, 3, -8, 8],
  [8, -8, 3, 3, 3, 3, -8, 8],
  [20, -8, 15, 3, 3, 15, -8, 20],
  [-30, -55, -8, -8, -8, -8, -55, -30],
  [120, -30, 20, 8, 8, 20, -30, 120],
] as const;

function chooseRandom<T>(items: T[], random: () => number): T | null {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function positionScore(move: ReversiMoveOption): number {
  return POSITION_WEIGHTS[move.row][move.col];
}

function frontierCount(board: ReversiBoard, color: DiscColor): number {
  let count = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col] !== color) continue;
      let frontier = false;
      for (let rowDelta = -1; rowDelta <= 1 && !frontier; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
          const nextRow = row + rowDelta;
          const nextCol = col + colDelta;
          if (
            nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8
            && board[nextRow][nextCol] === null
          ) {
            frontier = true;
            break;
          }
        }
      }
      if (frontier) count += 1;
    }
  }
  return count;
}

export function evaluateReversiBoard(board: ReversiBoard, perspective: DiscColor): number {
  const opponent = oppositeColor(perspective);
  const score = countReversiDiscs(board);
  const myCount = score[perspective];
  const opponentCount = score[opponent];
  const occupied = 64 - score.empty;
  const discWeight = occupied < 48 ? 1 : occupied < 58 ? 4 : 12;

  let positional = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col] === perspective) positional += POSITION_WEIGHTS[row][col];
      else if (board[row][col] === opponent) positional -= POSITION_WEIGHTS[row][col];
    }
  }

  const mobility = getValidMoves(board, perspective).length - getValidMoves(board, opponent).length;
  const frontier = frontierCount(board, opponent) - frontierCount(board, perspective);
  return positional * 3 + mobility * 12 + frontier * 4 + (myCount - opponentCount) * discWeight;
}

function applyOption(board: ReversiBoard, color: DiscColor, option: ReversiMoveOption): ReversiBoard {
  return placeDisc(board, color, option)!.board;
}

function minimax(
  board: ReversiBoard,
  colorToMove: DiscColor,
  perspective: DiscColor,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = getValidMoves(board, colorToMove);
  const opponent = oppositeColor(colorToMove);

  if (moves.length === 0) {
    const opponentMoves = getValidMoves(board, opponent);
    if (opponentMoves.length === 0) {
      const score = countReversiDiscs(board);
      const difference = score[perspective] - score[oppositeColor(perspective)];
      return difference === 0 ? 0 : Math.sign(difference) * 1_000_000 + difference;
    }
    // depth は「残り着手数」。パスは石を置かないので読みの深さを消費しない。
    return minimax(board, opponent, perspective, depth, alpha, beta);
  }

  if (depth <= 0) return evaluateReversiBoard(board, perspective);

  const maximizing = colorToMove === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  const ordered = [...moves].sort((a, b) => positionScore(b) - positionScore(a));

  for (const move of ordered) {
    const nextBoard = applyOption(board, colorToMove, move);
    const value = minimax(nextBoard, opponent, perspective, depth - 1, alpha, beta);
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

function chooseHighestScoring(
  moves: ReversiMoveOption[],
  scoreMove: (move: ReversiMoveOption) => number,
  random: () => number,
): ReversiMoveOption | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestMoves: ReversiMoveOption[] = [];
  for (const move of moves) {
    const score = scoreMove(move);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return chooseRandom(bestMoves, random);
}

export function chooseReversiCpuMove(
  state: ReversiGameState,
  level: ReversiCpuLevel,
  random: () => number = Math.random,
): ReversiMoveOption | null {
  if (state.status !== 'playing') return null;
  const color = state.currentColor;
  const moves = getValidMoves(state.board, color);
  if (moves.length === 0) return null;

  if (level === 'very-easy') return chooseRandom(moves, random);

  if (level === 'easy') {
    return chooseHighestScoring(moves, (move) => move.flips.length, random);
  }

  if (level === 'normal') {
    return chooseHighestScoring(moves, (move) => {
      const nextBoard = applyOption(state.board, color, move);
      const opponentMobility = getValidMoves(nextBoard, oppositeColor(color)).length;
      return positionScore(move) * 5 + move.flips.length * 2 - opponentMobility * 8;
    }, random);
  }

  const empty = countReversiDiscs(state.board).empty;
  const depth = level === 'hard'
    ? 3
    : empty <= 8 ? empty + 1 : 4;

  return chooseHighestScoring(moves, (move) => {
    const nextBoard = applyOption(state.board, color, move);
    return minimax(
      nextBoard,
      oppositeColor(color),
      color,
      depth - 1,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
  }, random);
}
