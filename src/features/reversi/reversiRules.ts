import type {
  DiscColor,
  ReversiBoard,
  ReversiConfig,
  ReversiGameState,
  ReversiMove,
  ReversiMoveOption,
  ReversiScore,
} from './reversiTypes';

export const REVERSI_BOARD_SIZE = 8;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],             [0, 1],
  [1, -1],  [1, 0],   [1, 1],
];

export function oppositeColor(color: DiscColor): DiscColor {
  return color === 'black' ? 'white' : 'black';
}

export function createInitialReversiBoard(): ReversiBoard {
  const board: ReversiBoard = Array.from(
    { length: REVERSI_BOARD_SIZE },
    () => Array.from({ length: REVERSI_BOARD_SIZE }, () => null),
  );
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

export function cloneReversiBoard(board: ReversiBoard): ReversiBoard {
  return board.map((row) => [...row]);
}

function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < REVERSI_BOARD_SIZE && col >= 0 && col < REVERSI_BOARD_SIZE;
}

export function getFlipsForMove(
  board: ReversiBoard,
  color: DiscColor,
  row: number,
  col: number,
): ReversiMove[] {
  if (!isInsideBoard(row, col) || board[row]?.[col] !== null) return [];

  const opponent = oppositeColor(color);
  const flips: ReversiMove[] = [];

  for (const [rowDelta, colDelta] of DIRECTIONS) {
    const line: ReversiMove[] = [];
    let nextRow = row + rowDelta;
    let nextCol = col + colDelta;

    while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
      line.push({ row: nextRow, col: nextCol });
      nextRow += rowDelta;
      nextCol += colDelta;
    }

    if (line.length > 0 && isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === color) {
      flips.push(...line);
    }
  }

  return flips;
}

export function getValidMoves(board: ReversiBoard, color: DiscColor): ReversiMoveOption[] {
  const moves: ReversiMoveOption[] = [];
  for (let row = 0; row < REVERSI_BOARD_SIZE; row += 1) {
    for (let col = 0; col < REVERSI_BOARD_SIZE; col += 1) {
      const flips = getFlipsForMove(board, color, row, col);
      if (flips.length > 0) moves.push({ row, col, flips });
    }
  }
  return moves;
}

export function placeDisc(
  board: ReversiBoard,
  color: DiscColor,
  move: ReversiMove,
): { board: ReversiBoard; flips: ReversiMove[] } | null {
  const flips = getFlipsForMove(board, color, move.row, move.col);
  if (flips.length === 0) return null;

  const nextBoard = cloneReversiBoard(board);
  nextBoard[move.row][move.col] = color;
  for (const flipped of flips) nextBoard[flipped.row][flipped.col] = color;
  return { board: nextBoard, flips };
}

export function countReversiDiscs(board: ReversiBoard): ReversiScore {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const row of board) {
    for (const disc of row) {
      if (disc === 'black') black += 1;
      else if (disc === 'white') white += 1;
      else empty += 1;
    }
  }
  return { black, white, empty };
}

export function getReversiWinner(board: ReversiBoard): DiscColor | 'draw' {
  const score = countReversiDiscs(board);
  if (score.black === score.white) return 'draw';
  return score.black > score.white ? 'black' : 'white';
}

export function applyReversiMove(state: ReversiGameState, move: ReversiMove): ReversiGameState {
  if (state.status !== 'playing') return state;
  const placed = placeDisc(state.board, state.currentColor, move);
  if (!placed) return state;

  const movingColor = state.currentColor;
  const opponent = oppositeColor(movingColor);
  const score = countReversiDiscs(placed.board);
  const opponentMoves = score.empty > 0 ? getValidMoves(placed.board, opponent) : [];
  const currentMoves = score.empty > 0 && opponentMoves.length === 0
    ? getValidMoves(placed.board, movingColor)
    : [];
  const isFinished = score.empty === 0 || (opponentMoves.length === 0 && currentMoves.length === 0);
  const passedColor = !isFinished && opponentMoves.length === 0 ? opponent : null;

  return {
    ...state,
    board: placed.board,
    status: isFinished ? 'finished' : 'playing',
    currentColor: !isFinished && opponentMoves.length === 0 ? movingColor : opponent,
    winner: isFinished ? getReversiWinner(placed.board) : null,
    lastMove: { row: move.row, col: move.col },
    lastMoveColor: movingColor,
    lastFlipped: placed.flips,
    lastFlipCount: placed.flips.length,
    passedColor,
    turnCount: state.turnCount + 1,
  };
}

export function createInitialReversiState(
  config: ReversiConfig,
  random: () => number = Math.random,
): ReversiGameState {
  const humanColor: DiscColor = config.humanSide === 'random'
    ? random() < 0.5 ? 'black' : 'white'
    : config.humanSide;
  const challengerName = config.name.trim() || '挑戦者';
  const opponentName = config.name2.trim() || '対戦者';
  const cpuName = getReversiCpuName(config.cpuLevel);

  const blackIsCpu = config.mode === 'cpu' && humanColor === 'white';
  const whiteIsCpu = config.mode === 'cpu' && humanColor === 'black';
  const usesNamedHumanOpponent = config.mode === 'local' || config.mode === 'online';

  return {
    gameId: `reversi-${Date.now()}-${Math.floor(random() * 1_000_000)}`,
    board: createInitialReversiBoard(),
    status: 'playing',
    currentColor: 'black',
    players: {
      black: {
        color: 'black',
        name: usesNamedHumanOpponent ? challengerName : blackIsCpu ? cpuName : challengerName,
        isCpu: blackIsCpu,
        cpuLevel: blackIsCpu ? config.cpuLevel : undefined,
      },
      white: {
        color: 'white',
        name: usesNamedHumanOpponent ? opponentName : whiteIsCpu ? cpuName : challengerName,
        isCpu: whiteIsCpu,
        cpuLevel: whiteIsCpu ? config.cpuLevel : undefined,
      },
    },
    winner: null,
    lastMove: null,
    lastMoveColor: null,
    lastFlipped: [],
    lastFlipCount: 0,
    passedColor: null,
    turnCount: 0,
  };
}

export function getReversiCpuName(level: ReversiConfig['cpuLevel']): string {
  switch (level) {
    case 'very-easy': return 'ベビードラゴン';
    case 'easy': return 'ドラゴン';
    case 'normal': return 'スーパードラゴン';
    case 'hard': return 'ドラゴンキング';
    case 'very-hard': return 'ゴッドドラゴン';
  }
}

export function isCornerMove(move: ReversiMove): boolean {
  return (move.row === 0 || move.row === REVERSI_BOARD_SIZE - 1)
    && (move.col === 0 || move.col === REVERSI_BOARD_SIZE - 1);
}
