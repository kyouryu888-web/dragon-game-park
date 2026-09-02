import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type RuleConfig } from '../../src/features/reversi/bakuretsu/config.ts';
import { emptyCell, idx } from '../../src/features/reversi/bakuretsu/rules.ts';
import { applyMove, applyRescue } from '../../src/features/reversi/bakuretsu/engine.ts';
import { checkState } from './invariants.ts';
import type { ChainEvent, GameState, PlayerId, SpecialType } from '../../src/features/reversi/bakuretsu/types.ts';

const cfg: RuleConfig = DEFAULT_CONFIG;
const cases: Array<{ name: string; passed: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = '') => {
  cases.push({ name, passed: cond, detail });
};

function blank(turn: 'BLACK' | 'WHITE' = 'BLACK'): GameState {
  return {
    board: Array.from({ length: 64 }, emptyCell),
    currentTurn: turn,
    hands: {
      BLACK: { playerId: 'BLACK', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
      WHITE: { playerId: 'WHITE', initialSpecials: ['BOMB', 'INFECT', 'SHIELD'], specialPieces: ['BOMB', 'INFECT', 'SHIELD'], dummyCount: 0 },
    },
    activeQuestionCount: 0, status: 'PLAYING', passStreak: 0, moveNo: 0,
  };
}
const put = (s: GameState, x: number, y: number, owner: PlayerId, sp: SpecialType = 'NONE', dur = 0) => {
  s.board[idx(x, y)] = { state: 'FACEUP', owner, specialType: sp, durability: dur, isQueued: false, activated: false };
};
const at = (s: GameState, x: number, y: number) => s.board[idx(x, y)];

// ---------- T1: 爆破は配置者のコマを破壊しない ----------
{
  const s = blank('BLACK');
  put(s, 2, 4, 'BLACK');                      // 挟みの端
  put(s, 3, 4, 'BLACK');                      // 黒（爆風で消える想定）
  put(s, 4, 4, 'WHITE', 'BOMB');              // 白の爆弾
  put(s, 4, 3, 'WHITE'); put(s, 4, 5, 'WHITE'); // 白（配置者なので無傷の想定）
  const r = applyMove(s, { x: 5, y: 4, kind: 'NORMAL' }, cfg);
  const b = r.state.board;
  ok('T1 配置者(白)のコマが爆風で残る', at(r.state, 4, 3).owner === 'WHITE' && at(r.state, 4, 5).owner === 'WHITE');
  ok('T1 相手(黒)のコマは破壊される', b[idx(3, 4)].state === 'EMPTY');
  ok('T1 爆弾自身も消える', b[idx(4, 4)].state === 'EMPTY');
  ok('T1 着手コマ自身も爆風で消える', b[idx(5, 4)].state === 'EMPTY');
}

// ---------- T2: 裏返しが爆破より先に確定する ----------
{
  const s = blank('BLACK');
  put(s, 2, 4, 'BLACK');
  put(s, 3, 4, 'WHITE');                      // 裏返って黒になった直後に爆破される想定
  put(s, 4, 4, 'WHITE', 'BOMB');
  const r = applyMove(s, { x: 5, y: 4, kind: 'NORMAL' }, cfg);
  // 裏返し先行なら (3,4) は黒になってから爆破 → 消滅
  // 爆破優先なら (3,4) は白のまま → 配置者無傷ルールで残る
  ok('T2 裏返し先行が効いている（(3,4)が消滅）', at(r.state, 3, 4).state === 'EMPTY',
    `実際: ${at(r.state, 3, 4).state}/${at(r.state, 3, 4).owner}`);
  ok('T2 裏返し中止イベントが発生しない', !r.events.some((e) => e.t === 'FLIP_CANCELLED'));
}

// ---------- T3: 感染は特殊コマ・中立を奪わない ----------
{
  const s = blank('BLACK');
  put(s, 4, 3, 'BLACK');                      // 挟みの端（奪取対象になる）
  put(s, 4, 4, 'WHITE', 'INFECT');
  put(s, 3, 4, 'BLACK', 'BOMB');              // 特殊コマ → 奪われない想定
  put(s, 5, 4, 'NONE', 'NEUTRAL');            // 中立 → 奪われない想定
  const r = applyMove(s, { x: 4, y: 5, kind: 'NORMAL' }, cfg);
  ok('T3 相手の特殊コマは奪われない', at(r.state, 3, 4).owner === 'BLACK' && at(r.state, 3, 4).specialType === 'BOMB');
  ok('T3 中立コマは奪われない', at(r.state, 5, 4).specialType === 'NEUTRAL' && at(r.state, 5, 4).owner === 'NONE');
  ok('T3 通常コマは奪われる', at(r.state, 4, 3).owner === 'WHITE');
  ok('T3 感染自身は相手の色の通常コマになる', at(r.state, 4, 4).owner === 'BLACK' && at(r.state, 4, 4).specialType === 'NONE');
}

// ---------- T4〜T6: 救済の拡張ロジック ----------
{
  const mk = (fill: (s: GameState) => void) => {
    const s = blank('BLACK');
    fill(s);
    const ev: ChainEvent[] = [];
    applyRescue(s, cfg, ev);
    return { s, ev };
  };
  // 中央4x4を全部埋める（すべて白）→ 黒は0枚
  const { s: s4, ev: e4 } = mk((s) => {
    for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) put(s, x, y, 'WHITE');
  });
  const r4 = e4.find((e) => e.t === 'RESCUE') as any;
  ok('T4 中央4x4が満杯なら6x6枠へ拡張', !!r4 && [1, 6].includes(r4.idx % 8) || (!!r4 && [1, 6].includes((r4.idx / 8) | 0)),
    `配置先 idx=${r4?.idx}`);
  ok('T4 救済位置は決定論的（y昇順→x昇順で最初の空き）', r4?.idx === idx(1, 1), `実際 idx=${r4?.idx}`);

  // 6x6まで全部埋める → 盤全体へ拡張（角は不可）
  const { ev: e6 } = mk((s) => {
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 6; x++) put(s, x, y, 'WHITE');
  });
  const r6 = e6.find((e) => e.t === 'RESCUE') as any;
  ok('T5 6x6も満杯なら盤全体へ拡張', !!r6, `配置先 idx=${r6?.idx}`);
  ok('T5 角には置かない', r6 && ![0, 7, 56, 63].includes(r6.idx), `実際 idx=${r6?.idx}`);

  // 盤面満杯 → 配置不能でも落ちない
  const { s: sf, ev: ef } = mk((s) => {
    for (let i = 0; i < 64; i++) s.board[i] = { state: 'FACEUP', owner: 'WHITE', specialType: 'NONE', durability: 0, isQueued: false, activated: false };
  });
  ok('T6 盤面満杯でも例外を出さない', ef.filter((e) => e.t === 'RESCUE').length === 0 && sf.board.every((c) => c.state !== 'EMPTY'));
}

// ---------- T7: 双方全滅 → 引き分け ----------
{
  const s = blank('BLACK');
  put(s, 0, 0, 'NONE', 'NEUTRAL');   // 中立だけが残った盤面
  const ev: ChainEvent[] = [];
  applyRescue(s, cfg, ev);
  ok('T7 双方0枚なら引き分けで終局', s.status === 'FINISHED' && s.winner === 'NONE' && s.endReason === 'MUTUAL_EXTINCTION',
    `status=${s.status} winner=${s.winner}`);
  ok('T7 救済配置は行われない', !ev.some((e) => e.t === 'RESCUE'));
}

// ---------- T8: 中立は挟み込みの端になれない ----------
{
  const s = blank('BLACK');
  put(s, 2, 4, 'NONE', 'NEUTRAL');   // 端が中立 → ラインは死ぬ
  put(s, 3, 4, 'WHITE');
  let threw = false;
  try { applyMove(s, { x: 4, y: 4, kind: 'NORMAL' }, cfg); } catch { threw = true; }
  ok('T8 中立を端にしたラインは成立しない（非合法手）', threw);
}

// ---------- T9: 中立だけを挟むラインは裏返らない ----------
{
  const s = blank('BLACK');
  put(s, 2, 4, 'BLACK');
  put(s, 3, 4, 'NONE', 'NEUTRAL');   // 相手コマ0枚のライン
  let threw = false;
  try { applyMove(s, { x: 4, y: 4, kind: 'NORMAL' }, cfg); } catch { threw = true; }
  ok('T9 相手コマを含まないラインでは打てない', threw);
}

// ---------- T10: 盾は裏返しを吸収し所有者が変わらない ----------
{
  const s = blank('BLACK');
  put(s, 2, 4, 'BLACK');
  put(s, 3, 4, 'WHITE', 'SHIELD', 1);
  put(s, 4, 4, 'WHITE');
  const r = applyMove(s, { x: 5, y: 4, kind: 'NORMAL' }, cfg);
  ok('T10 盾は裏返らず所有者も変わらない', at(r.state, 3, 4).owner === 'WHITE');
  ok('T10 盾は通常コマに変化する', at(r.state, 3, 4).specialType === 'NONE' && at(r.state, 3, 4).durability === 0);
  ok('T10 盾より外側は裏返る', at(r.state, 4, 4).owner === 'BLACK');
}

// ---------- T11: 盾が同一手番で2回被弾すると消滅する ----------
{
  // 白の盾が「黒の着手で裏返し吸収」→「誘爆した黒の爆弾の爆風」で2回目を受ける
  const s = blank('BLACK');
  put(s, 1, 4, 'BLACK');
  put(s, 2, 4, 'WHITE', 'SHIELD', 1);  // 1回目: 裏返しを吸収
  put(s, 3, 4, 'WHITE');
  put(s, 4, 4, 'WHITE', 'BOMB');       // 黒が裏返して起爆
  put(s, 3, 3, 'BLACK', 'BOMB');       // 白の爆風で誘爆 → その爆風が(2,4)を撃つ
  for (let i = 0; i < 20; i++) put(s, i % 8, 7 - ((i / 8) | 0), 'WHITE'); // N>=24 にして8方向にする
  const r = applyMove(s, { x: 5, y: 4, kind: 'NORMAL' }, cfg);
  const bombs = r.events.filter((e) => e.t === 'BOMB');
  const absorbs = r.events.filter((e) => e.t === 'SHIELD_ABSORB');
  ok('T11 誘爆が発生する', bombs.length >= 2, `爆発回数=${bombs.length}`);
  ok('T11 盾が2回被弾して消滅する', absorbs.length >= 1 && at(r.state, 2, 4).state === 'EMPTY',
    `吸収${absorbs.length}回 / (2,4)=${at(r.state, 2, 4).state}`);
}

// ---------- T12: 全テスト後の状態整合性 ----------
{
  const s = blank('BLACK');
  put(s, 3, 3, 'WHITE'); put(s, 4, 4, 'WHITE'); put(s, 3, 4, 'BLACK'); put(s, 4, 3, 'BLACK');
  const v = checkState(s, cfg);
  ok('T12 手組み盤面が不変条件を満たす', v.length === 0, v.map((x) => x.code).join(','));
}

describe('爆裂リバーシーの移植エッジケース25件', () => {
  if (cases.length !== 25) throw new Error(`Expected 25 edge cases, received ${cases.length}`);
  it.each(cases)('$name', ({ passed, detail }) => {
    expect(passed, detail).toBe(true);
  });
});
