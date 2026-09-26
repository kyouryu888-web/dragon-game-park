import type {
  DragonEmotion,
  DragonLevel,
  DragonReactionEvent,
  DragonReactionStage,
  PublicDragonReactionInput,
} from './types';

export const DRAGON_BLUFF_PERCENT: Readonly<Record<DragonLevel, number>> = {
  1: 15,
  2: 30,
  3: 25,
  4: 40,
  5: 35,
};

type Lines = Readonly<{
  advantage: readonly string[];
  disadvantage: readonly string[];
  advantageBluff: readonly string[];
  disadvantageBluff: readonly string[];
  neutral: readonly string[];
  victory: readonly string[];
  defeat: readonly string[];
  afterBravado: string;
}>;

const LINES: Readonly<Record<DragonLevel, Lines>> = {
  1: {
    advantage: ['やったー！', 'えへへ、できた！'],
    disadvantage: ['うう、くやしいよ〜', 'たいへんだぁ！'],
    advantageBluff: ['あれれ、こまったな〜', 'わあ、どうしよう？'],
    disadvantageBluff: ['へ、へいきだもん！', 'まだまだだもん！'],
    neutral: ['どうなるかな？', 'どきどきするね！'],
    victory: ['やったー！ ぼくの勝ち！'],
    defeat: ['つぎは負けないもん！'],
    afterBravado: 'うう、やっぱりくやしい！',
  },
  2: {
    advantage: ['よし、いいぞ！', 'この調子だ！'],
    disadvantage: ['くっ、やるな！', 'まだ終わってない！'],
    advantageBluff: ['おっと、困ったな〜', 'あれ、まずいかも？'],
    disadvantageBluff: ['ここから逆転だ！', 'これくらい平気さ！'],
    neutral: ['さあ、勝負だ！', '次はどう来る？'],
    victory: ['よっしゃ、勝ったぞ！'],
    defeat: ['次は絶対に勝つ！'],
    afterBravado: 'くっ……やっぱり悔しい！',
  },
  3: {
    advantage: ['いい流れだね', '悪くないね'],
    disadvantage: ['少し計算が狂ったね', 'これは手強いな'],
    advantageBluff: ['おっと、困ったな', '少し焦ってみようかな'],
    disadvantageBluff: ['予定どおり、かな', 'まだ余裕はあるよ'],
    neutral: ['次の一手が楽しみだ', 'さて、どうする？'],
    victory: ['僕の勝ちだね'],
    defeat: ['今回は君の勝ちだね'],
    afterBravado: '少しだけ悔しいな',
  },
  4: {
    advantage: ['フハハ、よいぞ！', 'まだ上を見せてやろう'],
    disadvantage: ['むう、やるではないか', 'この程度で王は折れぬ'],
    advantageBluff: ['おや、困ったものだ', 'これはピンチ……か？'],
    disadvantageBluff: ['勝ったと思ったか？', 'フハハ、面白い！'],
    neutral: ['見せてもらおうか', '次の手を待とう'],
    victory: ['王の勝利だ！'],
    defeat: ['見事だ。次は譲らぬぞ'],
    afterBravado: '……少し響いたな',
  },
  5: {
    advantage: ['よい一手ですね', 'ふふ、面白くなりました'],
    disadvantage: ['お見事です', 'まだ続きがありますよ'],
    advantageBluff: ['おや、どうしましょう', '困ってしまいましたね'],
    disadvantageBluff: ['さて、どうする？', 'まだ読めませんよ'],
    neutral: ['次の一手をどうぞ', 'ふふ、楽しみですね'],
    victory: ['私の勝ちですね'],
    defeat: ['あなたの勝ちです。見事でした'],
    afterBravado: '……これは痛いですね',
  },
};

/** Stable across host, guest and display settings. Only public event identity is hashed. */
function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function dragonReactionKey(input: PublicDragonReactionInput): string {
  return JSON.stringify([input.matchId, input.sequence, input.kind, input.cpu.id]);
}

function pick<T>(choices: readonly T[], seed: string): T {
  return choices[hash32(seed) % choices.length];
}

export function decideDragonReaction(input: PublicDragonReactionInput): DragonReactionEvent {
  const key = dragonReactionKey(input);
  const terminal = input.outcome === 'victory' || input.outcome === 'defeat';
  const bluffEligible = input.outcome === 'advantage' || input.outcome === 'disadvantage';
  const acting = !terminal && bluffEligible && hash32(`${key}|bluff`) % 100 < DRAGON_BLUFF_PERCENT[input.cpu.level]
    ? 'bluff' as const
    : 'sincere' as const;
  const lines = LINES[input.cpu.level];
  let emotionChoices: readonly DragonEmotion[];
  let speechChoices: readonly string[];

  switch (input.outcome) {
    case 'victory':
      emotionChoices = ['joy', 'laughing'];
      speechChoices = lines.victory;
      break;
    case 'defeat':
      emotionChoices = ['crying', 'angry'];
      speechChoices = lines.defeat;
      break;
    case 'neutral':
      emotionChoices = ['joy', 'smug'];
      speechChoices = lines.neutral;
      break;
    case 'advantage':
      emotionChoices = acting === 'bluff' ? ['scared'] : ['joy', 'smug', 'laughing'];
      speechChoices = acting === 'bluff' ? lines.advantageBluff : lines.advantage;
      break;
    case 'disadvantage':
      emotionChoices = acting === 'bluff'
        ? input.cpu.level === 4 ? ['laughing', 'smug'] : ['smug', 'joy']
        : ['scared', 'crying', 'angry'];
      speechChoices = acting === 'bluff' ? lines.disadvantageBluff : lines.disadvantage;
      break;
  }

  const firstStage: DragonReactionStage = {
    emotion: pick(emotionChoices, `${key}|emotion`),
    speech: pick(speechChoices, `${key}|speech`),
  };
  const needsTearfulSecondStage = acting === 'bluff'
    && input.outcome === 'disadvantage'
    && input.severity === 'major'
    && (input.cpu.level === 1 || input.cpu.level === 2);
  const stages: readonly DragonReactionStage[] = needsTearfulSecondStage
    ? [firstStage, { emotion: 'crying', speech: lines.afterBravado }]
    : [firstStage];
  const priority = terminal ? 4 : input.priority ?? (input.severity === 'major' ? 3 : 1);
  const cutIn = terminal
    ? input.outcome
    : acting === 'bluff' && input.outcome === 'disadvantage' && input.cutIn === 'pressure'
      ? 'attack'
      : input.cutIn;

  return {
    key,
    matchId: input.matchId,
    sequence: input.sequence,
    kind: input.kind,
    cpu: input.cpu,
    outcome: input.outcome,
    factLabel: input.factLabel,
    acting,
    emotion: firstStage.emotion,
    speech: firstStage.speech,
    stages,
    priority,
    cutIn,
  };
}
