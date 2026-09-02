import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEndActions } from '../../components/GameEndActions';
import cornerCaptureImage from './assets/corner-capture.png';
import grandFlipImage from './assets/grand-flip.png';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { applyMove } from './bakuretsu/engine.ts';
import {
  blastModeFor,
  countPieces,
  initGame,
  legalMoves,
  makeRng,
} from './bakuretsu/rules.ts';
import type { BlastRange, GameState, Move, Side, TurnResult } from './bakuretsu/types.ts';
import { BakuretsuReversiBoard } from './BakuretsuReversiBoard';
import {
  createBakuretsuCpuRequest,
  type BakuretsuCpuResponse,
} from './bakuretsuCpu';
import {
  createBakuretsuPlaybackSteps,
  getBakuretsuStepDuration,
  type BakuretsuPlaybackSpeed,
  type BakuretsuPlaybackStep,
} from './bakuretsuPlayback';
import {
  BAKURETSU_INITIAL_TIME_MS,
  BAKURETSU_SPECIAL_LABEL,
  BAKURETSU_SPECIAL_NAME,
  BAKURETSU_SPEED_LABEL,
  chooseBakuretsuAutoMove,
  forceAutoMoveLoss,
  formatTimeBank,
  isPublicSpecial,
  movesForChoice,
  playerName,
  resolveBakuretsuCpuSide,
  type BakuretsuAutoMoveCounts,
  type BakuretsuPieceChoice,
  type BakuretsuReversiConfig,
  type BakuretsuTimeBanks,
} from './bakuretsuUi';
import type { BakuretsuReversiSnapshot } from './bakuretsuReversiOnline';
import { canResolveBakuretsuTimeout, decideBakuretsuSync } from './bakuretsuOnlineSync';

const SPEEDS: BakuretsuPlaybackSpeed[] = ['slow', 'normal', 'fast'];
const INITIAL_CLOCKS: BakuretsuTimeBanks = {
  BLACK: BAKURETSU_INITIAL_TIME_MS,
  WHITE: BAKURETSU_INITIAL_TIME_MS,
};
const INITIAL_AUTO_MOVE_COUNTS: BakuretsuAutoMoveCounts = { BLACK: 0, WHITE: 0 };

function randomSeed(): number {
  const randomSeed = new Uint32Array([Date.now() >>> 0]);
  globalThis.crypto?.getRandomValues(randomSeed);
  return randomSeed[0];
}

function createGame(): GameState {
  return initGame(DEFAULT_CONFIG, makeRng(randomSeed()));
}

function sideName(side: Side): string {
  return side === 'BLACK' ? '黒炎' : '白銀';
}

function sameMove(left: Move, right: Move): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.kind === right.kind
    && left.special === right.special
    && (left.skipDirs ?? []).join(',') === (right.skipDirs ?? []).join(',');
}

function invalidateCpuRequestRefs(
  active: { current: number },
  counter: { current: number },
  requestedTurn: { current: string },
) {
  active.current = ++counter.current;
  requestedTurn.current = '';
}

function BlastRangeGlyph({ range }: { range: BlastRange }) {
  const active = range === 'CROSS' ? new Set([1, 3, 4, 5, 7]) : new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  return (
    <span className={`bakuretsu-range-glyph is-${range.toLowerCase()}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} className={active.has(index) ? 'is-active' : ''} />)}
    </span>
  );
}

function PublicHand({ state, side }: { state: GameState; side: Side }) {
  const hand = state.hands[side];
  return (
    <div className="bakuretsu-public-hand" aria-label={`${sideName(side)}の公開特殊コマ`}>
      {hand.initialSpecials.filter(isPublicSpecial).map((special) => {
        const remains = hand.specialPieces.includes(special);
        return (
          <span key={special} className={remains ? '' : 'is-used'} title={`${BAKURETSU_SPECIAL_NAME[special]}${remains ? '・使用可能' : '・使用済み'}`}>
            {BAKURETSU_SPECIAL_LABEL[special]}
          </span>
        );
      })}
    </div>
  );
}

function PlayerPanel({
  side,
  state,
  score,
  remainingMs,
  speed,
  name,
  active,
  isCpu,
  cpuLevel,
  viewerSide,
}: {
  side: Side;
  state: GameState;
  score: number;
  remainingMs: number;
  speed: BakuretsuPlaybackSpeed;
  name: string;
  active: boolean;
  isCpu: boolean;
  cpuLevel: BakuretsuReversiConfig['cpuLevel'];
  viewerSide?: Side;
}) {
  const color = side === 'BLACK' ? 'black' : 'white';
  return (
    <section className={`reversi-player-panel bakuretsu-player-panel is-${color}${active ? ' is-active' : ''}`} aria-label={`${sideName(side)}のプレイヤー`}>
      <div
        className="reversi-player-art"
        style={{ backgroundImage: `url(${side === 'BLACK' ? cornerCaptureImage : grandFlipImage})` }}
        aria-hidden="true"
      />
      <div className={`reversi-score-disc is-${color}`} aria-hidden="true" />
      <div className="reversi-player-name">
        <span>{sideName(side)}</span>
        <strong>{name}</strong>
      </div>
      <div className="reversi-score-number" aria-label={`${sideName(side)}${score}枚`}>{score}</div>
      <div className="reversi-score-meter" aria-hidden="true"><span style={{ width: `${Math.max(4, score / 64 * 100)}%` }} /></div>
      <div className="bakuretsu-time-bank" aria-label={`${sideName(side)}の残り時間${formatTimeBank(remainingMs)}`}>
        <span>TIME BANK</span><strong>{formatTimeBank(remainingMs)}</strong>
      </div>
      <PublicHand state={state} side={side} />
      <div className="reversi-player-role">
        {isCpu ? `CPU Lv${cpuLevel}` : viewerSide ? side === viewerSide ? 'ONLINE / YOU' : 'ONLINE / RIVAL' : 'LOCAL'} / {BAKURETSU_SPEED_LABEL[speed]}
      </div>
    </section>
  );
}

export function BakuretsuReversiGameScreen({
  config,
  onBackToSetup,
  onBackToHome,
  initialSnapshot,
  synchronizedSnapshot = null,
  synchronizedResetKey = 0,
  viewerSide,
  roomCode,
  canRematch = true,
  onlineMovePending = false,
  rematchWaitingMessage,
  onMoveRequest,
  onTurnReadyRequest,
  onRematch,
}: {
  config: BakuretsuReversiConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
  initialSnapshot?: BakuretsuReversiSnapshot;
  synchronizedSnapshot?: BakuretsuReversiSnapshot | null;
  synchronizedResetKey?: number;
  viewerSide?: Side;
  roomCode?: string;
  canRematch?: boolean;
  onlineMovePending?: boolean;
  rematchWaitingMessage?: string;
  onMoveRequest?: (move: Move | null, timeout: boolean) => void;
  onTurnReadyRequest?: (matchNo: number, moveNo: number) => void;
  onRematch?: () => void;
}) {
  const [state, setState] = useState<GameState>(() => initialSnapshot?.state ?? createGame());
  const [displayBoard, setDisplayBoard] = useState(() => state.board.map((cell) => ({ ...cell })));
  const [playback, setPlayback] = useState<BakuretsuPlaybackStep | null>(null);
  const [pendingResult, setPendingResult] = useState<TurnResult | null>(null);
  const [choice, setChoice] = useState<BakuretsuPieceChoice>('NORMAL');
  const [showHints, setShowHints] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [speeds, setSpeeds] = useState<Record<Side, BakuretsuPlaybackSpeed>>(config.playbackSpeed);
  const [clocks, setClocks] = useState<BakuretsuTimeBanks>(() => initialSnapshot?.clocks ?? INITIAL_CLOCKS);
  const [autoNotice, setAutoNotice] = useState('');
  const [serverLegalMoves, setServerLegalMoves] = useState<Move[]>(() => initialSnapshot?.legalMoves ?? []);
  const [cpuSide, setCpuSide] = useState<Side | null>(() => resolveBakuretsuCpuSide(config));
  const [cpuThinking, setCpuThinking] = useState(false);
  const stateRef = useRef(state);
  const pendingResultRef = useRef<TurnResult | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const paintFramesRef = useRef<number[]>([]);
  const clocksRef = useRef(clocks);
  const autoMoveCountsRef = useRef<BakuretsuAutoMoveCounts>(initialSnapshot?.autoMoveCounts ?? INITIAL_AUTO_MOVE_COUNTS);
  const speedRef = useRef(speeds);
  const timeoutGuardRef = useRef(false);
  const cpuWorkerRef = useRef<Worker | null>(null);
  const cpuRequestIdRef = useRef(0);
  const activeCpuRequestRef = useRef(0);
  const cpuRequestedTurnRef = useRef('');
  const cpuSeedRef = useRef(randomSeed());
  const gameTokenRef = useRef(0);
  const matchNoRef = useRef(initialSnapshot?.matchNo ?? 0);
  const playbackReadyAtRef = useRef(initialSnapshot?.playbackReadyAt ?? null);
  const turnStartsAtRef = useRef(initialSnapshot?.turnStartsAt ?? null);
  const turnDeadlineRef = useRef(initialSnapshot?.turnDeadline ?? null);
  const pendingSyncRef = useRef<BakuretsuReversiSnapshot | null>(null);
  const synchronizedResetKeyRef = useRef(synchronizedResetKey);
  const turnReadyRequestKeyRef = useRef('');
  const performMoveRef = useRef<(move: Move, automatic?: boolean) => void>(() => undefined);
  const handleTimeExpiredRef = useRef<(side: Side) => void>(() => undefined);
  stateRef.current = state;
  clocksRef.current = clocks;
  speedRef.current = speeds;

  const visualState = pendingResult?.state ?? state;
  const score = useMemo(() => countPieces(displayBoard), [displayBoard]);
  const occupied = 64 - score.empty;
  const blastRange = playback?.blast ?? blastModeFor(occupied, DEFAULT_CONFIG);
  const validMoves = useMemo(() => {
    if (state.status !== 'PLAYING' || pendingResult) return [];
    if (!onMoveRequest) return movesForChoice(state, choice);
    if (choice === 'NORMAL') return serverLegalMoves.filter((move) => move.kind === 'NORMAL');
    return serverLegalMoves.filter((move) => move.kind === 'SPECIAL' && move.special === choice);
  }, [choice, onMoveRequest, pendingResult, serverLegalMoves, state]);

  function clearPlaybackHandles() {
    if (playbackTimerRef.current !== null) window.clearTimeout(playbackTimerRef.current);
    playbackTimerRef.current = null;
    for (const frame of paintFramesRef.current) window.cancelAnimationFrame(frame);
    paintFramesRef.current = [];
  }

  function resetToSnapshot(snapshot: BakuretsuReversiSnapshot) {
    clearPlaybackHandles();
    invalidateCpuRequest();
    matchNoRef.current = snapshot.matchNo;
    playbackReadyAtRef.current = snapshot.playbackReadyAt;
    turnStartsAtRef.current = snapshot.turnStartsAt;
    turnDeadlineRef.current = snapshot.turnDeadline;
    pendingSyncRef.current = null;
    stateRef.current = snapshot.state;
    pendingResultRef.current = null;
    clocksRef.current = snapshot.clocks;
    autoMoveCountsRef.current = snapshot.autoMoveCounts;
    setState(snapshot.state);
    setDisplayBoard(snapshot.state.board.map((cell) => ({ ...cell })));
    setPlayback(null);
    setPendingResult(null);
    setChoice('NORMAL');
    setClocks(snapshot.clocks);
    setServerLegalMoves(snapshot.legalMoves);
    setAutoNotice('');
    setResultReady(snapshot.state.status === 'FINISHED');
    timeoutGuardRef.current = false;
  }

  function commitResult(result: TurnResult) {
    clearPlaybackHandles();
    stateRef.current = result.state;
    setState(result.state);
    setDisplayBoard(result.state.board.map((cell) => ({ ...cell })));
    setPlayback(null);
    setPendingResult(null);
    pendingResultRef.current = null;
    setChoice('NORMAL');
    setResultReady(result.state.status === 'FINISHED');
    timeoutGuardRef.current = false;
    const queued = pendingSyncRef.current;
    pendingSyncRef.current = null;
    if (queued && (queued.matchNo > matchNoRef.current || queued.state.moveNo >= result.state.moveNo)) {
      playbackTimerRef.current = window.setTimeout(() => syncIncomingSnapshot(queued), 0);
    }
  }

  function showFinalBoardThenCommit(result: TurnResult) {
    const finalStep = createBakuretsuPlaybackSteps(stateRef.current, result).at(-1)!;
    setDisplayBoard(result.state.board.map((cell) => ({ ...cell })));
    setPlayback(finalStep);
    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(() => commitResult(result));
      paintFramesRef.current.push(second);
    });
    paintFramesRef.current.push(first);
  }

  function runPlaybackStep(
    steps: BakuretsuPlaybackStep[],
    index: number,
    result: TurnResult,
    speed: BakuretsuPlaybackSpeed,
    reducedMotion: boolean,
  ) {
    if (index >= steps.length) {
      showFinalBoardThenCommit(result);
      return;
    }
    const step = steps[index];
    setDisplayBoard(step.board);
    setPlayback(step);
    playbackTimerRef.current = window.setTimeout(
      () => runPlaybackStep(steps, index + 1, result, speed, reducedMotion),
      getBakuretsuStepDuration(step, speed, reducedMotion),
    );
  }

  function beginPlayback(previous: GameState, result: TurnResult) {
    clearPlaybackHandles();
    pendingResultRef.current = result;
    setPendingResult(result);
    setResultReady(false);
    const steps = createBakuretsuPlaybackSteps(previous, result);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    runPlaybackStep(steps, 0, result, speedRef.current[previous.currentTurn], reducedMotion);
  }

  function syncIncomingSnapshot(incoming: BakuretsuReversiSnapshot) {
    const pending = pendingResultRef.current;
    const current = stateRef.current;
    const decision = decideBakuretsuSync(current, matchNoRef.current, pending?.state ?? null, incoming);
    switch (decision) {
      case 'ignore': return;
      case 'queue':
        pendingSyncRef.current = incoming;
        return;
      case 'refresh':
        clocksRef.current = incoming.clocks;
        autoMoveCountsRef.current = incoming.autoMoveCounts;
        playbackReadyAtRef.current = incoming.playbackReadyAt;
        turnStartsAtRef.current = incoming.turnStartsAt;
        turnDeadlineRef.current = incoming.turnDeadline;
        setClocks(incoming.clocks);
        setServerLegalMoves(incoming.legalMoves);
        return;
      case 'playback':
        clocksRef.current = incoming.clocks;
        autoMoveCountsRef.current = incoming.autoMoveCounts;
        playbackReadyAtRef.current = incoming.playbackReadyAt;
        turnStartsAtRef.current = incoming.turnStartsAt;
        turnDeadlineRef.current = incoming.turnDeadline;
        setClocks(incoming.clocks);
        setServerLegalMoves(incoming.legalMoves);
        beginPlayback(current, incoming.result!);
        return;
      case 'reset':
        if (incoming.matchNo > matchNoRef.current) gameTokenRef.current += 1;
        resetToSnapshot(incoming);
    }
  }

  function invalidateCpuRequest() {
    invalidateCpuRequestRefs(activeCpuRequestRef, cpuRequestIdRef, cpuRequestedTurnRef);
    setCpuThinking(false);
  }

  function performMove(move: Move, automatic = false) {
    if (pendingResultRef.current || stateRef.current.status !== 'PLAYING') return;
    invalidateCpuRequest();
    if (onMoveRequest) {
      onMoveRequest(move, automatic);
      return;
    }
    const previous = stateRef.current;
    const movingSide = previous.currentTurn;
    let result = applyMove(previous, move, DEFAULT_CONFIG);
    const nextAutoCounts = {
      ...autoMoveCountsRef.current,
      [movingSide]: automatic ? autoMoveCountsRef.current[movingSide] + 1 : 0,
    };
    autoMoveCountsRef.current = nextAutoCounts;
    if (automatic && nextAutoCounts[movingSide] >= 5) result = forceAutoMoveLoss(result, movingSide);
    setAutoNotice(automatic
      ? `${sideName(movingSide)}は時間切れのため通常コマを自動着手（連続${nextAutoCounts[movingSide]}回）`
      : '');
    beginPlayback(previous, result);
  }
  performMoveRef.current = performMove;

  useEffect(() => {
    if (!cpuSide) return;
    const worker = new Worker(new URL('./bakuretsuCpu.worker.ts', import.meta.url), { type: 'module' });
    cpuWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<BakuretsuCpuResponse>) => {
      const response = event.data;
      if (response.id !== activeCpuRequestRef.current) return;
      setCpuThinking(false);
      const current = stateRef.current;
      if (pendingResultRef.current || current.status !== 'PLAYING' || current.currentTurn !== cpuSide) return;
      const move = response.move;
      const isLegal = move && legalMoves(current, DEFAULT_CONFIG).some((candidate) => sameMove(candidate, move));
      if (!isLegal) {
        setAutoNotice('CPUの思考結果を使えなかったため、通常コマを自動着手します');
        const fallback = chooseBakuretsuAutoMove(current);
        if (fallback) performMoveRef.current(fallback);
        return;
      }
      performMoveRef.current(move);
    };
    return () => {
      worker.terminate();
      cpuWorkerRef.current = null;
      invalidateCpuRequestRefs(activeCpuRequestRef, cpuRequestIdRef, cpuRequestedTurnRef);
    };
  }, [cpuSide]);

  useEffect(() => {
    if (!cpuSide || state.status !== 'PLAYING' || state.currentTurn !== cpuSide || pendingResult || playback) {
      return;
    }
    const worker = cpuWorkerRef.current;
    if (!worker) return;
    const turnKey = `${gameTokenRef.current}:${state.moveNo}:${state.currentTurn}`;
    if (cpuRequestedTurnRef.current === turnKey) return;
    cpuRequestedTurnRef.current = turnKey;
    const requestId = ++cpuRequestIdRef.current;
    activeCpuRequestRef.current = requestId;
    setCpuThinking(true);
    worker.postMessage(createBakuretsuCpuRequest(
      requestId,
      state,
      config.cpuLevel,
      (cpuSeedRef.current ^ Math.imul(state.moveNo + 1, 0x9e3779b1)) >>> 0,
    ));
  }, [config.cpuLevel, cpuSide, pendingResult, playback, state]);

  function handleTimeExpired(side: Side) {
    const current = stateRef.current;
    if (pendingResultRef.current || current.status !== 'PLAYING' || current.currentTurn !== side) {
      timeoutGuardRef.current = false;
      return;
    }
    if (onMoveRequest) {
      onMoveRequest(null, true);
      return;
    }
    const move = chooseBakuretsuAutoMove(current);
    if (!move) {
      timeoutGuardRef.current = false;
      return;
    }
    performMove(move, true);
  }
  handleTimeExpiredRef.current = handleTimeExpired;

  useEffect(() => () => clearPlaybackHandles(), []);

  useEffect(() => {
    if (!synchronizedSnapshot) return;
    if (synchronizedResetKey !== synchronizedResetKeyRef.current) {
      synchronizedResetKeyRef.current = synchronizedResetKey;
      resetToSnapshot(synchronizedSnapshot);
      return;
    }
    syncIncomingSnapshot(synchronizedSnapshot);
    // 同期snapshotの識別子だけで反応し、同じ局面の親再描画では再生しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synchronizedResetKey, synchronizedSnapshot?.matchNo, synchronizedSnapshot?.state.moveNo, synchronizedSnapshot?.state]);

  useEffect(() => {
    if (
      !onTurnReadyRequest
      || pendingResult
      || playback
      || state.status !== 'PLAYING'
      || viewerSide !== state.currentTurn
      || turnStartsAtRef.current !== null
    ) return;
    const requestKey = `${matchNoRef.current}:${state.moveNo}:${state.currentTurn}`;
    if (turnReadyRequestKeyRef.current === requestKey) return;
    const readyAt = playbackReadyAtRef.current ? Date.parse(playbackReadyAtRef.current) : Number.NaN;
    const delay = Number.isFinite(readyAt) ? Math.max(0, readyAt - Date.now()) : 0;
    const timer = window.setTimeout(() => {
      turnReadyRequestKeyRef.current = requestKey;
      onTurnReadyRequest(matchNoRef.current, state.moveNo);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [onTurnReadyRequest, pendingResult, playback, state.currentTurn, state.moveNo, state.status, synchronizedResetKey, synchronizedSnapshot?.playbackReadyAt, viewerSide]);

  useEffect(() => {
    if (state.status !== 'PLAYING' || pendingResult || playback) return;
    const side = state.currentTurn;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      if (pendingResultRef.current || stateRef.current.currentTurn !== side) return;
      const now = performance.now();
      let elapsed = now - lastTick;
      lastTick = now;
      const startsAt = turnStartsAtRef.current ? Date.parse(turnStartsAtRef.current) : Number.NaN;
      if (onMoveRequest) {
        if (!Number.isFinite(startsAt)) {
          const deadline = turnDeadlineRef.current ? Date.parse(turnDeadlineRef.current) : Number.NaN;
          const wallNow = Date.now();
          if (
            Number.isFinite(deadline)
            && wallNow >= deadline
            && canResolveBakuretsuTimeout(viewerSide, side, turnDeadlineRef.current, wallNow)
            && !timeoutGuardRef.current
          ) {
            timeoutGuardRef.current = true;
            window.clearInterval(timer);
            window.setTimeout(() => handleTimeExpiredRef.current(side), 0);
          }
          return;
        }
        const wallNow = Date.now();
        elapsed = Math.max(0, wallNow - Math.max(wallNow - elapsed, startsAt));
      }
      const nextRemaining = Math.max(0, clocksRef.current[side] - elapsed);
      const nextClocks = { ...clocksRef.current, [side]: nextRemaining };
      clocksRef.current = nextClocks;
      setClocks(nextClocks);
      const canResolveTimeout = canResolveBakuretsuTimeout(viewerSide, side, turnDeadlineRef.current);
      if (nextRemaining === 0 && canResolveTimeout && !timeoutGuardRef.current) {
        timeoutGuardRef.current = true;
        window.clearInterval(timer);
        window.setTimeout(() => handleTimeExpiredRef.current(side), 0);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [onMoveRequest, pendingResult, playback, state.currentTurn, state.status, synchronizedResetKey, viewerSide]);

  function skipPlayback() {
    const result = pendingResultRef.current;
    if (!result) return;
    clearPlaybackHandles();
    showFinalBoardThenCommit(result);
  }

  function rematch() {
    if (onRematch) {
      onRematch();
      return;
    }
    clearPlaybackHandles();
    invalidateCpuRequest();
    cpuSeedRef.current = randomSeed();
    gameTokenRef.current += 1;
    const next = createGame();
    stateRef.current = next;
    pendingResultRef.current = null;
    setState(next);
    setDisplayBoard(next.board.map((cell) => ({ ...cell })));
    setPlayback(null);
    setPendingResult(null);
    setChoice('NORMAL');
    setClocks(INITIAL_CLOCKS);
    autoMoveCountsRef.current = INITIAL_AUTO_MOVE_COUNTS;
    setAutoNotice('');
    setCpuSide(resolveBakuretsuCpuSide(config));
    setCpuThinking(false);
    setResultReady(false);
    timeoutGuardRef.current = false;
  }

  function changeSpeed(side: Side, speed: BakuretsuPlaybackSpeed) {
    const next = { ...speedRef.current, [side]: speed };
    speedRef.current = next;
    setSpeeds(next);
  }

  const isCpuTurn = cpuSide === state.currentTurn && state.status === 'PLAYING';
  const viewerCanMove = viewerSide === undefined || viewerSide === state.currentTurn;
  const interactive = state.status === 'PLAYING' && viewerCanMove && !isCpuTurn && !cpuThinking && !onlineMovePending && !pendingResult && !playback && !showRules && !showSpeed;
  const currentName = playerName(config, state.currentTurn, cpuSide);
  const turnMessage = playback?.label
    ?? (state.status === 'FINISHED'
      ? '対局終了'
      : cpuThinking
        ? `${currentName}が思考中…`
        : !viewerCanMove
          ? `${currentName}の着手を待っています…`
          : autoNotice || `${currentName}の番です`);
  const turnDetail = playback
    ? playback.phase === 'placing'
      ? '着手 → 裏返し → 特殊発動の順で再生します'
      : playback.depth
        ? `連鎖 深度${playback.depth}を順番に解決中`
        : 'FLIPイベントの順番どおり、近い石から反転中'
    : cpuThinking
      ? '公開情報だけを使って次の一手を探索しています'
      : choice === 'NEUTRAL'
      ? '中立は壁を置くだけの手です。反転は0枚です'
      : `${choice === 'NORMAL' ? '通常コマ' : BAKURETSU_SPECIAL_NAME[choice]}を選択中`;

  return (
    <main className="reversi-game-shell bakuretsu-game-shell">
      <header className="reversi-game-topbar">
        <button type="button" onClick={onBackToSetup}><span aria-hidden="true">←</span><span>設定に戻る</span></button>
        <div className="reversi-game-title">
          <span>BAKURETSU REVERSI</span>
          <strong>爆裂する黒炎と白銀の竜陣</strong>
          {roomCode ? <em>ROOM {roomCode}</em> : null}
        </div>
        <div className="reversi-game-tools">
          <button type="button" onClick={() => setShowSpeed(true)} aria-label="演出速度を設定">⏱</button>
          <button type="button" onClick={() => setShowRules(true)} aria-label="ルールを見る">📖</button>
          <button type="button" onClick={rematch} disabled={!canRematch} aria-label="最初からやり直す">↻</button>
        </div>
      </header>

      <div className="reversi-mobile-score-row bakuretsu-mobile-score-row">
        {(['BLACK', 'WHITE'] as const).map((side) => (
          <div key={side} className={`is-${side.toLowerCase()}${state.currentTurn === side && state.status === 'PLAYING' ? ' is-active' : ''}`}>
            <span className={`reversi-mini-disc is-${side.toLowerCase()}`} />
            <span>{sideName(side)} <strong>{side === 'BLACK' ? score.black : score.white}</strong><small>{formatTimeBank(clocks[side])}</small></span>
          </div>
        ))}
      </div>

      <div className="reversi-arena bakuretsu-arena">
        <PlayerPanel side="BLACK" state={visualState} score={score.black} remainingMs={clocks.BLACK} speed={speeds.BLACK} name={playerName(config, 'BLACK', cpuSide)} active={state.status === 'PLAYING' && state.currentTurn === 'BLACK'} isCpu={cpuSide === 'BLACK'} cpuLevel={config.cpuLevel} viewerSide={viewerSide} />

        <section className="reversi-board-column bakuretsu-board-column">
          <div className="bakuretsu-board-meta" aria-label="爆裂ルールの現在情報">
            <div>
              <BlastRangeGlyph range={blastRange} />
              <span><strong>爆破射程 {blastRange === 'CROSS' ? '十字' : '8方向'}</strong><small>{blastRange === 'CROSS' ? `切替まであと${24 - occupied}枚` : '8方向爆破が有効'}</small></span>
            </div>
            <div><strong>{playback?.depth ? `連鎖 深度${playback.depth}` : '連鎖 待機'}</strong><small>発火元を1つずつ表示</small></div>
            <div><strong>{sideName(state.currentTurn)} {BAKURETSU_SPEED_LABEL[speeds[state.currentTurn]]}</strong><small>相手の時計は演出後に開始</small></div>
          </div>

          <BakuretsuReversiBoard
            state={state}
            displayBoard={displayBoard}
            playback={playback}
            choice={choice}
            validMoves={validMoves}
            interactive={interactive}
            showHints={showHints}
            onMove={(move) => performMove(move)}
          />

          <div className="reversi-status-tray" aria-live="polite">
            <span className={`reversi-turn-disc is-${state.currentTurn.toLowerCase()}`} aria-hidden="true" />
            <div><strong>{turnMessage}</strong><span>{turnDetail}</span></div>
            <div className="bakuretsu-status-actions">
              {pendingResult ? <button type="button" onClick={skipPlayback}>スキップ</button> : null}
              <button type="button" className={showHints ? 'is-active' : ''} onClick={() => setShowHints((value) => !value)} disabled={Boolean(pendingResult)}>
                候補 {showHints ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <section className="bakuretsu-action-panel" aria-label="配置するコマの選択">
            <div className="bakuretsu-choice-copy"><strong>配置するコマ</strong><span>特殊コマも光る合法マスだけに置けます</span></div>
            <div className="bakuretsu-piece-choices">
              <button type="button" className={choice === 'NORMAL' ? 'is-selected' : ''} onClick={() => setChoice('NORMAL')} disabled={!interactive}>通常</button>
              {visualState.hands[state.currentTurn].initialSpecials.filter(isPublicSpecial).map((special) => {
                const available = state.hands[state.currentTurn].specialPieces.includes(special);
                return (
                  <button
                    type="button"
                    key={special}
                    className={choice === special ? 'is-selected' : ''}
                    onClick={() => setChoice(special)}
                    disabled={!interactive || !available}
                    aria-label={`${BAKURETSU_SPECIAL_NAME[special]}コマ${available ? 'を選ぶ' : 'は使用済み'}`}
                  >
                    <b>{BAKURETSU_SPECIAL_LABEL[special]}</b><span>{BAKURETSU_SPECIAL_NAME[special]}</span>
                  </button>
                );
              })}
            </div>
            <div className="bakuretsu-public-hands-mobile">
              <span>黒</span><PublicHand state={visualState} side="BLACK" />
              <span>白</span><PublicHand state={visualState} side="WHITE" />
            </div>
          </section>

          <div className="bakuretsu-rule-cues" aria-label="間違えやすい爆裂ルール">
            <span><b>壁＋0</b>中立配置は反転0枚</span>
            <span><b>爆＋味方</b>自軍は爆風でも無傷</span>
            <span><b>—壁</b>中立は挟む端になれない</span>
            <span><b>盾↺</b>反転を止めて通常化</span>
          </div>
        </section>

        <PlayerPanel side="WHITE" state={visualState} score={score.white} remainingMs={clocks.WHITE} speed={speeds.WHITE} name={playerName(config, 'WHITE', cpuSide)} active={state.status === 'PLAYING' && state.currentTurn === 'WHITE'} isCpu={cpuSide === 'WHITE'} cpuLevel={config.cpuLevel} viewerSide={viewerSide} />
      </div>

      {showRules ? (
        <div className="reversi-rules-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}>
          <section className="reversi-rules-panel bakuretsu-rules-panel" role="dialog" aria-modal="true" aria-labelledby="bakuretsu-rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="reversi-rules-close" onClick={() => setShowRules(false)} aria-label="閉じる">×</button>
            <span>RULES</span>
            <h2 id="bakuretsu-rules-title">爆裂の掟</h2>
            <ol>
              <li>着手してすべて裏返してから、爆弾・感染・盾を深度順に解決します。</li>
              <li>爆弾は配置者自身のコマを破壊しません。十字から24枚で8方向へ広がります。</li>
              <li>感染は隣接する相手の通常コマを奪ってから、自身が相手色の通常コマになります。</li>
              <li>盾は裏返しや爆風を1回だけ吸収し、所有者を変えず通常コマになります。</li>
              <li>中立は置いた手で反転0枚。挟み込みの端になれない壁です。</li>
              <li>片方が全滅すると中央から救済。双方全滅は引き分けです。</li>
              <li>石数が同じ場合は角数で勝敗を決め、それも同じなら引き分けです。</li>
              <li>持ち時間は各20分。時間切れは最小反転の通常手を自動着手し、5回連続で敗北です。</li>
            </ol>
            <button type="button" className="reversi-rules-confirm" onClick={() => setShowRules(false)}>盤へ戻る</button>
          </section>
        </div>
      ) : null}

      {showSpeed ? (
        <div className="reversi-rules-backdrop" role="presentation" onMouseDown={() => setShowSpeed(false)}>
          <section className="reversi-rules-panel bakuretsu-speed-panel" role="dialog" aria-modal="true" aria-labelledby="bakuretsu-speed-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="reversi-rules-close" onClick={() => setShowSpeed(false)} aria-label="閉じる">×</button>
            <span>SPEED</span><h2 id="bakuretsu-speed-title">演出速度</h2>
            {(['BLACK', 'WHITE'] as const).map((side) => (
              <label key={side}><span>{sideName(side)}</span><select className="game-setup-select" value={speeds[side]} onChange={(event) => changeSpeed(side, event.target.value as BakuretsuPlaybackSpeed)}>
                {SPEEDS.map((speed) => <option key={speed} value={speed}>{BAKURETSU_SPEED_LABEL[speed]}</option>)}
              </select></label>
            ))}
            <button type="button" className="reversi-rules-confirm" onClick={() => setShowSpeed(false)}>盤へ戻る</button>
          </section>
        </div>
      ) : null}

      {state.status === 'FINISHED' && resultReady && !playback ? (
        <div className="reversi-result-backdrop">
          <section className="reversi-result-panel" role="dialog" aria-modal="true" aria-label="爆裂リバーシ対局結果">
            <span className="reversi-result-kicker">FINAL SCORE</span>
            <h2>{state.winner === 'BLACK' || state.winner === 'WHITE' ? `${playerName(config, state.winner, cpuSide)}の勝利` : '引き分け'}</h2>
            <div className="reversi-result-score">
              <span><i className="reversi-mini-disc is-black" />黒炎 <strong>{score.black}</strong></span><b>—</b>
              <span><i className="reversi-mini-disc is-white" />白銀 <strong>{score.white}</strong></span>
            </div>
            {rematchWaitingMessage && !canRematch ? <p className="reversi-rematch-waiting">{rematchWaitingMessage}</p> : null}
            {state.endReason === 'ABANDON' ? <p className="bakuretsu-result-note">時間切れの自動着手が5回続いたため敗北です。</p> : null}
            <GameEndActions onRematch={canRematch ? rematch : undefined} canRematch={canRematch} onChangeSettings={onBackToSetup} onBackToSetup={onBackToSetup} onBackToHome={onBackToHome} />
          </section>
        </div>
      ) : null}
    </main>
  );
}
