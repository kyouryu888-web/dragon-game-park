import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decideDragonReaction } from '../../components/dragonReactions';
import { BabanukiShuffleCutin, BABANUKI_SHUFFLE_CUTIN_MS } from './BabanukiShuffleCutin';
import { DiceResultPanel } from './BabanukiShufflePanel';
import { detectBabanukiShuffleAnnouncement } from './babanukiDragonReactions';
import { DICE_MS, eventDuration, SHUFFLE_MS } from './babanukiPlayback';
import type { BabanukiPlayer } from './babanukiTypes';

const human: BabanukiPlayer = { id: 'human', name: 'あおい', isCpu: false, cpuLevel: 'normal', hand: [], spotlightCardId: null, finishedRank: null, shuffleRight: true };
const cpu: BabanukiPlayer = { ...human, id: 'cpu', name: '白銀ドラゴン', isCpu: true };

describe('Babanuki presentation preserves public playback', () => {
  it('shows cosmetic shuffle art only for dice 3 in lively mode', () => {
    expect(renderToStaticMarkup(<BabanukiShuffleCutin dice={3} actor={cpu} />)).toContain('babanuki-shuffle-cutin');
    for (const dice of [1, 2, 4, 5, 6]) {
      expect(renderToStaticMarkup(<BabanukiShuffleCutin dice={dice} actor={cpu} />)).toBe('');
    }
    for (const preference of ['subtle', 'off'] as const) {
      expect(renderToStaticMarkup(<BabanukiShuffleCutin dice={3} actor={cpu} preference={preference} />)).toBe('');
    }
  });

  it('fits the 700ms cosmetic beat within existing motion instead of adding a game wait', () => {
    expect(BABANUKI_SHUFFLE_CUTIN_MS).toBe(700);
    expect(BABANUKI_SHUFFLE_CUTIN_MS).toBeLessThan(SHUFFLE_MS);
    expect(DICE_MS).toBe(1700);
    expect(eventDuration({ kind: 'shuffle', dice: 3, declarerId: 'human', mapping: {} })).toBe(3000);
    expect(eventDuration({ kind: 'shuffle', dice: 4, declarerId: 'human', mapping: {} })).toBe(1750);
  });

  it('keeps declaration commentary beside the public die panel for CPU and human actors', () => {
    for (const player of [human, cpu]) {
      const reaction = decideDragonReaction(detectBabanukiShuffleAnnouncement(player.id, [player], 'room', 1)[0]);
      const html = renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={player.name} reaction={reaction} />);
      expect(html).toContain('シャッフル');
      expect(html).toContain('全員 → 中央 → ランダム再配布');
      expect(html).toContain(player.isCpu ? 'babanuki-declaration-dragon' : 'data-presenter="narrator"');
      expect(html).not.toContain('joker');
      const moving = renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={player.name} stage="moving" reaction={reaction} />);
      expect(moving).not.toContain('babanuki-declaration-dragon');
      expect(moving).not.toContain('data-presenter="narrator"');
      const off = renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={player.name} reaction={reaction} preference="off" />);
      expect(off).toContain('全員 → 中央 → ランダム再配布');
      expect(off).not.toContain('data-presenter="narrator"');
    }
  });
});

 describe('Babanuki dice-stage image preparation', () => {
  it('preloads only the declared CPU level during the existing dice-3 stage', () => {
    const html = renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={cpu.name} actor={cpu} />);
    expect(html).toContain('rel="preload"');
    expect(html).toContain('lv3-shuffle.webp');
    for (const level of [1, 2, 4, 5]) expect(html).not.toContain(`lv${level}-shuffle.webp`);
    expect(renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={cpu.name} actor={cpu} stage="moving" />)).not.toContain('rel="preload"');
    for (const preference of ['subtle', 'off'] as const) {
      expect(renderToStaticMarkup(<DiceResultPanel dice={3} declarerName={cpu.name} actor={cpu} preference={preference} />)).not.toContain('rel="preload"');
    }
    expect(renderToStaticMarkup(<DiceResultPanel dice={4} declarerName={cpu.name} actor={cpu} />)).not.toContain('rel="preload"');
  });
});
