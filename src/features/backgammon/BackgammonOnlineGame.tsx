import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Move } from './backgammonTypes';
import {
  applyMove, getChainedMoves, getLegalMoves, getOpponent,
  isPureBearOffRace, passTurn, rollDice, rollOpening,
  type ChainedMove,
} from './backgammonRules';
import { chooseCpuMoveSequence } from './backgammonCpu';
import { BackgammonPlayScreen } from './BackgammonPlayScreen';
import { type BackgammonRoomInfo, type OnlinePayload, pushPayload, subscribeRoom } from './backgammonOnline';

type BackgammonOnlineGameProps = {
  room: BackgammonRoomInfo;
  initialPayload: OnlinePayload;
  showToast: (msg: string) => void;
  onExitToSettings: () => void;
  onBackToHome: () => void;
};

export function BackgammonOnlineGame({
  room, initialPayload, showToast, onExitToSettings, onBackToHome,
}: BackgammonOnlineGameProps) {
  const [payload, setPayload] = useState<OnlinePayload>(initialPayload);
  const [selected, setSelected] = useState<'bar' | number | null>(null);
  const [autoRun, setAutoRun] = useState(false);
  const seqRef = useRef(initialPayload.seq);
  const quitArm = useRef(false);

  const state = payload.state;
  const myColor = room.myColor;
  const isMyTurn = state.currentPlayer === myColor && state.phase !== 'finished';
  const iAmHost = myColor === 'white';

  const hostName = payload.hostName || 'ルームの主';
  const guestName = payload.guestName || '挑戦者';
  const oppName = iAmHost ? guestName : hostName;

  // ---- 受信 ----
  useEffect(() => {
    const unsubscribe = subscribeRoom(room.roomCode, (row) => {
      const incoming = row.game_state;
      if (!incoming || incoming.seq <= seqRef.current) return;
      seqRef.current = incoming.seq;
      setPayload(incoming);
      setSelected(null);
    });
    return unsubscribe;
  }, [room.roomCode]);

  // ---- 送信 ----
  function commit(nextState: GameState) {
    const next: OnlinePayload = { ...payload, state: nextState, seq: seqRef.current + 1 };
    seqRef.current = next.seq;
    setPayload(next);
    setSelected(null);
    void pushPayload(room.roomCode, next);
  }

  const legalMoves = useMemo(
    () => (state.phase === 'moving' && isMyTurn ? getLegalMoves(state) : []),
    [state, isMyTurn],
  );

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
    if (!isMyTurn || state.phase !== 'moving' || effectiveSelected !== null) return new Set<string>();
    return new Set(legalMoves.map((m) => String(m.from)));
  }, [isMyTurn, state.phase, effectiveSelected, legalMoves]);

  // サイコロ2個分を一度に動かす候補
  const chainMoves = useMemo<ChainedMove[]>(
    () => (isMyTurn && effectiveSelected !== null ? getChainedMoves(state, effectiveSelected) : []),
    [isMyTurn, effectiveSelected, state],
  );
  const chainDestinations = useMemo(
    () => new Set(chainMoves.map((c) => c.dest).filter((d) => !destinations.has(d))),
    [chainMoves, destinations],
  );

  function doApplyChain(chain: ChainedMove) {
    let hit = false;
    let s = state;
    for (const move of chain.moves) {
      if (move.to !== 'off') {
        const target = s.points[move.to as number];
        if (target && target.owner === getOpponent(state.currentPlayer)) hit = true;
      }
      s = applyMove(s, move);
    }
    if (hit) showToast('相手のコマを弾いた!');
    commit(s);
  }

  function doApplyMove(move: Move) {
    if (move.to !== 'off') {
      const target = state.points[move.to];
      if (target && target.owner === getOpponent(state.currentPlayer)) {
        showToast('相手のコマを弾いた!');
      }
    }
    const next = applyMove(state, move);
    if (next.currentPlayer !== state.currentPlayer && state.dice.length > 1 && next.phase === 'rolling') {
      showToast('動かせる手が尽きた — 手番交代');
    }
    commit(next);
  }

  function handleTapPoint(i: number) {
    if (!isMyTurn) return;
    if (state.phase === 'rolling' || state.phase === 'opening-roll') { showToast('まずサイコロを振るのだ'); return; }
    if (state.phase !== 'moving') return;
    if (effectiveSelected !== null && destinations.has(i)) {
      const candidates = movesFromSelected.filter((m) => m.to === i);
      doApplyMove(candidates.reduce((a, b) => (a.die >= b.die ? a : b)));
      return;
    }
    if (effectiveSelected !== null && chainDestinations.has(i)) {
      const chain = chainMoves.find((c) => c.dest === i);
      if (chain) { doApplyChain(chain); return; }
    }
    if (state.bar[myColor] > 0) { showToast('まずバーのコマを戻すのだ'); return; }
    const pt = state.points[i];
    if (pt && pt.owner === myColor) {
      const mine = legalMoves.filter((m) => m.from === i);
      if (!mine.length) { showToast('そのコマは動かせぬ'); return; }
      setSelected((prev) => (prev === i ? null : i));
      return;
    }
    if (selected !== null) setSelected(null);
  }

  function handleRoll() {
    if (state.phase === 'opening-roll') {
      if (!iAmHost) return;
      // オンラインでは往復を避けるため、決まるまでこちらで振り直す
      let s = state;
      do { s = rollOpening({ ...s, openingRoll: null }); } while (s.phase === 'opening-roll');
      showToast(s.currentPlayer === myColor ? 'そなたが先手!' : `${oppName}が先手!`);
      commit(s);
      return;
    }
    if (state.phase !== 'rolling' || !isMyTurn) return;
    commit(rollDice(state));
  }

  // 自分の手番で打てる手がない → 自動パス（自分のクライアントが書き込む）
  const mustPass = isMyTurn && state.phase === 'moving' && state.dice.length > 0 && legalMoves.length === 0;
  useEffect(() => {
    if (!mustPass) return;
    showToast('目が塞がれて動けぬ…手番を渡す');
    const timer = setTimeout(() => commit(passTurn(state)), 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustPass, state]);

  // ---- ベアオフ自動化 ----
  const autoEligible = isMyTurn && state.phase !== 'opening-roll' && isPureBearOffRace(state, myColor);
  useEffect(() => {
    if (state.phase === 'finished' && autoRun) setAutoRun(false);
  }, [state.phase, autoRun]);
  useEffect(() => {
    if (!autoRun || !isMyTurn || state.phase === 'finished') return;
    if (state.phase === 'rolling') {
      const timer = setTimeout(() => {
        if (state.phase === 'rolling' && isMyTurn) commit(rollDice(state));
      }, 420);
      return () => clearTimeout(timer);
    }
    if (state.phase === 'moving' && legalMoves.length > 0) {
      const timer = setTimeout(() => {
        const seq = chooseCpuMoveSequence(state, 'very-hard');
        if (seq && seq.moves.length > 0) doApplyMove(seq.moves[0]);
      }, 340);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, state, isMyTurn, legalMoves]);

  // ---- 表示 ----
  const waitingForGuest = payload.guestName === null;
  const centerMsg = (() => {
    if (waitingForGuest) return '対戦相手を待っている…';
    if (state.phase === 'opening-roll') {
      return iAmHost ? '骰子を振り、先手を占うのだ' : 'ルームの主が先手を占っている…';
    }
    if (state.phase === 'rolling') return isMyTurn ? 'そなたの番' : `${oppName}の番…`;
    if (mustPass) return '手詰まり…';
    if (state.phase === 'moving') {
      if (!isMyTurn) return `${oppName}が思案中…`;
      return effectiveSelected !== null ? '行き先を選べ' : '動かすコマを選べ';
    }
    return '';
  })();

  const over = (() => {
    if (state.phase !== 'finished' || !state.winner) return null;
    const iWin = state.winner === myColor;
    const kindTxt = state.winKind === 'gammon' ? 'ギャモン勝ち! ' : state.winKind === 'backgammon' ? 'バックギャモン勝ち!! ' : '';
    return {
      en: iWin ? 'VICTORY' : 'DEFEAT',
      title: iWin ? '勝利!' : '敗北…',
      sub: iWin ? `${kindTxt}見事なり。遠方の相手を下した。` : `${kindTxt}${oppName}が勝利した。「また挑むがよい」`,
      showRematch: false,
    };
  })();

  function handleQuit() {
    if (state.phase === 'finished' || quitArm.current) { onExitToSettings(); return; }
    quitArm.current = true;
    showToast('もう一度押すと盤を離れる');
    setTimeout(() => { quitArm.current = false; }, 2600);
  }

  // 盤の向きは共通（ホスト=金が下）。自分がどちらかはプレートの（そなた）表示で示す
  const topIsMe = myColor === 'black';
  return (
    <BackgammonPlayScreen
      state={state}
      selectedFrom={isMyTurn ? effectiveSelected : null}
      destinations={isMyTurn ? destinations : new Set()}
      chainDestinations={isMyTurn ? chainDestinations : new Set()}
      autoButton={
        autoEligible || autoRun
          ? {
              label: autoRun ? '⚡ 自動で上がり中…（触れて解除）' : '⚡ あとは自動で上がる',
              active: autoRun,
              onClick: () => setAutoRun((v) => !v),
            }
          : null
      }
      offDestFor={isMyTurn && offMove ? myColor : null}
      pickableFroms={pickableFroms}
      centerMsg={centerMsg}
      movesLeftTxt={state.phase === 'moving' ? `あと ${state.dice.length} 手` : ''}
      showRollBtn={
        (state.phase === 'opening-roll' && iAmHost && !waitingForGuest) ||
        (state.phase === 'rolling' && isMyTurn)
      }
      rollLabel={state.phase === 'opening-roll' ? '先手を決める' : 'サイコロを振る'}
      topPlayer={{
        name: guestName + (topIsMe ? '（そなた）' : ''),
        sub: '緋のコマ',
        avatar: 'initial',
        initial: (guestName[0] || 'G').toUpperCase(),
        active: state.currentPlayer === 'black' && state.phase !== 'finished',
      }}
      botPlayer={{
        name: hostName + (!topIsMe ? '（そなた）' : ''),
        sub: '金のコマ / ルームの主',
        avatar: 'initial',
        initial: (hostName[0] || 'H').toUpperCase(),
        active: state.currentPlayer === 'white' && state.phase !== 'finished',
      }}
      onRoll={handleRoll}
      onTapPoint={handleTapPoint}
      onTapBar={() => {
        if (isMyTurn && state.phase === 'moving' && state.bar[myColor] > 0) setSelected('bar');
      }}
      onTapOffTop={() => { if (myColor === 'black' && offMove) doApplyMove(offMove); }}
      onTapOffBot={() => { if (myColor === 'white' && offMove) doApplyMove(offMove); }}
      onQuit={handleQuit}
      over={over}
      onRematch={() => {}}
      onBackToSettings={onExitToSettings}
      onBackToHome={onBackToHome}
    />
  );
}
