import { describe, expect, it } from 'vitest';
import type { BabanukiConfig, BabanukiState } from './babanukiTypes';
import { isJoker } from './babanukiTypes';
import {
  activePlayers,
  canDeclareShuffle,
  createInitialBabanukiState,
  declareShuffle,
  drawCard,
  getPlayer,
  getRightNeighborId,
  reorderHand,
  resolveShuffle,
  setSpotlight,
} from './babanukiRules';
import { chooseCpuDraw, chooseSpotlight, shouldDeclareShuffle } from './babanukiCpu';

/**
 * ランダムな対局を大量に回して、ルールが壊れていないかを見張る回帰テスト。
 * 個別のケースを書くだけでは気づけない「詰まり」「札の消失」を捕まえる。
 */

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeConfig(playerCount: number): BabanukiConfig {
  return {
    playerCount,
    players: Array.from({ length: playerCount }, (_, i) => ({
      name: `P${i + 1}`,
      isCpu: i > 0,
      cpuLevel: (['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const)[i % 5],
    })),
  };
}

/** どの瞬間でも成り立っていなければいけないこと */
function checkInvariants(state: BabanukiState, where: string): void {
  const ids: string[] = [];
  for (const player of state.players) ids.push(...player.hand.map((c) => c.id));
  ids.push(...state.discardPile.map((c) => c.id));

  // 53枚が過不足なく存在し、重複もない
  expect(ids.length, `${where}: 札の総数`).toBe(53);
  expect(new Set(ids).size, `${where}: 札の重複`).toBe(53);

  // ジョーカーは捨て札にならない
  expect(state.discardPile.some(isJoker), `${where}: ジョーカーが捨てられた`).toBe(false);

  for (const player of state.players) {
    // 勝ち抜けた人の手札は空
    if (player.finishedRank !== null) {
      expect(player.hand.length, `${where}: 勝ち抜け後に手札が残っている`).toBe(0);
    }
    // ブラフの指定は自分の手札の中にしか無い
    if (player.spotlightCardId !== null) {
      expect(
        player.hand.some((c) => c.id === player.spotlightCardId),
        `${where}: 手札に無い札がブラフ指定されている`,
      ).toBe(true);
    }
    // ※ ペアの残りは検査しない。シャッフル直後は揃っていても捨てられないルールのため
  }

  // 手番のプレイヤーは残っている人
  if (state.phase === 'awaiting-draw') {
    expect(getPlayer(state, state.currentPlayerId).finishedRank, `${where}: 抜けた人が手番`).toBeNull();
  }

  // 勝ち抜け順位は1から連番
  state.finishOrder.forEach((id, index) => {
    expect(getPlayer(state, id).finishedRank, `${where}: 順位が連番でない`).toBe(index + 1);
  });

  // 宣言できるのはジョーカーを持っている人だけ
  for (const player of state.players) {
    if (canDeclareShuffle(state, player.id)) {
      expect(player.hand.some(isJoker), `${where}: ジョーカー無しで宣言できてしまう`).toBe(true);
      expect(player.shuffleRight, `${where}: 権利が無いのに宣言できる`).toBe(true);
      expect(activePlayers(state).length, `${where}: 残り2名で宣言できてしまう`).toBeGreaterThan(2);
    }
  }
}

/** CPUの判断を使って1局を最後まで進める */
function playGame(playerCount: number, seed: number): { state: BabanukiState; steps: number } {
  const rng = makeRng(seed);
  let state = createInitialBabanukiState(makeConfig(playerCount), rng);
  let steps = 0;

  while (state.phase !== 'finished') {
    steps += 1;
    expect(steps, `${playerCount}人 seed=${seed}: 決着しない`).toBeLessThan(3000);
    checkInvariants(state, `${playerCount}人 seed=${seed} step=${steps}`);

    if (state.phase === 'rolling') {
      const next = resolveShuffle(state, rng);
      expect(next, 'resolveShuffle が進まない').not.toBe(state);
      state = next;
      continue;
    }

    // 誰かが宣言するか
    const declarer = activePlayers(state).find(
      (p) => canDeclareShuffle(state, p.id) && shouldDeclareShuffle(state, p.id, p.cpuLevel, rng),
    );
    if (declarer) {
      const next = declareShuffle(state, declarer.id, rng);
      expect(next, 'declareShuffle が進まない').not.toBe(state);
      state = next;
      continue;
    }

    // ブラフと並べ替えをときどき挟む（状態を壊さないかの確認も兼ねる）
    const target = getRightNeighborId(state, state.currentPlayerId);
    if (target) {
      const holder = getPlayer(state, target);
      if (holder.spotlightCardId === null && rng() < 0.4) {
        const cardId = chooseSpotlight(state, target, holder.cpuLevel, rng);
        if (cardId) state = setSpotlight(state, target, cardId);
      }
      if (holder.hand.length > 2 && rng() < 0.3) {
        state = reorderHand(state, target, 0, holder.hand.length - 1);
      }
    }

    const drawer = getPlayer(state, state.currentPlayerId);
    const index = chooseCpuDraw(state, state.currentPlayerId, drawer.cpuLevel, rng);
    expect(index, '引く相手がいない').toBeGreaterThanOrEqual(0);
    const next = drawCard(state, index);
    expect(next, 'drawCard が進まない').not.toBe(state);
    state = next;
  }

  checkInvariants(state, `${playerCount}人 seed=${seed} 決着後`);
  return { state, steps };
}

describe('ランダム対局シミュレーション', () => {
  it('3〜6人で必ず決着し、途中で札が消えたり増えたりしない', () => {
    for (let playerCount = 3; playerCount <= 6; playerCount += 1) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const { state } = playGame(playerCount, seed * 7919 + playerCount);

        // 最弱王は1人だけで、ジョーカーを持っている
        expect(state.loserId).not.toBeNull();
        const loser = getPlayer(state, state.loserId as string);
        expect(loser.hand.some(isJoker)).toBe(true);
        expect(loser.finishedRank).toBeNull();

        // 最弱王以外は全員勝ち抜けている
        const notFinished = state.players.filter((p) => p.finishedRank === null);
        expect(notFinished).toHaveLength(1);
        expect(state.finishOrder).toHaveLength(playerCount - 1);
      }
    }
  }, 15_000);

  it('シャッフルタイムは1人1回までしか使われない', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = makeRng(seed * 104729);
      let state = createInitialBabanukiState(makeConfig(5), rng);
      const declareCount = new Map<string, number>();

      let steps = 0;
      while (state.phase !== 'finished' && steps < 3000) {
        steps += 1;
        if (state.phase === 'rolling') {
          state = resolveShuffle(state, rng);
          continue;
        }
        // 宣言できる人がいれば必ず宣言させる（上限の検査なので最大まで使う）
        const declarer = activePlayers(state).find((p) => canDeclareShuffle(state, p.id));
        if (declarer) {
          declareCount.set(declarer.id, (declareCount.get(declarer.id) ?? 0) + 1);
          state = declareShuffle(state, declarer.id, rng);
          continue;
        }
        const drawer = getPlayer(state, state.currentPlayerId);
        const index = chooseCpuDraw(state, state.currentPlayerId, drawer.cpuLevel, rng);
        state = drawCard(state, index);
      }

      expect(state.phase).toBe('finished');
      for (const count of declareCount.values()) expect(count).toBe(1);
    }
  });

  it('ブラフは指定した札が手札から無くなるまで解除されない', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = makeRng(seed * 15485863);
      let state = createInitialBabanukiState(makeConfig(4), rng);
      let steps = 0;

      while (state.phase !== 'finished' && steps < 3000) {
        steps += 1;
        if (state.phase === 'rolling') {
          state = resolveShuffle(state, rng);
          continue;
        }

        const target = getRightNeighborId(state, state.currentPlayerId);
        if (target) {
          const before = getPlayer(state, target);
          if (before.spotlightCardId === null && before.hand.length > 0) {
            state = setSpotlight(state, target, before.hand[0].id);
          }
          const marked = getPlayer(state, target).spotlightCardId;
          const drawerIndex = chooseCpuDraw(state, state.currentPlayerId, 'normal', rng);
          const drawnId = getPlayer(state, target).hand[drawerIndex]?.id;
          state = drawCard(state, drawerIndex);

          const after = state.players.find((p) => p.id === target);
          if (after && after.finishedRank === null) {
            if (drawnId === marked) {
              expect(after.spotlightCardId, 'ブラフ札が引かれたのに残っている').toBeNull();
            } else {
              expect(after.spotlightCardId, 'ブラフが勝手に外れた').toBe(marked);
            }
          }
        } else {
          break;
        }
      }
    }
  });
});
