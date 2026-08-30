import type { ChainEvent, GameState, Side } from './types.ts';
import type { RuleConfig } from './config.ts';
import { countPieces } from './rules.ts';

export type Violation = { code: string; detail: string };

/** 単一状態の整合性 */
export function checkState(s: GameState, cfg: RuleConfig): Violation[] {
  const v: Violation[] = [];
  let fd = 0;
  for (let i = 0; i < 64; i++) {
    const c = s.board[i];
    if (c.state === 'FACEDOWN') fd++;
    if (c.state === 'EMPTY' && (c.owner !== 'NONE' || c.specialType !== 'NONE')) v.push({ code: 'EMPTY_DIRTY', detail: `${i}` });
    if (c.specialType === 'NEUTRAL' && (c.state !== 'FACEUP' || c.owner !== 'NONE')) v.push({ code: 'NEUTRAL_FORM', detail: `${i}` });
    if (c.state === 'FACEUP' && c.specialType !== 'NEUTRAL' && c.owner === 'NONE') v.push({ code: 'FACEUP_NO_OWNER', detail: `${i}` });
    if (c.state === 'FACEUP' && !cfg.openSpecials && !['NONE', 'NEUTRAL'].includes(c.specialType)) v.push({ code: 'FACEUP_SPECIAL', detail: `${i}:${c.specialType}` });
    if (c.state === 'FACEUP' && cfg.openSpecials && c.specialType !== 'NONE' && c.specialType !== 'NEUTRAL') {
      const h = s.hands[c.owner as Side];
      if (!h || !h.initialSpecials.includes(c.specialType)) v.push({ code: 'P1_ALIEN_SPECIAL', detail: `${i}` });
    }
    if (c.durability < 0) v.push({ code: 'NEG_DURABILITY', detail: `${i}` });
    if (c.isQueued || c.activated) v.push({ code: 'FLAG_LEAK', detail: `${i}` });
    // 原則①: 配られていない特殊コマが盤上に存在しない
    if (c.state === 'FACEDOWN' && c.specialType !== 'DUMMY' && c.specialType !== 'NONE') {
      const h = s.hands[c.owner as Side];
      if (!h || !h.initialSpecials.includes(c.specialType)) v.push({ code: 'P1_ALIEN_SPECIAL', detail: `${i}:${c.specialType}:${c.owner}` });
    }
  }
  if (fd !== s.activeQuestionCount) v.push({ code: 'AQC_MISMATCH', detail: `${fd} vs ${s.activeQuestionCount}` });
  if (s.activeQuestionCount > cfg.maxQuestionMarks) v.push({ code: 'AQC_OVER', detail: `${s.activeQuestionCount}` });
  for (const p of ['BLACK', 'WHITE'] as Side[]) {
    const h = s.hands[p];
    if (h.dummyCount < 0 || h.dummyCount > cfg.dummyCount) v.push({ code: 'DUMMY_RANGE', detail: `${p}:${h.dummyCount}` });
    if (h.specialPieces.length > cfg.specialCount) v.push({ code: 'HAND_OVERFLOW', detail: `${p}` });
    if (new Set(h.initialSpecials).size !== h.initialSpecials.length) v.push({ code: 'DEAL_DUP', detail: `${p}` });
    for (const sp of h.specialPieces) if (!h.initialSpecials.includes(sp)) v.push({ code: 'P1_HAND_ALIEN', detail: `${p}:${sp}` });
  }
  return v;
}

/** 手番をまたぐ不可逆性チェック（原則③） */
export function checkTransition(a: GameState, bst: GameState, ev: ChainEvent[]): Violation[] {
  const v: Violation[] = [];
  const na = countPieces(a.board).neutral, nb = countPieces(bst.board).neutral;
  const placedNeutral = ev.some((e) => e.t === 'PLACE' && e.special === 'NEUTRAL');
  if (nb > na + (placedNeutral ? 1 : 0)) v.push({ code: 'P3_NEUTRAL_REBORN', detail: `${na}->${nb}` });
  for (let i = 0; i < 64; i++) {
    const x = a.board[i], y = bst.board[i];
    if (y.durability > x.durability && !(x.state === 'EMPTY')) v.push({ code: 'P3_DURABILITY_UP', detail: `${i}` });
    // 原則①: 相手の特殊コマが自色化していない（裏向きのまま所有者が変わる）
    if (x.state === 'FACEDOWN' && y.state === 'FACEDOWN' && x.specialType === y.specialType && x.owner !== y.owner) {
      v.push({ code: 'P1_OWNER_STOLEN', detail: `${i}` });
    }
  }
  for (const p of ['BLACK', 'WHITE'] as Side[]) {
    if (bst.hands[p].dummyCount > a.hands[p].dummyCount) v.push({ code: 'DUMMY_REGEN', detail: p });
  }
  return v;
}
