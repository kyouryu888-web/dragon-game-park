import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/features/reversi/bakuretsu/config.ts';
import { initGame, makeRng, legalMoves, countPieces } from '../../src/features/reversi/bakuretsu/rules.ts';
import { applyMove, settleTurnStart } from '../../src/features/reversi/bakuretsu/engine.ts';
import type { ChainEvent, GameState, Move } from '../../src/features/reversi/bakuretsu/types.ts';
import golden from './golden.json';

const cfg = { ...DEFAULT_CONFIG, specialCount: 3 };

/** 盤面を64文字に符号化。移植先で同じ文字列になれば一致 */
const CH: Record<string, string> = {
  'EMPTY': '.', 'BLACK/NONE': 'B', 'WHITE/NONE': 'W',
  'BLACK/BOMB': 'b', 'WHITE/BOMB': 'w', 'BLACK/INFECT': 'i', 'WHITE/INFECT': 'I',
  'BLACK/SHIELD': 's', 'WHITE/SHIELD': 'S', 'NONE/NEUTRAL': 'n',
};
function encode(s: GameState): string {
  return s.board.map((c) => c.state === 'EMPTY' ? '.' : (CH[`${c.owner}/${c.specialType}`] ?? '?')).join('');
}

interface Vector {
  seed: number;
  hands: { BLACK: string[]; WHITE: string[] };
  moves: string[];       // "x,y,kind[,special]"
  board: string;         // 最終盤面64文字
  winner: string;
  reason: string;
  counts: { black: number; white: number; neutral: number };
  events: Record<string, number>; // イベント種別ごとの回数
}

function run(seed: number): Vector {
  const rng = makeRng(seed);
  let s: GameState = initGame(cfg, rng);
  const all: ChainEvent[] = [];
  const moves: string[] = [];
  settleTurnStart(s, cfg, all);
  const hands = {
    BLACK: [...s.hands.BLACK.initialSpecials],
    WHITE: [...s.hands.WHITE.initialSpecials],
  };
  let guard = 0;
  while (s.status === 'PLAYING' && guard++ < 200) {
    const opts = legalMoves(s, cfg);
    if (opts.length === 0) break;
    const m: Move = opts[(rng() * opts.length) | 0];
    moves.push(`${m.x},${m.y},${m.kind}${m.special ? ',' + m.special : ''}`);
    const r = applyMove(s, m, cfg);
    s = r.state; all.push(...r.events);
  }
  const c = countPieces(s.board);
  const events: Record<string, number> = {};
  for (const e of all) events[e.t] = (events[e.t] ?? 0) + 1;
  return {
    seed, hands, moves, board: encode(s),
    winner: s.winner ?? '?', reason: s.endReason ?? '?',
    counts: { black: c.black, white: c.white, neutral: c.neutral }, events,
  };
}

describe('爆裂リバーシーのgolden移植検証', () => {
  it('golden.jsonの300件と全着手列・最終盤面・勝敗・終局理由が一致する', () => {
    const vectors = golden.vectors as Vector[];
    expect(vectors).toHaveLength(300);
    for (const vector of vectors) {
      const actual = run(vector.seed);
      expect(actual.moves, `seed=${vector.seed} moves`).toEqual(vector.moves);
      expect(actual.board, `seed=${vector.seed} board`).toBe(vector.board);
      expect(actual.winner, `seed=${vector.seed} winner`).toBe(vector.winner);
      expect(actual.reason, `seed=${vector.seed} reason`).toBe(vector.reason);
    }
  }, 15_000);
});
