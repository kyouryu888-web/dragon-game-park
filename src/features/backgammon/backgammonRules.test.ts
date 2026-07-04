import { describe, it, expect } from 'vitest';
import type { GameState, PlayerId, Point } from './backgammonTypes';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import {
  acceptDouble,
  applyMove,
  canBearOff,
  canOfferDouble,
  declineDouble,
  expandDice,
  getLegalMoves,
  getLegalMoveSequences,
  getPipCount,
  offerDouble,
  rollDice,
  rollOpening,
} from './backgammonRules';

/** テスト用: 空盤面から任意の配置を作る */
function makeState(
  placements: { index: number; owner: PlayerId; count: number }[],
  overrides: Partial<GameState> = {},
): GameState {
  const base = createInitialBackgammonState();
  const points: Point[] = Array.from({ length: 24 }, () => null);
  for (const p of placements) {
    points[p.index] = { owner: p.owner, count: p.count };
  }
  return {
    ...base,
    points,
    phase: 'moving',
    currentPlayer: 'white',
    ...overrides,
  };
}

/** 乱数の代わりに固定値列を返す rng */
function fixedRng(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('初期配置', () => {
  it('両者15個ずつ、標準配置になっている', () => {
    const state = createInitialBackgammonState();
    const count = (owner: PlayerId) =>
      state.points.reduce((sum, p) => sum + (p?.owner === owner ? p.count : 0), 0);
    expect(count('white')).toBe(15);
    expect(count('black')).toBe(15);
    expect(state.points[23]).toEqual({ owner: 'white', count: 2 });
    expect(state.points[0]).toEqual({ owner: 'black', count: 2 });
    expect(state.phase).toBe('opening-roll');
    expect(getPipCount(state, 'white')).toBe(167);
    expect(getPipCount(state, 'black')).toBe(167);
  });
});

describe('オープニングロール', () => {
  it('大きい目を出した方が先手になり、その出目で開始する', () => {
    const state = createInitialBackgammonState();
    // white=2, black=5 → black 先手
    const next = rollOpening(state, fixedRng([1 / 6, 4 / 6]));
    expect(next.currentPlayer).toBe('black');
    expect(next.phase).toBe('moving');
    expect(next.dice.slice().sort()).toEqual([2, 5]);
  });

  it('ゾロ目なら振り直し（phase は opening-roll のまま）', () => {
    const state = createInitialBackgammonState();
    const next = rollOpening(state, fixedRng([2 / 6, 2 / 6]));
    expect(next.phase).toBe('opening-roll');
  });
});

describe('サイコロ', () => {
  it('ゾロ目は4個に展開される', () => {
    expect(expandDice(3, 3)).toEqual([3, 3, 3, 3]);
    expect(expandDice(2, 5)).toEqual([2, 5]);
  });

  it('rollDice で phase が moving になる', () => {
    const state = { ...createInitialBackgammonState(), phase: 'rolling' as const };
    const next = rollDice(state, fixedRng([0 / 6, 5 / 6]));
    expect(next.phase).toBe('moving');
    expect(next.dice).toEqual([1, 6]);
  });
});

describe('基本の移動', () => {
  it('white は index が減る方向にしか動けない', () => {
    const state = makeState(
      [{ index: 10, owner: 'white', count: 2 }, { index: 20, owner: 'black', count: 2 }],
      { dice: [3, 5] },
    );
    const moves = getLegalMoves(state);
    expect(moves.every((m) => m.from === 10)).toBe(true);
    expect(moves.map((m) => m.to).sort()).toEqual([5, 7]);
  });

  it('相手が2個以上いるポイントには入れない', () => {
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 2 },
        { index: 7, owner: 'black', count: 2 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [3] },
    );
    // 10 - 3 = 7 は black が2個 → 打てる手なし
    expect(getLegalMoves(state)).toEqual([]);
  });

  it('相手のブロットに乗るとヒットしてバーへ送る', () => {
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 1 },
        { index: 7, owner: 'black', count: 1 },
        { index: 20, owner: 'black', count: 3 },
      ],
      { dice: [3, 6] },
    );
    const next = applyMove(state, { from: 10, to: 7, die: 3 });
    expect(next.points[7]).toEqual({ owner: 'white', count: 1 });
    expect(next.bar.black).toBe(1);
  });
});

describe('バー', () => {
  it('バーに駒があるとバーからの復帰しか打てない', () => {
    const state = makeState(
      [{ index: 10, owner: 'white', count: 2 }, { index: 0, owner: 'black', count: 2 }],
      { dice: [3, 5], bar: { white: 1, black: 0 } },
    );
    const moves = getLegalMoves(state);
    expect(moves.every((m) => m.from === 'bar')).toBe(true);
    // white の復帰先: die 3 → index 21, die 5 → index 19
    expect(moves.map((m) => m.to).sort()).toEqual([19, 21]);
  });

  it('復帰先が両方ブロックされていたら1手も打てない', () => {
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 2 },
        { index: 21, owner: 'black', count: 2 },
        { index: 19, owner: 'black', count: 2 },
      ],
      { dice: [3, 5], bar: { white: 1, black: 0 } },
    );
    expect(getLegalMoves(state)).toEqual([]);
  });
});

describe('ベアオフ', () => {
  it('全駒がホームに入るまでベアオフできない', () => {
    const state = makeState(
      [
        { index: 3, owner: 'white', count: 14 },
        { index: 10, owner: 'white', count: 1 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [4] },
    );
    expect(canBearOff(state, 'white')).toBe(false);
    expect(getLegalMoves(state).some((m) => m.to === 'off')).toBe(false);
  });

  it('ちょうどの目でベアオフできる', () => {
    const state = makeState(
      [
        { index: 3, owner: 'white', count: 15 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [4] },
    );
    const moves = getLegalMoves(state);
    expect(moves).toContainEqual({ from: 3, to: 'off', die: 4 });
  });

  it('超過目は後方に駒がない場合だけベアオフできる', () => {
    // index 4（5ポイント）に駒がある間、index 2 から die 6 では上がれない。
    // 最後方の index 4 からは die 6 で上がれる。
    const blocked = makeState(
      [
        { index: 4, owner: 'white', count: 2 },
        { index: 2, owner: 'white', count: 13 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [6] },
    );
    expect(getLegalMoves(blocked).filter((m) => m.to === 'off')).toEqual([
      { from: 4, to: 'off', die: 6 },
    ]);

    const open = makeState(
      [
        { index: 2, owner: 'white', count: 15 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [6] },
    );
    expect(getLegalMoves(open)).toContainEqual({ from: 2, to: 'off', die: 6 });
  });

  it('15個ベアオフで勝利し、点数が付く', () => {
    const state = makeState(
      [
        { index: 0, owner: 'white', count: 1 },
        { index: 20, owner: 'black', count: 2 },
      ],
      { dice: [1, 2], borneOff: { white: 14, black: 3 } },
    );
    const next = applyMove(state, { from: 0, to: 'off', die: 1 });
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe('white');
    expect(next.winKind).toBe('single');
    expect(next.resultPoints).toBe(1);
  });

  it('相手が1個も上げていなければギャモン（2倍）', () => {
    const state = makeState(
      [
        { index: 0, owner: 'white', count: 1 },
        { index: 20, owner: 'black', count: 15 },
      ],
      { dice: [1], borneOff: { white: 14, black: 0 }, cube: { value: 2, owner: 'white' } },
    );
    const next = applyMove(state, { from: 0, to: 'off', die: 1 });
    expect(next.winKind).toBe('gammon');
    expect(next.resultPoints).toBe(4); // キューブ2 × ギャモン2
  });

  it('相手が勝者のホーム内に駒を残していればバックギャモン（3倍）', () => {
    const state = makeState(
      [
        { index: 0, owner: 'white', count: 1 },
        { index: 3, owner: 'black', count: 15 },
      ],
      { dice: [1], borneOff: { white: 14, black: 0 } },
    );
    const next = applyMove(state, { from: 0, to: 'off', die: 1 });
    expect(next.winKind).toBe('backgammon');
    expect(next.resultPoints).toBe(3);
  });
});

describe('最大限使用ルール', () => {
  it('両方の出目を使える手順があるなら、片方しか使えなくなる手は選べない', () => {
    // white: index 23 に1個。dice [6, 5]。
    // 23→17(6)→12(5) は両方使える。23→18(5) のあと 18→12(6) も使える想定だが、
    // 12 を black がブロックしている場合を作る:
    //   23→18(5) の後 18-6=12 がブロック → 5 から使う手順は1手しか使えない
    //   23→17(6) の後 17-5=12 がブロック → これも駄目
    // 代わりに 17→ や 18→ 以外に white の駒がもう1個 index 8 にあると
    //   23→18(5), 8→2(6) のように両方使える
    const state = makeState(
      [
        { index: 23, owner: 'white', count: 1 },
        { index: 8, owner: 'white', count: 1 },
        { index: 12, owner: 'black', count: 2 },
        { index: 3, owner: 'black', count: 2 },
      ],
      { dice: [6, 5] },
    );
    const sequences = getLegalMoveSequences(state);
    expect(sequences.every((s) => s.moves.length === 2)).toBe(true);
  });

  it('1個しか使えないときは大きい方の目を使う', () => {
    // white: index 5 に1個だけ（ホーム内、ベアオフはまだ不可: index 10 にもう1個）
    // dice [6, 3]: index 10 から 10-6=4 は black ブロック、10-3=7 も black ブロック。
    // index 5 から 5-3=2 は空き、5-6 はベアオフ不可（index 10 に駒があるので）
    // → 3 しか使えない…これでは大きい方テストにならない。
    // 両方とも1手だけ可能なケース: from 10 die 6 → 4 が空き、from 10 die 3 → 7 が空き、
    // ただしどちらを打っても残りが打てない状況を作る。
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 1 },
        { index: 1, owner: 'black', count: 2 },
        { index: 2, owner: 'black', count: 2 },
        { index: 4, owner: 'black', count: 2 },
        { index: 5, owner: 'black', count: 2 },
        { index: 20, owner: 'black', count: 5 },
      ],
      { dice: [6, 3] },
    );
    // from 10: die 6 → index 4 はブロック。die 3 → index 7 空き。
    // 7 に動いた後 die 6 → index 1 はブロック → 1手のみ。
    // die 6 は最初から打てないので、3 の1手が唯一 → それが合法
    const sequences = getLegalMoveSequences(state);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences.every((s) => s.moves.length === 1 && s.moves[0].die === 3)).toBe(true);

    // 今度は両方打てるが1手のみのケース: die 6 → index 4 を空ける
    const state2 = makeState(
      [
        { index: 10, owner: 'white', count: 1 },
        { index: 1, owner: 'black', count: 2 },
        { index: 2, owner: 'black', count: 2 },
        { index: 5, owner: 'black', count: 2 },
        { index: 7, owner: 'black', count: 2 },
        { index: 20, owner: 'black', count: 5 },
      ],
      { dice: [6, 3] },
    );
    // from 10: die 6 → index 4 空き。その後 die 3 → 4-3=1 ブロック → 1手。
    // from 10: die 3 → index 7 ブロック → 不可。
    // → die 6 の1手のみ
    const seq2 = getLegalMoveSequences(state2);
    expect(seq2.every((s) => s.moves.length === 1 && s.moves[0].die === 6)).toBe(true);
  });

  it('大小どちらか一方だけなら大きい目を強制する', () => {
    // from 10 die 6 → 4 空き（その後 3 は打てない）
    // from 10 die 3 → 7 空き（その後 6 は打てない: 7-6=1 ブロック）
    const state = makeState(
      [
        { index: 10, owner: 'white', count: 1 },
        { index: 1, owner: 'black', count: 2 },
        { index: 2, owner: 'black', count: 2 },
        { index: 5, owner: 'black', count: 2 },
        { index: 20, owner: 'black', count: 5 },
      ],
      { dice: [6, 3] },
    );
    // die 6: 10→4 → 残り3: 4-3=1 ブロック → 1手
    // die 3: 10→7 → 残り6: 7-6=1 ブロック → 1手
    // 両方1手 → 大きい方（6）を強制
    const sequences = getLegalMoveSequences(state);
    expect(sequences.every((s) => s.moves.length === 1 && s.moves[0].die === 6)).toBe(true);
  });

  it('ゾロ目は4回動ける', () => {
    const state = makeState(
      [
        { index: 20, owner: 'white', count: 4 },
        { index: 0, owner: 'black', count: 2 },
      ],
      { dice: [2, 2, 2, 2] },
    );
    const sequences = getLegalMoveSequences(state);
    expect(sequences.every((s) => s.moves.length === 4)).toBe(true);
  });
});

describe('手番の自動交代', () => {
  it('全出目を使い切ると相手の手番（rolling）になる', () => {
    const state = makeState(
      [
        { index: 20, owner: 'white', count: 2 },
        { index: 0, owner: 'black', count: 2 },
      ],
      { dice: [3], turnCount: 1 },
    );
    const next = applyMove(state, { from: 20, to: 17, die: 3 });
    expect(next.currentPlayer).toBe('black');
    expect(next.phase).toBe('rolling');
    expect(next.dice).toEqual([]);
    expect(next.turnCount).toBe(2);
  });

  it('残りの出目が打てなければ自動で手番交代', () => {
    // dice [5, 6]。5 を使った後、6 がどこも打てない状況
    const state = makeState(
      [
        { index: 23, owner: 'white', count: 1 },
        { index: 17, owner: 'black', count: 2 },
        { index: 12, owner: 'black', count: 2 },
        { index: 13, owner: 'black', count: 2 },
      ],
      { dice: [5, 6] },
    );
    // 23→18(5) 可、その後 18-6=12 ブロック。23→17(6) はブロック。
    // → 最大1手。5 の手を適用したら手番交代するはず
    const moves = getLegalMoves(state);
    expect(moves).toEqual([{ from: 23, to: 18, die: 5 }]);
    const next = applyMove(state, moves[0]);
    expect(next.currentPlayer).toBe('black');
    expect(next.phase).toBe('rolling');
  });
});

describe('ダブリングキューブ', () => {
  it('振る前だけ提案でき、センターか自分所有のときだけ', () => {
    const base = makeState(
      [{ index: 10, owner: 'white', count: 2 }, { index: 20, owner: 'black', count: 2 }],
      { phase: 'rolling', currentPlayer: 'white' },
    );
    expect(canOfferDouble(base, 'white')).toBe(true);
    expect(canOfferDouble(base, 'black')).toBe(false); // 手番でない
    expect(canOfferDouble({ ...base, phase: 'moving' }, 'white')).toBe(false); // 振った後
    expect(canOfferDouble({ ...base, cube: { value: 2, owner: 'black' } }, 'white')).toBe(false); // 相手所有
    expect(canOfferDouble({ ...base, cube: { value: 2, owner: 'white' } }, 'white')).toBe(true);
  });

  it('受諾でキューブ値2倍・所有権が受けた側に移る', () => {
    const base = makeState(
      [{ index: 10, owner: 'white', count: 2 }, { index: 20, owner: 'black', count: 2 }],
      { phase: 'rolling', currentPlayer: 'white' },
    );
    const offered = offerDouble(base);
    expect(offered.phase).toBe('double-offered');
    const accepted = acceptDouble(offered);
    expect(accepted.cube).toEqual({ value: 2, owner: 'black' });
    expect(accepted.phase).toBe('rolling');
    expect(accepted.currentPlayer).toBe('white'); // 提案者の手番のまま
  });

  it('拒否すると現在のキューブ値で提案者の勝ち', () => {
    const base = makeState(
      [{ index: 10, owner: 'white', count: 2 }, { index: 20, owner: 'black', count: 2 }],
      { phase: 'rolling', currentPlayer: 'white', cube: { value: 2, owner: 'white' } },
    );
    const declined = declineDouble(offerDouble(base));
    expect(declined.phase).toBe('finished');
    expect(declined.winner).toBe('white');
    expect(declined.resultPoints).toBe(2);
  });
});
