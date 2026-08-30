import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReversiBoard } from './ReversiBoard';
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
});
