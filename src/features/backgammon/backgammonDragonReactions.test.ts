import { describe, expect, it } from 'vitest';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import { acceptDouble, applyMove, declineDouble, getLegalMoves, offerDouble, passTurn, rollDice } from './backgammonRules';
import { detectBackgammonDragonReactions } from './backgammonDragonReactions';
import type { GameState } from './backgammonTypes';

const context = {
  matchId: 'backgammon-test',
  sequence: 7,
  cpu: { id: 'black', name: 'CPU ドラゴン', level: 3 as const },
};

function rolling(player: 'white' | 'black'): GameState {
  return { ...createInitialBackgammonState(), phase: 'rolling', currentPlayer: player };
}

describe('backgammon public dragon reactions', () => {
  it('reports a CPU double, acceptance and a real drop result without changing the facts', () => {
    const before = rolling('black');
    const offered = offerDouble(before);
    const offer = detectBackgammonDragonReactions(before, offered, context);
    expect(offer).toMatchObject([{ kind: 'backgammon-cpu-double-offer', factLabel: 'ダブル提案・2点', cutIn: 'attack' }]);

    const accepted = acceptDouble(offered);
    const take = detectBackgammonDragonReactions(offered, accepted, context);
    expect(take).toMatchObject([{ kind: 'backgammon-opponent-double-accept', factLabel: 'ダブル受諾・2点' }]);

    const dropped = declineDouble(offered);
    const result = detectBackgammonDragonReactions(offered, dropped, context);
    expect(result).toMatchObject([{ kind: 'backgammon-cpu-victory', outcome: 'victory', factLabel: 'CPUのドロップ勝ち・1点', cutIn: 'victory' }]);
  });

  it('reflects the actual loser when the CPU drops a human double', () => {
    const before = rolling('white');
    const offered = offerDouble(before);
    const dropped = declineDouble(offered);
    expect(detectBackgammonDragonReactions(offered, dropped, context)).toMatchObject([
      { kind: 'backgammon-cpu-defeat', outcome: 'defeat', factLabel: '対戦者のドロップ勝ち・1点', cutIn: 'defeat' },
    ]);
  });

  it('reacts only to the public dice and visible hit counter, then ignores the next game reset', () => {
    const before = rolling('black');
    const rolled = rollDice(before, () => 0);
    expect(detectBackgammonDragonReactions(before, rolled, context)).toMatchObject([
      { kind: 'backgammon-cpu-doubles-roll', factLabel: 'ゾロ目 1・1' },
    ]);

    const hit = { ...rolled, bar: { ...rolled.bar, white: 1 } };
    expect(detectBackgammonDragonReactions(rolled, hit, context)).toMatchObject([
      { kind: 'backgammon-cpu-hit:1', factLabel: '白の駒を1個ヒット' },
    ]);

    const rematch = createInitialBackgammonState();
    expect(detectBackgammonDragonReactions({ ...hit, phase: 'finished', turnCount: 12 }, rematch, context)).toEqual([]);
  });

  it('announces a blocked CPU turn only after the public pass has occurred', () => {
    const base = rolling('black');
    const points = base.points.slice();
    points[0] = { owner: 'white', count: 2 };
    const blocked: GameState = {
      ...base, points, phase: 'moving', bar: { white: 0, black: 1 }, dice: [1], rolled: [1, 2],
    };
    const before: GameState = { ...blocked, phase: 'rolling', dice: [], rolled: null };
    expect(getLegalMoves(blocked)).toEqual([]);
    expect(detectBackgammonDragonReactions(before, blocked, context)).toEqual([]);
    expect(detectBackgammonDragonReactions(blocked, passTurn(blocked), context)).toMatchObject([
      { kind: 'backgammon-cpu-no-moves', outcome: 'disadvantage', factLabel: '動かせる手がない' },
    ]);
  });
});

describe('Backgammon human public presentation v2', () => {
  const publicContext = { matchId: 'room-example', sequence: 12, names: { white: 'ホスト', black: 'ゲスト' } };

  it.each(['white', 'black'] as const)('narrates the actual %s hitter even when the turn changes', mover => {
    const base = rolling(mover);
    const victim = mover === 'white' ? 'black' : 'white';
    const from = mover === 'white' ? 5 : 4;
    const to = mover === 'white' ? 4 : 5;
    const points: GameState['points'] = Array(24).fill(null);
    points[from] = { owner: mover, count: 1 };
    points[to] = { owner: victim, count: 1 };
    const before: GameState = { ...base, phase: 'moving', points, dice: [1], rolled: [1, 2], borneOff: { white: 14, black: 14 } };
    const after = applyMove(before, { from, to, die: 1 });
    expect(after.currentPlayer).toBe(victim);
    const cues = detectBackgammonDragonReactions(before, after, publicContext);
    expect(cues).toMatchObject([{
      presenter: 'narrator', outcome: 'neutral', cpu: { id: `dragon-narrator:${mover}`, name: 'ゲーム案内' },
      kind: 'backgammon-hit:1', factLabel: `${publicContext.names[victim]}の駒を1個ヒット`, priority: 2,
    }]);
    expect(cues[0].cutIn).toBeUndefined();
  });

  it('uses the responder rather than the cube proposer as the public acceptance actor', () => {
    const before = rolling('white');
    const offered = offerDouble(before);
    expect(detectBackgammonDragonReactions(before, offered, publicContext)).toMatchObject([{
      kind: 'backgammon-double-offer', presenter: 'narrator', cpu: { id: 'dragon-narrator:white' }, cutIn: 'attack',
    }]);
    expect(detectBackgammonDragonReactions(offered, acceptDouble(offered), publicContext)).toMatchObject([{
      kind: 'backgammon-double-accept', presenter: 'narrator', cpu: { id: 'dragon-narrator:black' }, outcome: 'neutral',
    }]);
    expect(detectBackgammonDragonReactions(offered, declineDouble(offered), publicContext)).toMatchObject([{
      kind: 'backgammon-result', presenter: 'narrator', cpu: { id: 'dragon-narrator:white' }, outcome: 'neutral',
      factLabel: 'ホストのドロップ勝ち・1点', cutIn: 'victory',
    }]);
  });

  it('adds public return and bearoff wipes without a fullscreen scene', () => {
    const before = { ...rolling('white'), phase: 'moving' as const, bar: { white: 1, black: 0 } };
    const returned = { ...before, bar: { white: 0, black: 0 } };
    expect(detectBackgammonDragonReactions(before, returned, publicContext)).toMatchObject([{
      kind: 'backgammon-return', factLabel: 'ホストの駒がバーから復帰', priority: 1, presenter: 'narrator',
    }]);
    const off = { ...returned, borneOff: { white: returned.borneOff.white + 1, black: returned.borneOff.black } };
    expect(detectBackgammonDragonReactions(returned, off, publicContext)).toMatchObject([{
      kind: 'backgammon-bearoff', factLabel: 'ホストが1個ベアオフ', priority: 1, presenter: 'narrator',
    }]);
  });

  it('keeps skipped public snapshots quiet', () => {
    const before = rolling('black');
    expect(detectBackgammonDragonReactions(before, {
      ...before, turnCount: before.turnCount + 2, bar: { white: 2, black: 0 },
    }, publicContext)).toEqual([]);
  });
});

it('keeps opponent return/bearoff and cube decisions distinct from the CPU actor', () => {
  const white = { ...rolling('white'), phase: 'moving' as const, bar: { white: 1, black: 0 } };
  const returned = { ...white, bar: { white: 0, black: 0 } };
  expect(detectBackgammonDragonReactions(white, returned, context)).toMatchObject([{
    kind: 'backgammon-opponent-return', cpu: { id: 'black' }, outcome: 'neutral',
  }]);
  const off = { ...returned, borneOff: { white: returned.borneOff.white + 1, black: returned.borneOff.black } };
  expect(detectBackgammonDragonReactions(returned, off, context)).toMatchObject([{
    kind: 'backgammon-opponent-bearoff', outcome: 'neutral',
  }]);
  const offered = offerDouble(rolling('white'));
  expect(detectBackgammonDragonReactions(rolling('white'), offered, context)).toMatchObject([{
    kind: 'backgammon-opponent-double-offer', outcome: 'neutral',
  }]);
  expect(detectBackgammonDragonReactions(offered, acceptDouble(offered), context)).toMatchObject([{
    kind: 'backgammon-cpu-double-accept', outcome: 'advantage',
  }]);
  const blackOffered = offerDouble(rolling('black'));
  expect(detectBackgammonDragonReactions(blackOffered, acceptDouble(blackOffered), context)).toMatchObject([{
    kind: 'backgammon-opponent-double-accept',
  }]);
});

it('phrases a public hit against the CPU as a loss of its own checker', () => {
  const before = { ...rolling('white'), phase: 'moving' as const };
  const after = { ...before, bar: { white: 0, black: 1 } };
  expect(detectBackgammonDragonReactions(before, after, context)).toMatchObject([{
    kind: 'backgammon-cpu-was-hit:1', factLabel: '黒の駒が1個ヒットされた',
  }]);
});
