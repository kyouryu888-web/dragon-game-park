import { describe, expect, it } from 'vitest';
import { getDragonReactionImageUrl } from './assets';
import { decideDragonReaction, DRAGON_BLUFF_PERCENT } from './decision';
import {
  beginDragonReactionQueue,
  clearDragonReactionQueue,
  DRAGON_REACTION_WAITING_LIMIT,
  finishDragonReaction,
  ingestDragonReactionEvents,
} from './queue';
import type { DragonLevel, PublicDragonReactionInput } from './types';

const publicEvent = (
  sequence: number,
  overrides: Partial<PublicDragonReactionInput> = {},
): PublicDragonReactionInput => ({
  matchId: 'shared-match',
  sequence,
  kind: 'public-capture',
  cpu: { id: 'cpu-3', name: '白銀ドラゴン', level: 3 },
  outcome: 'disadvantage',
  factLabel: '6個捕獲されました',
  ...overrides,
});

describe('公開イベントからのドラゴン演技', () => {
  it('5レベル×6表情の軽量画像をすべて本番用URLとして解決できる', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      for (const emotion of ['joy', 'smug', 'crying', 'angry', 'laughing', 'scared'] as const) {
        expect(getDragonReactionImageUrl(level, emotion)).toMatch(/\.webp(?:\?|$)/);
      }
    }
  });

  it('同じ試合・連番・CPUなら端末ごとの実行で同じ演技と台詞になる', () => {
    const event = publicEvent(17);
    expect(decideDragonReaction(event)).toEqual(decideDragonReaction({ ...event }));
    expect(decideDragonReaction(event).factLabel).toBe(event.factLabel);
  });

  it('隠し札や内部評価を変えても抽選と表示事実に影響しない', () => {
    const event = publicEvent(18);
    const first = { ...event, hiddenJokerOwner: 'cpu-3', privateHand: ['joker'], cpuEvaluation: 0.96 };
    const second = { ...event, hiddenJokerOwner: 'human', privateHand: ['normal'], cpuEvaluation: 0.02 };
    expect(decideDragonReaction(first)).toEqual(decideDragonReaction(second));
  });

  it('各レベルの公開イベントでは固定入力から性格別のブラフ比率を再現できる', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const total = 10_000;
      const bluffs = Array.from({ length: total }, (_, sequence) =>
        decideDragonReaction(publicEvent(sequence, {
          cpu: { id: `cpu-${level}`, name: 'CPU', level },
        })).acting === 'bluff' ? 1 : 0,
      ).reduce((sum: number, current: number) => sum + current, 0);
      expect(Math.abs(bluffs / total * 100 - DRAGON_BLUFF_PERCENT[level])).toBeLessThan(2);
    }
  });

  it('勝敗確定では演技と画像ヒントを真の結果に固定する', () => {
    for (const level of [1, 2, 3, 4, 5] as readonly DragonLevel[]) {
      const cpu = { id: 'cpu', name: 'CPU', level };
      const victory = decideDragonReaction(publicEvent(1, { cpu, outcome: 'victory', factLabel: 'CPUの勝ち', cutIn: 'pressure' }));
      const defeat = decideDragonReaction(publicEvent(2, { cpu, outcome: 'defeat', factLabel: 'CPUの負け', cutIn: 'attack' }));
      expect(victory).toMatchObject({ acting: 'sincere', factLabel: 'CPUの勝ち', cutIn: 'victory', priority: 4 });
      expect(defeat).toMatchObject({ acting: 'sincere', factLabel: 'CPUの負け', cutIn: 'defeat', priority: 4 });
      expect(['joy', 'laughing']).toContain(victory.emotion);
      expect(['crying', 'angry']).toContain(defeat.emotion);
    }
  });

  it('Lv1・Lv2の大きな被害では強がりから涙目への2段階演出を選べる', () => {
    for (const level of [1, 2] as const) {
      const dramatic = Array.from({ length: 100 }, (_, sequence) =>
        decideDragonReaction(publicEvent(sequence, {
          cpu: { id: 'cpu', name: 'CPU', level },
          severity: 'major',
          cutIn: 'pressure',
        })),
      ).find(reaction => reaction.acting === 'bluff');
      expect(dramatic?.stages).toHaveLength(2);
      expect(dramatic?.stages[1].emotion).toBe('crying');
      expect(dramatic?.cutIn).toBe('attack');
      expect(dramatic?.factLabel).toBe('6個捕獲されました');
    }
  });

  it('優勢での困ったふりも表示事実を変えない', () => {
    const bluff = Array.from({ length: 100 }, (_, sequence) =>
      decideDragonReaction(publicEvent(sequence, { outcome: 'advantage', factLabel: '6個捕獲しました' })),
    ).find(reaction => reaction.acting === 'bluff');
    expect(bluff).toMatchObject({ emotion: 'scared', factLabel: '6個捕獲しました', acting: 'bluff' });
  });
});

describe('連続・再接続・設定差のキュー管理', () => {
  it('画面を開いた時の履歴を再生せず、新しい公開イベントだけ表示する', () => {
    const initial = publicEvent(5);
    const baseline = beginDragonReactionQueue('shared-match', [initial]);
    expect(baseline.active).toBeNull();
    const next = ingestDragonReactionEvents(baseline, 'shared-match', [initial, publicEvent(6)]);
    expect(next.active?.sequence).toBe(6);
    expect(ingestDragonReactionEvents(next, 'shared-match', [initial, publicEvent(6)])).toBe(next);
  });

  it('遅れて届いた旧連番と遠隔更新で飛び越えた古い軽反応を再生しない', () => {
    const baseline = beginDragonReactionQueue('shared-match', [publicEvent(5)]);
    const skipped = ingestDragonReactionEvents(baseline, 'shared-match', [publicEvent(6), publicEvent(7)]);
    expect(skipped.active?.sequence).toBe(7);
    const stale = ingestDragonReactionEvents(skipped, 'shared-match', [publicEvent(6)]);
    expect(stale).toBe(skipped);
  });

  it('重大イベントを優先し待機を2件に抑え、再戦と退出で消去できる', () => {
    let queue = beginDragonReactionQueue('shared-match', []);
    queue = ingestDragonReactionEvents(queue, 'shared-match', [publicEvent(1)]);
    queue = ingestDragonReactionEvents(queue, 'shared-match', [publicEvent(2)]);
    queue = ingestDragonReactionEvents(queue, 'shared-match', [publicEvent(3)]);
    queue = ingestDragonReactionEvents(queue, 'shared-match', [publicEvent(4)]);
    expect(queue.waiting).toHaveLength(DRAGON_REACTION_WAITING_LIMIT);
    expect(queue.waiting.map(event => event.sequence)).toEqual([3, 4]);
    queue = ingestDragonReactionEvents(queue, 'shared-match', [publicEvent(5, { severity: 'major' })]);
    expect(queue.active?.sequence).toBe(5);
    expect(queue.waiting).toEqual([]);
    expect(clearDragonReactionQueue(queue).active).toBeNull();
    expect(ingestDragonReactionEvents(queue, 'next-match', [publicEvent(1, { matchId: 'next-match' })]).active).toBeNull();
  });

  it('同じ公開結果で複数CPUの勝敗が確定した時は両方を順に見せる', () => {
    const winner = publicEvent(8, {
      cpu: { id: 'winner', name: '勝者', level: 5 }, outcome: 'victory', factLabel: '勝者の勝ち',
    });
    const loser = publicEvent(8, {
      cpu: { id: 'loser', name: '敗者', level: 2 }, outcome: 'defeat', factLabel: '敗者の負け',
    });
    const state = ingestDragonReactionEvents(beginDragonReactionQueue('shared-match', []), 'shared-match', [winner, loser]);
    expect(state.active?.priority).toBe(4);
    expect(state.waiting).toHaveLength(1);
    expect(new Set([state.active?.cpu.id, finishDragonReaction(state).active?.cpu.id])).toEqual(new Set(['winner', 'loser']));
  });

  it('端末設定は演技内容に影響せず、オフと控えめで抑制した演出は後から再生しない', () => {
    const baseline = beginDragonReactionQueue('shared-match', []);
    const off = ingestDragonReactionEvents(baseline, 'shared-match', [publicEvent(1)], 'off');
    expect(off.active).toBeNull();
    expect(ingestDragonReactionEvents(off, 'shared-match', [publicEvent(1)], 'lively').active).toBeNull();
    const subtle = ingestDragonReactionEvents(off, 'shared-match', [publicEvent(2)], 'subtle');
    expect(subtle.active).toBeNull();
    const major = ingestDragonReactionEvents(subtle, 'shared-match', [publicEvent(3, { severity: 'major' })], 'subtle');
    expect(major.active?.priority).toBe(3);
    expect(finishDragonReaction(major).active).toBeNull();
  });
});
