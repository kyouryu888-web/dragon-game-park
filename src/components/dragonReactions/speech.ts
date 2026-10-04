import type { DragonLevel, DragonOutcome } from './types';

type EventLine = Readonly<{
  hint: string;
  upbeat: readonly [string, string, string, string, string];
  hurt?: readonly [string, string, string, string, string];
}>;

/** All themes come from public event kinds, never card identities or CPU evaluation. */
const EVENT_LINES: Readonly<Record<string, EventLine>> = {
  counter: { hint: 'ドロー返し', upbeat: ['もっと返すよ！', 'さらに返すぞ！', 'ドロー返しだね', 'さらに返してやろう！', 'さらに返しますね'] },
  draw: { hint: 'ドロー', upbeat: ['いっぱい来た！', 'こんなに引くのか！', 'ずいぶん引いたね', 'むう、札が多いな', 'たくさん来ましたね'], hurt: ['こんなに〜！？', 'うわっ、こんなに！', 'これは多いね', 'むう、札の雨か！', 'おや、札の雨ですね'] },
  reverse: { hint: 'リバース', upbeat: ['順番、逆だよ！', '順番、逆だ！', '順番を逆にしよう', '逆回りにするぞ！', '順番を逆にしますね'] },
  color: { hint: '色変更', upbeat: ['色を変えたよ！', '色を変えるぞ！', '色を変えよう', '色を変えてやろう', '色を変えますね'] },
  skip: { hint: 'スキップ', upbeat: ['1回おやすみ！', 'ひとつ飛ばすぞ！', '順番を飛ばそう', '一回休みだ！', '順番を飛ばしますね'] },
  lowCards: { hint: 'あと少し', upbeat: ['あとちょっと！', 'あと少しだ！', '残りわずかだね', 'あとわずかだ！', '残り少なくなりました'] },
  lastCard: { hint: 'あと1枚', upbeat: ['あと1枚だよ！', 'あと1枚だ！', '残り1枚だね', '最後の1枚だ！', '残り1枚ですね'] },
  roulette: { hint: 'ルーレット', upbeat: ['どこで止まる？', 'まだ回るのか！', 'まだ続くんだね', 'まだ止まらぬか！', 'まだ続きますね'] },
  rouletteStop: { hint: '安全な色', upbeat: ['止まったよ！', 'よし、止まった！', '安全な色が出たね', 'ついに止まったか！', '安全な色が出ましたね'] },
  pair: { hint: 'ペア', upbeat: ['そろったよ！', 'ペアがそろった！', 'ペア成立だね', '二枚そろったぞ！', 'ペアがそろいましたね'] },
  shuffleDeclared: { hint: 'シャッフル', upbeat: ['シャッフルだよ！', 'シャッフルタイム！', '札を混ぜようか', 'シャッフルの時間だ！', 'シャッフルですね'] },
  shuffle: { hint: 'シャッフル', upbeat: ['札がぐるっと！', '札が回ったぞ！', '札が入れ替わったね', '札が動いたぞ！', '札が入れ替わりました'] },
  shuffleFour: { hint: '移動なし', upbeat: ['動かなかった…', '札が動かないぞ…', '今回は移動なしだね', 'むう、移動なしか', '今回は移動なしですね'] },
  singleDraw: { hint: '1枚引く', upbeat: ['さあ、1枚！', 'よし、1枚引くぞ！', '1枚引いてみよう', 'さあ、1枚引くぞ！', '1枚引きますね'] },
  flip: { hint: '反転', upbeat: ['石が返ったよ！', '一気に返すぞ！', 'まとめて返ったね', 'まとめて返すぞ！', '石が返りましたね'], hurt: ['いっぱい返された！', 'くっ、返された！', 'ずいぶん返されたね', 'むう、返されたか！', '見事に返されました'] },
  corner: { hint: '角', upbeat: ['角をとったよ！', '角を押さえた！', '角を押さえたね', 'この角は王のものだ！', '角を押さえましたね'], hurt: ['角をとられた〜', 'くっ、角を取られた！', '角を取られたね', '角を取るとは！', '角を取られましたね'] },
  pass: { hint: 'パス', upbeat: ['次の番だよ！', '次の手を打つぞ！', 'もう一手だね', 'もう一手打とう！', '次の手番ですね'], hurt: ['今回はパス…', 'ここはパスだ！', '今回はパスだね', '今は待とう', '今回はパスですね'] },
  shield: { hint: '盾', upbeat: ['盾で守ったよ！', '盾で守った！', '盾が防いだね', '盾が守ったぞ！', '盾が防ぎましたね'], hurt: ['盾に止められた！', 'くっ、盾か！', '盾が防いだね', 'むう、盾に防がれた', '盾に防がれましたね'] },
  bomb: { hint: '爆裂', upbeat: ['わっ、爆裂！', 'どかんと爆裂！', '爆裂したね', 'フハハ、爆裂だ！', '爆裂しましたね'], hurt: ['わあ、石が〜！', 'くっ、爆裂か！', '石が消えたね', 'むう、爆裂か！', '石が消えましたね'] },
  infection: { hint: '感染', upbeat: ['石に広がった！', 'どんどん広がるぞ！', '感染が広がったね', '周りへ広がったぞ！', '感染が広がりました'], hurt: ['広がっちゃった！', 'くっ、広がったか！', '周りまで変わったね', 'むう、感染か！', '周りまで変わりました'] },
  hit: { hint: 'ヒット', upbeat: ['バーへ送ったよ！', 'よし、ヒットだ！', 'バーへ送ったね', 'バーへ送ってやろう！', 'ヒットしましたね'], hurt: ['バーへ行っちゃった！', 'くっ、ヒットされた！', 'バーへ送られたね', 'むう、ヒットか！', 'バーへ送られました'] },
  doubles: { hint: 'ゾロ目', upbeat: ['ゾロ目だよ！', 'よし、ゾロ目だ！', 'ゾロ目が出たね', 'フハハ、ゾロ目だ！', 'ゾロ目が出ましたね'] },
  noMoves: { hint: '動けない', upbeat: ['動けないよ〜', 'ここは待つか！', '今は動かせないね', '今は待とう', '今は動かせませんね'] },
  return: { hint: '盤へ復帰', upbeat: ['戻れたよ！', 'よし、盤へ戻った！', '盤へ戻れたね', '盤へ戻ったぞ！', '盤へ戻れましたね'] },
  bearoff: { hint: 'ベアオフ', upbeat: ['ゴールへ！', 'よし、ベアオフ！', 'ひとつ上がったね', 'ひとつ上がったぞ！', 'ベアオフしましたね'] },
  doubleOffer: { hint: 'ダブル提案', upbeat: ['勝負を倍に！', '勝負を倍にするぞ！', 'ダブルを提案しよう', '倍の勝負といこう！', 'ダブルを提案しますね'] },
  doubleAccept: { hint: 'ダブル受諾', upbeat: ['倍でもいくよ！', '倍の勝負だ！', 'ダブルを受けよう', '倍でも受けて立つ！', 'ダブルを受けますね'] },
  doubleOfferOpponent: { hint: '相手のダブル提案', upbeat: ['倍の勝負を提案してきた！', '倍の勝負を提案してきたぞ！', 'ダブルを提案してきたね', '倍の勝負を提案してきたか！', 'ダブルを提案してきましたね'] },
  doubleAcceptOpponent: { hint: '相手のダブル受諾', upbeat: ['倍の勝負を受けたね！', '倍の勝負を受けてきたぞ！', 'ダブルを受けてきたね', '倍でも受けて立つか！', 'ダブルを受けてきましたね'] },
  returnOpponent: { hint: '相手の盤への復帰', upbeat: ['相手の駒が戻ったよ！', '相手が盤へ戻ったぞ！', '相手の駒が盤へ戻ったね', '相手が盤へ戻ったか！', '相手の駒が盤へ戻りましたね'] },
  bearoffOpponent: { hint: '相手のベアオフ', upbeat: ['相手の駒がゴールへ！', '相手がベアオフしたぞ！', '相手がひとつ上がったね', '相手がひとつ上がったか！', '相手がベアオフしましたね'] },
  extraTurn: { hint: '追加ターン', upbeat: ['もう1回だよ！', 'よし、もう1回！', 'もう一手だね', 'もう一手打つぞ！', 'もう一手ですね'] },
  stones: { hint: '石を獲得', upbeat: ['石がいっぱい！', 'まとめてゲット！', '石が集まったね', '石が集まったぞ！', '石が集まりましたね'] },
  lostStones: { hint: '石を獲得された', upbeat: ['石が持ってかれた！', 'くっ、石を取られた！', '石が移ったね', 'むう、石を取られた', '石が移りましたね'] },
  sow: { hint: '石まき', upbeat: ['ころころ、進め！', '石をまいていくぞ！', '順に石をまこう', '石をまいてゆくぞ！', '順に石をまきますね'] },
};

function themeOf(kind: string): string | undefined {
  if (kind === 'uno-draw-counter') return 'counter';
  if (kind === 'uno-forced-draw' || kind === 'uno-knockout') return 'draw';
  if (kind === 'uno-reverse') return 'reverse';
  if (kind === 'uno-color-picked' || kind === 'uno-color-change') return 'color';
  if (kind === 'uno-skip') return 'skip';
  if (kind === 'uno-1-cards') return 'lastCard';
  if (/^uno-[23]-cards$/.test(kind)) return 'lowCards';
  if (kind === 'uno-roulette-stop') return 'rouletteStop';
  if (kind.startsWith('uno-roulette:')) return 'roulette';
  if (kind === 'babanuki-pair') return 'pair';
  if (kind === 'babanuki-shuffle-declared') return 'shuffleDeclared';
  if (kind === 'babanuki-shuffle-four') return 'shuffleFour';
  if (kind.startsWith('babanuki-shuffle')) return 'shuffle';
  if (kind === 'babanuki-draw') return 'singleDraw';
  if (kind === 'corner') return 'corner';
  if (kind === 'large-flip' || kind === 'flip' || kind === 'reversi-flip') return 'flip';
  if (kind === 'pass') return 'pass';
  if (kind === 'shield-defense') return 'shield';
  if (kind.startsWith('bomb:')) return 'bomb';
  if (kind.startsWith('infection:')) return 'infection';
  if (kind.startsWith('backgammon-opponent-')) {
    if (kind.includes('double-offer')) return 'doubleOfferOpponent';
    if (kind.includes('double-accept')) return 'doubleAcceptOpponent';
    if (kind.includes('return') || kind.includes('bar-entry')) return 'returnOpponent';
    if (kind.includes('bearoff') || kind.includes('bear-off')) return 'bearoffOpponent';
  }
  if (kind.includes('was-hit')) return 'hit';
  if (kind.startsWith('backgammon-') && kind.includes('hit')) return 'hit';
  if (kind.includes('doubles-roll')) return 'doubles';
  if (kind.includes('no-moves')) return 'noMoves';
  if (kind.includes('return') || kind.includes('bar-entry')) return 'return';
  if (kind.includes('bearoff') || kind.includes('bear-off')) return 'bearoff';
  if (kind.includes('double-offer')) return 'doubleOffer';
  if (kind.includes('double-accept')) return 'doubleAccept';
  if (kind === 'mancala-extra-turn') return 'extraTurn';
  if (kind === 'mancala-large-loss' || kind === 'mancala-capture-loss') return 'lostStones';
  if (kind.startsWith('mancala-') && (kind.includes('capture') || kind.includes('store-gain') || kind.includes('gain'))) return 'stones';
  if (kind.startsWith('mancala-') && (kind.includes('sow') || kind.includes('move'))) return 'sow';
  return undefined;
}

export function eventSpecificSpeech(
  kind: string,
  level: DragonLevel,
  outcome: DragonOutcome,
  acting: 'sincere' | 'bluff',
): string | undefined {
  if (kind === 'babanuki-finish' && outcome === 'victory') {
    return ['抜けたよ！', 'よし、勝ち抜け！', '勝ち抜けたね', '勝ち抜けたぞ！', '勝ち抜けましたね'][level - 1];
  }
  if (kind === 'babanuki-loser' && outcome === 'defeat') {
    return ['最弱王になっちゃった…', 'くっ、最弱王か…', '今回は最弱王だね', 'むう、最弱王か…', '今回は最弱王ですね'][level - 1];
  }
  if (kind === 'uno-knockout' && outcome === 'defeat') {
    return ['25枚でアウト…', 'くっ、25枚でアウト！', '25枚でアウトだね', 'むう、25枚でアウトか', '25枚でアウトですね'][level - 1];
  }
  if (outcome === 'victory' || outcome === 'defeat') return undefined;
  const theme = themeOf(kind);
  const lines = theme ? EVENT_LINES[theme] : undefined;
  if (!lines) return undefined;
  if (acting === 'bluff') {
    const hints = outcome === 'advantage'
      ? [`${lines.hint}…こまったな〜`, `${lines.hint}…まずいかも？`, `${lines.hint}、焦るね`, `${lines.hint}…ピンチか？`, `${lines.hint}、困りましたね`]
      : [`${lines.hint}？へいきだもん！`, `${lines.hint}でも平気さ！`, `${lines.hint}も予定どおり`, `${lines.hint}も面白い！`, `${lines.hint}もまだ読めません`];
    return hints[level - 1];
  }
  return (outcome === 'disadvantage' ? lines.hurt ?? lines.upbeat : lines.upbeat)[level - 1];
}
