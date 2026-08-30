import { DEFAULT_CONFIG } from './config.ts';
import { initGame, makeRng, legalMoves, countPieces } from './rules.ts';
import { applyMove, settleTurnStart } from './engine.ts';
import type { ChainEvent, GameState, Move } from './types.ts';
import { readFileSync, writeFileSync } from 'node:fs';

const cfg = DEFAULT_CONFIG;

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

const mode = process.argv[2] ?? 'generate';
const path = process.argv[4] ?? 'golden.json';

if (mode === 'generate') {
  const n = Number(process.argv[3] ?? 200);
  const vectors: Vector[] = [];
  for (let i = 1; i <= n; i++) vectors.push(run(i));
  writeFileSync(path, JSON.stringify({
    note: '爆裂リバーシー 移植検証用の正解データ。同じ乱数（mulberry32）と同じ手選択で、moves と board が完全一致すること。',
    rng: 'mulberry32 (rules.ts の makeRng と同一)',
    config: cfg, vectors,
  }, null, 1));
  console.log(`${n}件の正解データを ${path} に出力しました`);
  const agg = vectors.reduce((a, v) => { for (const [k, c] of Object.entries(v.events)) a[k] = (a[k] ?? 0) + c; return a; }, {} as Record<string, number>);
  console.log('含まれるイベント:', Object.entries(agg).map(([k, v]) => `${k}=${v}`).join(' '));
} else {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  let okc = 0, ng = 0;
  for (const v of data.vectors as Vector[]) {
    const r = run(v.seed);
    const same = r.board === v.board && r.moves.join('|') === v.moves.join('|')
      && r.winner === v.winner && r.reason === v.reason;
    if (same) okc++; else { ng++; if (ng <= 3) console.log(`  ❌ seed=${v.seed} 不一致`); }
  }
  console.log(`照合 ${okc + ng}件: 一致 ${okc} / 不一致 ${ng}  ${ng === 0 ? '✅ 完全一致' : '❌ 移植にズレがあります'}`);
  if (ng > 0) process.exitCode = 1;
}
