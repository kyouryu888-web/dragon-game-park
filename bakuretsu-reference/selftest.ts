import { DEFAULT_CONFIG, type RuleConfig } from './config.ts';
import { initGame, legalMoves, makeRng, countPieces, cornerCount } from './rules.ts';
import { applyMove, settleTurnStart } from './engine.ts';
import { checkState, checkTransition, type Violation } from './invariants.ts';
import type { ChainEvent, GameState, Move } from './types.ts';

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

// ---- runner ----
const N = Number(process.argv[2] ?? 2000);
const t0 = Date.now();
const recs: GameRecord[] = [];
const CFG = { ...DEFAULT_CONFIG, flipBeforeBlast: process.env.FBB === "1" };
for (let i = 1; i <= N; i++) recs.push(playRandomGame(i, CFG));
const ms = Date.now() - t0;

const allV = recs.flatMap((r) => r.violations);
const byCode = new Map<string, number>();
for (const v of allV) byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1);

// 決定論チェック
let detOk = true;
for (let i = 1; i <= 50; i++) {
  const a = playRandomGame(i, DEFAULT_CONFIG, false), b = playRandomGame(i, DEFAULT_CONFIG, false);
  if (a.moves.join(',') !== b.moves.join(',') || a.winner !== b.winner) { detOk = false; break; }
}

const avg = (f: (r: GameRecord) => number) => (recs.reduce((a, r) => a + f(r), 0) / recs.length).toFixed(2);
const pct = (f: (r: GameRecord) => boolean) => ((recs.filter(f).length / recs.length) * 100).toFixed(1);

console.log(`games=${N}  ${ms}ms  (${(N / (ms / 1000)).toFixed(0)} games/s)`);
console.log(`VIOLATIONS: ${allV.length}` + (allV.length ? '\n  ' + [...byCode].map(([k, n]) => `${k}:${n}`).join('\n  ') : ' ✅'));
console.log(`determinism: ${detOk ? '✅' : '❌'}`);
console.log(`--- balance ---`);
console.log(`black win% = ${pct((r) => r.winner === 'BLACK')}  white = ${pct((r) => r.winner === 'WHITE')}  draw = ${pct((r) => r.winner === 'NONE')}`);
console.log(`plies avg=${avg((r) => r.plies)}  maxDepth avg=${avg((r) => r.maxDepth)} max=${Math.max(...recs.map((r) => r.maxDepth))}`);
console.log(`destroyed avg=${avg((r) => r.destroyed)}  bombFired=${avg((r) => r.bombFired)}  infect=${avg((r) => r.infectFired)}  shield=${avg((r) => r.shieldAbsorb)}  returns=${avg((r) => r.returns)}`);
console.log(`rescue% = ${pct((r) => r.rescues > 0)}  bothPass% = ${pct((r) => r.reason === 'BOTH_PASS')}  boardFull% = ${pct((r) => r.reason === 'BOARD_FULL')}  mutual% = ${pct((r) => r.reason === 'MUTUAL_EXTINCTION')}`);
console.log(`neutral on board avg=${avg((r) => r.neutral)}  final pieces avg=${avg((r) => r.black + r.white)}`);
const hands = new Map<string, { n: number; w: number }>();
for (const r of recs) {
  for (const [p, h] of Object.entries(r.hands)) {
    const e = hands.get(h) ?? { n: 0, w: 0 }; e.n++; if (r.winner === p) e.w++; hands.set(h, e);
  }
}
console.log(`--- hand win% (random AI) ---`);
for (const [h, e] of [...hands].sort()) console.log(`  ${h}: n=${e.n} win=${((e.w / e.n) * 100).toFixed(1)}%`);
