import { describe, expect, it } from 'vitest';
import { decideDragonReaction } from '../../components/dragonReactions';
import type { BabanukiPlayer } from './babanukiTypes';
import { detectBabanukiDragonReactions, detectBabanukiShuffleAnnouncement } from './babanukiDragonReactions';

const players: BabanukiPlayer[] = [
  { id: 'player-1', name: 'You', isCpu: false, cpuLevel: 'normal', hand: [], spotlightCardId: null, finishedRank: null, shuffleRight: true },
  { id: 'player-2', name: '赤ドラゴン', isCpu: true, cpuLevel: 'easy', hand: [], spotlightCardId: null, finishedRank: null, shuffleRight: true },
];

describe('Babanuki public dragon cues', () => {
  it('announces the public draw identically for any secret card and position', () => {
    const published = { kind: 'draw' as const, fromId: 'player-2', toId: 'player-1', fromIndex: 0, cardId: 'ordinary-secret' };
    const result = detectBabanukiDragonReactions(published, players, 'shared-room', 200);
    expect(result).toMatchObject([{ kind: 'babanuki-draw', presenter: 'narrator', factLabel: '1枚引きます', priority: 1 }]);
    for (const cardId of ['joker-secret', 'ordinary-secret']) {
      for (const fromIndex of [0, 8]) {
        expect(detectBabanukiDragonReactions({ ...published, cardId, fromIndex }, players, 'shared-room', 200)).toEqual(result);
      }
    }
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(decideDragonReaction(result[0]).speech).toBe('1枚引きます');
  });

  it('reacts identically when hidden hands or shuffle mapping differ', () => {
    const shuffled = { kind: 'shuffle' as const, declarerId: 'player-2', dice: 4, mapping: { 'player-1': 'player-2' } };
    const changedPlayers = players.map(player => ({ ...player, hand: [{ id: 'private', suit: 'joker' as const, rank: 0 }], spotlightCardId: 'private' }));
    const result = detectBabanukiDragonReactions(shuffled, players, 'shared-room', 301);
    expect(result).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2', level: 2 }),
      outcome: 'disadvantage', factLabel: '出目4、札の移動なし',
    })]);
    expect(detectBabanukiDragonReactions({ ...shuffled, mapping: {} }, changedPlayers, 'shared-room', 301)).toEqual(result);
    expect(detectBabanukiShuffleAnnouncement('player-2', players, 'shared-room', 299)[0].factLabel).toBe('シャッフル宣言');
  });

  it('keeps dice-3 shuffle commentary equal across private exchanges', () => {
    const published = { kind: 'shuffle' as const, declarerId: 'player-1', dice: 3, mapping: {} };
    const allHuman = players.map(player => ({ ...player, isCpu: false }));
    const result = detectBabanukiDragonReactions(published, allHuman, 'shared-room', 302);
    expect(result).toMatchObject([{ presenter: 'narrator', priority: 3, factLabel: '出目3でシャッフル' }]);
    expect(detectBabanukiDragonReactions({ ...published, mapping: { 'player-1': 'player-2', 'player-2': 'player-1' } }, allHuman, 'shared-room', 302)).toEqual(result);
    expect(decideDragonReaction(result[0]).acting).toBe('sincere');
  });

  it('uses only published pair, rank, and loser events', () => {
    expect(detectBabanukiDragonReactions({ kind: 'discard-pair', playerId: 'player-2', cardIds: ['private-a', 'private-b'] }, players, 'shared-room', 401)[0].kind).toBe('babanuki-pair');
    expect(detectBabanukiDragonReactions({ kind: 'finish', playerId: 'player-2', rank: 1 }, players, 'shared-room', 402)[0].factLabel).toBe('1位で勝ち抜け');
    expect(detectBabanukiDragonReactions({ kind: 'game-end', loserId: 'player-2' }, players, 'shared-room', 403)[0].outcome).toBe('defeat');
  });

  it('provides neutral public commentary for human-only games and ignores unknown actors', () => {
    const allHuman = players.map(player => ({ ...player, isCpu: false }));
    const announcement = detectBabanukiShuffleAnnouncement('player-1', allHuman, 'humans', 1)[0];
    expect(announcement).toMatchObject({ presenter: 'narrator', factLabel: 'シャッフル宣言' });
    expect(announcement.cpu.id).not.toBe('player-1');
    const finished = detectBabanukiDragonReactions({ kind: 'finish', playerId: 'player-1', rank: 2 }, allHuman, 'humans', 2)[0];
    expect(decideDragonReaction(finished).speech).toBe('2位で勝ち抜け');
    expect(detectBabanukiShuffleAnnouncement('missing-player', players, 'humans', 3)).toEqual([]);
    expect(detectBabanukiDragonReactions({ kind: 'initial-discard', playerId: 'player-1', cardIds: ['private'] }, allHuman, 'humans', 0)).toEqual([]);
  });
});
