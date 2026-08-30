import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEndActions } from '../../components/GameEndActions';
import cornerCaptureImage from './assets/corner-capture.png';
import grandFlipImage from './assets/grand-flip.png';
import {
  applyFlipWave,
  createPlacementBoard,
  groupReversiFlipsByDistance,
  REVERSI_FLIP_SETTLE_MS,
  REVERSI_FLIP_WAVE_INTERVAL_MS,
  REVERSI_PLACE_DURATION_MS,
  type ReversiPlaybackVisual,
} from './reversiAnimation';
import { chooseReversiCpuMove } from './reversiCpu';
import { ReversiBoard } from './ReversiBoard';
import {
  ReversiCinematicOverlay,
  type ReversiCinematicEvent,
} from './ReversiCinematicOverlay';
import {
  applyReversiMove,
  countReversiDiscs,
  createInitialReversiState,
  getValidMoves,
  isCornerMove,
} from './reversiRules';
import type {
  DiscColor,
  ReversiBoard as ReversiBoardState,
  ReversiConfig,
  ReversiGameState,
  ReversiMove,
} from './reversiTypes';

type Props = {
  config: ReversiConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
  initialState?: ReversiGameState;
  synchronizedState?: ReversiGameState | null;
  viewerColor?: DiscColor;
  roomCode?: string;
  canRematch?: boolean;
  rematchWaitingMessage?: string;
  onStateCommit?: (next: ReversiGameState) => void;
  onRematch?: () => void;
};

const CINEMATIC_DURATION_MS = 1900;

function colorLabel(color: DiscColor): string {
  return color === 'black' ? '黒炎' : '白銀';
}

function moveCoordinate(move: ReversiMove): string {
  return `${String.fromCharCode(65 + move.col)}${move.row + 1}`;
}

function createCinematicEvent(
  previous: ReversiGameState,
  next: ReversiGameState,
  move: ReversiMove,
): ReversiCinematicEvent | null {
  const playerName = previous.players[previous.currentColor].name;
  const key = `${previous.gameId}:${next.turnCount}`;
  if (next.status === 'finished') {
    return { key, kind: 'finale', title: '決着', detail: '最後の石まで返り終え、勝敗が定まった' };
  }
  if (isCornerMove(move)) {
    return { key, kind: 'corner', title: '角を制した', detail: `${playerName}が不落の角を獲得` };
  }
  if (next.lastFlipCount >= 5) {
    return { key, kind: 'grand-flip', title: '大反転', detail: `${next.lastFlipCount}枚を一気に覆した` };
  }
  return null;
}

function PlayerPanel({
  color,
  state,
  score,
  viewerColor,
}: {
  color: DiscColor;
  state: ReversiGameState;
  score: number;
  viewerColor?: DiscColor;
}) {
  const player = state.players[color];
  const active = state.status === 'playing' && state.currentColor === color;
  const role = player.isCpu ? 'DRAGON CPU' : viewerColor === color ? 'YOU / CHALLENGER' : 'CHALLENGER';
  return (
    <section className={`reversi-player-panel is-${color}${active ? ' is-active' : ''}`} aria-label={`${colorLabel(color)}のプレイヤー`}>
      <div
        className="reversi-player-art"
        style={{ backgroundImage: `url(${color === 'black' ? cornerCaptureImage : grandFlipImage})` }}
        aria-hidden="true"
      />
      <div className={`reversi-score-disc is-${color}`} aria-hidden="true" />
      <div className="reversi-player-name">
        <span>{colorLabel(color)}</span>
        <strong>{player.name}</strong>
      </div>
      <div className="reversi-score-number" aria-label={`${colorLabel(color)}${score}枚`}>{score}</div>
      <div className="reversi-score-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(4, score / 64 * 100)}%` }} />
      </div>
      <div className="reversi-player-role">{role}</div>
    </section>
  );
}

export function ReversiGameScreen({
  config,
  onBackToSetup,
  onBackToHome,
  initialState,
  synchronizedState = null,
  viewerColor,
  roomCode,
  canRematch = true,
  rematchWaitingMessage,
  onStateCommit,
  onRematch,
}: Props) {
  const [state, setState] = useState<ReversiGameState>(() => initialState ?? createInitialReversiState(config));
  const [displayBoard, setDisplayBoard] = useState<ReversiBoardState>(() => state.board);
  const [playback, setPlayback] = useState<ReversiPlaybackVisual | null>(null);
  const [showHints, setShowHints] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [cinematic, setCinematic] = useState<ReversiCinematicEvent | null>(null);
  const stateRef = useRef(state);
  const moveGuardRef = useRef(false);
  const playbackTimersRef = useRef<number[]>([]);
  const pendingSyncRef = useRef<ReversiGameState | null>(null);
  const grandFlipShownRef = useRef(false);
  const onStateCommitRef = useRef(onStateCommit);
  onStateCommitRef.current = onStateCommit;
  stateRef.current = state;

  const score = useMemo(() => countReversiDiscs(displayBoard), [displayBoard]);
  const validMoves = useMemo(
    () => state.status === 'playing' ? getValidMoves(state.board, state.currentColor) : [],
    [state.board, state.currentColor, state.status],
  );
  const currentPlayer = state.players[state.currentColor];
  const isCpuTurn = state.status === 'playing' && currentPlayer.isCpu;
  const isAnimatingMove = playback !== null;

  function clearPlaybackTimers() {
    for (const timer of playbackTimersRef.current) window.clearTimeout(timer);
    playbackTimersRef.current = [];
  }

  function resetToState(next: ReversiGameState) {
    clearPlaybackTimers();
    moveGuardRef.current = false;
    pendingSyncRef.current = null;
    grandFlipShownRef.current = false;
    stateRef.current = next;
    setState(next);
    setDisplayBoard(next.board);
    setPlayback(null);
    setCinematic(null);
  }

  function showMoveCinematic(previous: ReversiGameState, next: ReversiGameState, move: ReversiMove) {
    let nextCinematic = createCinematicEvent(previous, next, move);
    if (nextCinematic?.kind === 'grand-flip') {
      if (grandFlipShownRef.current) nextCinematic = null;
      else grandFlipShownRef.current = true;
    }
    setCinematic(nextCinematic);
  }

  function finishPlayback(
    previous: ReversiGameState,
    next: ReversiGameState,
    move: ReversiMove,
    shouldCommit: boolean,
  ) {
    clearPlaybackTimers();
    stateRef.current = next;
    setState(next);
    setDisplayBoard(next.board);
    setPlayback(null);
    moveGuardRef.current = false;
    showMoveCinematic(previous, next, move);
    if (shouldCommit) onStateCommitRef.current?.(next);

    const pending = pendingSyncRef.current;
    pendingSyncRef.current = null;
    if (pending && (pending.gameId !== next.gameId || pending.turnCount > next.turnCount)) {
      const timer = window.setTimeout(() => syncIncomingState(pending), 0);
      playbackTimersRef.current.push(timer);
    }
  }

  function beginPlayback(previous: ReversiGameState, next: ReversiGameState, shouldCommit: boolean) {
    const move = next.lastMove;
    const color = next.lastMoveColor;
    if (!move || !color || next.turnCount !== previous.turnCount + 1) {
      resetToState(next);
      if (shouldCommit) onStateCommitRef.current?.(next);
      return;
    }

    clearPlaybackTimers();
    moveGuardRef.current = true;
    let nextDisplayBoard = createPlacementBoard(previous.board, color, move);
    const waves = groupReversiFlipsByDistance(move, next.lastFlipped);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const placeDuration = reducedMotion ? 90 : REVERSI_PLACE_DURATION_MS;
    const waveInterval = reducedMotion ? 55 : REVERSI_FLIP_WAVE_INTERVAL_MS;
    const settleDuration = reducedMotion ? 100 : REVERSI_FLIP_SETTLE_MS;

    setDisplayBoard(nextDisplayBoard);
    setPlayback({ phase: 'placing', placed: move, activeFlips: [], color });

    waves.forEach((wave, index) => {
      const timer = window.setTimeout(() => {
        nextDisplayBoard = applyFlipWave(nextDisplayBoard, color, wave);
        setDisplayBoard(nextDisplayBoard);
        setPlayback({ phase: 'flipping', placed: move, activeFlips: wave, color });
      }, placeDuration + index * waveInterval);
      playbackTimersRef.current.push(timer);
    });

    const finishDelay = placeDuration
      + Math.max(0, waves.length - 1) * waveInterval
      + settleDuration;
    const finishTimer = window.setTimeout(
      () => finishPlayback(previous, next, move, shouldCommit),
      finishDelay,
    );
    playbackTimersRef.current.push(finishTimer);
  }

  function syncIncomingState(incoming: ReversiGameState) {
    const current = stateRef.current;
    if (incoming.gameId === current.gameId && incoming.turnCount === current.turnCount) return;
    if (moveGuardRef.current) {
      pendingSyncRef.current = incoming;
      return;
    }
    if (incoming.gameId !== current.gameId || incoming.turnCount <= current.turnCount) {
      resetToState(incoming);
      return;
    }
    if (incoming.turnCount === current.turnCount + 1) beginPlayback(current, incoming, false);
    else resetToState(incoming);
  }

  function performMove(move: ReversiMove) {
    if (moveGuardRef.current) return;
    const previous = stateRef.current;
    const next = applyReversiMove(previous, move);
    if (next === previous) return;
    beginPlayback(previous, next, Boolean(onStateCommitRef.current));
  }

  useEffect(() => () => clearPlaybackTimers(), []);

  useEffect(() => {
    if (!synchronizedState) return;
    syncIncomingState(synchronizedState);
    // 同期の識別子だけで反応し、同じ局面の親再描画では再生しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synchronizedState?.gameId, synchronizedState?.turnCount]);

  useEffect(() => {
    if (!cinematic) return;
    const timer = window.setTimeout(() => setCinematic(null), CINEMATIC_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [cinematic]);

  useEffect(() => {
    if (!isCpuTurn || isAnimatingMove || cinematic || showRules) return;
    const expectedGameId = state.gameId;
    const expectedTurn = state.turnCount;
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      if (
        current.gameId !== expectedGameId
        || current.turnCount !== expectedTurn
        || current.status !== 'playing'
        || !current.players[current.currentColor].isCpu
      ) return;
      const level = current.players[current.currentColor].cpuLevel ?? 'normal';
      const move = chooseReversiCpuMove(current, level);
      if (move) performMove(move);
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematic, isAnimatingMove, isCpuTurn, showRules, state.gameId, state.turnCount]);

  function rematch() {
    if (onRematch) {
      onRematch();
      return;
    }
    resetToState(createInitialReversiState(config));
  }

  const viewerCanMove = viewerColor === undefined || viewerColor === state.currentColor;
  const interactive = state.status === 'playing'
    && !isCpuTurn
    && !isAnimatingMove
    && !cinematic
    && !showRules
    && viewerCanMove;
  const turnMessage = playback
    ? playback.phase === 'placing'
      ? `${state.players[playback.color].name}が${moveCoordinate(playback.placed)}へ着手`
      : '置いた石のそばから反転しています…'
    : state.status === 'finished'
      ? '対局終了'
      : isCpuTurn
        ? `${currentPlayer.name}が盤面を読んでいます…`
        : viewerColor && !viewerCanMove
          ? `${currentPlayer.name}の着手を待っています…`
          : `${currentPlayer.name}の番です`;
  const passMessage = playback
    ? playback.phase === 'placing'
      ? 'まず新しい石を置きます'
      : `近い石から順番に返しています（今回${playback.activeFlips.length}枚）`
    : state.passedColor
      ? `${state.players[state.passedColor].name}は置ける場所がなく、自動でパスしました`
      : state.lastMove
        ? `${state.lastFlipCount}枚を反転しました`
        : '黒が先手。光る陣へ石を置いてください';

  return (
    <main className="reversi-game-shell">
      <header className="reversi-game-topbar">
        <button type="button" onClick={onBackToSetup}><span aria-hidden="true">←</span><span>設定に戻る</span></button>
        <div className="reversi-game-title">
          <span>REVERSI</span>
          <strong>黒炎と白銀の竜陣</strong>
          {roomCode ? <em>ROOM {roomCode}</em> : null}
        </div>
        <div className="reversi-game-tools">
          <button type="button" onClick={() => setShowRules(true)} aria-label="ルールを見る">📖</button>
          <button type="button" onClick={rematch} disabled={!canRematch} aria-label="最初からやり直す">↻</button>
        </div>
      </header>

      <div className="reversi-mobile-score-row">
        <div className={`is-black${state.currentColor === 'black' && state.status === 'playing' ? ' is-active' : ''}`}><span className="reversi-mini-disc is-black" />黒炎 <strong>{score.black}</strong></div>
        <div className={`is-white${state.currentColor === 'white' && state.status === 'playing' ? ' is-active' : ''}`}><span className="reversi-mini-disc is-white" />白銀 <strong>{score.white}</strong></div>
      </div>

      <div className="reversi-arena">
        <PlayerPanel color="black" state={state} score={score.black} viewerColor={viewerColor} />

        <section className="reversi-board-column">
          <ReversiBoard
            state={state}
            displayBoard={displayBoard}
            playback={playback}
            validMoves={isAnimatingMove ? [] : validMoves}
            interactive={interactive}
            showHints={showHints}
            onMove={performMove}
          />
          <div className="reversi-status-tray" aria-live="polite">
            <span className={`reversi-turn-disc is-${playback?.color ?? state.currentColor}`} aria-hidden="true" />
            <div>
              <strong>{turnMessage}</strong>
              <span>{passMessage}</span>
            </div>
            <button type="button" className={showHints ? 'is-active' : ''} onClick={() => setShowHints((value) => !value)} disabled={isAnimatingMove}>
              候補 {showHints ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <PlayerPanel color="white" state={state} score={score.white} viewerColor={viewerColor} />
      </div>

      {showRules ? (
        <div className="reversi-rules-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}>
          <section className="reversi-rules-panel" role="dialog" aria-modal="true" aria-labelledby="reversi-rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="reversi-rules-close" onClick={() => setShowRules(false)} aria-label="閉じる">×</button>
            <span>RULES</span>
            <h2 id="reversi-rules-title">遊戯の掟</h2>
            <ol>
              <li>黒が先手です。相手の石を縦・横・斜めにはさむ場所へ置きます。</li>
              <li>はさんだ石はすべて自分の色へ返ります。1枚も返せない場所には置けません。</li>
              <li>置ける場所がなければ自動でパス。両者とも置けなくなると対局終了です。</li>
              <li>終了時に石が多い側の勝ちです。角の石は二度と返されません。</li>
            </ol>
            <button type="button" className="reversi-rules-confirm" onClick={() => setShowRules(false)}>盤へ戻る</button>
          </section>
        </div>
      ) : null}

      {state.status === 'finished' && !isAnimatingMove ? (
        <div className="reversi-result-backdrop">
          <section className="reversi-result-panel" role="dialog" aria-modal="true" aria-label="対局結果">
            <span className="reversi-result-kicker">FINAL SCORE</span>
            <h2>{state.winner === 'draw' ? '引き分け' : `${state.players[state.winner!].name}の勝利`}</h2>
            <div className="reversi-result-score">
              <span><i className="reversi-mini-disc is-black" />黒炎 <strong>{score.black}</strong></span>
              <b>—</b>
              <span><i className="reversi-mini-disc is-white" />白銀 <strong>{score.white}</strong></span>
            </div>
            {rematchWaitingMessage && !canRematch ? <p className="reversi-rematch-waiting">{rematchWaitingMessage}</p> : null}
            <GameEndActions
              onRematch={canRematch ? rematch : undefined}
              canRematch={canRematch}
              onChangeSettings={onBackToSetup}
              onBackToSetup={onBackToSetup}
              onBackToHome={onBackToHome}
            />
          </section>
        </div>
      ) : null}

      {cinematic ? <ReversiCinematicOverlay event={cinematic} /> : null}
    </main>
  );
}
