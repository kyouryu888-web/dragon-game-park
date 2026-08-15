/**
 * 最弱王ババ抜き CPU
 *
 * 方針（docs/babanuki-spec.md §6）
 * - 宣言   : 不利な局面（ジョーカー保持・手札が多い）で宣言する。弱いほどランダムに近い
 * - 飛び出し: レベル1〜4はブラフ（安全札を飛び出させる）。**ゴッドドラゴンは飛び出しを使わない**
 * - 引き方 : 弱いほど飛び出している札を引いてブラフに引っかかる。強いほど引っかからない
 */
import type { BabanukiState, CpuLevel } from './babanukiTypes';
import { isJoker } from './babanukiTypes';
import type { Rng } from './babanukiRules';
import {
  activePlayers,
  canDeclareShuffle,
  getPlayer,
  getRightNeighborId,
  holdsJoker,
} from './babanukiRules';

export function getCpuDisplayName(level: CpuLevel): string {
  const names: Record<CpuLevel, string> = {
    'very-easy': 'ベビードラゴン',
    easy: 'ドラゴン',
    normal: 'スーパードラゴン',
    hard: 'ドラゴンキング',
    'very-hard': 'ゴッドドラゴン',
  };
  return names[level];
}

export function getCpuLevelLabel(level: CpuLevel): string {
  // ドラゴン段位（既存3ゲームと共通の呼び名）
  const labels: Record<CpuLevel, string> = {
    'very-easy': '🥚 ベビードラゴン',
    easy: '🐲 ドラゴン',
    normal: '🐉 スーパードラゴン',
    hard: '👑 ドラゴンキング',
    'very-hard': '⚡ ゴッドドラゴン',
  };
  return labels[level];
}

export const CPU_LEVELS: CpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];

function pickIndex(length: number, rng: Rng): number {
  return Math.floor(rng() * length);
}

// ---------------------------------------------------------------- 引き方

/** 飛び出している札を引いてしまう確率。null は「飛び出しを気にせず一様に選ぶ」 */
const SPOTLIGHT_BIAS: Record<CpuLevel, number | null> = {
  'very-easy': 0.75,
  easy: 0.55,
  normal: 0.35,
  hard: 0.15,
  'very-hard': null,
};

/** 右隣の手札の何番目を引くかを決める。手札が無ければ -1 */
export function chooseCpuDraw(
  state: BabanukiState,
  playerId: string,
  level: CpuLevel,
  rng: Rng = Math.random,
): number {
  const targetId = getRightNeighborId(state, playerId);
  if (!targetId) return -1;

  const target = getPlayer(state, targetId);
  const size = target.hand.length;
  if (size === 0) return -1;

  const spotlight = target.spotlightCardId
    ? target.hand.findIndex((c) => c.id === target.spotlightCardId)
    : -1;
  const bias = SPOTLIGHT_BIAS[level];
  if (spotlight < 0 || bias === null) return pickIndex(size, rng);

  if (rng() < bias) return spotlight;

  const others: number[] = [];
  for (let i = 0; i < size; i += 1) if (i !== spotlight) others.push(i);
  if (others.length === 0) return spotlight;
  return others[pickIndex(others.length, rng)];
}

// ---------------------------------------------------------------- 飛び出し

/** そのターンに飛び出しを使う確率。毎回やると不自然なので半分以下に抑える */
const SPOTLIGHT_USE_CHANCE: Record<CpuLevel, number> = {
  'very-easy': 0.3,
  easy: 0.4,
  normal: 0.5,
  hard: 0.55,
  'very-hard': 0,
};

/**
 * ジョーカーを持っているとき、あえて安全札を飛び出させる（＝ブラフする）確率。
 * 強いCPUほどブラフ寄りだが、**100%にはしない**。
 * 常にブラフだと「飛び出しはジョーカーではない」と読み切られて駆け引きが消えるため、
 * 最も強いドラゴンキングでも3回に1回はジョーカーそのものを飛び出させる。
 */
const BLUFF_CHANCE: Record<CpuLevel, number> = {
  'very-easy': 0.35,
  easy: 0.45,
  normal: 0.55,
  hard: 0.65,
  'very-hard': 0,
};

/**
 * 飛び出させる札（カードID）を決める。null なら今回は飛び出さない。
 * ゴッドドラゴンは飛び出しを使わないため常に null を返す。
 */
export function chooseSpotlight(
  state: BabanukiState,
  playerId: string,
  level: CpuLevel,
  rng: Rng = Math.random,
): string | null {
  if (level === 'very-hard') return null;

  const me = getPlayer(state, playerId);
  if (me.hand.length === 0) return null;

  // 毎回は仕掛けない
  if (rng() >= SPOTLIGHT_USE_CHANCE[level]) return null;

  const jokerIds = me.hand.filter(isJoker).map((c) => c.id);
  const safeIds = me.hand.filter((c) => !isJoker(c)).map((c) => c.id);

  // ジョーカーを持っていなければ、どの札を出しても同じ意味しかない
  if (jokerIds.length === 0) return safeIds[pickIndex(safeIds.length, rng)];
  if (safeIds.length === 0) return jokerIds[0];

  const bluff = rng() < BLUFF_CHANCE[level];
  return bluff ? safeIds[pickIndex(safeIds.length, rng)] : jokerIds[0];
}

// ---------------------------------------------------------------- シャッフル宣言

const DECLARE_WEIGHT: Record<CpuLevel, number> = {
  'very-easy': 0.15,
  easy: 0.35,
  normal: 0.6,
  hard: 0.85,
  'very-hard': 1,
};

/** 局面と関係なく気まぐれに宣言してしまう確率 */
const DECLARE_NOISE: Record<CpuLevel, number> = {
  'very-easy': 0.22,
  easy: 0.15,
  normal: 0.08,
  hard: 0.03,
  'very-hard': 0,
};

/** 今の局面がどれくらい不利か（0〜1） */
export function evaluateDisadvantage(state: BabanukiState, playerId: string): number {
  const me = getPlayer(state, playerId);
  const actives = activePlayers(state);
  if (actives.length === 0) return 0;

  const total = actives.reduce((sum, p) => sum + p.hand.length, 0);
  const average = total / actives.length;

  let score = 0;
  if (holdsJoker(me)) score += 0.55;
  if (average > 0) {
    const excess = (me.hand.length - average) / average;
    score += Math.max(-0.2, Math.min(0.25, excess * 0.5));
  }
  // 残り3人＝次に誰か抜けたら権利が消える。使うなら今
  if (actives.length === 3) score += 0.2;

  return Math.max(0, Math.min(1, score));
}

export function shouldDeclareShuffle(
  state: BabanukiState,
  playerId: string,
  level: CpuLevel,
  rng: Rng = Math.random,
): boolean {
  if (!canDeclareShuffle(state, playerId)) return false;

  let probability = evaluateDisadvantage(state, playerId) * DECLARE_WEIGHT[level] + DECLARE_NOISE[level];

  // 自分がこれから引かれる側なら、ジョーカーを引き取ってもらえる可能性がある。
  // 強いCPUはその機会を潰さない
  if (getRightNeighborId(state, state.currentPlayerId) === playerId) {
    if (level === 'hard' || level === 'very-hard') return false;
    probability *= 0.4;
  }

  return rng() < probability;
}
