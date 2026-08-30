import type { DiscColor, ReversiGameState, ReversiMove, ReversiMoveOption } from './reversiTypes';

type Props = {
  state: ReversiGameState;
  validMoves: ReversiMoveOption[];
  interactive: boolean;
  showHints: boolean;
  onMove: (move: ReversiMove) => void;
};

function moveKey(move: ReversiMove): string {
  return `${move.row}:${move.col}`;
}

function colorLabel(color: DiscColor): string {
  return color === 'black' ? '黒' : '白';
}

export function ReversiBoard({ state, validMoves, interactive, showHints, onMove }: Props) {
  const validMoveMap = new Map(validMoves.map((move) => [moveKey(move), move]));
  const flippedKeys = new Set(state.lastFlipped.map(moveKey));
  const lastMoveKey = state.lastMove ? moveKey(state.lastMove) : null;

  return (
    <div className="reversi-board-frame">
      <div className="reversi-board" role="grid" aria-label="8かける8のリバーシ盤">
        {state.board.flatMap((row, rowIndex) => row.map((disc, colIndex) => {
          const key = `${rowIndex}:${colIndex}`;
          const validMove = validMoveMap.get(key);
          const coordinate = `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;
          const canPlace = Boolean(validMove) && interactive;
          const label = disc
            ? `${coordinate}、${colorLabel(disc)}の石`
            : validMove
              ? `${coordinate}、${colorLabel(state.currentColor)}を置くと${validMove.flips.length}枚返せる`
              : `${coordinate}、空き`;

          return (
            <button
              type="button"
              role="gridcell"
              key={key}
              className={`reversi-cell${validMove ? ' is-valid' : ''}${lastMoveKey === key ? ' is-last' : ''}`}
              disabled={!canPlace}
              aria-label={label}
              data-coordinate={coordinate}
              data-disc={disc ?? 'empty'}
              onClick={() => onMove({ row: rowIndex, col: colIndex })}
            >
              {disc ? (
                <span
                  aria-hidden="true"
                  className={`reversi-disc is-${disc}${flippedKeys.has(key) ? ' is-flipped' : ''}`}
                />
              ) : null}
              {validMove && showHints ? (
                <span className="reversi-legal-marker" aria-hidden="true">
                  <span>{validMove.flips.length}</span>
                </span>
              ) : null}
              {lastMoveKey === key ? <span className="reversi-last-marker" aria-hidden="true" /> : null}
            </button>
          );
        }))}
      </div>
    </div>
  );
}
