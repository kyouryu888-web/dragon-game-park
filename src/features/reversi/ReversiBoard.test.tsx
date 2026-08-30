import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReversiBoard } from './ReversiBoard';
import { createPlacementBoard } from './reversiAnimation';
import { createInitialReversiState, getValidMoves } from './reversiRules';

describe('ReversiBoard', () => {
  it('64マスと初期4合法手をアクセシブルなボタンとして描画する', () => {
    const state = createInitialReversiState({
      mode: 'local',
      name: '',
      name2: '',
      cpuLevel: 'normal',
      humanSide: 'black',
    }, () => 0.2);
    const html = renderToStaticMarkup(
      <ReversiBoard
        state={state}
        validMoves={getValidMoves(state.board, state.currentColor)}
        interactive
        showHints
        onMove={vi.fn()}
      />,
    );

    expect(html.match(/role="gridcell"/g)).toHaveLength(64);
    expect(html.match(/class="reversi-cell is-valid"/g)).toHaveLength(4);
    expect(html).toContain('8かける8のリバーシ盤');
    expect(html).toContain('黒を置くと1枚返せる');
  });

  it('着手石と反転中の石を別のアニメーション状態で描画する', () => {
    const state = createInitialReversiState({
      mode: 'local',
      name: '黒',
      name2: '白',
      cpuLevel: 'normal',
      humanSide: 'black',
    }, () => 0.2);
    const move = { row: 2, col: 3 };
    const placedBoard = createPlacementBoard(state.board, 'black', move);
    const placing = renderToStaticMarkup(
      <ReversiBoard
        state={state}
        displayBoard={placedBoard}
        playback={{ phase: 'placing', placed: move, activeFlips: [], color: 'black' }}
        validMoves={[]}
        interactive={false}
        showHints
        onMove={vi.fn()}
      />,
    );
    expect(placing).toContain('reversi-disc is-black is-placing');

    const flippedBoard = placedBoard.map((row) => [...row]);
    flippedBoard[3][3] = 'black';
    const flipping = renderToStaticMarkup(
      <ReversiBoard
        state={state}
        displayBoard={flippedBoard}
        playback={{ phase: 'flipping', placed: move, activeFlips: [{ row: 3, col: 3 }], color: 'black' }}
        validMoves={[]}
        interactive={false}
        showHints
        onMove={vi.fn()}
      />,
    );
    expect(flipping).toContain('reversi-disc-flipper is-flipping');
    expect(flipping).toContain('reversi-disc-face is-front is-white');
    expect(flipping).toContain('reversi-disc-face is-back is-black');
  });
});
