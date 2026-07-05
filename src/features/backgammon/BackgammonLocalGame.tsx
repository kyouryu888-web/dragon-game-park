import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackgammonConfig, GameState, Move, PlayerId } from './backgammonTypes';
import { createInitialBackgammonState } from './createInitialBackgammonState';
import { applyMove, getLegalMoves, getOpponent, passTurn, rollDice, rollOpening } from './backgammonRules';
import { chooseCpuMoveSequence, getCpuDisplayName } from './backgammonCpu';
import { BackgammonPlayScreen } from './BackgammonPlayScreen';

const CPU_ROLL_DELAY = 950;
const CPU_MOVE_DELAY = 800;

type BackgammonLocalGameProps = {
  config: BackgammonConfig; // mode: 'cpu' | 'local'
  showToast: (msg: string) => void;
  onExitToSettings: () => void;
  onBackToHome: () => void;
};

export function BackgammonLocalGame({ config, showToast, onExitToSettings, onBackToHome }: BackgammonLocalGameProps) {
  const [state, setState] = useState<GameState>(() => createInitialBackgammonState());
  const [selected, setSelected] = useState<'bar' | number | null>(null);
  const quitArm = useRef(false);

  const isCpuMode = config.mode === 'cpu';
  const pName = config.name.trim() || '挑戦者';
  const cName = isCpuMode ? getCpuDisplayName(config.cpuLevel) : (config.name2.trim() || '挑戦者2');
  const nameFor = (id: PlayerId) => (id === 'white' ? pName : cName);
  const isHumanTurn = !isCpuMode || state.currentPlayer === 'white';

  const legalMoves = useMemo(
    () => (state.phase === 'moving' ? getLegalMoves(state) : []),
    [state],
  );

  // バー復帰しか打てないときは自動選択
  const effectiveSelected: 'bar' | number | null =
    selected !== null
      ? selected
      : legalMoves.length > 0 && legalMoves.every((m) => m.from === 'bar')
      ? 'bar'
      : null;

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
    return offs.length ? offs.reduce((a, b) => (a.die <= b.die ? a : b)) : null;
  }, [movesFromSelected]);

  const pickableFroms = useMemo(() => {
    if (!isHumanTurn || state.phase !== 'moving' || effectiveSelected !== null) return new Set<string>();
    return new Set(legalMoves.map((m) => String(m.from)));
  }, [isHumanTurn, state.phase, effectiveSelected, legalMoves]);

  function doApplyMove(move: Move) {
    const mover = state.currentPlayer;
    // ヒット判定（適用前に見る）
    if (move.to !== 'off') {
      const target = state.points[move.to];
      if (target && target.owner === getOpponent(mover)) {
        const humanHit = !isCpuMode || mover === 'white';
        showToast(humanHit ? '相手のコマを弾いた!' : 'コマが弾かれてバー送りに!');
      }
    }
    const next = applyMove(state, move);
    // 出目を残して打ち切りになった場合の通知
    if (next.currentPlayer !== mover && state.dice.length > 1 && next.phase === 'rolling' && (!isCpuMode || mover === 'white')) {
      showToast('動かせる手が尽きた — 手番交代');
    }
    setSelected(null);
    setState(next);
  }

  // ---- タップ操作 ----
  function handleTapPoint(i: number) {
    if (state.phase === 'finished') return;
    if (!isHumanTurn) return;
    if (state.phase === 'rolling' || state.phase === 'opening-roll') { showToast('まずサイコロを振るのだ'); return; }
    if (state.phase !== 'moving') return;
    if (effectiveSelected !== null && destinations.has(i)) {
      const candidates = movesFromSelected.filter((m) => m.to === i);
      doApplyMove(candidates.reduce((a, b) => (a.die >= b.die ? a : b)));
      return;
    }
    if (state.bar[state.currentPlayer] > 0) { showToast('まずバーのコマを戻すのだ'); return; }
    const pt = state.points[i];
    if (pt && pt.owner === state.currentPlayer) {
      const mine = legalMoves.filter((m) => m.from === i);
      if (!mine.length) { showToast('そのコマは動かせぬ'); return; }
      setSelected((prev) => (prev === i ? null : i));
      return;
    }
    if (selected !== null) setSelected(null);
  }

  function handleTapBar() {
    if (!isHumanTurn || state.phase !== 'moving') return;
    if (state.bar[state.currentPlayer] > 0) setSelected('bar');
  }

  function handleTapOff() {
    if (offMove) doApplyMove(offMove);
  }

  // ---- サイコロ ----
  function handleRoll() {
    if (state.phase === 'opening-roll') {
      const next = rollOpening(state);
      setState(next);
      if (next.phase === 'opening-roll') showToast('同じ目！もう一度振るのだ');
      else showToast(`${nameFor(next.currentPlayer)}が先手!`);
      return;
    }
    if (state.phase !== 'rolling' || !isHumanTurn) return;
    setState(rollDice(state));
  }

  // ---- 打つ手がないときの自動パス ----
  const mustPass = state.phase === 'moving' && state.dice.length > 0 && legalMoves.length === 0;
  useEffect(() => {
    if (!mustPass) return;
    showToast(isHumanTurn ? '目が塞がれて動けぬ…手番を渡す' : '龍は動けぬようだ');
    const timer = setTimeout(() => setState((s) => (s.phase === 'moving' ? passTurn(s) : s)), 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustPass, state]);

  // ---- CPUの手番 ----
  useEffect(() => {
    if (!isCpuMode || state.currentPlayer !== 'black' || state.phase === 'finished') return;
    if (state.phase === 'rolling') {
      const timer = setTimeout(() => {
        setState((s) => (s.phase === 'rolling' && s.currentPlayer === 'black' ? rollDice(s) : s));
      }, CPU_ROLL_DELAY);
      return () => clearTimeout(timer);
    }
    if (state.phase === 'moving' && legalMoves.length > 0) {
      const timer = setTimeout(() => {
        const seq = chooseCpuMoveSequence(state, config.cpuLevel);
        if (seq && seq.moves.length > 0) doApplyMove(seq.moves[0]);
      }, CPU_MOVE_DELAY);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isCpuMode, legalMoves]);

  // ---- 表示テキスト ----
  const centerMsg = (() => {
    if (state.phase === 'opening-roll') return '骰子を振り、先手を占うのだ';
    if (state.phase === 'rolling') {
      return isHumanTurn
        ? (isCpuMode ? 'そなたの番' : `${nameFor(state.currentPlayer)}の番`)
        : '龍が骰子を取った…';
    }
    if (mustPass) return '手詰まり…';
    if (state.phase === 'moving') {
      if (isCpuMode && state.currentPlayer === 'black') return '龍の思案中…';
      return effectiveSelected !== null
        ? '行き先を選べ'
        : (isCpuMode ? '動かすコマを選べ' : `${nameFor(state.currentPlayer)}、コマを選べ`);
    }
    return '';
  })();

  const showRollBtn =
    state.phase === 'opening-roll' || (state.phase === 'rolling' && isHumanTurn);

  // ---- 勝敗 ----
  const over = (() => {
    if (state.phase !== 'finished' || !state.winner) return null;
    const pWin = state.winner === 'white';
    const kindTxt = state.winKind === 'gammon' ? 'ギャモン勝ち! ' : state.winKind === 'backgammon' ? 'バックギャモン勝ち!! ' : '';
    if (!isCpuMode) {
      return {
        en: 'VICTORY',
        title: `${nameFor(state.winner)} の勝利!`,
        sub: `${kindTxt}見事な采配であった。`,
        showRematch: true,
      };
    }
    return {
      en: pWin ? 'VICTORY' : 'DEFEAT',
      title: pWin ? '勝利!' : '敗北…',
      sub: pWin
        ? `${kindTxt}見事なり。龍は翼を畳み、深く一礼した。`
        : `${kindTxt}龍はほくそ笑んだ。「また挑むがよい」`,
      showRematch: true,
    };
  })();

  function handleQuit() {
    if (state.phase === 'finished') { onExitToSettings(); return; }
    if (quitArm.current) { onExitToSettings(); return; }
    quitArm.current = true;
    showToast('もう一度押すと盤を離れる');
    setTimeout(() => { quitArm.current = false; }, 2600);
  }

  function handleRematch() {
    setSelected(null);
    setState(createInitialBackgammonState());
    showToast(isCpuMode ? 'そなたから振るがよい' : `${pName}から振るがよい`);
  }

  return (
    <BackgammonPlayScreen
      state={state}
      selectedFrom={effectiveSelected}
      destinations={isHumanTurn ? destinations : new Set()}
      offDestFor={isHumanTurn && offMove ? state.currentPlayer : null}
      pickableFroms={pickableFroms}
      centerMsg={centerMsg}
      movesLeftTxt={state.phase === 'moving' ? `あと ${state.dice.length} 手` : ''}
      showRollBtn={showRollBtn}
      rollLabel={state.phase === 'opening-roll' ? '先手を決める' : 'サイコロを振る'}
      topPlayer={{
        name: cName,
        sub: isCpuMode ? '緋のコマ / 番人' : '緋のコマ',
        avatar: isCpuMode ? 'dragon' : 'initial',
        initial: (cName[0] || 'D').toUpperCase(),
        active: state.currentPlayer === 'black' && state.phase !== 'finished',
      }}
      botPlayer={{
        name: pName,
        sub: '金のコマ',
        avatar: 'initial',
        initial: (pName[0] || 'P').toUpperCase(),
        active: state.currentPlayer === 'white' && state.phase !== 'finished',
      }}
      onRoll={handleRoll}
      onTapPoint={handleTapPoint}
      onTapBar={handleTapBar}
      onTapOffTop={() => { if (state.currentPlayer === 'black') handleTapOff(); }}
      onTapOffBot={() => { if (state.currentPlayer === 'white') handleTapOff(); }}
      onQuit={handleQuit}
      over={over}
      onRematch={handleRematch}
      onBackToSettings={onExitToSettings}
      onBackToHome={onBackToHome}
    />
  );
}
