import type { GuideDefinition, LearningItem, QuestDefinition, SpiritDefinition } from './englishQuestTypes';

type Seed = {
  id: string;
  ja: string;
  en: string;
  emoji: string;
  audioText?: string;
};

const asset = (id: string) => `/audio/englishQuest/${id}.mp3`;

const rotateChoices = (values: string[], index: number): string[] => {
  const answer = values[index];
  const choices = [answer];
  for (let offset = 1; choices.length < 4; offset += 1) {
    const candidate = values[(index + offset * 5) % values.length];
    if (!choices.includes(candidate)) choices.push(candidate);
  }
  return choices.sort((a, b) => a.localeCompare(b));
};

const soundSeeds: Seed[] = [
  { id: 'a', ja: 'apple の最初の音', en: 'A', emoji: '🍎' },
  { id: 'b', ja: 'bird の最初の音', en: 'B', emoji: '🐦' },
  { id: 'c', ja: 'cat の最初の音', en: 'C', emoji: '🐱' },
  { id: 'd', ja: 'dog の最初の音', en: 'D', emoji: '🐶' },
  { id: 'e', ja: 'egg の最初の音', en: 'E', emoji: '🥚' },
  { id: 'f', ja: 'fish の最初の音', en: 'F', emoji: '🐟' },
  { id: 'g', ja: 'green の最初の音', en: 'G', emoji: '🟢' },
  { id: 'h', ja: 'hat の最初の音', en: 'H', emoji: '🎩' },
  { id: 'i', ja: 'insect の最初の音', en: 'I', emoji: '🐞' },
  { id: 'j', ja: 'juice の最初の音', en: 'J', emoji: '🧃' },
  { id: 'k', ja: 'key の最初の音', en: 'K', emoji: '🔑' },
  { id: 'l', ja: 'leaf の最初の音', en: 'L', emoji: '🍃' },
  { id: 'm', ja: 'moon の最初の音', en: 'M', emoji: '🌙' },
  { id: 'n', ja: 'nest の最初の音', en: 'N', emoji: '🪺' },
  { id: 'o', ja: 'orange の最初の音', en: 'O', emoji: '🍊' },
  { id: 'p', ja: 'pen の最初の音', en: 'P', emoji: '🖊️' },
];

const wordSeeds: Seed[] = [
  { id: 'cat', ja: 'ねこ', en: 'cat', emoji: '🐱' },
  { id: 'dog', ja: 'いぬ', en: 'dog', emoji: '🐶' },
  { id: 'bird', ja: 'とり', en: 'bird', emoji: '🐦' },
  { id: 'fish', ja: 'さかな', en: 'fish', emoji: '🐟' },
  { id: 'rabbit', ja: 'うさぎ', en: 'rabbit', emoji: '🐰' },
  { id: 'fox', ja: 'きつね', en: 'fox', emoji: '🦊' },
  { id: 'lion', ja: 'ライオン', en: 'lion', emoji: '🦁' },
  { id: 'turtle', ja: 'かめ', en: 'turtle', emoji: '🐢' },
  { id: 'red', ja: 'あか', en: 'red', emoji: '🔴' },
  { id: 'blue', ja: 'あお', en: 'blue', emoji: '🔵' },
  { id: 'green', ja: 'みどり', en: 'green', emoji: '🟢' },
  { id: 'yellow', ja: 'きいろ', en: 'yellow', emoji: '🟡' },
  { id: 'orange', ja: 'オレンジ色', en: 'orange', emoji: '🟠' },
  { id: 'purple', ja: 'むらさき', en: 'purple', emoji: '🟣' },
  { id: 'black', ja: 'くろ', en: 'black', emoji: '⚫' },
  { id: 'white', ja: 'しろ', en: 'white', emoji: '⚪' },
  { id: 'one', ja: '1', en: 'one', emoji: '1️⃣' },
  { id: 'two', ja: '2', en: 'two', emoji: '2️⃣' },
  { id: 'three', ja: '3', en: 'three', emoji: '3️⃣' },
  { id: 'four', ja: '4', en: 'four', emoji: '4️⃣' },
  { id: 'five', ja: '5', en: 'five', emoji: '5️⃣' },
  { id: 'six', ja: '6', en: 'six', emoji: '6️⃣' },
  { id: 'seven', ja: '7', en: 'seven', emoji: '7️⃣' },
  { id: 'eight', ja: '8', en: 'eight', emoji: '8️⃣' },
  { id: 'mother', ja: 'おかあさん', en: 'mother', emoji: '👩' },
  { id: 'father', ja: 'おとうさん', en: 'father', emoji: '👨' },
  { id: 'sister', ja: 'おねえさん・いもうと', en: 'sister', emoji: '👧' },
  { id: 'brother', ja: 'おにいさん・おとうと', en: 'brother', emoji: '👦' },
  { id: 'friend', ja: 'ともだち', en: 'friend', emoji: '🧑‍🤝‍🧑' },
  { id: 'teacher', ja: 'せんせい', en: 'teacher', emoji: '🧑‍🏫' },
  { id: 'book', ja: 'ほん', en: 'book', emoji: '📘' },
  { id: 'pen', ja: 'ペン', en: 'pen', emoji: '🖊️' },
  { id: 'bag', ja: 'かばん', en: 'bag', emoji: '🎒' },
  { id: 'cup', ja: 'コップ', en: 'cup', emoji: '🥤' },
  { id: 'chair', ja: 'いす', en: 'chair', emoji: '🪑' },
  { id: 'table', ja: 'つくえ', en: 'table', emoji: '🟫' },
  { id: 'key', ja: 'かぎ', en: 'key', emoji: '🔑' },
  { id: 'clock', ja: 'とけい', en: 'clock', emoji: '🕒' },
  { id: 'run', ja: 'はしる', en: 'run', emoji: '🏃' },
  { id: 'jump', ja: 'ジャンプする', en: 'jump', emoji: '🦘' },
  { id: 'walk', ja: 'あるく', en: 'walk', emoji: '🚶' },
  { id: 'stop', ja: 'とまる', en: 'stop', emoji: '✋' },
  { id: 'listen', ja: 'きく', en: 'listen', emoji: '👂' },
  { id: 'look', ja: 'みる', en: 'look', emoji: '👀' },
  { id: 'open', ja: 'あける', en: 'open', emoji: '📖' },
  { id: 'close', ja: 'しめる', en: 'close', emoji: '📕' },
  { id: 'eat', ja: 'たべる', en: 'eat', emoji: '🍽️' },
  { id: 'drink', ja: 'のむ', en: 'drink', emoji: '🥛' },
];

const chunkSeeds: Seed[] = [
  { id: 'hello', ja: 'こんにちは', en: 'Hello!', emoji: '👋' },
  { id: 'good-morning', ja: 'おはよう', en: 'Good morning!', emoji: '🌅' },
  { id: 'thank-you', ja: 'ありがとう', en: 'Thank you.', emoji: '💐' },
  { id: 'youre-welcome', ja: 'どういたしまして', en: "You're welcome.", emoji: '😊' },
  { id: 'please', ja: 'おねがいします', en: 'Please.', emoji: '🙏' },
  { id: 'im-seven', ja: 'わたしは7さいです', en: "I'm seven.", emoji: '7️⃣' },
  { id: 'my-name', ja: 'わたしの名前はミオです', en: 'My name is Mio.', emoji: '📛' },
  { id: 'i-like-cats', ja: 'ねこがすきです', en: 'I like cats.', emoji: '🐱' },
  { id: 'dont-like-rain', ja: '雨はすきではありません', en: "I don't like rain.", emoji: '🌧️' },
  { id: 'this-book', ja: 'これは本です', en: 'This is a book.', emoji: '📘' },
  { id: 'it-red', ja: 'それは赤いです', en: 'It is red.', emoji: '🔴' },
  { id: 'can-run', ja: 'わたしは走れます', en: 'I can run.', emoji: '🏃' },
  { id: 'can-jump', ja: 'ジャンプできますか', en: 'Can you jump?', emoji: '🦘' },
  { id: 'yes-can', ja: 'はい、できます', en: 'Yes, I can.', emoji: '✅' },
  { id: 'no-cant', ja: 'いいえ、できません', en: "No, I can't.", emoji: '🙅' },
  { id: 'where-book', ja: '本はどこですか', en: 'Where is the book?', emoji: '🔎' },
  { id: 'on-table', ja: 'つくえの上です', en: "It's on the table.", emoji: '🟫' },
  { id: 'open-door', ja: 'ドアをあけて', en: 'Open the door.', emoji: '🚪' },
  { id: 'close-book', ja: '本をとじて', en: 'Close the book.', emoji: '📕' },
  { id: 'see-you', ja: 'またね', en: 'See you!', emoji: '🌟' },
];

const dialogueSeeds: Seed[] = [
  { id: 'name', ja: 'What is your name? への返事', en: 'My name is Mio.', emoji: '💬', audioText: 'Hello! Hi! What is your name?' },
  { id: 'how-are-you', ja: 'How are you? への返事', en: "I'm fine, thank you.", emoji: '😊', audioText: 'Good morning! Good morning! How are you?' },
  { id: 'like-cats', ja: 'Do you like cats? への返事', en: 'Yes, I do.', emoji: '🐱', audioText: 'Look, a cat! It is cute. Do you like cats?' },
  { id: 'book-where', ja: 'Where is my book? への返事', en: "It's on the table.", emoji: '📘', audioText: 'I need my book. I can help. Where is my book?' },
  { id: 'color', ja: 'What color is it? への返事', en: "It's blue.", emoji: '🔵', audioText: 'Look at this bag. Nice! What color is it?' },
  { id: 'how-many', ja: 'How many birds? への返事', en: 'Three birds.', emoji: '🐦', audioText: 'Look at the birds. I see them. How many birds?' },
  { id: 'can-swim', ja: 'Can you swim? への返事', en: 'Yes, I can.', emoji: '🏊', audioText: 'Let us go to the pool. Okay! Can you swim?' },
  { id: 'goodbye', ja: 'Goodbye! への返事', en: 'See you!', emoji: '👋', audioText: 'It is time to go. Okay. Goodbye!' },
];

const readingSeeds: Seed[] = [
  { id: 'open-sign', ja: 'この看板のお店は？', en: 'OPEN', emoji: '🏪' },
  { id: 'stop-sign', ja: '進んではいけない看板は？', en: 'STOP', emoji: '🛑' },
  { id: 'library-time', ja: '図書館がひらく時間は？', en: '3:00', emoji: '🏛️' },
  { id: 'blue-door', ja: '入るドアの色は？', en: 'BLUE DOOR', emoji: '🚪' },
  { id: 'two-tickets', ja: 'ひつようなチケットは何まい？', en: 'TWO TICKETS', emoji: '🎟️' },
  { id: 'meet-monday', ja: '会う曜日は？', en: 'MONDAY', emoji: '📅' },
  { id: 'bus-eight', ja: 'バスの番号は？', en: 'BUS 8', emoji: '🚌' },
  { id: 'key-table', ja: 'かぎがある場所は？', en: 'ON THE TABLE', emoji: '🔑' },
];

const prerequisites: Record<string, string[]> = {
  'chunk-i-like-cats': ['word-cat'],
  'chunk-it-red': ['word-red'],
  'chunk-can-run': ['word-run'],
  'chunk-can-jump': ['word-jump'],
  'chunk-where-book': ['word-book'],
  'chunk-on-table': ['word-table'],
  'chunk-open-door': ['word-open'],
  'chunk-close-book': ['word-close', 'word-book'],
  'dialogue-like-cats': ['word-cat', 'chunk-i-like-cats'],
  'dialogue-book-where': ['word-book', 'chunk-on-table'],
  'dialogue-color': ['word-blue'],
  'dialogue-how-many': ['word-three', 'word-bird'],
  'reading-open-sign': ['word-open'],
  'reading-stop-sign': ['word-stop'],
  'reading-blue-door': ['word-blue', 'chunk-open-door'],
  'reading-two-tickets': ['word-two'],
  'reading-bus-eight': ['word-eight'],
  'reading-key-table': ['word-key', 'word-table'],
};

const makeSimpleItems = (
  prefix: string,
  type: LearningItem['type'],
  seeds: Seed[],
  tags: LearningItem['skillTags'],
  difficulty: LearningItem['difficulty'],
): LearningItem[] => {
  const answers = seeds.map((seed) => seed.en);
  return seeds.map((seed, index) => {
    const id = `${prefix}-${seed.id}`;
    return {
      id,
      type,
      promptJa: type === 'word' ? `${seed.emoji} を英語でいうと？` : seed.ja,
      display: seed.ja,
      answer: seed.en,
      choices: rotateChoices(answers, index),
      audioText: seed.audioText ?? seed.en,
      audioAsset: asset(id),
      emoji: seed.emoji,
      skillTags: tags,
      difficulty,
      prerequisites: prerequisites[id] ?? [],
    };
  });
};

const sounds = makeSimpleItems('sound', 'sound', soundSeeds, ['phonics', 'listening'], 1).map(
  (item, index) => ({
    ...item,
    promptJa: `${soundSeeds[index].emoji} “${soundSeeds[index].id === 'a' ? 'apple' : soundSeeds[index].ja.split(' ')[0]}” の最初の文字は？`,
    audioText: soundSeeds[index].ja.split(' ')[0],
  }),
);

const words = makeSimpleItems('word', 'word', wordSeeds, ['listening', 'vocabulary'], 1);
const chunks = makeSimpleItems('chunk', 'chunk', chunkSeeds, ['listening', 'grammar', 'speaking'], 2);
const dialogues = makeSimpleItems('dialogue', 'dialogue', dialogueSeeds, ['listening', 'conversation'], 3);
const readings = makeSimpleItems('reading', 'reading', readingSeeds, ['reading', 'inference'], 3);

export const ENGLISH_QUEST_ITEMS: LearningItem[] = [
  ...sounds,
  ...words,
  ...chunks,
  ...dialogues,
  ...readings,
];

export const ITEM_BY_ID = new Map(ENGLISH_QUEST_ITEMS.map((item) => [item.id, item]));

export const ENGLISH_QUEST_SPIRITS: SpiritDefinition[] = [
  { id: 'echo', name: 'エコリ', evolvedName: 'エコリア', description: '音を見つける青い精霊', spriteIndex: 0, unlockQuestStep: 1, unlockMasteredCount: 2 },
  { id: 'flare', name: 'フレコ', evolvedName: 'フレアード', description: '勇気をくれる炎の精霊', spriteIndex: 1, unlockQuestStep: 2, unlockMasteredCount: 5 },
  { id: 'aqua', name: 'アクアム', evolvedName: 'アクアリア', description: 'ことばをつなぐ水の精霊', spriteIndex: 2, unlockQuestStep: 3, unlockMasteredCount: 9 },
  { id: 'lore', name: 'ロアウル', evolvedName: 'ロアセージ', description: '本の謎を知る精霊', spriteIndex: 3, unlockQuestStep: 4, unlockMasteredCount: 14 },
  { id: 'sol', name: 'ソルル', evolvedName: 'ソルレオン', description: '思い出す力を照らす精霊', spriteIndex: 4, unlockQuestStep: 5, unlockMasteredCount: 20 },
  { id: 'leaf', name: 'リーフィ', evolvedName: 'リーフェル', description: '毎日の成長を守る精霊', spriteIndex: 5, unlockQuestStep: 6, unlockMasteredCount: 27 },
  { id: 'tempo', name: 'テンポ', evolvedName: 'テンポラ', description: '忘れる前に現れる精霊', spriteIndex: 6, unlockQuestStep: 7, unlockMasteredCount: 35 },
  { id: 'luna', name: 'ルナ', evolvedName: 'ルナリス', description: '記憶の夜道を照らす精霊', spriteIndex: 7, unlockQuestStep: 8, unlockMasteredCount: 44 },
];

export const ENGLISH_QUEST_GUIDES: GuideDefinition[] = [
  { id: 'mina', name: 'ミーナ', role: '会話の相棒', message: 'いっしょに声に出すと、ことばがもっと仲良くなるよ！', spriteIndex: 0 },
  { id: 'lira', name: 'リラ', role: '読解の案内人', message: '絵と見出しから、文のヒントを先に見つけよう。', spriteIndex: 1 },
  { id: 'gald', name: 'ガルド', role: 'アリーナ隊長', message: 'まちがえても大丈夫。英語の合図をもう一度聞こう！', spriteIndex: 2 },
  { id: 'tick', name: 'ティック', role: '記憶の時計番', message: '今日思い出すと、忘れにくい宝物になるよ。', spriteIndex: 3 },
  { id: 'sage', name: 'セージ', role: '物語の語り手', message: '前に覚えたことばが、次の謎を開く鍵になるよ。', spriteIndex: 4 },
  { id: 'nox', name: 'ノクス', role: 'まちがい救助隊', message: '難しいときはヒントの灯りをつけよう。進めなくはならないよ。', spriteIndex: 5 },
];

export const QUEST_REGIONS = [
  { id: 'capture', name: 'ささやきの森', description: '音を聞いて精霊を見つけよう', mode: 'capture' as const },
  { id: 'arena', name: 'ほのおの闘技場', description: '英語の合図でドラゴンを動かそう', mode: 'arena' as const },
  { id: 'merge', name: 'ことばの泉', description: '音とことばをマージしよう', mode: 'merge' as const },
  { id: 'escape', name: '記憶の図書館', description: '手がかりを合わせて扉を開こう', mode: 'escape' as const },
];

export const MAIN_QUESTS: QuestDefinition[] = [
  {
    id: 'q01', chapter: 1, title: '音の芽をさがせ', regionName: 'ささやきの森', mode: 'capture', guideId: 'mina', spiritId: 'echo',
    story: '森から音が消えて、青い羽だけが残ったよ。光る足あとを追ってエコリを見つけよう。',
    objective: '音を聞き、森を探し、同じ絵を精霊へ届ける', reward: '音の精霊 エコリ', rewardEmoji: '🎵',
    itemIds: ['sound-a', 'sound-b', 'sound-c', 'sound-d', 'word-cat', 'word-dog', 'word-bird', 'word-fish'],
  },
  {
    id: 'q02', chapter: 2, title: '赤い実の合図', regionName: 'ほのおの闘技場', mode: 'arena', guideId: 'gald', spiritId: 'flare',
    story: '火の橋が眠ってしまった。聞こえた仲間のところまでドラゴンを動かして、勇気の火をともそう。',
    objective: '音を覚え、ドラゴンを動かして目標へたどり着く', reward: '炎の精霊 フレコ', rewardEmoji: '🔥',
    itemIds: ['sound-e', 'sound-f', 'sound-g', 'sound-h', 'word-rabbit', 'word-fox', 'word-lion', 'word-turtle'],
  },
  {
    id: 'q03', chapter: 3, title: 'ことば結晶', regionName: 'ことばの泉', mode: 'merge', guideId: 'tick', spiritId: 'aqua',
    story: '泉のしずくが、ばらばらになっているよ。音・絵・ことばを自分の手で結び直そう。',
    objective: 'しずくを選び、泉へ運び、ことば結晶を作る', reward: '水の精霊 アクアム', rewardEmoji: '💧',
    itemIds: ['sound-i', 'sound-j', 'sound-k', 'sound-l', 'word-red', 'word-blue', 'word-green', 'word-yellow'],
  },
  {
    id: 'q04', chapter: 4, title: '森の道しるべ', regionName: '記憶の図書館', mode: 'escape', guideId: 'lira', spiritId: 'lore',
    story: '古い図書館の扉が閉じたまま。部屋に隠れた二つの手がかりを重ねて、出口を見つけよう。',
    objective: '部屋を調べ、二つの手がかりから出口を推理する', reward: '知恵の精霊 ロアウル', rewardEmoji: '📚',
    itemIds: ['sound-m', 'sound-n', 'sound-o', 'sound-p', 'word-orange', 'word-purple', 'word-black', 'word-white'],
  },
  {
    id: 'q05', chapter: 5, title: '八つ星のかくれんぼ', regionName: 'ささやきの森', mode: 'capture', guideId: 'sage', spiritId: 'sol',
    story: '数の星が森のあちこちに隠れたよ。聞こえた数を覚えて、星明かりを集めよう。',
    objective: '英語の数を聞き分け、隠れ場所から見つける', reward: '光の精霊 ソルル', rewardEmoji: '☀️',
    itemIds: ['word-one', 'word-two', 'word-three', 'word-four', 'word-five', 'word-six', 'word-seven', 'word-eight'],
  },
  {
    id: 'q06', chapter: 6, title: '仲間のアリーナ', regionName: 'ほのおの闘技場', mode: 'arena', guideId: 'gald', spiritId: 'leaf',
    story: '迷子の仲間たちがアリーナで待っている。声の合図を聞いて、一人ずつ迎えに行こう。',
    objective: '人や持ち物の音を覚え、正しい場所まで移動する', reward: '若葉の精霊 リーフィ', rewardEmoji: '🌿',
    itemIds: ['word-mother', 'word-father', 'word-sister', 'word-brother', 'word-friend', 'word-teacher', 'word-book', 'word-pen'],
  },
  {
    id: 'q07', chapter: 7, title: '動きのしずく', regionName: 'ことばの泉', mode: 'merge', guideId: 'mina', spiritId: 'tempo',
    story: '泉が元気をなくして、物も動きも止まってしまった。しずくを結んで時間を動かそう。',
    objective: '身の回りの物と動きの音・絵・文字を結ぶ', reward: '時の精霊 テンポ', rewardEmoji: '⏰',
    itemIds: ['word-bag', 'word-cup', 'word-chair', 'word-table', 'word-key', 'word-clock', 'word-run', 'word-jump'],
  },
  {
    id: 'q08', chapter: 8, title: '迷い鳥の地図', regionName: '記憶の図書館', mode: 'escape', guideId: 'nox', spiritId: 'luna',
    story: '月の鳥が帰る道を忘れてしまった。動きの合図を集めて、夜の迷路から連れ出そう。',
    objective: '行動の手がかりを組み合わせ、正しい道を選ぶ', reward: '月の精霊 ルナ', rewardEmoji: '🌙',
    itemIds: ['word-walk', 'word-stop', 'word-listen', 'word-look', 'word-open', 'word-close', 'word-eat', 'word-drink'],
  },
  {
    id: 'q09', chapter: 9, title: '月明かりのあいさつ', regionName: 'ささやきの森', mode: 'capture', guideId: 'tick',
    story: '森の仲間が夜のお祭りへ集まってきた。あいさつの声を見つけて、みんなを輪へ招こう。',
    objective: '短い英語のまとまりを、声・場面・意味で覚える', reward: '友情のランタン', rewardEmoji: '🏮',
    itemIds: ['chunk-hello', 'chunk-good-morning', 'chunk-thank-you', 'chunk-youre-welcome', 'chunk-please', 'chunk-im-seven', 'chunk-my-name', 'chunk-i-like-cats'],
  },
  {
    id: 'q10', chapter: 10, title: 'ドラゴンの試練', regionName: 'ほのおの闘技場', mode: 'arena', guideId: 'gald',
    story: '言葉の嵐がアリーナを包んだよ。文の合図を聞き、ドラゴンと一緒に十の光を取り戻そう。',
    objective: '文の意味を聞き取り、動きながら素早く使う', reward: '勇気の紋章', rewardEmoji: '🛡️',
    itemIds: ['chunk-dont-like-rain', 'chunk-this-book', 'chunk-it-red', 'chunk-can-run', 'chunk-can-jump', 'chunk-yes-can', 'chunk-no-cant', 'chunk-where-book', 'dialogue-name', 'dialogue-how-are-you'],
  },
  {
    id: 'q11', chapter: 11, title: '会話の泉', regionName: 'ことばの泉', mode: 'merge', guideId: 'mina',
    story: '会話の橋が言葉のかけらに分かれてしまった。聞いた順に並べて、返事を完成させよう。',
    objective: '単語を順番に組み、質問と返事をつなげる', reward: '会話の王冠', rewardEmoji: '👑',
    itemIds: ['chunk-on-table', 'chunk-open-door', 'chunk-close-book', 'chunk-see-you', 'dialogue-like-cats', 'dialogue-book-where', 'dialogue-color', 'dialogue-how-many', 'reading-open-sign', 'reading-stop-sign'],
  },
  {
    id: 'q12', chapter: 12, title: '図書館の封印', regionName: '記憶の図書館', mode: 'escape', guideId: 'lira',
    story: '最後の本が開いた。会話・看板・時刻・地図を一つずつ読み、図書館の封印を解こう。',
    objective: '複数の手がかりを組み合わせ、理由を持って出口を選ぶ', reward: '記憶の鍵', rewardEmoji: '🗝️',
    itemIds: ['dialogue-can-swim', 'dialogue-goodbye', 'reading-library-time', 'reading-blue-door', 'reading-two-tickets', 'reading-meet-monday', 'reading-bus-eight', 'reading-key-table'],
  },
];

export const FINAL_QUEST: QuestDefinition = {
  id: 'final', chapter: 13, title: '記憶の脱出ダンジョン', regionName: '森の心臓部', mode: 'escape', guideId: 'sage',
  story: '十二の冒険で集めた光が、森の心臓部へ続く道を照らした。四つの部屋を自分の力で突破しよう。',
  objective: '音・移動・語順・予定表を組み合わせて四つの部屋から脱出する', reward: 'はじまりの森の守り手', rewardEmoji: '🏆',
  itemIds: ['word-key', 'word-red', 'word-blue', 'word-green', 'word-yellow', 'chunk-open-door', 'reading-library-time', 'reading-blue-door'], final: true,
};
