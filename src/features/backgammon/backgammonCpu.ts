import type { CpuLevel, GameState, PlayerId } from './backgammonTypes';
import {
  getLegalMoveSequences,
  getOpponent,
  getPipCount,
  type MoveSequence,
  type Rng,
} from './backgammonRules';

// ---- CPU 表示名（マンカラと共通のドラゴン段位） ----
export function getCpuDisplayName(level: CpuLevel): string {
  switch (level) {
    case 'very-easy': return 'ベビードラゴン';
    case 'easy':      return 'ドラゴン';
    case 'normal':    return 'スーパードラゴン';
    case 'hard':      return 'ドラゴンキング';
    case 'very-hard': return 'ゴッドドラゴン';
  }
}

// ============================================================
// 盤面評価
// ============================================================

/** あるブロット（1枚駒）が相手に打たれる確率（36通り中の当たり数 / 36） */
function hitProbability(state: GameState, player: PlayerId, blotIndex: number): number {
  const opponent = getOpponent(player);
  const oppDir = opponent === 'white' ? -1 : 1;

  // 相手の駒（バー含む）からブロットまでの距離を集める
  const distances: number[] = [];
  if (state.bar[opponent] > 0) {
    const entryDistance = opponent === 'white' ? 24 - blotIndex : blotIndex + 1;
    if (entryDistance >= 1 && entryDistance <= 6) distances.push(entryDistance);
  }
  for (let i = 0; i < 24; i++) {
    const p = state.points[i];
    if (!p || p.owner !== opponent) continue;
    const d = (blotIndex - i) * oppDir;
    if (d >= 1 && d <= 24) distances.push(d);
  }
  if (distances.length === 0) return 0;

  // 36通りの出目のうちヒットできる組み合わせを数える（直接ヒットのみの近似 + ゾロ目連打）
  let hits = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      const reachable = new Set<number>();
      reachable.add(d1);
      reachable.add(d2);
      if (d1 !== d2) {
        reachable.add(d1 + d2);
      } else {
        reachable.add(d1 * 2);
        reachable.add(d1 * 3);
        reachable.add(d1 * 4);
      }
      if (distances.some((d) => reachable.has(d))) hits++;
    }
  }
  return hits / 36;
}

/**
 * 盤面を player 視点でスコアリング（大きいほど有利）。
 * exactHits=true なら被ヒット確率を36通り計算、false なら簡易ペナルティ。
 */
export function evaluateState(state: GameState, player: PlayerId, exactHits: boolean): number {
  const opponent = getOpponent(player);
  let score = 0;

  // ピップ差（レースの基本）
  score += (getPipCount(state, opponent) - getPipCount(state, player)) * 1.0;

  // ベアオフ済みは大きく加点
  score += state.borneOff[player] * 18;
  score -= state.borneOff[opponent] * 18;

  // 相手をバーに送っている
  score += state.bar[opponent] * 14;
  score -= state.bar[player] * 14;

  const [homeLo, homeHi] = player === 'white' ? [0, 5] : [18, 23];
  const [oppHomeLo, oppHomeHi] = player === 'white' ? [18, 23] : [0, 5];

  for (let i = 0; i < 24; i++) {
    const p = state.points[i];
    if (!p) continue;
    if (p.owner === player) {
      if (p.count >= 2) {
        score += 3; // ポイント形成
        if (i >= homeLo && i <= homeHi) score += 3;           // ホームボード強化
        if (i >= oppHomeLo && i <= oppHomeHi) score += 2;     // 相手陣内のアンカー
      } else if (p.count === 1) {
        // ブロットの危険度
        if (exactHits) {
          const risk = hitProbability(state, player, i);
          const depth = player === 'white' ? 24 - i : i + 1; // 進んでいるほど痛い
          score -= risk * (10 + depth * 0.8);
        } else {
          score -= 5;
        }
      }
      if (p.count > 4) score -= (p.count - 4) * 0.5; // 過積載は軽く減点
    }
  }
  return score;
}

// ============================================================
// 手番の選択
// ============================================================

/** 難易度に応じて手順（1ターン分の全手）を選ぶ */
export function chooseCpuMoveSequence(
  state: GameState,
  level: CpuLevel = 'normal',
  rng: Rng = Math.random,
): MoveSequence | null {
  const sequences = getLegalMoveSequences(state);
  if (sequences.length === 0 || sequences[0].moves.length === 0) return null;

  if (level === 'very-easy') {
    return sequences[Math.floor(rng() * sequences.length)];
  }

  const exactHits = level === 'hard' || level === 'very-hard';
  const noise =
    level === 'easy' ? 20 :
    level === 'normal' ? 6 :
    level === 'hard' ? 1.5 : 0;

  let best: MoveSequence | null = null;
  let bestScore = -Infinity;
  for (const seq of sequences) {
    const score = evaluateState(seq.state, state.currentPlayer, exactHits) + (rng() - 0.5) * noise;
    if (score > bestScore) {
      bestScore = score;
      best = seq;
    }
  }
  return best;
}

// ============================================================
// ダブリングキューブの判断
// ============================================================

/** CPUがダブルを提案すべきか（振る前に呼ぶ） */
export function shouldCpuOfferDouble(state: GameState, level: CpuLevel): boolean {
  if (level === 'very-easy' || level === 'easy') return false; // 弱いCPUはキューブを使わない
  const me = state.currentPlayer;
  const myPips = getPipCount(state, me);
  const oppPips = getPipCount(state, getOpponent(me));
  const lead = oppPips - myPips;
  // リードが自分のピップの一定割合を超えたら提案
  const threshold = level === 'normal' ? 0.25 : level === 'hard' ? 0.18 : 0.12;
  return lead > myPips * threshold && lead >= 15;
}

/** CPUがダブルを受けるべきか */
export function shouldCpuAcceptDouble(state: GameState, cpuPlayer: PlayerId, level: CpuLevel): boolean {
  if (level === 'very-easy') return true; // 何でも受ける
  const myPips = getPipCount(state, cpuPlayer);
  const oppPips = getPipCount(state, getOpponent(cpuPlayer));
  const deficit = myPips - oppPips;
  // 遅れが大きすぎるなら降りる（定石: 勝率25%を下回ったらパス、をピップ差で近似）
  const limit = level === 'easy' ? 0.4 : level === 'normal' ? 0.3 : 0.22;
  return deficit <= myPips * limit;
}
