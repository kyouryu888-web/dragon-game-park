import { getPreviousDiscColor, type ReversiPlaybackVisual } from './reversiAnimation';
import type { DiscColor, ReversiBoard as ReversiBoardState, ReversiGameState, ReversiMove, ReversiMoveOption } from './reversiTypes';

type Props = {
  state: ReversiGameState;
  displayBoard?: ReversiBoardState;
  playback?: ReversiPlaybackVisual | null;
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

export function ReversiBoard({ state, displayBoard = state.board, playback = null, validMoves, interactive, showHints, onMove }: Props) {
  const validMoveMap = new Map(validMoves.map((move) => [moveKey(move), move]));
  const activeFlipKeys = new Set(playback?.activeFlips.map(moveKey) ?? []);
  const placedKey = playback ? moveKey(playback.placed) : null;
  const lastMoveKey = placedKey ?? (state.lastMove ? moveKey(state.lastMove) : null);

  return (
    <div className="reversi-board-frame">
      <div className="reversi-board" role="grid" aria-label="8かける8のリバーシ盤">
        {displayBoard.flatMap((row, rowIndex) => row.map((disc, colIndex) => {
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
              {disc ? activeFlipKeys.has(key) ? (
                <span aria-hidden="true" className="reversi-disc reversi-disc-flipper is-flipping">
                  <span className={`reversi-disc-face is-front is-${getPreviousDiscColor(disc)}`} />
                  <span className={`reversi-disc-face is-back is-${disc}`} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`reversi-disc is-${disc}${placedKey === key && playback?.phase === 'placing' ? ' is-placing' : ''}`}
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
