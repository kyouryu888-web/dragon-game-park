import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type RuleConfig } from '../../src/features/reversi/bakuretsu/config.ts';
import { initGame, legalMoves, makeRng, countPieces } from '../../src/features/reversi/bakuretsu/rules.ts';
import { applyMove, settleTurnStart } from '../../src/features/reversi/bakuretsu/engine.ts';
import { checkState, checkTransition, type Violation } from './invariants.ts';
import type { ChainEvent, GameState, Move } from '../../src/features/reversi/bakuretsu/types.ts';

export interface GameRecord {
  winner: string; reason: string; plies: number; maxDepth: number;
  black: number; white: number; neutral: number;
  bombFired: number; infectFired: number; shieldAbsorb: number;
  destroyed: number; rescues: number; passes: number; returns: number;
  hands: Record<string, string>;
  moves: string[];
  violations: Violation[];
}

export function playRandomGame(seed: number, cfg: RuleConfig = DEFAULT_CONFIG, check = true): GameRecord {
  const rng = makeRng(seed);
  let s: GameState = initGame(cfg, rng);
  const evAll: ChainEvent[] = [];
  const violations: Violation[] = [];
  const moves: string[] = [];
  let maxDepth = 0, plies = 0;

  settleTurnStart(s, cfg, evAll);
  if (check) violations.push(...checkState(s, cfg));

  while (s.status === 'PLAYING' && plies < 200) {
    const opts = legalMoves(s, cfg);
    if (opts.length === 0) break;
    const m: Move = opts[(rng() * opts.length) | 0];
    const before = s;
    const r = applyMove(s, m, cfg);
    s = r.state; evAll.push(...r.events);
    maxDepth = Math.max(maxDepth, r.maxDepth);
    moves.push(`${m.x}${m.y}${m.kind[0]}${m.special?.[0] ?? ''}`);
    if (check) { violations.push(...checkState(s, cfg)); violations.push(...checkTransition(before, s, r.events)); }
    plies++;
  }
  if (s.status === 'PLAYING') violations.push({ code: 'NO_TERMINATION', detail: `${plies}` });

  const c = countPieces(s.board);
  const cnt = (t: string) => evAll.filter((e) => e.t === t).length;
  return {
    winner: s.winner ?? '?', reason: s.endReason ?? '?', plies, maxDepth,
    black: c.black, white: c.white, neutral: c.neutral,
    bombFired: cnt('BOMB'), infectFired: cnt('INFECT'), shieldAbsorb: cnt('SHIELD_ABSORB'),
    destroyed: evAll.reduce((a, e) => a + (e.t === 'BOMB' ? e.destroyed.length + e.chained.length + 1 : 0), 0),
    rescues: cnt('RESCUE'), passes: cnt('PASS'), returns: cnt('RETURN_TO_HAND'),
    hands: {
      BLACK: s.hands.BLACK.initialSpecials.join('/'),
      WHITE: s.hands.WHITE.initialSpecials.join('/'),
    },
    moves, violations,
  };
}

describe('爆裂リバーシーの自動対戦移植検証', () => {
  it('1200局でルール違反0件かつ全シードの結果が決定論的に一致する', () => {
    const seeds = Array.from({ length: 1200 }, (_, index) => index + 1);
    const first = seeds.map((seed) => playRandomGame(seed, DEFAULT_CONFIG, true));
    const second = seeds.map((seed) => playRandomGame(seed, DEFAULT_CONFIG, true));
    expect(first.flatMap((record) => record.violations)).toEqual([]);
    expect(second.flatMap((record) => record.violations)).toEqual([]);
    expect(second).toEqual(first);
  }, 120_000);
});
