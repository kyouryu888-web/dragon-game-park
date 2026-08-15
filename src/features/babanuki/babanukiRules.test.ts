import { describe, expect, it } from 'vitest';
import type { BabanukiConfig, BabanukiPlayer, BabanukiState, Card, Suit } from './babanukiTypes';
import {
  buildShuffleMapping,
  canAnyoneDeclareShuffle,
  canDeclareShuffle,
  createBabanukiRematchState,
  createDeck,
  createInitialBabanukiState,
  declareShuffle,
  drawCard,
  getRightNeighborId,
  reorderHand,
  resolveShuffle,
  setSpotlight,
} from './babanukiRules';

function card(suit: Suit, rank: number): Card {
  return { id: `${suit}-${rank}`, suit, rank };
}

const joker: Card = { id: 'joker', suit: 'joker', rank: 0 };

function makePlayer(index: number, hand: Card[], extra: Partial<BabanukiPlayer> = {}): BabanukiPlayer {
  return {
    id: `player-${index}`,
    name: `P${index}`,
    isCpu: false,
    cpuLevel: 'normal',
    hand,
    spotlightCardId: null,
    finishedRank: null,
    shuffleRight: true,
    ...extra,
  };
}

function makeState(players: BabanukiPlayer[], extra: Partial<BabanukiState> = {}): BabanukiState {
  return {
    players,
    seatOrder: players.map((p) => p.id),
    currentPlayerId: players[0].id,
    phase: 'awaiting-draw',
    shuffleUsedThisTurn: false,
    pendingShuffle: null,
    discardPile: [],
    finishOrder: [],
    loserId: null,
    events: [],
    eventSeq: 0,
    ...extra,
  };
}

function makeConfig(playerCount: number): BabanukiConfig {
  return {
    playerCount,
    players: Array.from({ length: playerCount }, (_, i) => ({
      name: `P${i + 1}`,
      isCpu: i > 0,
      cpuLevel: 'normal' as const,
    })),
  };
}

/** 決まった順番の乱数を返す（テスト用） */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('createDeck', () => {
  it('52枚＋ジョーカーの53枚になる', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(53);
    expect(deck.filter((c) => c.suit === 'joker')).toHaveLength(1);
    expect(new Set(deck.map((c) => c.id)).size).toBe(53);
  });
});

describe('createInitialBabanukiState', () => {
  it('3〜6人で53枚すべてが手札か捨て札のどちらかになる', () => {
    for (let count = 3; count <= 6; count += 1) {
      const state = createInitialBabanukiState(makeConfig(count), Math.random);
      const inHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
      expect(inHands + state.discardPile.length).toBe(53);
      expect(state.players).toHaveLength(count);
    }
  });

  it('配り終えた時点で手札にペアが残っていない', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = createInitialBabanukiState(makeConfig(4), Math.random);
      for (const player of state.players) {
        const counts = new Map<number, number>();
        for (const c of player.hand) {
          if (c.suit === 'joker') continue;
          counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
        }
        for (const n of counts.values()) expect(n).toBeLessThan(2);
      }
    }
  });

  it('全員がシャッフルタイムの権利を1つ持って始まる', () => {
    const state = createInitialBabanukiState(makeConfig(5), Math.random);
    expect(state.players.every((p) => p.shuffleRight)).toBe(true);
  });
});

describe('ペアを捨てる処理', () => {
  it('同じ数字が3枚なら2枚だけ捨てて1枚残る', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 7), card('heart', 7), joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('diamond', 7), card('club', 9)]),
    ]);
    // player-1 が右隣 player-3 から ダイヤの7 を引く → 7が3枚になる
    const next = drawCard(state, 0);
    const hand = next.players[0].hand;
    expect(hand.filter((c) => c.rank === 7)).toHaveLength(1);
    expect(next.discardPile.filter((c) => c.rank === 7)).toHaveLength(2);
  });

  it('同じ数字が4枚なら2ペアとも捨てる', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 7), card('heart', 7), card('club', 7), joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('diamond', 7), card('club', 9)]),
    ]);
    const next = drawCard(state, 0);
    expect(next.players[0].hand.filter((c) => c.rank === 7)).toHaveLength(0);
    expect(next.discardPile.filter((c) => c.rank === 7)).toHaveLength(4);
  });

  it('ジョーカーは何とも揃わない', () => {
    const state = createInitialBabanukiState(makeConfig(3), Math.random);
    const jokerHolder = state.players.find((p) => p.hand.some((c) => c.suit === 'joker'));
    expect(jokerHolder).toBeDefined();
    expect(state.discardPile.some((c) => c.suit === 'joker')).toBe(false);
  });
});

describe('引く相手（右隣）', () => {
  it('右隣が勝ち抜け済みならさらにその先の残存プレイヤーになる', () => {
    const state = makeState([
      makePlayer(1, [joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('club', 9)]),
      makePlayer(4, [], { finishedRank: 1 }),
    ]);
    expect(getRightNeighborId(state, 'player-1')).toBe('player-3');
  });

  it('引かれて0枚になった人も即・勝ち抜けになる', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 2)]),
      makePlayer(2, [joker]),
      makePlayer(3, [card('heart', 2)]),
    ]);
    const next = drawCard(state, 0);
    const p3 = next.players[2];
    expect(p3.hand).toHaveLength(0);
    expect(p3.finishedRank).toBe(1);
    // 引いた側もペアが揃って0枚になったが、順位は引かれた側が先
    expect(next.players[0].finishedRank).toBe(2);
  });

  it('残り1人になったらその人が最弱王になる', () => {
    const state = makeState([
      makePlayer(1, [joker, card('spade', 2)]),
      makePlayer(2, [], { finishedRank: 1 }),
      makePlayer(3, [card('heart', 2)]),
    ]);
    const next = drawCard(state, 0);
    expect(next.phase).toBe('finished');
    expect(next.loserId).toBe('player-1');
    expect(next.events.some((e) => e.kind === 'game-end')).toBe(true);
  });
});

describe('シャッフルタイムの写像', () => {
  const state = makeState([
    makePlayer(1, [card('spade', 1)]),
    makePlayer(2, [card('spade', 2)]),
    makePlayer(3, [card('spade', 3)]),
    makePlayer(4, [card('spade', 4)]),
  ]);

  it('出目1は左隣へ、出目2は右隣へ渡す', () => {
    expect(buildShuffleMapping(state, 1)['player-1']).toBe('player-2');
    expect(buildShuffleMapping(state, 2)['player-1']).toBe('player-4');
  });

  it('出目5は2つ左隣へ、出目6は2つ右隣へ渡す', () => {
    expect(buildShuffleMapping(state, 5)['player-1']).toBe('player-3');
    expect(buildShuffleMapping(state, 6)['player-1']).toBe('player-3');
    expect(buildShuffleMapping(state, 5)['player-2']).toBe('player-4');
    expect(buildShuffleMapping(state, 6)['player-2']).toBe('player-4');
  });

  it('出目4は何も動かない', () => {
    const mapping = buildShuffleMapping(state, 4);
    for (const [from, to] of Object.entries(mapping)) expect(to).toBe(from);
  });

  it('出目3は残存プレイヤー全員の順列になる', () => {
    const mapping = buildShuffleMapping(state, 3, seqRng([0.42, 0.11, 0.87, 0.3]));
    const froms = Object.keys(mapping).sort();
    const tos = Object.values(mapping).sort();
    expect(tos).toEqual(froms);
  });

  it('勝ち抜け済みのプレイヤーは写像に含まれない', () => {
    const withFinished = makeState([
      makePlayer(1, [card('spade', 1)]),
      makePlayer(2, [], { finishedRank: 1 }),
      makePlayer(3, [card('spade', 3)]),
      makePlayer(4, [card('spade', 4)]),
    ]);
    const mapping = buildShuffleMapping(withFinished, 1);
    expect(Object.keys(mapping)).toEqual(['player-1', 'player-3', 'player-4']);
    expect(mapping['player-1']).toBe('player-3');
  });
});

describe('シャッフルタイムの発動条件', () => {
  it('残り2名になったら誰も宣言できない', () => {
    const state = makeState([
      makePlayer(1, [joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [], { finishedRank: 1 }),
    ], { phase: 'awaiting-draw' });
    expect(canAnyoneDeclareShuffle(state)).toBe(false);
  });

  it('同じターンで2回目は宣言できない', () => {
    const state = makeState([
      makePlayer(1, [joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('club', 9)]),
    ], { phase: 'awaiting-draw', shuffleUsedThisTurn: true });
    expect(canAnyoneDeclareShuffle(state)).toBe(false);
  });

  it('権利を使い切っていたら宣言できない', () => {
    const state = makeState([
      makePlayer(1, [joker], { shuffleRight: false }),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('club', 9)]),
    ], { phase: 'awaiting-draw' });
    expect(canAnyoneDeclareShuffle(state)).toBe(false);
  });

  it('ジョーカーを持っている人だけが宣言できる', () => {
    const state = makeState([
      makePlayer(1, [joker, card('spade', 2)]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('club', 9)]),
    ], { phase: 'awaiting-draw' });
    expect(canDeclareShuffle(state, 'player-1')).toBe(true);
    expect(canDeclareShuffle(state, 'player-2')).toBe(false);
    expect(canDeclareShuffle(state, 'player-3')).toBe(false);
    // 持っていない人が宣言しようとしても状態は変わらない
    expect(declareShuffle(state, 'player-2')).toBe(state);
  });

  it('手番中でなくても、次の1枚が引かれるまでは宣言できる', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 2)]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [joker]),
    ], { phase: 'awaiting-draw', currentPlayerId: 'player-1' });
    // 手番は player-1 だが、ジョーカー持ちの player-3 が割り込める
    expect(canDeclareShuffle(state, 'player-3')).toBe(true);
  });

  it('宣言すると権利を消費し、サイコロの目が決まる', () => {
    const state = makeState([
      makePlayer(1, [card('club', 3)]),
      makePlayer(2, [joker]),
      makePlayer(3, [card('club', 9)]),
    ], { phase: 'awaiting-draw' });
    const next = declareShuffle(state, 'player-2', seqRng([0.5]));
    expect(next.phase).toBe('rolling');
    expect(next.players[1].shuffleRight).toBe(false);
    expect(next.shuffleUsedThisTurn).toBe(true);
    expect(next.pendingShuffle?.dice).toBe(4);
  });
});

describe('シャッフルの適用', () => {
  it('手札がそのままの形で移動する', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1), card('heart', 1)]),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('spade', 3)]),
    ], {
      phase: 'rolling',
      pendingShuffle: { declarerId: 'player-1', dice: 1 },
    });
    const next = resolveShuffle(state, Math.random);
    expect(next.players[1].hand.map((c) => c.id)).toEqual(['spade-1', 'heart-1']);
    expect(next.players[0].hand.map((c) => c.id)).toEqual(['spade-3']);
  });

  it('移動でペアが揃っても、その場では捨てない', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 5)]),
      makePlayer(2, [card('heart', 5)]),
      makePlayer(3, [joker]),
    ], {
      phase: 'rolling',
      pendingShuffle: { declarerId: 'player-3', dice: 3 },
    });
    // 出目3で player-1 と player-2 の手札が同じ人に集まっても捨てられない
    const next = resolveShuffle(state, seqRng([0]));
    expect(next.discardPile).toHaveLength(0);
    const total = next.players.reduce((sum, p) => sum + p.hand.length, 0);
    expect(total).toBe(3);
  });

  it('シャッフルのあとも手番は移らず、そのターンの2回目は宣言できない', () => {
    const state = makeState(
      [
        makePlayer(1, [card('spade', 1)]),
        makePlayer(2, [joker]),
        makePlayer(3, [card('spade', 3)]),
      ],
      {
        phase: 'rolling',
        shuffleUsedThisTurn: true,
        pendingShuffle: { declarerId: 'player-2', dice: 4 },
      },
    );
    const next = resolveShuffle(state, Math.random);
    expect(next.phase).toBe('awaiting-draw');
    expect(next.currentPlayerId).toBe('player-1');
    expect(next.shuffleUsedThisTurn).toBe(true);
    expect(canAnyoneDeclareShuffle(next)).toBe(false);
  });

  it('カードが引かれると手番が移り、シャッフルの権利がまた使えるようになる', () => {
    const state = makeState(
      [
        makePlayer(1, [card('spade', 1), card('heart', 7)]),
        makePlayer(2, [joker, card('club', 4)]),
        makePlayer(3, [card('spade', 3), card('diamond', 9)]),
      ],
      { phase: 'awaiting-draw', shuffleUsedThisTurn: true },
    );
    const next = drawCard(state, 0);
    expect(next.currentPlayerId).toBe('player-2');
    expect(next.shuffleUsedThisTurn).toBe(false);
    expect(next.phase).toBe('awaiting-draw');
  });

  it('手札が動く出目では、全員のブラフが自然に解除される', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1), card('heart', 1)], { spotlightCardId: 'heart-1' }),
      makePlayer(2, [card('spade', 2)], { spotlightCardId: 'spade-2' }),
      makePlayer(3, [card('spade', 3)], { spotlightCardId: 'spade-3' }),
    ], {
      phase: 'rolling',
      pendingShuffle: { declarerId: 'player-1', dice: 1 },
    });
    const next = resolveShuffle(state, Math.random);
    expect(next.players.every((player) => player.spotlightCardId === null)).toBe(true);
  });

  it('出目4で手札が動かなければブラフは残る', () => {
    const state = makeState([
      makePlayer(1, [joker, card('heart', 1)], { spotlightCardId: 'heart-1' }),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('spade', 3)]),
    ], {
      phase: 'rolling',
      pendingShuffle: { declarerId: 'player-1', dice: 4 },
    });
    const next = resolveShuffle(state, Math.random);
    expect(next.players[0].spotlightCardId).toBe('heart-1');
  });
});

describe('同じ設定で再戦', () => {
  it('人数・名前・人/CPU・強さを保ち、対局状態と演出連番を更新する', () => {
    const state = makeState([
      makePlayer(1, [joker], { name: 'ホスト', finishedRank: null, shuffleRight: false }),
      makePlayer(2, [], { name: 'ゲスト', finishedRank: 1 }),
      makePlayer(3, [], { name: '炎竜', isCpu: true, cpuLevel: 'hard', finishedRank: 2 }),
    ], {
      phase: 'finished',
      finishOrder: ['player-2', 'player-3'],
      loserId: 'player-1',
      eventSeq: 27,
    });

    const next = createBabanukiRematchState(state, () => 0.5);

    expect(next.players.map(({ name, isCpu, cpuLevel }) => ({ name, isCpu, cpuLevel }))).toEqual([
      { name: 'ホスト', isCpu: false, cpuLevel: 'normal' },
      { name: 'ゲスト', isCpu: false, cpuLevel: 'normal' },
      { name: '炎竜', isCpu: true, cpuLevel: 'hard' },
    ]);
    expect(next.phase).toBe('awaiting-draw');
    expect(next.finishOrder).toEqual([]);
    expect(next.loserId).toBeNull();
    expect(next.players.every((player) => player.finishedRank === null && player.shuffleRight)).toBe(true);
    expect(next.events).toEqual([]);
    expect(next.eventSeq).toBe(28);
  });
});

describe('飛び出しの持続', () => {
  it('並べ替えても飛び出したままになる', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1), card('heart', 5), card('club', 9)], { spotlightCardId: 'heart-5' }),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('spade', 3)]),
    ]);
    const next = reorderHand(state, 'player-1', 1, 2);
    expect(next.players[0].hand.map((c) => c.id)).toEqual(['spade-1', 'club-9', 'heart-5']);
    expect(next.players[0].spotlightCardId).toBe('heart-5');
  });

  it('もう一度同じ札を指定すると解除される', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1), card('heart', 5)], { spotlightCardId: 'heart-5' }),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('spade', 3)]),
    ]);
    expect(setSpotlight(state, 'player-1', 'heart-5').players[0].spotlightCardId).toBeNull();
  });

  it('飛び出していない札が引かれても、飛び出しは続く', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1)]),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('heart', 5), card('club', 9)], { spotlightCardId: 'heart-5' }),
    ]);
    // player-1 が右隣 player-3 の 2枚目（club-9）を引く
    const next = drawCard(state, 1);
    expect(next.players[2].spotlightCardId).toBe('heart-5');
  });

  it('飛び出していた札が引かれたら解除される', () => {
    const state = makeState([
      makePlayer(1, [card('spade', 1)]),
      makePlayer(2, [card('spade', 2)]),
      makePlayer(3, [card('heart', 5), card('club', 9)], { spotlightCardId: 'heart-5' }),
    ]);
    const next = drawCard(state, 0);
    expect(next.players[2].spotlightCardId).toBeNull();
  });
});
