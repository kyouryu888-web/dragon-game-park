import { describe, expect, it } from 'vitest';
import { applyMove } from './bakuretsu/engine.ts';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { initGame, legalMoves, makeRng } from './bakuretsu/rules.ts';
import type { GameState, Move } from './bakuretsu/types.ts';
import { redactionLeaks } from './bakuretsu/view.ts';
import {
  BAKURETSU_CPU_LEVELS,
  createBakuretsuCpuRequest,
  runBakuretsuCpuRequest,
} from './bakuretsuCpu';

function moveKey(move: Move): string {
  return `${move.x},${move.y},${move.kind},${move.special ?? ''},${move.skipDirs?.join('.') ?? ''}`;
}

describe('Bakuretsu Reversi CPU', () => {
  it('passes only a redacted clone to the CPU boundary', () => {
    const state = initGame(DEFAULT_CONFIG, makeRng(10));
    state.board[0] = {
      state: 'FACEDOWN', owner: 'WHITE', specialType: 'BOMB', durability: 7,
      isQueued: false, activated: false,
    };
    state.hands.WHITE.specialPieces = ['BOMB'];
    state.hands.WHITE.dummyCount = 9;

    const request = createBakuretsuCpuRequest(1, state, 5, 99);

    expect(redactionLeaks(state, 'BLACK')).toEqual([]);
    expect(request.publicState).not.toBe(state);
    expect(request.publicState.board[0].specialType).toBe('NONE');
    expect(request.publicState.board[0].durability).toBe(0);
    expect(request.publicState.hands.WHITE.specialPieces).toEqual(state.hands.WHITE.initialSpecials);
    expect(request.publicState.hands.WHITE.dummyCount).toBe(-1);
  });

  it('returns a legal move at every level and is deterministic for the same seeds', () => {
    for (const level of BAKURETSU_CPU_LEVELS) {
      for (let gameSeed = 1; gameSeed <= 24; gameSeed += 1) {
        let state: GameState = initGame(DEFAULT_CONFIG, makeRng(gameSeed));
        for (let ply = 0; state.status === 'PLAYING' && ply < 80; ply += 1) {
          const seed = gameSeed * 10_000 + ply * 10 + level;
          const first = runBakuretsuCpuRequest(createBakuretsuCpuRequest(ply, state, level, seed));
          const second = runBakuretsuCpuRequest(createBakuretsuCpuRequest(ply, state, level, seed));
          expect(second).toEqual(first);
          expect(first.error).toBeUndefined();
          expect(first.move).toBeDefined();
          state = applyMove(state, first.move!, DEFAULT_CONFIG).state;
        }
        expect(state.status).toBe('FINISHED');
      }
    }
  }, 120_000);

  it('keeps the five levels behaviorally distinct on a fixed public position set', () => {
    const positions: GameState[] = [];
    for (let gameSeed = 1; gameSeed <= 6; gameSeed += 1) {
      const rng = makeRng(gameSeed * 19);
      let state = initGame(DEFAULT_CONFIG, rng);
      for (let ply = 0; state.status === 'PLAYING' && ply < 24; ply += 1) {
        if (ply >= 4 && ply % 4 === 0) positions.push(state);
        const moves = legalMoves(state, DEFAULT_CONFIG);
        state = applyMove(state, moves[(rng() * moves.length) | 0], DEFAULT_CONFIG).state;
      }
    }
    const signatures = BAKURETSU_CPU_LEVELS.map((level) => {
      return positions.map((state, index) => {
        const response = runBakuretsuCpuRequest(createBakuretsuCpuRequest(index, state, level, index * 101 + 7));
        return moveKey(response.move!);
      }).join('|');
    });

    expect(new Set(signatures).size).toBe(5);
  });
});
