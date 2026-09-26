import { describe, expect, it } from 'vitest';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import { acceptDouble, declineDouble, getLegalMoves, offerDouble, passTurn, rollDice } from './backgammonRules';
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
