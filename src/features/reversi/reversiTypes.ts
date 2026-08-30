export type DiscColor = 'black' | 'white';
export type Disc = DiscColor | null;
export type ReversiBoard = Disc[][];

export type ReversiMove = {
  row: number;
  col: number;
};

export type ReversiMoveOption = ReversiMove & {
  flips: ReversiMove[];
};

export type ReversiCpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';
export type ReversiMode = 'cpu' | 'local';
export type ReversiSideChoice = DiscColor | 'random';

export type ReversiConfig = {
  mode: ReversiMode;
  name: string;
  name2: string;
  cpuLevel: ReversiCpuLevel;
  humanSide: ReversiSideChoice;
};

export type ReversiPlayer = {
  color: DiscColor;
  name: string;
  isCpu: boolean;
  cpuLevel?: ReversiCpuLevel;
};

export type ReversiGameStatus = 'playing' | 'finished';

export type ReversiGameState = {
  gameId: string;
  board: ReversiBoard;
  status: ReversiGameStatus;
  currentColor: DiscColor;
  players: Record<DiscColor, ReversiPlayer>;
  winner: DiscColor | 'draw' | null;
  lastMove: ReversiMove | null;
  lastMoveColor: DiscColor | null;
  lastFlipped: ReversiMove[];
  lastFlipCount: number;
  passedColor: DiscColor | null;
  turnCount: number;
};

export type ReversiScore = Record<DiscColor, number> & { empty: number };
