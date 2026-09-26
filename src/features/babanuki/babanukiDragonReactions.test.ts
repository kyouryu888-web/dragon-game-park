import { describe, expect, it } from 'vitest';
import type { BabanukiPlayer } from './babanukiTypes';
import { detectBabanukiDragonReactions, detectBabanukiShuffleAnnouncement } from './babanukiDragonReactions';

const players: BabanukiPlayer[] = [
  { id: 'player-1', name: 'You', isCpu: false, cpuLevel: 'normal', hand: [], spotlightCardId: null, finishedRank: null, shuffleRight: true },
  { id: 'player-2', name: '赤ドラゴン', isCpu: true, cpuLevel: 'easy', hand: [], spotlightCardId: null, finishedRank: null, shuffleRight: true },
];

describe('Babanuki public dragon cues', () => {
  it('does not reveal the identity or value of a drawn card', () => {
    for (const cardId of ['joker-secret', 'ordinary-secret']) {
      expect(detectBabanukiDragonReactions({
        kind: 'draw', fromId: 'player-2', toId: 'player-1', fromIndex: 0, cardId,
      }, players, 'shared-room', 200)).toEqual([]);
    }
  });

  it('reacts identically when hidden hands or shuffle mapping differ', () => {
    const shuffled = { kind: 'shuffle' as const, declarerId: 'player-2', dice: 4, mapping: { 'player-1': 'player-2' } };
    const changedPlayers = players.map(player => ({ ...player, hand: [{ id: 'private', suit: 'joker' as const, rank: 0 }] }));
    const result = detectBabanukiDragonReactions(shuffled, players, 'shared-room', 301);
    expect(result).toEqual([expect.objectContaining({
      cpu: expect.objectContaining({ id: 'player-2', level: 2 }),
      outcome: 'disadvantage', factLabel: '出目4、札の移動なし',
    })]);
    expect(detectBabanukiDragonReactions({ ...shuffled, mapping: {} }, changedPlayers, 'shared-room', 301)).toEqual(result);
    expect(detectBabanukiShuffleAnnouncement('player-2', players, 'shared-room', 299)[0].factLabel).toBe('シャッフル宣言');
  });

  it('uses only published pair, rank, and loser events', () => {
    expect(detectBabanukiDragonReactions({ kind: 'discard-pair', playerId: 'player-2', cardIds: ['private-a', 'private-b'] }, players, 'shared-room', 401)[0].kind).toBe('babanuki-pair');
    expect(detectBabanukiDragonReactions({ kind: 'finish', playerId: 'player-2', rank: 1 }, players, 'shared-room', 402)[0].factLabel).toBe('1位で勝ち抜け');
    expect(detectBabanukiDragonReactions({ kind: 'game-end', loserId: 'player-2' }, players, 'shared-room', 403)[0].outcome).toBe('defeat');
  });
});
