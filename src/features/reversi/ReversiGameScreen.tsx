import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEndActions } from '../../components/GameEndActions';
import cornerCaptureImage from './assets/corner-capture.png';
import grandFlipImage from './assets/grand-flip.png';
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
import type { DiscColor, ReversiConfig, ReversiGameState, ReversiMove } from './reversiTypes';

type Props = {
  config: ReversiConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

const CINEMATIC_DURATION_MS = 1900;

function colorLabel(color: DiscColor): string {
  return color === 'black' ? '黒炎' : '白銀';
}

function createCinematicEvent(
  previous: ReversiGameState,
  next: ReversiGameState,
  move: ReversiMove,
): ReversiCinematicEvent | null {
  const playerName = previous.players[previous.currentColor].name;
  const key = `${previous.gameId}:${next.turnCount}`;
  if (next.status === 'finished') {
    return { key, kind: 'finale', title: '決着', detail: '黒炎と白銀、最後の石が運命を定める' };
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
}: {
  color: DiscColor;
  state: ReversiGameState;
  score: number;
}) {
  const player = state.players[color];
  const active = state.status === 'playing' && state.currentColor === color;
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
      <div className="reversi-player-role">{player.isCpu ? 'DRAGON CPU' : 'CHALLENGER'}</div>
    </section>
  );
}

export function ReversiGameScreen({ config, onBackToSetup, onBackToHome }: Props) {
  const [state, setState] = useState<ReversiGameState>(() => createInitialReversiState(config));
  const [showHints, setShowHints] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [cinematic, setCinematic] = useState<ReversiCinematicEvent | null>(null);
  const stateRef = useRef(state);
  const moveGuardRef = useRef(false);
  const grandFlipShownRef = useRef(false);
  stateRef.current = state;

  const score = useMemo(() => countReversiDiscs(state.board), [state.board]);
  const validMoves = useMemo(
    () => state.status === 'playing' ? getValidMoves(state.board, state.currentColor) : [],
    [state.board, state.currentColor, state.status],
  );
  const currentPlayer = state.players[state.currentColor];
  const isCpuTurn = state.status === 'playing' && currentPlayer.isCpu;

  function performMove(move: ReversiMove) {
    if (moveGuardRef.current) return;
    const previous = stateRef.current;
    const next = applyReversiMove(previous, move);
    if (next === previous) return;

    moveGuardRef.current = true;
    stateRef.current = next;
    setState(next);
    let nextCinematic = createCinematicEvent(previous, next, move);
    if (nextCinematic?.kind === 'grand-flip') {
      if (grandFlipShownRef.current) nextCinematic = null;
      else grandFlipShownRef.current = true;
    }
    setCinematic(nextCinematic);
    window.setTimeout(() => { moveGuardRef.current = false; }, 280);
  }

  useEffect(() => {
    if (!cinematic) return;
    const timer = window.setTimeout(() => setCinematic(null), CINEMATIC_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [cinematic]);

  useEffect(() => {
    if (!isCpuTurn || cinematic || showRules) return;
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
    }, 520);
    return () => window.clearTimeout(timer);
  }, [cinematic, isCpuTurn, showRules, state.gameId, state.turnCount]);

  function rematch() {
    moveGuardRef.current = false;
    grandFlipShownRef.current = false;
    setCinematic(null);
    const next = createInitialReversiState(config);
    stateRef.current = next;
    setState(next);
  }

  const interactive = state.status === 'playing' && !isCpuTurn && !cinematic && !showRules;
  const turnMessage = state.status === 'finished'
    ? '対局終了'
    : isCpuTurn
      ? `${currentPlayer.name}が盤面を読んでいます…`
      : `${currentPlayer.name}の番です`;
  const passMessage = state.passedColor
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
        </div>
        <div className="reversi-game-tools">
          <button type="button" onClick={() => setShowRules(true)} aria-label="ルールを見る">📖</button>
          <button type="button" onClick={rematch} aria-label="最初からやり直す">↻</button>
        </div>
      </header>

      <div className="reversi-mobile-score-row">
        <div className={`is-black${state.currentColor === 'black' && state.status === 'playing' ? ' is-active' : ''}`}><span className="reversi-mini-disc is-black" />黒炎 <strong>{score.black}</strong></div>
        <div className={`is-white${state.currentColor === 'white' && state.status === 'playing' ? ' is-active' : ''}`}><span className="reversi-mini-disc is-white" />白銀 <strong>{score.white}</strong></div>
      </div>

      <div className="reversi-arena">
        <PlayerPanel color="black" state={state} score={score.black} />

        <section className="reversi-board-column">
          <ReversiBoard
            state={state}
            validMoves={validMoves}
            interactive={interactive}
            showHints={showHints}
            onMove={performMove}
          />
          <div className="reversi-status-tray" aria-live="polite">
            <span className={`reversi-turn-disc is-${state.currentColor}`} aria-hidden="true" />
            <div>
              <strong>{turnMessage}</strong>
              <span>{passMessage}</span>
            </div>
            <button type="button" className={showHints ? 'is-active' : ''} onClick={() => setShowHints((value) => !value)}>
              候補 {showHints ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <PlayerPanel color="white" state={state} score={score.white} />
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

      {state.status === 'finished' ? (
        <div className="reversi-result-backdrop">
          <section className="reversi-result-panel" role="dialog" aria-modal="true" aria-label="対局結果">
            <span className="reversi-result-kicker">FINAL SCORE</span>
            <h2>{state.winner === 'draw' ? '引き分け' : `${state.players[state.winner!].name}の勝利`}</h2>
            <div className="reversi-result-score">
              <span><i className="reversi-mini-disc is-black" />黒炎 <strong>{score.black}</strong></span>
              <b>—</b>
              <span><i className="reversi-mini-disc is-white" />白銀 <strong>{score.white}</strong></span>
            </div>
            <GameEndActions
              onRematch={rematch}
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
