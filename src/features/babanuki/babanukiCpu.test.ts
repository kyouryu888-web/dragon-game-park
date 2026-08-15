import { describe, expect, it } from 'vitest';
import type { BabanukiPlayer, BabanukiState, Card, CpuLevel, Suit } from './babanukiTypes';
import {
  CPU_LEVELS,
  chooseCpuDraw,
  chooseSpotlight,
  evaluateDisadvantage,
  getCpuDisplayName,
  shouldDeclareShuffle,
} from './babanukiCpu';

function card(suit: Suit, rank: number): Card {
  return { id: `${suit}-${rank}`, suit, rank };
}

const joker: Card = { id: 'joker', suit: 'joker', rank: 0 };

function makePlayer(index: number, hand: Card[], extra: Partial<BabanukiPlayer> = {}): BabanukiPlayer {
  return {
    id: `player-${index}`,
    name: `P${index}`,
    isCpu: true,
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

/** 常に同じ値を返す乱数（判定の境目を固定するため） */
function constRng(value: number): () => number {
  return () => value;
}

describe('getCpuDisplayName', () => {
  it('5段階すべてに名前がある', () => {
    for (const level of CPU_LEVELS) {
      expect(getCpuDisplayName(level)).toBeTruthy();
    }
    expect(CPU_LEVELS).toHaveLength(5);
  });
});

describe('chooseCpuDraw', () => {
  const baseState = (spotlightCardId: string | null) =>
    makeState([
      makePlayer(1, [joker]),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [card('spade', 4), card('heart', 5), card('club', 6)], { spotlightCardId }),
    ]);

  it('常に右隣の手札の範囲内を返す', () => {
    for (const level of CPU_LEVELS) {
      for (let i = 0; i < 20; i += 1) {
        const index = chooseCpuDraw(baseState('heart-5'), 'player-1', level, Math.random);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(3);
      }
    }
  });

  it('弱いCPUほど飛び出している札に引っかかる', () => {
    // rng=0.5 のとき、bias が 0.5 より大きいレベルだけが飛び出しを引く
    expect(chooseCpuDraw(baseState('heart-5'), 'player-1', 'very-easy', constRng(0.5))).toBe(1);
    expect(chooseCpuDraw(baseState('heart-5'), 'player-1', 'easy', constRng(0.5))).toBe(1);
    expect(chooseCpuDraw(baseState('heart-5'), 'player-1', 'normal', constRng(0.5))).not.toBe(1);
    expect(chooseCpuDraw(baseState('heart-5'), 'player-1', 'hard', constRng(0.5))).not.toBe(1);
  });

  it('飛び出しが無ければ位置に偏りなく選ぶ', () => {
    const picked = new Set<number>();
    for (let i = 0; i < 60; i += 1) {
      picked.add(chooseCpuDraw(baseState(null), 'player-1', 'very-hard', Math.random));
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('引く相手がいなければ -1 を返す', () => {
    const state = makeState([
      makePlayer(1, [joker]),
      makePlayer(2, [], { finishedRank: 1 }),
    ]);
    expect(chooseCpuDraw(state, 'player-1', 'normal', Math.random)).toBe(-1);
  });
});

describe('chooseSpotlight', () => {
  const state = makeState([
    makePlayer(1, [joker, card('spade', 4), card('heart', 9)]),
    makePlayer(2, [card('club', 3)]),
    makePlayer(3, [card('club', 8)]),
  ]);

  /** 1000回試して「飛び出した割合」と「そのうちジョーカーだった割合」を測る */
  function sampleSpotlight(level: CpuLevel) {
    let used = 0;
    let jokerShown = 0;
    for (let i = 0; i < 1000; i += 1) {
      const cardId = chooseSpotlight(state, 'player-1', level, Math.random);
      if (cardId === null) continue;
      used += 1;
      if (cardId === 'joker') jokerShown += 1;
    }
    return { useRate: used / 1000, jokerRate: used === 0 ? 0 : jokerShown / used };
  }

  it('ゴッドドラゴンは飛び出しを使わない', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(chooseSpotlight(state, 'player-1', 'very-hard', Math.random)).toBeNull();
    }
  });

  it('毎ターン必ず飛び出させるわけではない', () => {
    const levels: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard'];
    for (const level of levels) {
      const { useRate } = sampleSpotlight(level);
      expect(useRate).toBeGreaterThan(0.1);
      expect(useRate).toBeLessThan(0.75);
    }
  });

  it('飛び出させた札がジョーカーのこともあり、常に見破れる状態にはならない', () => {
    const levels: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard'];
    for (const level of levels) {
      const { jokerRate } = sampleSpotlight(level);
      // ジョーカーそのものを見せる割合。0でも1でもない＝読み切れない
      expect(jokerRate).toBeGreaterThan(0.2);
      expect(jokerRate).toBeLessThan(0.8);
    }
  });

  it('強いCPUほどブラフ（安全札を飛び出させる）が多い', () => {
    const weak = sampleSpotlight('very-easy').jokerRate;
    const strong = sampleSpotlight('hard').jokerRate;
    // 強いほうがジョーカーを見せる割合は低い＝ブラフが多い
    expect(strong).toBeLessThan(weak);
  });

  it('手札が無ければ飛び出さない', () => {
    const empty = makeState([
      makePlayer(1, []),
      makePlayer(2, [card('club', 3)]),
      makePlayer(3, [joker]),
    ]);
    expect(chooseSpotlight(empty, 'player-1', 'normal', Math.random)).toBeNull();
  });
});

describe('shouldDeclareShuffle', () => {
  const windowState = (overrides: Partial<BabanukiState> = {}) =>
    makeState(
      [
        makePlayer(1, [joker, card('spade', 4), card('heart', 9)]),
        makePlayer(2, [card('club', 3)]),
        makePlayer(3, [card('club', 8)]),
      ],
      { phase: 'awaiting-draw', ...overrides },
    );

  it('宣言できない局面では常に false', () => {
    const used = windowState({ shuffleUsedThisTurn: true });
    for (const level of CPU_LEVELS) {
      expect(shouldDeclareShuffle(used, 'player-1', level, constRng(0))).toBe(false);
    }
  });

  it('権利を持っていなければ false', () => {
    const state = windowState();
    state.players[0].shuffleRight = false;
    for (const level of CPU_LEVELS) {
      expect(shouldDeclareShuffle(state, 'player-1', level, constRng(0))).toBe(false);
    }
  });

  it('ジョーカーを持つ不利な局面では強いCPUほど宣言する', () => {
    const state = windowState();
    // rng=0.5 で判定。不利スコアが高いので強いレベルだけが上回る
    expect(shouldDeclareShuffle(state, 'player-1', 'very-hard', constRng(0.5))).toBe(true);
    expect(shouldDeclareShuffle(state, 'player-1', 'hard', constRng(0.5))).toBe(true);
    expect(shouldDeclareShuffle(state, 'player-1', 'very-easy', constRng(0.5))).toBe(false);
  });

  it('ジョーカーを持たない有利な局面では最強CPUでも宣言しない', () => {
    const state = windowState();
    expect(evaluateDisadvantage(state, 'player-2')).toBeLessThan(
      evaluateDisadvantage(state, 'player-1'),
    );
    expect(shouldDeclareShuffle(state, 'player-2', 'very-hard', constRng(0.5))).toBe(false);
  });

  it('不利スコアは0〜1に収まる', () => {
    const state = windowState();
    for (const player of state.players) {
      const score = evaluateDisadvantage(state, player.id);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
