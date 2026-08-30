import type { GameState, Side, SpecialType } from './types.ts';
import { opponent } from './rules.ts';
import { cloneState } from './engine.ts';

/**
 * 視点 viewer から見える情報だけを残した状態を返す。
 * - 相手の裏向きコマの正体・耐久は隠す
 * - 相手の specialPieces 残数・dummyCount は隠す（★秘匿必須）
 * - initialSpecials と activeQuestionCount は公開情報なので残す
 *
 * AIはこの結果しか受け取らない（カンニング防止）。
 * サーバ権威実装では、これがそのままクライアントへの送信ペイロードになる。
 */
export function redact(s: GameState, viewer: Side): GameState {
  const v = cloneState(s);
  for (const c of v.board) {
    if (c.state === 'FACEDOWN' && c.owner !== viewer) {
      c.specialType = 'NONE';
      c.durability = 0;
    }
  }
  const foe = opponent(viewer);
  // 相手が「まだ何を持っているか」は推定対象であって既知ではない。
  // 探索では公開情報の initialSpecials を上限として仮定する。
  v.hands[foe] = {
    ...v.hands[foe],
    specialPieces: [...v.hands[foe].initialSpecials],
    dummyCount: -1,
  };
  return v;
}

/** 遮蔽が実際に効いているかの検査（カテゴリA アサーション） */
export function redactionLeaks(s: GameState, viewer: Side): string[] {
  const v = redact(s, viewer);
  const out: string[] = [];
  const foe = opponent(viewer);
  for (let i = 0; i < 64; i++) {
    const a = s.board[i], b = v.board[i];
    if (a.state === 'FACEDOWN' && a.owner === foe) {
      if (b.specialType !== 'NONE') out.push(`LEAK_SPECIAL@${i}`);
      if (b.durability !== 0) out.push(`LEAK_DURABILITY@${i}`);
    }
    if (a.state !== b.state || a.owner !== b.owner) out.push(`VIEW_DESYNC@${i}`);
  }
  if (v.hands[foe].dummyCount >= 0) out.push('LEAK_DUMMY_COUNT');
  const realRemain = s.hands[foe].specialPieces.join('/');
  const shown = v.hands[foe].specialPieces.join('/');
  if (shown !== s.hands[foe].initialSpecials.join('/') && shown === realRemain) out.push('LEAK_HAND_REMAIN');
  if (v.activeQuestionCount !== s.activeQuestionCount) out.push('AQC_DESYNC');
  return out;
}

export type Belief = { idx: number; pBomb: number; pInfect: number; pShield: number; pDummy: number };

/**
 * 相手の裏向きコマが何であるかの単純ベイズ推定。
 * 公開情報（相手の initialSpecials、これまでに開示された正体）だけを使う。
 */
export function estimate(view: GameState, viewer: Side, revealed: SpecialType[]): Belief[] {
  const foe = opponent(viewer);
  const pool: SpecialType[] = [...view.hands[foe].initialSpecials.filter((k) => k !== 'NEUTRAL')];
  const left = pool.filter((k) => !revealed.includes(k));
  const dummiesLeft = Math.max(0, 2 - revealed.filter((k) => k === 'DUMMY').length);
  const total = left.length + dummiesLeft;
  const out: Belief[] = [];
  for (let i = 0; i < 64; i++) {
    const c = view.board[i];
    if (c.state !== 'FACEDOWN' || c.owner !== foe) continue;
    const q = (k: SpecialType) => (total > 0 && left.includes(k) ? 1 / total : 0);
    out.push({
      idx: i, pBomb: q('BOMB'), pInfect: q('INFECT'), pShield: q('SHIELD'),
      pDummy: total > 0 ? dummiesLeft / total : 0,
    });
  }
  return out;
}
