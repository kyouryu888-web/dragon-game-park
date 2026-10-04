import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GameCutinArtProps } from '../../components/dragonReactions/GameCutinArt';
import { UnoCinematicOverlay } from './UnoCinematicOverlay';
import { detectUnoCinematicEvents, type UnoDrawCounterEvent } from './unoCinematics';
import { createInitialUnoState } from './createInitialUnoState';

vi.mock('../../components/dragonReactions', async importOriginal => {
  const original = await importOriginal<typeof import('../../components/dragonReactions')>();
  return {
    ...original,
    GameCutinArt: (props: GameCutinArtProps) => props.preference === 'off' ? null : <div data-art-variant={props.variant} data-art-scene={props.scene} />,
  };
});

function counter(addedCount: number): UnoDrawCounterEvent {
  return { kind: 'draw-counter', key: `counter-${addedCount}`, playerId: 'player-2', playerName: '白銀ドラゴン', addedCount, totalCount: 2 + addedCount, cardName: `ドロー${addedCount}`, reversed: false };
}

describe('UNO action-specific art semantics', () => {
  it('reserves painted +2 scenes for an actual +2 counter', () => {
    expect(renderToStaticMarkup(<UnoCinematicOverlay event={counter(2)} />)).toContain('data-art-variant="counter-draw2"');
    for (const count of [4, 6, 10]) {
      const html = renderToStaticMarkup(<UnoCinematicOverlay event={counter(count)} />);
      expect(html).toContain('data-art-variant="counter"');
      expect(html).not.toContain('counter-draw2');
      expect(html).toContain(`ドロー${count}で返した！`);
      expect(html).toContain(`合計${2 + count}まい`);
      expect(html).toContain('--uno-cinematic-duration:2400ms');
    }
  });

  it('separates forced-draw and knockout art, and keeps the factual result when art is off', () => {
    const forced = { kind: 'forced-draw' as const, key: 'draw', playerId: 'player-1', playerName: 'あおい', count: 6 };
    expect(renderToStaticMarkup(<UnoCinematicOverlay event={forced} />)).toContain('data-art-variant="draw-rain"');
    const knockedOut = { kind: 'knockout' as const, key: 'ko', playerId: 'player-1', playerName: 'あおい', count: 10, cause: 'draw-stack' as const };
    expect(renderToStaticMarkup(<UnoCinematicOverlay event={knockedOut} />)).toContain('data-art-variant="knockout-pile"');
    const off = renderToStaticMarkup(<UnoCinematicOverlay event={forced} preference="off" />);
    expect(off).not.toContain('data-art-variant');
    expect(off).toContain('合計6まい引いた！');
    expect(off).toContain('--uno-cinematic-duration:2400ms');
  });

  it('does not replay a cutin after bootstrap, match change, rewind or reconnect gap', () => {
    const start = createInitialUnoState({ variant: 'hard', playerConfigs: [{ name: 'あおい', isCpu: false }, { name: '白銀', isCpu: true, cpuLevel: 'normal' }] });
    const before = { ...start, status: 'playing' as const, turnCount: 3, pendingDrawCount: 2 };
    const next = { ...before, pendingDrawCount: 4, turnCount: 4 };
    expect(detectUnoCinematicEvents(before, next)[0].kind).toBe('draw-counter');
    expect(detectUnoCinematicEvents({ ...before, status: 'starter-ready' }, next)).toEqual([]);
    expect(detectUnoCinematicEvents(before, { ...next, gameId: 'other-match' })).toEqual([]);
    expect(detectUnoCinematicEvents(before, { ...next, turnCount: 2 })).toEqual([]);
    expect(detectUnoCinematicEvents(before, { ...next, turnCount: 5 })).toEqual([]);
  });
});
