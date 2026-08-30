import type {
  BoardCell, ChainEvent, GameState, Move, Side, SpecialType, TurnResult, BlastRange,
} from './types.ts';
import type { RuleConfig } from './config.ts';
import {
  DIRS4, DIRS8, blastModeFor, canMove, capturesByDir, chebyshev, countPieces, decideWinner, skippableDirs,
  idx, inBoard, opponent, rangeCells, xOf, yOf,
} from './rules.ts';

const cloneCell = (c: BoardCell): BoardCell => ({ ...c });
export function cloneState(s: GameState): GameState {
  return {
    board: s.board.map(cloneCell),
    currentTurn: s.currentTurn,
    hands: {
      BLACK: { ...s.hands.BLACK, initialSpecials: [...s.hands.BLACK.initialSpecials], specialPieces: [...s.hands.BLACK.specialPieces] },
      WHITE: { ...s.hands.WHITE, initialSpecials: [...s.hands.WHITE.initialSpecials], specialPieces: [...s.hands.WHITE.specialPieces] },
    },
    activeQuestionCount: s.activeQuestionCount,
    status: s.status,
    passStreak: s.passStreak,
    moveNo: s.moveNo,
    endReason: s.endReason,
    winner: s.winner,
  };
}

interface Act { i: number; snap: BoardCell; src: number }

export function applyMove(prev: GameState, move: Move, cfg: RuleConfig): TurnResult {
  if (prev.status !== 'PLAYING') throw new Error('game finished');
  const s = cloneState(prev);
  const b = s.board;
  const mover = s.currentTurn;
  const hand = s.hands[mover];
  const ev: ChainEvent[] = [];
  const here = idx(move.x, move.y);

  // ---- 検証 ----
  if (b[here].state !== 'EMPTY') throw new Error('occupied');
  const isNeutralPlacement = move.kind === 'SPECIAL' && move.special === 'NEUTRAL';
  const byDir = capturesByDir(b, move.x, move.y, mover, cfg);
  const skipSet = new Set(cfg.optionalQuestionLines ? (move.skipDirs ?? []) : []);
  if (skipSet.size) {
    const allowed = new Set(skippableDirs(b, byDir, mover));
    for (const d of skipSet) if (!allowed.has(d)) throw new Error('dir not skippable');
  }
  const caps = byDir.flatMap((arr, d) => (skipSet.has(d) ? [] : arr));
  const freeNeutral = isNeutralPlacement && cfg.neutralFreePlacement;
  if (caps.length === 0 && !freeNeutral) throw new Error('illegal square');
  const hides = move.kind === 'DUMMY' || (move.kind === 'SPECIAL' && move.special !== 'NEUTRAL');
  if (hides && s.activeQuestionCount >= cfg.maxQuestionMarks) throw new Error('question limit');
  if (move.kind === 'DUMMY' && hand.dummyCount <= 0) throw new Error('no dummy');
  if (move.kind === 'SPECIAL') {
    const at = hand.specialPieces.indexOf(move.special!);
    if (at < 0) throw new Error('no such special');
    hand.specialPieces.splice(at, 1);
  }
  if (move.kind === 'DUMMY') hand.dummyCount--;

  // ---- helpers ----
  const reveal = (i: number) => {
    if (b[i].state === 'FACEDOWN') { b[i].state = 'FACEUP'; s.activeQuestionCount--; ev.push({ t: 'REVEAL', idx: i, special: b[i].specialType }); }
  };
  const wipe = (i: number) => {
    if (b[i].state === 'FACEDOWN') s.activeQuestionCount--;
    b[i] = { state: 'EMPTY', owner: 'NONE', specialType: 'NONE', durability: 0, isQueued: false, activated: false };
  };
  const giveBack = (owner: Side, sp: SpecialType, i: number) => {
    hand; s.hands[owner].specialPieces.push(sp);
    ev.push({ t: 'RETURN_TO_HAND', idx: i, owner, special: sp });
  };

  // ---- 着手 ----
  const cell = b[here];
  if (move.kind === 'SPECIAL' && move.special === 'NEUTRAL') {
    cell.state = 'FACEUP'; cell.owner = 'NONE'; cell.specialType = 'NEUTRAL';
  } else if (move.kind === 'SPECIAL') {
    cell.state = cfg.openSpecials ? 'FACEUP' : 'FACEDOWN';
    cell.owner = mover; cell.specialType = move.special!;
    cell.durability = move.special === 'SHIELD' ? cfg.shieldDurability : 0;
    if (!cfg.openSpecials) s.activeQuestionCount++;
  } else if (move.kind === 'DUMMY') {
    cell.state = 'FACEDOWN'; cell.owner = mover; cell.specialType = 'DUMMY';
    s.activeQuestionCount++;
  } else {
    cell.state = 'FACEUP'; cell.owner = mover; cell.specialType = 'NONE';
  }

  // ---- N確定・爆破射程確定（手番中不変）----
  const n = b.reduce((a, c) => a + (c.state === 'EMPTY' ? 0 : 1), 0);
  const blast: BlastRange = blastModeFor(n, cfg);
  ev.push({ t: 'PLACE', idx: here, by: mover, kind: move.kind, special: move.special, n, blast });

  // ---- 裏返しキュー確定（以降再計算しない）----
  const queued = isNeutralPlacement ? [] : [...new Set(caps)].sort((a, z) => a - z);
  // アニメーション用: 方向ごとに「着手マスに近い順」で保持する
  const queuedLines: number[][] = isNeutralPlacement ? []
    : byDir.map((arr, d) => (skipSet.has(d) ? [] : arr)).filter((arr) => arr.length > 0);
  /** 着手マスからの距離が近い順 → 方向順 に並べ替える（波紋状に広がる演出用） */
  const rippleOrder = (idxs: number[]) => [...idxs].sort((a, z) =>
    (chebyshev(here, a) - chebyshev(here, z)) || (yOf(a) - yOf(z)) || (xOf(a) - xOf(z)));
  const liveLines = () => queuedLines.map((l) => l.filter((i) => b[i].owner === mover && b[i].state === 'FACEUP')).filter((l) => l.length);
  for (const i of queued) b[i].isQueued = true;
  if (queued.length) ev.push({ t: 'QUEUE', idxs: queued });

  // ---- 連鎖フェーズ（BFS）----
  const destroyed = new Set<number>();
  const activated = new Set<number>();
  let cur: Act[] = queued
    .filter((i) => b[i].specialType === 'BOMB' || b[i].specialType === 'INFECT')
    .map((i) => ({ i, snap: cloneCell(b[i]), src: here }));
  let depth = 0;
  const earlyFlipped: number[] = [];
  if (cfg.flipBeforeBlast) {
    // 裏返しを先に確定する。爆破は「裏返し後の盤面」に作用する。
    for (const i of queued) {
      const c = b[i];
      if (c.specialType === 'SHIELD' && c.durability > 0) {
        c.durability--; c.specialType = 'NONE'; reveal(i);
        ev.push({ t: 'SHIELD_ABSORB', idx: i, cause: 'FLIP' });
        continue;
      }
      if (c.specialType === 'NEUTRAL' && cfg.neutralPermanent) continue; // 永続壁
      if (c.specialType === 'DUMMY' || c.specialType === 'BOMB' || c.specialType === 'INFECT') reveal(i);
      c.specialType = 'NONE'; c.owner = mover; c.state = 'FACEUP';
      earlyFlipped.push(i);
    }
    if (earlyFlipped.length) {
      const set = new Set(earlyFlipped);
      ev.push({
        t: 'FLIP', idxs: rippleOrder(earlyFlipped), to: mover, from: here,
        lines: queuedLines.map((l) => l.filter((i) => set.has(i))).filter((l) => l.length),
      });
    }
  }

  while (cur.length) {
    depth++;
    cur.sort((p, q) =>
      (chebyshev(p.src, p.i) - chebyshev(q.src, q.i)) || (yOf(p.i) - yOf(q.i)) || (xOf(p.i) - xOf(q.i)));
    const next: Act[] = [];

    for (const act of cur) {
      if (activated.has(act.i)) continue;
      activated.add(act.i);
      if (b[act.i].state !== 'EMPTY') b[act.i].activated = true;

      if (act.snap.specialType === 'BOMB') {
        if (b[act.i].state !== 'EMPTY') { reveal(act.i); wipe(act.i); }
        destroyed.add(act.i);
        const dest: number[] = [], abs: number[] = [], chained: number[] = [], owners: import('./types.ts').PlayerId[] = [];
        for (const j of rangeCells(act.i, blast)) {
          if (j === act.i) continue;
          const c = b[j];
          if (c.state === 'EMPTY') continue;
          if (cfg.bombSparesPlanter && c.owner === act.snap.owner) continue; // 原則①: 自陣は無傷
          if (c.specialType === 'SHIELD' && c.durability > 0) {
            c.durability--; c.specialType = 'NONE'; reveal(j); abs.push(j);
            ev.push({ t: 'SHIELD_ABSORB', idx: j, cause: 'BLAST' });
            continue;
          }
          const snap = cloneCell(c);
          reveal(j); wipe(j); destroyed.add(j);
          if (snap.specialType === 'BOMB' && cfg.bombDetonatesOnBlast && !activated.has(j)) {
            next.push({ i: j, snap, src: act.i }); chained.push(j); continue;
          }
          dest.push(j); owners.push(snap.owner);
          if (snap.specialType === 'INFECT' && (snap.isQueued || cfg.blastTriggersAllSpecials) && !activated.has(j)) {
            next.push({ i: j, snap, src: act.i }); continue; // 原則②: 発動権は失われない
          }
          if (!activated.has(j) && (snap.specialType === 'BOMB' || snap.specialType === 'INFECT' || snap.specialType === 'SHIELD')) {
            giveBack(snap.owner as Side, snap.specialType, j); // 未発動 → 手元に返却
          }
        }
        ev.push({ t: 'BOMB', depth, idx: act.i, range: blast, destroyed: dest, absorbed: abs, chained, owners, planter: act.snap.owner });

      } else if (act.snap.specialType === 'INFECT') {
        const own = act.snap.owner as Side, foe = opponent(own);
        const dirs = cfg.infectRange === 'CROSS' ? DIRS4 : DIRS8;
        const stolen: number[] = [];
        for (const [dx, dy] of dirs) {
          const nx = xOf(act.i) + dx, ny = yOf(act.i) + dy;
          if (!inBoard(nx, ny)) continue;
          const c = b[idx(nx, ny)];
          if (c.state !== 'FACEUP') continue;          // 裏向きは免疫
          if (c.specialType !== 'NONE') continue;      // 中立・特殊コマは対象外（原則①）
          if (c.owner !== foe) continue;
          c.owner = own; stolen.push(idx(nx, ny));
        }
        let selfFlipped = false;
        if (b[act.i].state !== 'EMPTY') {
          reveal(act.i);
          b[act.i].owner = foe; b[act.i].specialType = 'NONE'; b[act.i].state = 'FACEUP';
          selfFlipped = true;
        }
        ev.push({ t: 'INFECT', depth, idx: act.i, stolen, selfFlipped });
      }
    }
    cur = next;
  }

  // ---- 裏返し確定処理 ----
  const flipped: number[] = [], cancelled: number[] = [];
  for (const i of (cfg.flipBeforeBlast ? [] : queued)) {
    if (destroyed.has(i) || b[i].state === 'EMPTY') { cancelled.push(i); continue; }
    if (activated.has(i)) continue;
    const c = b[i];
    if (c.specialType === 'SHIELD' && c.durability > 0) {
      c.durability--; c.specialType = 'NONE'; reveal(i);
      ev.push({ t: 'SHIELD_ABSORB', idx: i, cause: 'FLIP' });
      continue;
    }
    if (c.specialType === 'NEUTRAL' && cfg.neutralPermanent) continue; // 永続壁
    if (c.specialType === 'DUMMY') { reveal(i); c.specialType = 'NONE'; }
    else if (c.specialType === 'NEUTRAL') { c.specialType = 'NONE'; }
    c.owner = mover; c.state = 'FACEUP'; flipped.push(i);
  }
  if (flipped.length) {
    const set = new Set(flipped);
    ev.push({
      t: 'FLIP', idxs: rippleOrder(flipped), to: mover, from: here,
      lines: queuedLines.map((l) => l.filter((i) => set.has(i))).filter((l) => l.length),
    });
  }
  if (cancelled.length) ev.push({ t: 'FLIP_CANCELLED', idxs: cancelled });

  for (const c of b) { c.isQueued = false; c.activated = false; }
  s.moveNo++;

  // ---- 救済判定（終局判定より優先）----
  applyRescue(s, cfg, ev);

  // ---- 手番交代・パス・終局 ----
  if (s.status === 'PLAYING') {
    s.currentTurn = opponent(mover);
    s.passStreak = 0;
    settleTurnStart(s, cfg, ev);
  }
  return { state: s, events: ev, maxDepth: depth };
}

function centralPool(size: number): number[] {
  const lo = (8 - size) / 2, hi = lo + size - 1;
  const out: number[] = [];
  for (let y = lo; y <= hi; y++) for (let x = lo; x <= hi; x++) out.push(idx(x, y));
  return out;
}

export function applyRescue(s: GameState, cfg: RuleConfig, ev: ChainEvent[]) {
  const { black, white } = countPieces(s.board);
  const dead: Side[] = [];
  if (black === 0) dead.push('BLACK');
  if (white === 0) dead.push('WHITE');
  if (dead.length === 0) return;
  if (dead.length === 2) {
    if (cfg.mutualExtinctionIsDraw) { finish(s, ev, 'MUTUAL_EXTINCTION'); return; }
  }
  for (const p of dead) {
    const pools = [centralPool(cfg.rescueAreaSize), centralPool(cfg.rescueAreaSize + 2),
      [...Array(64).keys()].filter((i) => !(xOf(i) % 7 === 0 && yOf(i) % 7 === 0))];
    let placed = -1;
    for (const pool of pools) {
      const free = pool.filter((i) => s.board[i].state === 'EMPTY')
        .sort((a, z) => (yOf(a) - yOf(z)) || (xOf(a) - xOf(z)));
      if (free.length) { placed = free[0]; break; }
    }
    if (placed < 0) continue; // 盤面満杯 → 復帰不能
    s.board[placed] = { state: 'FACEUP', owner: p, specialType: 'NONE', durability: 0, isQueued: false, activated: false };
    ev.push({ t: 'RESCUE', idx: placed, player: p });
  }
}

/** 手番開始時のパス処理と終局判定 */
export function settleTurnStart(s: GameState, cfg: RuleConfig, ev: ChainEvent[]) {
  for (let guard = 0; guard < 3; guard++) {
    if (s.board.every((c) => c.state !== 'EMPTY')) { finish(s, ev, 'BOARD_FULL'); return; }
    if (canMove(s, cfg)) { return; }
    ev.push({ t: 'PASS', player: s.currentTurn });
    s.passStreak++;
    if (s.passStreak >= 2) { finish(s, ev, 'BOTH_PASS'); return; }
    s.currentTurn = opponent(s.currentTurn);
  }
  finish(s, ev, 'BOTH_PASS');
}

export function finish(s: GameState, ev: ChainEvent[], reason: GameState['endReason']) {
  s.status = 'FINISHED';
  s.endReason = reason;
  s.winner = decideWinner(s.board);
  const { black, white } = countPieces(s.board);
  ev.push({ t: 'END', reason: reason!, winner: s.winner, black, white });
}
