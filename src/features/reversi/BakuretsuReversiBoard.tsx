import { useState, type CSSProperties } from 'react';
import { idx } from './bakuretsu/rules.ts';
import type { BoardCell, GameState, Move, PlayerId, Side, SpecialType } from './bakuretsu/types.ts';
import type { BakuretsuPlaybackStep } from './bakuretsuPlayback';
import {
  BAKURETSU_SPECIAL_LABEL,
  BAKURETSU_SPECIAL_NAME,
  hintCountForChoice,
  neutralWallBlockers,
  type BakuretsuPieceChoice,
} from './bakuretsuUi';

function ownerClass(owner: PlayerId, specialType: SpecialType): string {
  if (specialType === 'NEUTRAL' || owner === 'NONE') return 'is-neutral';
  return owner === 'BLACK' ? 'is-black' : 'is-white';
}

function ownerName(owner: PlayerId): string {
  if (owner === 'BLACK') return '黒';
  if (owner === 'WHITE') return '白';
  return '中立';
}

function specialMark(specialType: SpecialType | undefined) {
  if (!specialType || specialType === 'NONE' || specialType === 'DUMMY') return null;
  return <span className="bakuretsu-special-mark">{BAKURETSU_SPECIAL_LABEL[specialType]}</span>;
}

function Disc({
  cell,
  index,
  playback,
}: {
  cell: BoardCell;
  index: number;
  playback: BakuretsuPlaybackStep | null;
}) {
  if (cell.state === 'EMPTY') return null;
  const isFlip = playback?.phase === 'flipping' && playback.activeIndices.includes(index);
  const isShield = playback?.shieldIndices.includes(index) ?? false;
  const placed = playback?.phase === 'placing' && playback.activeIndices.includes(index);
  const className = ownerClass(cell.owner, cell.specialType);

  if (isFlip && playback?.flipTo) {
    const frontClass = ownerClass(playback.flipFrom ?? 'NONE', playback.special ?? 'NONE');
    const backClass = playback.flipTo === 'BLACK' ? 'is-black' : 'is-white';
    return (
      <span aria-hidden="true" className="reversi-disc reversi-disc-flipper is-flipping">
        <span className={`reversi-disc-face is-front ${frontClass}`}>{specialMark(playback.special)}</span>
        <span className={`reversi-disc-face is-back ${backClass}`} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`reversi-disc bakuretsu-disc ${className}${placed ? ' is-placing' : ''}${isShield ? ' is-shield-stopping' : ''}`}
    >
      {specialMark(isShield ? 'SHIELD' : cell.specialType)}
    </span>
  );
}

export function BakuretsuReversiBoard({
  viewer,
  state,
  displayBoard,
  playback,
  choice,
  validMoves,
  interactive,
  showHints,
  onMove,
}: {
  viewer: Side;
  state: GameState;
  displayBoard: BoardCell[];
  playback: BakuretsuPlaybackStep | null;
  choice: BakuretsuPieceChoice;
  validMoves: Move[];
  interactive: boolean;
  showHints: boolean;
  onMove: (move: Move) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const validMoveMap = new Map(validMoves.map((move) => [idx(move.x, move.y), move]));
  const blockedWalls = new Set(previewIndex === null ? [] : neutralWallBlockers(
    state.board,
    previewIndex % 8,
    Math.floor(previewIndex / 8),
    state.currentTurn,
  ));
  const lastMoveIndex = playback?.placedIdx ?? -1;

  return (
    <div className="reversi-board-frame bakuretsu-board-frame">
      <div className="reversi-board" role="grid" aria-label="8かける8の爆裂リバーシ盤">
        {displayBoard.map((rawCell, index) => {
          const isHiddenSpecial = rawCell.owner !== viewer && rawCell.owner !== 'NONE' && rawCell.specialType !== 'NONE';
          const cell = isHiddenSpecial ? { ...rawCell, specialType: 'NONE' as SpecialType } : rawCell;
          const x = index % 8;
          const y = Math.floor(index / 8);
          const coordinate = `${String.fromCharCode(65 + x)}${y + 1}`;
          const validMove = validMoveMap.get(index);
          const canPlace = Boolean(validMove) && interactive;
          const specialName = cell.specialType !== 'NONE' && cell.specialType !== 'DUMMY'
            ? `、${BAKURETSU_SPECIAL_NAME[cell.specialType]}`
            : '';
          const hint = validMove ? hintCountForChoice(state, choice, x, y) : 0;
          const label = cell.state !== 'EMPTY'
            ? `${coordinate}、${ownerName(cell.owner)}のコマ${specialName}`
            : validMove
              ? `${coordinate}、${choice === 'NORMAL' ? '通常コマ' : BAKURETSU_SPECIAL_NAME[choice]}を置く、反転${hint}枚`
              : `${coordinate}、空き`;
          const destroyed = playback?.destroyedIndices.includes(index) ?? false;
          const spared = playback?.sparedIndices.includes(index) ?? false;
          const infected = playback?.phase === 'special-resolve'
            && playback.special === 'INFECT'
            && playback.activeIndices.slice(1).includes(index);
          const infectionSource = playback?.activeIndices[0] ?? index;
          const infectionStyle = infected ? {
            '--bakuretsu-infect-x': `${(infectionSource % 8 - x) * 100}%`,
            '--bakuretsu-infect-y': `${(Math.floor(infectionSource / 8) - y) * 100}%`,
          } as CSSProperties : undefined;
          const origin = playback?.activeIndices[0] === index
            && (playback.phase === 'special-highlight' || playback.phase === 'special-resolve');

          return (
            <button
              type="button"
              role="gridcell"
              key={index}
              className={`reversi-cell${validMove ? ' is-valid' : ''}${lastMoveIndex === index ? ' is-last' : ''}${blockedWalls.has(index) ? ' is-wall-blocking' : ''}${destroyed ? ' is-bakuretsu-destroyed' : ''}${spared ? ' is-bakuretsu-spared' : ''}${infected ? ' is-bakuretsu-infected' : ''}${origin ? ' is-bakuretsu-origin' : ''}`}
              disabled={!canPlace}
              aria-label={label}
              data-coordinate={coordinate}
              data-owner={cell.owner}
              data-special={cell.specialType}
              data-wall={cell.specialType === 'NEUTRAL' ? 'true' : undefined}
              style={infectionStyle}
              onMouseEnter={() => setPreviewIndex(index)}
              onMouseLeave={() => setPreviewIndex(null)}
              onFocus={() => setPreviewIndex(index)}
              onBlur={() => setPreviewIndex(null)}
              onClick={() => validMove && onMove(validMove)}
            >
              <Disc cell={cell} index={index} playback={playback} />
              {cell.state === 'EMPTY' && validMove && showHints ? (
                <span className="reversi-legal-marker" aria-hidden="true">
                  <span>{choice === 'NEUTRAL' ? '壁' : hint}</span>
                </span>
              ) : null}
              {origin && playback?.special ? (
                <span className={`bakuretsu-effect-origin is-${playback.special.toLowerCase()}`} aria-hidden="true">
                  {playback.special === 'BOMB' ? '爆' : '染'}
                </span>
              ) : null}
              {lastMoveIndex === index ? <span className="reversi-last-marker" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {blockedWalls.size > 0 ? (
        <div className="bakuretsu-wall-callout" role="status">中立の壁でこの方向は止まります</div>
      ) : null}
    </div>
  );
}
