import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackgammonConfig, GameState, Move, PlayerId } from './backgammonTypes';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import {
  acceptDouble,
  applyMove,
  canOfferDouble,
  declineDouble,
  getLegalMoves,
  getPipCount,
  offerDouble,
  passTurn,
  rollDice,
  rollOpening,
} from './backgammonRules';
import {
  chooseCpuMoveSequence,
  getCpuDisplayName,
  shouldCpuAcceptDouble,
  shouldCpuOfferDouble,
} from './backgammonCpu';
import { BackgammonBoard, type AnimatedMove } from './BackgammonBoard';
import { DiceRow, Die } from './BackgammonDice';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

const CPU_DELAY = 750;   // CPUの手のテンポ（ms）
const MOVE_DELAY = 620;  // CPUが1手ずつ動かす間隔

const WIN_KIND_LABEL = {
  single: 'シングル勝ち',
  gammon: 'ギャモン勝ち！',
  backgammon: 'バックギャモン勝ち！！',
} as const;

type BackgammonGamePageProps = {
  config: BackgammonConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function BackgammonGamePage({ config, onBackToSetup, onBackToHome }: BackgammonGamePageProps) {
  const [state, setState] = useState<GameState>(() => createInitialBackgammonState());
  const [selected, setSelected] = useState<'bar' | number | null>(null);
  const [lastMove, setLastMove] = useState<AnimatedMove | null>(null);
  const [scores, setScores] = useState<Record<PlayerId, number>>({ white: 0, black: 0 });
  const [scoredGameId, setScoredGameId] = useState(0); // 二重加算防止
  const [gameId, setGameId] = useState(1);
  const moveSeq = useRef(0);

  const playerFor = (id: PlayerId) => config.players[id === 'white' ? 0 : 1];
  const nameFor = (id: PlayerId) => {
    const p = playerFor(id);
    return p.name.trim() || (p.isCpu ? getCpuDisplayName(p.cpuLevel) : id === 'white' ? 'プレイヤー1' : 'プレイヤー2');
  };
  const isCpuTurn = playerFor(state.currentPlayer).isCpu;

  const legalMoves = useMemo(
    () => (state.phase === 'moving' ? getLegalMoves(state) : []),
    [state],
  );

  // 人間の操作用: 移動元の候補と、選択中の移動先候補
  const sources = useMemo(() => {
    if (isCpuTurn) return new Set<string>();
    return new Set(legalMoves.map((m) => String(m.from)));
  }, [legalMoves, isCpuTurn]);

  const effectiveSelected: 'bar' | number | null =
    selected !== null ? selected : sources.size === 1 && sources.has('bar') ? 'bar' : null;

  const movesFromSelected = useMemo(
    () => legalMoves.filter((m) => String(m.from) === String(effectiveSelected)),
    [legalMoves, effectiveSelected],
  );
  const destinations = useMemo(
    () => new Set(movesFromSelected.filter((m) => m.to !== 'off').map((m) => m.to as number)),
    [movesFromSelected],
  );
  const offMove = useMemo(() => {
    const offs = movesFromSelected.filter((m) => m.to === 'off');
    if (offs.length === 0) return null;
    return offs.reduce((a, b) => (a.die <= b.die ? a : b)); // ちょうどの目を優先
  }, [movesFromSelected]);

  function doApplyMove(move: Move) {
    moveSeq.current += 1;
    setLastMove({ seq: moveSeq.current, player: state.currentPlayer, from: move.from, to: move.to });
    setSelected(null);
    setState((s) => applyMove(s, move));
  }

  // ---- 人間の盤面タップ ----
  function handleTapPoint(index: number) {
    if (isCpuTurn || state.phase !== 'moving') return;
    if (destinations.has(index) && effectiveSelected !== null) {
      const candidates = movesFromSelected.filter((m) => m.to === index);
      const move = candidates.reduce((a, b) => (a.die >= b.die ? a : b));
      doApplyMove(move);
      return;
    }
    if (sources.has(String(index))) {
      setSelected((prev) => (prev === index ? null : index));
    }
  }

  function handleTapBar() {
    if (isCpuTurn || state.phase !== 'moving') return;
    if (sources.has('bar')) setSelected((prev) => (prev === 'bar' ? null : 'bar'));
  }

  function handleTapOff() {
    if (offMove) doApplyMove(offMove);
  }

  // ---- 打てる手がないときの自動パス ----
  const mustPass = state.phase === 'moving' && state.dice.length > 0 && legalMoves.length === 0;
  useEffect(() => {
    if (!mustPass) return;
    const timer = setTimeout(() => setState((s) => passTurn(s)), 1400);
    return () => clearTimeout(timer);
  }, [mustPass, state]);

  // ---- オープニングロール（CPU同士なら自動） ----
  const bothCpu = config.players[0].isCpu && config.players[1].isCpu;
  useEffect(() => {
    if (state.phase !== 'opening-roll' || !bothCpu) return;
    const timer = setTimeout(() => setState((s) => rollOpening(s)), CPU_DELAY);
    return () => clearTimeout(timer);
  }, [state, bothCpu]);

  // ---- CPUの手番: ダブル判断 → ロール ----
  useEffect(() => {
    if (state.phase !== 'rolling' || !isCpuTurn) return;
    const cpu = playerFor(state.currentPlayer);
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.phase !== 'rolling') return s;
        if (
          config.useDoublingCube &&
          canOfferDouble(s, s.currentPlayer) &&
          shouldCpuOfferDouble(s, cpu.cpuLevel)
        ) {
          return offerDouble(s);
        }
        return rollDice(s);
      });
    }, CPU_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isCpuTurn]);

  // ---- CPUの手番: 1手ずつ動かす ----
  useEffect(() => {
    if (state.phase !== 'moving' || !isCpuTurn || legalMoves.length === 0) return;
    const cpu = playerFor(state.currentPlayer);
    const timer = setTimeout(() => {
      const seq = chooseCpuMoveSequence(state, cpu.cpuLevel);
      if (seq && seq.moves.length > 0) {
        doApplyMove(seq.moves[0]);
      }
    }, MOVE_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isCpuTurn, legalMoves]);

  // ---- ダブル提案への応答（受け手がCPUの場合） ----
  const doubleResponder: PlayerId | null =
    state.phase === 'double-offered' && state.doubleOfferedBy
      ? state.doubleOfferedBy === 'white' ? 'black' : 'white'
      : null;
  useEffect(() => {
    if (!doubleResponder || !playerFor(doubleResponder).isCpu) return;
    const cpu = playerFor(doubleResponder);
    const timer = setTimeout(() => {
      setState((s) =>
        s.phase !== 'double-offered' ? s
        : shouldCpuAcceptDouble(s, doubleResponder, cpu.cpuLevel) ? acceptDouble(s)
        : declineDouble(s),
      );
    }, CPU_DELAY + 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, doubleResponder]);

  // ---- 勝敗確定でスコア加算 ----
  useEffect(() => {
    if (state.phase !== 'finished' || !state.winner || scoredGameId === gameId) return;
    setScores((prev) => ({
      ...prev,
      [state.winner!]: prev[state.winner!] + (state.resultPoints ?? 1),
    }));
    setScoredGameId(gameId);
  }, [state, gameId, scoredGameId]);

  function handleRematch() {
    setGameId((n) => n + 1);
    setSelected(null);
    setLastMove(null);
    setState(createInitialBackgammonState());
  }

  // ---- 状態メッセージ ----
  const statusText = (() => {
    if (state.phase === 'opening-roll') {
      return state.openingRoll
        ? '同じ目！ もう一度振ってください'
        : 'サイコロを振って先手を決めましょう';
    }
    if (state.phase === 'rolling') return `${nameFor(state.currentPlayer)}の番です`;
    if (state.phase === 'double-offered') {
      return `${nameFor(state.doubleOfferedBy!)}がダブルを提案！（×${state.cube.value * 2}）`;
    }
    if (mustPass) return '打てる手がありません… パスします';
    if (state.phase === 'moving') {
      return isCpuTurn
        ? `${nameFor(state.currentPlayer)}が考えています…`
        : effectiveSelected !== null
        ? '移動先をタップしてください'
        : '動かす駒をタップしてください';
    }
    return '';
  })();

  const humanRespondsDouble = doubleResponder !== null && !playerFor(doubleResponder).isCpu;

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb, 32px)' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={onBackToSetup}
            style={{
              background: 'none', border: 'none', color: 'var(--text-mid)',
              cursor: 'pointer', fontSize: 13, padding: '6px 0',
            }}
          >
            ← 設定へ
          </button>
          <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--brown)' }}>🎲 バックギャモン</div>
          <button
            onClick={onBackToHome}
            style={{
              background: 'none', border: 'none', color: 'var(--text-mid)',
              cursor: 'pointer', fontSize: 13, padding: '6px 0',
            }}
          >
            ホーム
          </button>
        </div>

        {/* 相手（黒/翠）パネル */}
        <PlayerPanel
          id="black"
          name={nameFor('black')}
          state={state}
          score={scores.black}
          active={state.currentPlayer === 'black' && state.phase !== 'finished'}
        />

        {/* 盤 */}
        <div style={{ margin: '8px 0' }}>
          <BackgammonBoard
            state={state}
            selectableSources={sources}
            selected={effectiveSelected}
            destinations={destinations}
            onTapPoint={handleTapPoint}
            onTapBar={handleTapBar}
            lastMove={lastMove}
          />
        </div>

        {/* 自分（白/金）パネル */}
        <PlayerPanel
          id="white"
          name={nameFor('white')}
          state={state}
          score={scores.white}
          active={state.currentPlayer === 'white' && state.phase !== 'finished'}
        />

        {/* あがりゾーン */}
        <button className={`bg-off${offMove ? ' dest' : ''}`} onClick={handleTapOff} disabled={!offMove} style={{ marginTop: 8 }}>
          🏆 あがり（金 {state.borneOff.white} / 翠 {state.borneOff.black}）
          {offMove && ' ← タップで上げる！'}
        </button>

        {/* 状態表示 + サイコロ + 操作 */}
        <div style={{
          marginTop: 10, background: '#fffdf8', borderRadius: 16, padding: '14px 14px 16px',
          border: '1.5px solid var(--border-light)', boxShadow: 'var(--shadow-sm)',
          display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text)', textAlign: 'center', minHeight: 20 }}>
            {statusText}
          </div>

          {/* オープニングロールの出目 */}
          {state.phase === 'opening-roll' && state.openingRoll && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>金</span>
              <Die value={state.openingRoll[0]} />
              <Die value={state.openingRoll[1]} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>翠</span>
            </div>
          )}

          {/* 手番中のサイコロ */}
          {state.rolled && state.phase === 'moving' && (
            <DiceRow key={`${gameId}-${state.turnCount}`} rolled={state.rolled} remaining={state.dice} rolling />
          )}

          {/* オープニングロールボタン */}
          {state.phase === 'opening-roll' && !bothCpu && (
            <Button fullWidth onClick={() => setState((s) => rollOpening(s))}>
              🎲 サイコロを振って先手を決める
            </Button>
          )}

          {/* 人間の手番: ロール & ダブル */}
          {state.phase === 'rolling' && !isCpuTurn && (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <div style={{ flex: 2 }}>
                <Button fullWidth onClick={() => setState((s) => rollDice(s))}>
                  🎲 サイコロを振る
                </Button>
              </div>
              {config.useDoublingCube && canOfferDouble(state, state.currentPlayer) && (
                <div style={{ flex: 1 }}>
                  <Button fullWidth variant="secondary" onClick={() => setState((s) => offerDouble(s))}>
                    ×{state.cube.value * 2} ダブル！
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ダブル提案への応答（人間） */}
          {humanRespondsDouble && (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <div style={{ flex: 1 }}>
                <Button fullWidth onClick={() => setState((s) => acceptDouble(s))}>
                  受ける（×{state.cube.value * 2}）
                </Button>
              </div>
              <div style={{ flex: 1 }}>
                <Button fullWidth variant="secondary" onClick={() => setState((s) => declineDouble(s))}>
                  降りる（-{state.cube.value}点）
                </Button>
              </div>
            </div>
          )}

          {/* キューブ表示 */}
          {config.useDoublingCube && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <div className="bg-cube">×{state.cube.value}</div>
              {state.cube.owner
                ? `${nameFor(state.cube.owner)} が所有`
                : 'キューブはセンター'}
            </div>
          )}
        </div>

        {/* 勝敗オーバーレイ */}
        {state.phase === 'finished' && state.winner && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(30,25,10,0.55)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div style={{
              background: '#fffdf4', borderRadius: 22, padding: '28px 22px', maxWidth: 380, width: '100%',
              textAlign: 'center', border: '2px solid var(--gold)', boxShadow: 'var(--shadow-lg)',
            }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>
                {state.winKind === 'backgammon' ? '👑' : state.winKind === 'gammon' ? '⚡' : '🏆'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
                {nameFor(state.winner)}の勝ち！
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-mid)', marginBottom: 4 }}>
                {state.winKind ? WIN_KIND_LABEL[state.winKind] : ''}　+{state.resultPoints}点
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
                通算: {nameFor('white')} {scores.white}点 ／ {nameFor('black')} {scores.black}点
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button fullWidth onClick={handleRematch}>もう一度対戦する</Button>
                <Button fullWidth variant="secondary" onClick={onBackToSetup}>設定に戻る</Button>
                <Button fullWidth variant="ghost" onClick={onBackToHome}>ゲーム選択へ</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ============================================================
// プレイヤーパネル（名前・ピップ・スコア）
// ============================================================

function PlayerPanel({
  id, name, state, score, active,
}: {
  id: PlayerId;
  name: string;
  state: GameState;
  score: number;
  active: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
      background: active ? '#fdf6dd' : '#faf8f2',
      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border-light)'}`,
      borderRadius: 12, transition: 'all 0.2s',
    }}>
      <div className={`bg-checker ${id}`} style={{ width: 22, height: 22, flexShrink: 0 }} />
      <span style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
        {active && ' ⬅'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        ピップ {getPipCount(state, id)}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        通算 {score}点
      </span>
    </div>
  );
}
