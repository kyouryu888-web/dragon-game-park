import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { UnoCard, UnoColor, UnoConfig, UnoGameState, UnoPlayer, UnoPlayerId } from './unoTypes';
import { createInitialUnoState } from './createInitialUnoState';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyPassDrawnCard,
  applyPlayCard,
  applyStarterDraw,
  applyStartGame,
  applySwapPick,
  applyUnoDeclaration,
  canPlayCard,
  getNextPlayerId,
  getPlayableCards,
} from './unoRules';
import { chooseUnoCpuAction } from './unoCpu';
import { UNO_COLOR_LABELS, getUnoCardName } from './unoCardMeta';
import { UnoRulesPanel } from './UnoRulesPanel';
import { UnoTableView } from './UnoTableView';
import { getUnoRankings, type UnoRankingEntry } from './unoScoring';
import { UnoCardView } from './UnoCardView';

const COLOR_BUTTONS: Array<{ color: UnoColor; bg: string }> = [
  { color: 'red', bg: '#df352c' },
  { color: 'yellow', bg: '#f2c436' },
  { color: 'green', bg: '#25a85a' },
  { color: 'blue', bg: '#2581d8' },
];

type UnoGamePageProps = {
  config: UnoConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function UnoGamePage({ config, onBackToSetup, onBackToHome }: UnoGamePageProps) {
  const [gameState, setGameState] = useState<UnoGameState>(() => createInitialUnoState(config));
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [message, setMessage] = useState('カードを出すか、引いてください。');
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const isHard = gameState.variant === 'hard';
  const currentPlayer = gameState.players.find((p) => p.id === gameState.currentPlayerId)!;
  const visibleHandPlayer =
    currentPlayer.isCpu
      ? gameState.players.find((player) => !player.isCpu && !player.isEliminated)
        ?? gameState.players.find((player) => !player.isCpu)
        ?? currentPlayer
      : currentPlayer;
  const visibleHand = gameState.hands[visibleHandPlayer.id] ?? [];
  const topCard = gameState.discardPile[0]!;
  const playableCards = visibleHandPlayer.id === gameState.currentPlayerId
    ? getPlayableCards(gameState, gameState.currentPlayerId)
    : [];
  const pending = gameState.pendingAction;
  const nextPlayerId = useMemo(() => getNextPlayerId(gameState), [gameState]);

  const winner = gameState.winnerPlayerId
    ? gameState.players.find((p) => p.id === gameState.winnerPlayerId) ?? null
    : null;

  const currentIsCpu = currentPlayer?.isCpu ?? false;
  const canHumanAct =
    gameState.status === 'playing' &&
    !isCpuThinking &&
    !currentIsCpu &&
    (pending === null || (pending.kind === 'drawn-card-play' && pending.playerId === gameState.currentPlayerId));

  const applyState = useCallback((updater: (state: UnoGameState) => UnoGameState, nextMessage?: string) => {
    setGameState((prev) => {
      const next = updater(prev);
      if (next !== prev && nextMessage) setMessage(nextMessage);
      return next;
    });
  }, []);

  const handlePlayCard = useCallback((card: UnoCard) => {
    if (!canHumanAct) return;
    if (!canPlayCard(gameState, card)) return;
    applyState((state) => applyPlayCard(state, card.id), `${currentPlayer.name} が ${getUnoCardName(card)} を出しました。`);
  }, [applyState, canHumanAct, currentPlayer.name, gameState]);

  const handleDraw = useCallback(() => {
    if (!canHumanAct) return;
    applyState(
      (state) => applyDrawCard(state),
      `${currentPlayer.name} が山札から1まい引きました。`,
    );
  }, [applyState, canHumanAct, currentPlayer.name]);

  const handlePassDrawnCard = useCallback(() => {
    if (!canHumanAct) return;
    applyState((state) => applyPassDrawnCard(state), `${currentPlayer.name} は引いたカードを出さずに進めました。`);
  }, [applyState, canHumanAct, currentPlayer.name]);

  const handleDecideStarter = useCallback(() => {
    applyState((state) => applyStarterDraw(state), '引いたカードを確認してください。');
  }, [applyState]);

  const handleStartGame = useCallback(() => {
    const starterName = gameState.players.find((player) => player.id === gameState.currentPlayerId)?.name ?? 'スタートプレイヤー';
    applyState((state) => applyStartGame(state), `${starterName} から始めます。`);
  }, [applyState, gameState.currentPlayerId, gameState.players]);

  const handleAcceptDraw = useCallback(() => {
    if (!canHumanAct || gameState.pendingDrawCount <= 0) return;
    const count = gameState.pendingDrawCount;
    applyState((state) => applyAcceptDraw(state), `${currentPlayer.name} が ${count}まい引きました。`);
  }, [applyState, canHumanAct, currentPlayer.name, gameState.pendingDrawCount]);

  const handleRestart = useCallback(() => {
    setIsCpuThinking(false);
    setMessage('新しいゲームをはじめました。');
    setGameState(createInitialUnoState(config));
  }, [config]);

  const handleColorChoice = useCallback((color: UnoColor) => {
    applyState((state) => applyColorChoice(state, color), `${UNO_COLOR_LABELS[color]}をえらびました。`);
  }, [applyState]);

  const handleSwapPick = useCallback((targetPlayerId: UnoPlayerId) => {
    const target = gameState.players.find((p) => p.id === targetPlayerId);
    applyState((state) => applySwapPick(state, targetPlayerId), `${target?.name ?? '相手'} と手札をこうかんしました。`);
  }, [applyState, gameState.players]);

  const handleUnoDeclare = useCallback((playerId: UnoPlayerId) => {
    const player = gameState.players.find((p) => p.id === playerId);
    applyState((state) => applyUnoDeclaration(state, playerId), `${player?.name ?? 'プレイヤー'} が「ウノ!」と言いました。`);
  }, [applyState, gameState.players]);

  const rouletteProgressKey = useMemo(() => {
    if (pending?.kind !== 'color-roulette') return 'none';
    const target = gameState.players.find((player) => player.id === pending.targetPlayerId);
    return [
      pending.targetPlayerId,
      pending.targetColor,
      target?.isEliminated ? 'out' : 'in',
      gameState.hands[pending.targetPlayerId]?.length ?? 0,
      gameState.deck.length,
    ].join(':');
  }, [gameState.deck.length, gameState.hands, gameState.players, pending]);

  useEffect(() => {
    if (gameState.status !== 'playing') {
      setIsCpuThinking(false);
      return;
    }

    const pendingAction = gameState.pendingAction;
    const actingPlayerId =
      pendingAction?.kind === 'color-pick' ? pendingAction.chooserPlayerId
      : pendingAction?.kind === 'swap-pick' ? pendingAction.swapperPlayerId
      : pendingAction?.kind === 'uno-window' ? pendingAction.playerWithOneCard
      : gameState.currentPlayerId;
    const actingPlayer = gameState.players.find((p) => p.id === actingPlayerId);

    if (pendingAction?.kind === 'color-roulette') {
      setIsCpuThinking(true);
      const id = setTimeout(() => {
        setGameState((prev) => applyColorRouletteStep(prev));
        setMessage('カラー ルーレット中...');
        setIsCpuThinking(false);
      }, 420);
      return () => clearTimeout(id);
    }

    if (!actingPlayer?.isCpu) {
      setIsCpuThinking(false);
      return;
    }

    setIsCpuThinking(true);
    const id = setTimeout(() => {
      const state = stateRef.current;
      const action = chooseUnoCpuAction(state, actingPlayer.id, actingPlayer.cpuLevel ?? 'normal');
      if (!action) {
        setIsCpuThinking(false);
        return;
      }
      setGameState((prev) => {
        switch (action.type) {
          case 'play-card':
            return applyPlayCard(prev, action.cardId);
          case 'draw-card':
            return applyDrawCard(prev);
          case 'pass-drawn-card':
            return applyPassDrawnCard(prev);
          case 'accept-draw':
            return applyAcceptDraw(prev);
          case 'choose-color':
            return applyColorChoice(prev, action.color);
          case 'choose-swap':
            return applySwapPick(prev, action.targetPlayerId);
          case 'roulette-step':
            return applyColorRouletteStep(prev);
          case 'declare-uno':
            return applyUnoDeclaration(prev, action.playerId);
        }
      });
      setMessage(`${actingPlayer.name} が考えました。`);
      setIsCpuThinking(false);
    }, 620);

    return () => clearTimeout(id);
  }, [
    gameState.currentPlayerId,
    gameState.pendingAction,
    gameState.status,
    gameState.turnCount,
    gameState.players,
    rouletteProgressKey,
  ]);

  const rankings = useMemo(() => {
    return getUnoRankings(gameState);
  }, [gameState]);

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, color: 'var(--brown)', marginBottom: 3 }}>
            {isHard ? 'ハード版 UNO' : '通常版 UNO'}
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {gameState.players.length}人プレイ / 山札 {gameState.deck.length}まい
          </div>
        </div>

        {gameState.status === 'finished' && (
          <ResultPanel
            winner={winner}
            rankings={rankings}
            onRestart={handleRestart}
            onBackToSetup={onBackToSetup}
            onBackToHome={onBackToHome}
          />
        )}

        {gameState.status !== 'finished' && (
          <>
            {gameState.status === 'playing' ? (
              <TurnStatus
                player={currentPlayer}
                thinking={isCpuThinking}
                pendingDrawCount={gameState.pendingDrawCount}
                activeColor={gameState.activeColor}
                message={message}
                variant={gameState.variant}
              />
            ) : (
              <div className="uno-start-status">
                山札から1まいずつ引いて、いちばん大きい数字を出した人から始めます。
              </div>
            )}

            <UnoTableView
              state={gameState}
              currentPlayer={currentPlayer}
              nextPlayerId={nextPlayerId}
              topCard={topCard}
              currentHand={visibleHand}
              handPlayer={visibleHandPlayer}
              playableIds={new Set(playableCards.map((card) => card.id))}
              canAct={canHumanAct}
              isCpuThinking={isCpuThinking}
              message={message}
              pendingOverlay={gameState.status === 'deciding-starter' || gameState.status === 'starter-ready' ? (
                <StarterDecisionPanel state={gameState} onDecideStarter={handleDecideStarter} onStartGame={handleStartGame} />
              ) : pending ? (
                <PendingPanel
                  state={gameState}
                  onColorChoice={handleColorChoice}
                  onSwapPick={handleSwapPick}
                  onUnoDeclare={handleUnoDeclare}
                  onPassDrawnCard={handlePassDrawnCard}
                />
              ) : null}
              onPlay={handlePlayCard}
              onDraw={handleDraw}
              onAcceptDraw={handleAcceptDraw}
            />

            <button
              onClick={() => setShowRules((show) => !show)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '11px 14px',
                borderRadius: 14,
                border: '1.5px solid var(--border)',
                background: '#191320',
                color: 'var(--text-mid)',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              {showRules ? 'ルール説明を閉じる' : 'ルール説明を開く'}
            </button>
            {showRules && <div style={{ marginTop: 8 }}><UnoRulesPanel variant={gameState.variant} /></div>}

            <div className="game-nav-buttons">
              <Button variant="ghost" fullWidth onClick={handleRestart}>
                リスタート
              </Button>
              <div className="game-nav-secondary">
                <Button variant="secondary" fullWidth onClick={onBackToSetup}>
                  UNO設定へ戻る
                </Button>
                <Button variant="secondary" fullWidth onClick={onBackToHome}>
                  ゲーム選択へ戻る
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function TurnStatus({
  player,
  thinking,
  pendingDrawCount,
  activeColor,
  message,
  variant,
}: {
  player: UnoPlayer;
  thinking: boolean;
  pendingDrawCount: number;
  activeColor: UnoColor;
  message: string;
  variant: 'standard' | 'hard';
}) {
  return (
    <div className="turn-slide" style={{
      background: variant === 'hard'
        ? 'linear-gradient(135deg, #2b1114, #4b1518)'
        : 'linear-gradient(135deg, rgba(201,162,75,.12), rgba(201,162,75,.12))',
      color: variant === 'hard' ? '#f0dfae' : '#7a5010',
      border: `1.5px solid ${variant === 'hard' ? '#c33a30' : '#e8d070'}`,
      borderRadius: 15,
      padding: '11px 14px',
      marginBottom: 10,
      textAlign: 'center',
    }}>
      <div className={thinking ? 'cpu-thinking-pulse' : undefined} style={{ fontWeight: 900, fontSize: 14 }}>
        {player.isCpu ? 'CPU ' : ''}{player.name} の番
      </div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>
        色: {UNO_COLOR_LABELS[activeColor]}{pendingDrawCount > 0 ? ` / ドロー ${pendingDrawCount}まい` : ''} / {message}
      </div>
    </div>
  );
}

export function PendingPanel({
  state,
  onColorChoice,
  onSwapPick,
  onUnoDeclare,
  onPassDrawnCard,
}: {
  state: UnoGameState;
  onColorChoice: (color: UnoColor) => void;
  onSwapPick: (targetPlayerId: UnoPlayerId) => void;
  onUnoDeclare: (playerId: UnoPlayerId) => void;
  onPassDrawnCard: () => void;
}) {
  const pending = state.pendingAction;
  if (!pending) return null;

  if (pending.kind === 'color-pick') {
    const player = state.players.find((p) => p.id === pending.chooserPlayerId);
    return (
      <ActionPanel title={`${player?.name ?? 'プレイヤー'}、色をえらんでください`}>
        <p className="uno-pending-description">次の場の色になります。見やすい色ボタンを1つ押してください。</p>
        <div className="uno-pending-color-grid">
          {COLOR_BUTTONS.map(({ color, bg }) => (
            <button
              key={color}
              className={`uno-pending-color-button is-${color}`}
              onClick={() => onColorChoice(color)}
              style={{ '--uno-choice-color': bg } as CSSProperties}
            >
              {UNO_COLOR_LABELS[color]}
            </button>
          ))}
        </div>
      </ActionPanel>
    );
  }

  if (pending.kind === 'swap-pick') {
    const player = state.players.find((p) => p.id === pending.swapperPlayerId);
    return (
      <ActionPanel title={`${player?.name ?? 'プレイヤー'}、こうかんする相手をえらんでください`}>
        <p className="uno-pending-description">選んだ相手と手札をすべて交換します。</p>
        <div className="uno-pending-target-grid">
          {state.players.filter((p) => p.id !== pending.swapperPlayerId && !p.isEliminated).map((target) => (
            <button
              key={target.id}
              type="button"
              className="uno-pending-target-button"
              onClick={() => onSwapPick(target.id)}
            >
              <strong>{target.name}</strong>
              <span>{state.hands[target.id]?.length ?? 0}まい</span>
            </button>
          ))}
        </div>
      </ActionPanel>
    );
  }

  if (pending.kind === 'color-roulette') {
    const target = state.players.find((p) => p.id === pending.targetPlayerId);
    return (
      <ActionPanel title="カラー ルーレット">
        <p className="uno-pending-description">
          {target?.name ?? '次の人'} が {UNO_COLOR_LABELS[pending.targetColor]} のカードを引くまで、対象プレイヤーに1まいずつ引かせます。
        </p>
        <div className="uno-pending-status cpu-thinking-pulse">
          自動で進めています...
        </div>
      </ActionPanel>
    );
  }

  if (pending.kind === 'drawn-card-play') {
    const player = state.players.find((p) => p.id === pending.playerId);
    return (
      <ActionPanel title="引いたカードを出せます">
        <p className="uno-pending-description">
          {player?.name ?? 'プレイヤー'} が今引いたカードだけ出せます。出さない場合は次の人へ進みます。
        </p>
        <div className="uno-pending-target-grid">
          <Button fullWidth variant="secondary" onClick={onPassDrawnCard}>
            出さずに次へ
          </Button>
        </div>
      </ActionPanel>
    );
  }

  if (pending.kind === 'uno-window') {
    const player = state.players.find((p) => p.id === pending.playerWithOneCard);
    return (
      <ActionPanel title="ウノ!">
        <p className="uno-pending-description">
          {player?.name ?? 'プレイヤー'} の手札があと1まいです。UNOは自動で宣言されます。
        </p>
        <div className="uno-pending-target-grid">
          <Button fullWidth onClick={() => onUnoDeclare(pending.playerWithOneCard)}>
            OK
          </Button>
        </div>
      </ActionPanel>
    );
  }

  return null;
}

export function StarterDecisionPanel({
  state,
  onDecideStarter,
  onStartGame,
  hostOnly = false,
  canDecide = true,
}: {
  state: UnoGameState;
  onDecideStarter: () => void;
  onStartGame: () => void;
  hostOnly?: boolean;
  canDecide?: boolean;
}) {
  const latestRound = state.starterDraws.reduce((max, draw) => Math.max(max, draw.round), 0);
  const rounds = Array.from({ length: latestRound }, (_, index) => index + 1);
  const finalDraws = latestRound > 0 ? state.starterDraws.filter((draw) => draw.round === latestRound) : [];
  const bestValue = finalDraws.length > 0 ? Math.max(...finalDraws.map((draw) => draw.value)) : null;
  const starter = state.players.find((player) => player.id === state.currentPlayerId);
  const isReady = state.status === 'starter-ready';

  return (
    <ActionPanel title="スタートプレイヤー決定">
      <p className="uno-pending-description">
        全員が山札から1まい引きます。数字がいちばん大きい人から始めます。記号やワイルドは0です。
      </p>
      {rounds.length > 0 && (
        <div className="uno-starter-draw-grid">
          {rounds.map((round) => (
            <div key={round} className="uno-starter-round">
              {latestRound > 1 && <strong className="uno-starter-round-title">{round}回目</strong>}
              {state.starterDraws.filter((draw) => draw.round === round).map((draw) => {
                const player = state.players.find((p) => p.id === draw.playerId);
                const isBest = isReady && draw.round === latestRound && draw.value === bestValue;
                return (
                  <div key={`${draw.round}-${draw.playerId}-${draw.card.id}`} className={`uno-starter-card ${isBest ? 'is-best' : ''}`}>
                    <strong>{player?.name ?? 'プレイヤー'}</strong>
                    <UnoCardView card={draw.card} compact variant={state.variant} />
                    <span>{draw.value}点</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {isReady && (
        <p className="uno-start-status">
          スタートプレイヤーは <strong>{starter?.name ?? 'プレイヤー'}</strong> です。
        </p>
      )}
      <div className="uno-pending-target-grid">
        <Button fullWidth onClick={isReady ? onStartGame : onDecideStarter} disabled={!canDecide}>
          {isReady ? 'ゲーム開始' : 'カードを引いて決める'}
        </Button>
      </div>
      {hostOnly && !canDecide && (
        <p className="uno-pending-description">ルームを作った人が操作します。</p>
      )}
    </ActionPanel>
  );
}

function ActionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="uno-pending-panel">
      <h2 className="uno-pending-title">{title}</h2>
      {children}
    </div>
  );
}

function ResultPanel({
  winner,
  rankings,
  onRestart,
  onBackToSetup,
  onBackToHome,
}: {
  winner: UnoPlayer | null;
  rankings: UnoRankingEntry[];
  onRestart: () => void;
  onBackToSetup: () => void;
  onBackToHome: () => void;
}) {
  return (
    <div className="result-appear" style={{
      background: 'linear-gradient(135deg, rgba(201,162,75,.12), rgba(201,162,75,.22))',
      border: '2px solid #d8b030',
      borderRadius: 22,
      padding: '22px 18px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-md)',
      marginBottom: 16,
    }}>
      <div className="trophy-bounce" style={{ fontSize: 42 }}>🏆</div>
      <h2 style={{ fontSize: 20, color: 'var(--brown)', marginBottom: 12 }}>
        {winner ? `${winner.name} の勝利!` : '決闘は終わった'}
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
        数字カードは数字の点、スキップ・リバース・ドローなどの記号カードは20点、ワイルドカードは50点です。点が少ないほど上位です。
      </p>
      <div style={{ display: 'grid', gap: 7, marginBottom: 16 }}>
        {rankings.map((entry, index) => (
          <div key={entry.player.id} className="rank-card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            background: index === 0 ? 'rgba(230,200,119,.25)' : '#1d1723',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            padding: '8px 10px',
            fontSize: 13,
            animationDelay: `${index * 45}ms`,
          }}>
            <strong>{entry.rank}. {entry.player.name}</strong>
            <span>
              {entry.player.isEliminated ? '脱落 / ' : ''}
              {entry.score}点
              <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>残り{entry.cardCount}枚</small>
            </span>
          </div>
        ))}
      </div>
      <div className="game-nav-buttons" style={{ marginTop: 0 }}>
        <Button fullWidth onClick={onRestart}>もう一度戦う</Button>
        <div className="game-nav-secondary">
          <Button fullWidth variant="secondary" onClick={onBackToSetup}>UNO設定へ戻る</Button>
          <Button fullWidth variant="secondary" onClick={onBackToHome}>ゲーム選択へ戻る</Button>
        </div>
      </div>
    </div>
  );
}
