import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UnoPresentationPreload } from './UnoPresentationPreload';
import type { UnoPlayer } from './unoTypes';

const players: UnoPlayer[] = [
  { id: 'human', name: 'あおい', isCpu: false, isEliminated: false },
  { id: 'cpu-a', name: '白銀1', isCpu: true, cpuLevel: 'normal', isEliminated: false },
  { id: 'cpu-b', name: '白銀2', isCpu: true, cpuLevel: 'normal', isEliminated: false },
];

describe('UNO participating-level art preparation', () => {
  it('preloads one shared scene for duplicate CPU levels rather than all five levels', () => {
    const html = renderToStaticMarkup(<UnoPresentationPreload players={players} preference="lively" />);
    expect(html.match(/lv3-counter.webp/g)).toHaveLength(1);
    for (const level of [1, 2, 4, 5]) expect(html).not.toContain(`lv${level}-counter.webp`);
    expect(html).toContain('as="image"');
  });
  it('does not preload CPU images for human-only games or off preference', () => {
    expect(renderToStaticMarkup(<UnoPresentationPreload players={[players[0]]} preference="lively" />)).toBe('');
    expect(renderToStaticMarkup(<UnoPresentationPreload players={players} preference="off" />)).toBe('');
  });
});
