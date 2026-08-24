import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createHardDeck } from './unoDeck';
import { createInitialUnoState } from './createInitialUnoState';
import { UnoTableView } from './UnoTableView';

describe('UNO table layout contract', () => {
  it('keeps a large hand inside the dedicated play layout', () => {
    const initial = createInitialUnoState({
      variant: 'hard',
      playerConfigs: [
        { name: 'Player 1', isCpu: false },
        { name: 'CPU', isCpu: true, cpuLevel: 'normal' },
      ],
    });
    const hand = createHardDeck().slice(0, 24);
    const state = {
      ...initial,
      status: 'playing' as const,
      hands: { ...initial.hands, 'player-1': hand },
    };

    const html = renderToStaticMarkup(
      <UnoTableView
        state={state}
        currentPlayer={state.players[0]!}
        nextPlayerId="player-2"
        topCard={state.discardPile[0]!}
        currentHand={hand}
        playableIds={new Set(hand.map((card) => card.id))}
        canAct
        isCpuThinking={false}
        message="Your turn"
        onPlay={vi.fn()}
        onDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
      />,
    );

    expect(html).toContain('class="uno-play-layout ');
    expect(html).toContain('class="uno-board-column"');
    expect(html).toContain('class="uno-hand-scroll"');
    expect(html.match(/class="uno-hand-card is-playable"/g)).toHaveLength(24);
  });
});
