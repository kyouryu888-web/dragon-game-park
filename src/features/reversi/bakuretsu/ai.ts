import type { GameState, Move, Side, SpecialType } from './types.ts';
import type { RuleConfig } from './config.ts';
import {
  CORNERS, DIRS8, blastModeFor, capturesByDir, cornerCount, countPieces, idx, inBoard,
  legalSquares, opponent, rangeCells, skippableDirs, xOf, yOf,
} from './rules.ts';
import { applyMove } from './engine.ts';
import { redact, estimate } from './view.ts';

export type Level = 1 | 2 | 3 | 4 | 5;

// 標準的なリバーシ位置評価（角=最大、C/X打ち=負）
const W = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

export interface AiMemory {
  revealed: SpecialType[];   // 相手の開示済み正体（公開情報）
  oppBluffs: number;         // 相手の「？」がダミーだった回数
  oppReals: number;          // 相手の「？」が本物だった回数
}
export const newMemory = (): AiMemory => ({ revealed: [], oppBluffs: 0, oppReals: 0 });

export interface AiConfig {
  level: Level;
  /** 相手の「？」をどれだけ警戒するか 0=完全無視 1=最大警戒。G7検証で独立に振る */
  suspicion?: number;
  /** ★検証専用: 伏せカードの正体が見える（情報価値の上限を測るため） */
  omniscient?: boolean;
}

const SUSPICION: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0.8, 5: 1.0 };
/** レベルごとの手のブレ幅（ε-greedy）。階梯を単調にする調整ノブ */
const EPS: Record<Level, number> = { 1: 1, 2: 0.62, 3: 0.18, 4: 0.02, 5: 0 };
/** レベルごとの固定の癖（プレイヤーが学習できる偏り）: 本物を置く確率 */
const REAL_RATE: Record<Level, number> = { 1: 1, 2: 1, 3: 0.5, 4: 0.6, 5: 0.5 };

export function evaluatePublic(s: GameState, me: Side, cfg: RuleConfig): number { return evaluate(s, me, cfg, true); }
/** フロンティア: 空きマスに接する自コマは相手に打たれる足場になる（少ないほど良い） */
function frontier(s: GameState, me: Side): number {
  const foe = opponent(me);
  let mine = 0, theirs = 0;
  for (let i = 0; i < 64; i++) {
    const c = s.board[i];
    if (c.state === 'EMPTY' || c.owner === 'NONE') continue;
    let open = false;
    for (const [dx, dy] of DIRS8) {
      const nx = xOf(i) + dx, ny = yOf(i) + dy;
      if (inBoard(nx, ny) && s.board[idx(nx, ny)].state === 'EMPTY') { open = true; break; }
    }
    if (!open) continue;
    if (c.owner === me) mine++; else if (c.owner === foe) theirs++;
  }
  return mine - theirs;
}
function evaluate(s: GameState, me: Side, cfg: RuleConfig, advanced = false): number {
  const foe = opponent(me);
  const c = countPieces(s.board);
  const n = 64 - c.empty;
  let pos = 0;
  for (let i = 0; i < 64; i++) {
    const cell = s.board[i];
    if (cell.state === 'EMPTY' || cell.owner === 'NONE') continue;
    pos += W[i] * (cell.owner === me ? 1 : -1);
  }
  const myMob = legalSquares(s, cfg, me).length;
  const foeMob = legalSquares(s, cfg, foe).length;
  const disc = (me === 'BLACK' ? c.black - c.white : c.white - c.black);
  const corner = cornerCount(s.board, me) - cornerCount(s.board, foe);
  const t = Math.min(1, n / 60);                 // 進行度
  const wPos = 1.0, wMob = 12 * (1 - t) + 2, wDisc = 1 + 14 * t;
  let v = wPos * pos + wMob * (myMob - foeMob) + wDisc * disc + 90 * corner;
  if (advanced) v -= frontier(s, me) * (14 * (1 - t) + 2);
  return v;
}

/** 相手の「？」を裏返すことの期待損失 */
function hiddenRisk(v: GameState, me: Side, flipped: number[], n: number, cfg: RuleConfig, mem: AiMemory, susp: number): number {
  if (susp <= 0) return 0;
  const foe = opponent(me);
  const bel = estimate(v, me, mem.revealed);
  // @ts-expect-error -- 移植元の未使用変数をそのまま保持する
  const mode = blastModeFor(n, cfg);
  let pen = 0;
  for (const j of flipped) {
    const cell = v.board[j];
    if (cell.owner !== foe) continue;
    if (cell.state === 'FACEUP') {
      // 公開された特殊コマ: 実測値に基づく期待損失
      const t2 = Math.min(1, (64 - v.board.filter((c) => c.state === 'EMPTY').length) / 60);
      const w2 = 1 + 14 * t2;
      if (cell.specialType === 'BOMB') pen += 0.25 * w2 * susp;
      else if (cell.specialType === 'INFECT') pen += 1.07 * w2 * susp;
      else if (cell.specialType === 'SHIELD') pen += 1.0 * w2 * susp;
      continue;
    }
    if (cell.state !== 'FACEDOWN') continue;
    const known = cell.specialType;
    const b = bel.find((x) => x.idx === j) ?? { idx: j, pBomb: 0, pInfect: 0, pShield: 0, pDummy: 0 };
    if (known === 'BOMB') { b.pBomb = 1; b.pInfect = 0; b.pShield = 0; }
    else if (known === 'INFECT') { b.pBomb = 0; b.pInfect = 1; b.pShield = 0; }
    else if (known === 'SHIELD') { b.pBomb = 0; b.pInfect = 0; b.pShield = 1; }
    else if (known === 'DUMMY') { b.pBomb = 0; b.pInfect = 0; b.pShield = 0; }
    // 実測値に基づくコマ換算の期待損失（trapvalue.ts より）
    const t = Math.min(1, (64 - v.board.filter((c) => c.state === 'EMPTY').length) / 60);
    const wDisc = 1 + 14 * t;
    pen += (b.pBomb * 1.15 + b.pInfect * 4.5 + b.pShield * 1.0) * wDisc;
  }
  return pen * susp;
}

/** 案B: 「？」を含む方向のうち、辞退した方が得な方向を返す */
function riskyDirs(v: GameState, me: Side, at: number, cfg: RuleConfig, mem: AiMemory, susp: number): number[] {
  if (susp <= 0) return [];
  const byDir = capturesByDir(v.board, xOf(at), yOf(at), me, cfg);
  const cand = skippableDirs(v.board, byDir, me);
  if (!cand.length) return [];
  const bel = estimate(v, me, mem.revealed);
  const risky: number[] = [];
  for (const d of cand) {
    let pen = 0;
    for (const j of byDir[d]) {
      const c = v.board[j];
      if (c.state !== 'FACEDOWN' || c.owner === me) continue;
      const b = bel.find((x) => x.idx === j);
      let pB = b?.pBomb ?? 0, pI = b?.pInfect ?? 0, pS = b?.pShield ?? 0;
      const k = c.specialType; // 全知AIならここに実値が入る
      if (k === 'BOMB') { pB = 1; pI = 0; pS = 0; }
      else if (k === 'INFECT') { pB = 0; pI = 1; pS = 0; }
      else if (k === 'SHIELD') { pB = 0; pI = 0; pS = 1; }
      else if (k === 'DUMMY') { pB = 0; pI = 0; pS = 0; }
      pen += pB * 1.15 + pI * 4.5 + pS * 1.0;
    }
    if (pen * susp > 0.6) risky.push(d);
  }
  const rest = byDir.flatMap((arr, d) => (risky.includes(d) ? [] : arr));
  return rest.length ? risky : [];
}

/** 特殊コマ／ダミーをどこに伏せるか: 相手に触られやすく、自軍密度が低いマスを好む */
function hideValue(v: GameState, me: Side, at: number): number {
  const foe = opponent(me);
  let foeAdj = 0, myAdj = 0;
  for (const k of rangeCells(at, 'EIGHT')) {
    if (k === at) continue;
    const c = v.board[k];
    if (c.state === 'EMPTY' || c.owner === 'NONE') continue;
    if (c.owner === foe) foeAdj++; else myAdj++;
  }
  return foeAdj * 3 - myAdj * 2;
}

export function chooseMove(
  full: GameState, cfgRules: RuleConfig, ai: AiConfig, rng: () => number, mem: AiMemory,
): Move {
  const me = full.currentTurn;
  const v = ai.omniscient ? full : redact(full, me); // 通常は公開情報のみ
  const lvl = ai.level;
  const susp = ai.suspicion ?? SUSPICION[lvl];
  const hand = v.hands[me];
  const squares = legalSquares(v, cfgRules, me);
  const neutralOnly = squares.length === 0;
  if (neutralOnly) {
    const empties = [...Array(64).keys()].filter((i) => v.board[i].state === 'EMPTY');
    return { x: xOf(empties[0]), y: yOf(empties[0]), kind: 'SPECIAL', special: 'NEUTRAL' };
  }

  // --- Lv1: 完全ランダム（伏せない） ---
  if (lvl === 1) {
    const i = squares[(rng() * squares.length) | 0];
    return { x: xOf(i), y: yOf(i), kind: 'NORMAL' };
  }

  // --- Lv2+: マス選択を1手先評価、Lv5のみ相手最善応手まで読む ---
  const n0 = 64 - countPieces(v.board).empty;
  const scored = squares.map((i) => {
    const variants: Move[] = [{ x: xOf(i), y: yOf(i), kind: 'NORMAL' }];
    if (cfgRules.optionalQuestionLines) {
      const rd = riskyDirs(v, me, i, cfgRules, mem, susp);
      if (rd.length) variants.push({ x: xOf(i), y: yOf(i), kind: 'NORMAL', skipDirs: rd });
    }
    let sc = -1e9, skip: number[] | undefined;
    for (const m of variants) {
      try {
        const r = applyMove(v, m, cfgRules);
        const flipped = r.events.flatMap((e) => (e.t === 'FLIP' ? e.idxs : []));
        const val = evaluate(r.state, me, cfgRules, lvl >= 4) - hiddenRisk(v, me, flipped, n0 + 1, cfgRules, mem, susp);
        if (val > sc) { sc = val; skip = m.skipDirs; }
      } catch { /* skip */ }
    }
    return { i, sc, skip };
  }).sort((a, b) => b.sc - a.sc);

  let pick = scored[0].i;
  let pickSkip = scored[0].skip;
  if (rng() < EPS[lvl]) { pick = squares[(rng() * squares.length) | 0]; pickSkip = undefined; }
  else if (lvl === 5) {
    const top = scored.slice(0, 10);
    let bestVal = -Infinity;
    for (const cand of top) {
      const m: Move = { x: xOf(cand.i), y: yOf(cand.i), kind: 'NORMAL' };
      let worst = Infinity;
      try {
        const r = applyMove(v, m, cfgRules);
        if (r.state.status !== 'PLAYING') { worst = evaluate(r.state, me, cfgRules, true); }
        else {
          const reply = legalSquares(r.state, cfgRules, r.state.currentTurn).slice(0, 8);
          if (reply.length === 0) worst = evaluate(r.state, me, cfgRules, true);
          for (const j of reply) {
            try {
              const r2 = applyMove(r.state, { x: xOf(j), y: yOf(j), kind: 'NORMAL' }, cfgRules);
              worst = Math.min(worst, evaluate(r2.state, me, cfgRules, true));
            } catch { /* skip */ }
          }
        }
      } catch { worst = -1e9; }
      if (worst > bestVal) { bestVal = worst; pick = cand.i; pickSkip = cand.skip; }
    }
  }
  const chosen = decorate(v, me, pick, hand, lvl, rng, cfgRules, susp);
  return pickSkip ? { ...chosen, skipDirs: pickSkip } : chosen;
}

/** そのマスに「何を」置くか決める（通常／ダミー／特殊）。レベルごとの癖はここ。 */
function decorate(
  v: GameState, me: Side, at: number, hand: GameState['hands'][Side],
  lvl: Level, rng: () => number, cfg: RuleConfig, _susp: number,
): Move {
  const base: Move = { x: xOf(at), y: yOf(at), kind: 'NORMAL' };
  const canHide = v.activeQuestionCount < cfg.maxQuestionMarks;
  const specials = hand.specialPieces.filter((k) => k !== 'NEUTRAL');
  const hasNeutral = hand.specialPieces.includes('NEUTRAL');
  const hv = hideValue(v, me, at);

  // 中立コマ: 自分のモビリティを削らず相手の展開を塞げるときだけ
  if (hasNeutral && lvl >= 4 && hv > 6 && rng() < 0.15) {
    return { ...base, kind: 'SPECIAL', special: 'NEUTRAL' };
  }
  if (!canHide || hv < 2) return base;
  if (lvl === 2) {
    return specials.length ? { ...base, kind: 'SPECIAL', special: specials[0] } : base;
  }
  const nearCorner = CORNERS.some((c) => Math.abs(xOf(c) - xOf(at)) <= 2 && Math.abs(yOf(c) - yOf(at)) <= 2);
  let realRate = REAL_RATE[lvl];
  if (lvl === 4 && nearCorner) realRate = 0.9;   // Lv4の癖: 角付近は本物
  if (lvl === 5) realRate = 0.35 + 0.3 * rng();  // Lv5: 読まれにくく揺らす

  const wantReal = rng() < realRate;
  if (wantReal && specials.length) {
    return { ...base, kind: 'SPECIAL', special: specials[(rng() * specials.length) | 0] };
  }
  if (hand.dummyCount > 0) return { ...base, kind: 'DUMMY' };
  if (specials.length) return { ...base, kind: 'SPECIAL', special: specials[0] };
  return base;
}
