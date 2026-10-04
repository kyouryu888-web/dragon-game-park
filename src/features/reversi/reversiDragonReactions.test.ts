import { describe, expect, it } from 'vitest';
import { decideDragonReaction } from '../../components/dragonReactions';
import { createInitialReversiState } from './reversiRules';
import { detectReversiDragonReactions, reversiCinematicImage, reversiDragonCpu } from './reversiDragonReactions';
import type { ReversiConfig, ReversiGameState } from './reversiTypes';

const CONFIG: ReversiConfig = {
  mode: 'cpu', name: '挑戦者', name2: '', cpuLevel: 'hard', humanSide: 'white',
};

function state(): ReversiGameState {
  return createInitialReversiState(CONFIG, () => 0.25);
}

describe('通常リバーシーのドラゴン演出', () => {
  it('公開済みの反転・角・パスだけをCPUの事実ラベルに使う', () => {
    const previous = state();
    const next: ReversiGameState = {
      ...previous, turnCount: 1, currentColor: 'black', lastMove: { row: 0, col: 0 },
      lastMoveColor: 'black', lastFlipCount: 6, passedColor: 'white',
    };
    const events = detectReversiDragonReactions(previous, next);

    expect(events.map(event => event.kind)).toEqual(['large-flip', 'corner', 'pass']);
    expect(events.map(event => event.factLabel)).toEqual([
      `${previous.players.black.name}が6枚反転`,
      `${previous.players.black.name}が角を獲得`,
      `${previous.players.white.name}がパス`,
    ]);
    expect(events.every(event => event.cpu.id === 'black')).toBe(true);
    expect(events.map(event => event.sequence)).toEqual([11, 12, 13]);
    expect(decideDragonReaction(events[0]).factLabel).toBe(events[0].factLabel);
  });

  it('結果は確定した勝者に一致し、再試合や更新飛び越しでは発火しない', () => {
    const previous = state();
    const next: ReversiGameState = {
      ...previous, turnCount: 1, status: 'finished', winner: 'white',
      lastMove: { row: 2, col: 3 }, lastMoveColor: 'black',
    };
    const result = detectReversiDragonReactions(previous, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'result', outcome: 'defeat', cutIn: 'defeat' });
    expect(result[0].factLabel).toBe(`${previous.players.white.name}の勝利`);
    expect(decideDragonReaction(result[0]).outcome).toBe('defeat');
    expect(detectReversiDragonReactions(previous, { ...next, turnCount: 3 })).toEqual([]);
    expect(detectReversiDragonReactions(previous, { ...next, gameId: 'rematch' })).toEqual([]);
  });

  it('CPUレベルと画像を対応させ、人間同士は別の中立案内役を使う', () => {
    const previous = state();
    expect(reversiDragonCpu(previous.players.black)).toMatchObject({ id: 'black', level: 4 });
    expect(reversiCinematicImage(previous, {
      ...previous, turnCount: 1, lastMove: { row: 0, col: 0 }, lastMoveColor: 'black',
    })).toMatch(/\.webp(?:\?|$)/);

    const humans: ReversiGameState = {
      ...previous,
      players: {
        black: { ...previous.players.black, isCpu: false, cpuLevel: undefined },
        white: { ...previous.players.white, isCpu: false, cpuLevel: undefined },
      },
    };
    const next = { ...humans, turnCount: 1, lastMove: { row: 0, col: 0 }, lastMoveColor: 'black' as const, lastFlipCount: 6 };
    const narration = detectReversiDragonReactions(humans, next);
    expect(narration).toMatchObject([
      { kind: 'large-flip', presenter: 'narrator', outcome: 'neutral', cpu: { id: 'dragon-narrator:black', name: 'ゲーム案内' } },
      { kind: 'corner', presenter: 'narrator', outcome: 'neutral' },
    ]);
    expect(narration.every(event => event.cpu.id !== humans.players.black.color)).toBe(true);
    expect(reversiCinematicImage(humans, next)).toBeUndefined();
  });
});

it('adds a brief neutral human wipe for a revealed two-disc flip', () => {
  const previous = createInitialReversiState({ ...CONFIG, mode: 'online' }, () => 0.25);
  const next = { ...previous, turnCount: 1, lastMove: { row: 2, col: 3 }, lastMoveColor: 'black' as const, lastFlipCount: 2 };
  expect(detectReversiDragonReactions(previous, next)).toMatchObject([{
    kind: 'large-flip', presenter: 'narrator', outcome: 'neutral', priority: 1,
    factLabel: `${previous.players.black.name}が2枚反転`,
  }]);
});
