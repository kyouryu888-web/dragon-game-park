import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decideDragonReaction } from './decision';
import { DragonReactionNarration } from './DragonReactionNarration';
import { DragonReactionWipe } from './DragonReactionWipe';
import { publicReactionPresenter } from './presenter';
import type { PublicDragonReactionInput } from './types';

function input(kind: string, overrides: Partial<PublicDragonReactionInput> = {}): PublicDragonReactionInput {
  return {
    matchId: 'public-v2',
    sequence: 1,
    kind,
    cpu: { id: 'cpu', name: '白銀ドラゴン', level: 3 },
    outcome: 'neutral',
    factLabel: '公開された出来事',
    ...overrides,
  };
}

describe('ゲーム固有の公開リアクション', () => {
  it('カード・石・サイコロの公開場面を短い言葉で区別し、Lvごとの口調を保つ', () => {
    const scenes = [
      ['uno-reverse', '順番'],
      ['babanuki-pair', 'ペア'],
      ['corner', '角'],
      ['backgammon-cpu-doubles-roll', 'ゾロ目'],
      ['mancala-extra-turn', 'もう一'],
    ];
    for (const [kind, keyword] of scenes) {
      expect(decideDragonReaction(input(kind)).speech).toContain(keyword);
    }
    const baby = decideDragonReaction(input('uno-draw-counter', { cpu: { id: 'cpu', name: '幼竜', level: 1 } }));
    const celestial = decideDragonReaction(input('uno-draw-counter', { cpu: { id: 'cpu', name: '天竜', level: 5 } }));
    expect(baby.speech).toContain('よ');
    expect(celestial.speech).toContain('ます');
    expect(baby.speech).not.toBe(celestial.speech);
  });

  it('勝ち抜けや脱落を、対局全体の勝敗として宣言しない', () => {
    const escaped = decideDragonReaction(input('babanuki-finish', { outcome: 'victory', factLabel: '3位で勝ち抜け' }));
    const knockedOut = decideDragonReaction(input('uno-knockout', { outcome: 'defeat', factLabel: '25枚でアウト' }));
    expect(escaped.speech).toContain('勝ち抜け');
    expect(escaped.speech).not.toContain('僕の勝ち');
    expect(knockedOut.speech).toContain('25枚');
    expect(knockedOut.speech).not.toContain('君の勝ち');
    expect(escaped.factLabel).toBe('3位で勝ち抜け');
    expect(knockedOut.factLabel).toBe('25枚でアウト');
  });

  it('秘密の札や交換対応を添付しても公開イベントの演技は同じ', () => {
    const published = input('babanuki-shuffle', { outcome: 'advantage', factLabel: '出目3でシャッフル' });
    expect(decideDragonReaction({ ...published, ...{ hiddenJokerOwner: 'a', privateExchange: ['a', 'b'] } }))
      .toEqual(decideDragonReaction({ ...published, ...{ hiddenJokerOwner: 'b', privateExchange: ['b', 'a'] } }));
  });
});

describe('人間だけの対局の中立マスコット', () => {
  it('人間をCPUとして名乗らず、事実だけを読み上げ、ブラフをしない', () => {
    const human = { id: 'human-a', name: 'あおい', isCpu: false };
    const presentation = publicReactionPresenter(human);
    expect(presentation.presenter).toBe('narrator');
    expect(presentation.cpu.id).not.toBe(human.id);
    expect(presentation.cpu.name).not.toBe(human.name);
    for (let sequence = 0; sequence < 100; sequence += 1) {
      const reaction = decideDragonReaction(input('corner', {
        ...presentation, sequence, outcome: 'advantage', factLabel: 'あおいが角を獲得',
      }));
      expect(reaction.acting).toBe('sincere');
      expect(reaction.speech).toBe('あおいが角を獲得');
      expect(reaction.stages).toHaveLength(1);
    }
  });

  it('人間の発話をCPU席に出さず、中立欄に公開事実と案内ラベルを出す', () => {
    const narrator = decideDragonReaction(input('babanuki-shuffle', {
      ...publicReactionPresenter({ id: 'human', name: 'あおい', isCpu: false }),
      factLabel: '出目3でシャッフル', priority: 3,
    }));
    const cpuSlot = renderToStaticMarkup(<DragonReactionWipe cpu={narrator.cpu} event={narrator} />);
    expect(cpuSlot).not.toContain('dragon-reaction-speech');
    const narration = renderToStaticMarkup(<DragonReactionNarration event={narrator} />);
    expect(narration).toContain('ゲーム案内');
    expect(narration).toContain('出目3でシャッフル');
    expect(narration).not.toContain('data-cpu-id');
    expect(narration).not.toContain('Lv3');
  });

  it('控えめは主要場面のみ、オフは案内演技も消し、CPUイベントを二重に出さない', () => {
    const light = decideDragonReaction(input('babanuki-pair', { ...publicReactionPresenter(undefined), priority: 2 }));
    const major = decideDragonReaction(input('babanuki-shuffle', { ...publicReactionPresenter(undefined), priority: 3 }));
    const cpu = decideDragonReaction(input('babanuki-shuffle', { priority: 3 }));
    expect(renderToStaticMarkup(<DragonReactionNarration event={light} preference="subtle" />)).toBe('');
    expect(renderToStaticMarkup(<DragonReactionNarration event={major} preference="subtle" />)).toContain('ゲーム案内');
    expect(renderToStaticMarkup(<DragonReactionNarration event={major} preference="off" />)).toBe('');
    expect(renderToStaticMarkup(<DragonReactionNarration event={cpu} />)).toBe('');
  });

  it('CPUレベルは既存の文字列と数値を同じ人物へ対応させる', () => {
    expect(publicReactionPresenter({ id: 'cpu', name: 'CPU', isCpu: true, cpuLevel: 'very-hard' }))
      .toEqual(publicReactionPresenter({ id: 'cpu', name: 'CPU', isCpu: true, cpuLevel: 5 }));
  });
});
