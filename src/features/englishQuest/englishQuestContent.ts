import type { GuideDefinition, LearningItem, QuestDefinition, SpiritDefinition } from './englishQuestTypes';

type Seed = {
  id: string;
  ja: string;
  en: string;
  emoji: string;
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
  { id: 'name', ja: 'What is your name? への返事', en: 'My name is Mio.', emoji: '💬' },
  { id: 'how-are-you', ja: 'How are you? への返事', en: "I'm fine, thank you.", emoji: '😊' },
  { id: 'like-cats', ja: 'Do you like cats? への返事', en: 'Yes, I do.', emoji: '🐱' },
  { id: 'book-where', ja: 'Where is my book? への返事', en: "It's on the table.", emoji: '📘' },
  { id: 'color', ja: 'What color is it? への返事', en: "It's blue.", emoji: '🔵' },
  { id: 'how-many', ja: 'How many birds? への返事', en: 'Three birds.', emoji: '🐦' },
  { id: 'can-swim', ja: 'Can you swim? への返事', en: 'Yes, I can.', emoji: '🏊' },
  { id: 'goodbye', ja: 'Goodbye! への返事', en: 'See you!', emoji: '👋' },
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
      audioText: type === 'dialogue' ? seed.ja.split(' への')[0] : seed.en,
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
  { id: 'echo', name: 'エコリ', evolvedName: 'エコリア', description: '音を見つける青い精霊', spriteIndex: 0, unlockMasteredCount: 2 },
  { id: 'flare', name: 'フレコ', evolvedName: 'フレアード', description: '勇気をくれる炎の精霊', spriteIndex: 1, unlockMasteredCount: 5 },
  { id: 'aqua', name: 'アクアム', evolvedName: 'アクアリア', description: 'ことばをつなぐ水の精霊', spriteIndex: 2, unlockMasteredCount: 9 },
  { id: 'lore', name: 'ロアウル', evolvedName: 'ロアセージ', description: '本の謎を知る精霊', spriteIndex: 3, unlockMasteredCount: 14 },
  { id: 'sol', name: 'ソルル', evolvedName: 'ソルレオン', description: '思い出す力を照らす精霊', spriteIndex: 4, unlockMasteredCount: 20 },
  { id: 'leaf', name: 'リーフィ', evolvedName: 'リーフェル', description: '毎日の成長を守る精霊', spriteIndex: 5, unlockMasteredCount: 27 },
  { id: 'tempo', name: 'テンポ', evolvedName: 'テンポラ', description: '忘れる前に現れる精霊', spriteIndex: 6, unlockMasteredCount: 35 },
  { id: 'luna', name: 'ルナ', evolvedName: 'ルナリス', description: '記憶の夜道を照らす精霊', spriteIndex: 7, unlockMasteredCount: 44 },
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
  { id: 'q01', title: '音の芽をさがせ', regionName: 'ささやきの森', mode: 'capture' },
  { id: 'q02', title: '赤い実の合図', regionName: 'ほのおの闘技場', mode: 'arena' },
  { id: 'q03', title: 'ことば結晶', regionName: 'ことばの泉', mode: 'merge' },
  { id: 'q04', title: '森の道しるべ', regionName: '記憶の図書館', mode: 'escape' },
  { id: 'q05', title: '精霊のかくれんぼ', regionName: 'ささやきの森', mode: 'capture' },
  { id: 'q06', title: 'ほのお橋をわたれ', regionName: 'ほのおの闘技場', mode: 'arena' },
  { id: 'q07', title: 'あいさつのしずく', regionName: 'ことばの泉', mode: 'merge' },
  { id: 'q08', title: '迷い鳥の地図', regionName: '記憶の図書館', mode: 'escape' },
  { id: 'q09', title: '月明かりの音', regionName: 'ささやきの森', mode: 'capture' },
  { id: 'q10', title: 'ドラゴンの試練', regionName: 'ほのおの闘技場', mode: 'arena' },
  { id: 'q11', title: '会話の泉', regionName: 'ことばの泉', mode: 'merge' },
  { id: 'q12', title: '図書館の封印', regionName: '記憶の図書館', mode: 'escape' },
];

export const FINAL_QUEST: QuestDefinition = {
  id: 'final',
  title: '記憶の脱出ダンジョン',
  regionName: '森の心臓部',
  mode: 'escape',
  final: true,
};
