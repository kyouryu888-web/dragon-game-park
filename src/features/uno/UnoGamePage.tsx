import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { UnoCard, UnoColor, UnoConfig, UnoGameState, UnoPlayer, UnoPlayerId } from './unoTypes';
import { createInitialUnoState } from './createInitialUnoState';
import {
  applyAcceptDraw,
  applyColorChoice,
  applyColorRouletteStep,
  applyDrawCard,
  applyPlayCard,
  applySwapPick,
  applyUnoDeclaration,
  applyUnoPenalty,
  canPlayCard,
  getNextPlayerId,
  getPlayableCards,
} from './unoRules';
import { chooseUnoCpuAction } from './unoCpu';
import { UNO_COLOR_LABELS, getUnoCardName } from './unoCardMeta';
import { UnoRulesPanel } from './UnoRulesPanel';
import { UnoTableView } from './UnoTableView';

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
  const currentHand = gameState.hands[gameState.currentPlayerId] ?? [];
  const topCard = gameState.discardPile[0]!;
  const playableCards = getPlayableCards(gameState, gameState.currentPlayerId);
  const pending = gameState.pendingAction;
  const nextPlayerId = useMemo(() => getNextPlayerId(gameState), [gameState]);

  const winner = gameState.winnerPlayerId
    ? gameState.players.find((p) => p.id === gameState.winnerPlayerId)
    : null;

  const currentIsCpu = currentPlayer?.isCpu ?? false;
  const canHumanAct =
    gameState.status === 'playing' &&
    !isCpuThinking &&
    !currentIsCpu &&
    pending === null;

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
      isHard ? '出せるカードが出るまで引きます。' : `${currentPlayer.name} が1まい引きました。`,
    );
  }, [applyState, canHumanAct, currentPlayer.name, isHard]);

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

  const handleRouletteStep = useCallback(() => {
    applyState((state) => applyColorRouletteStep(state), 'ルーレットで1まい引きました。');
  }, [applyState]);

  const handleUnoDeclare = useCallback((playerId: UnoPlayerId) => {
    const player = gameState.players.find((p) => p.id === playerId);
    applyState((state) => applyUnoDeclaration(state, playerId), `${player?.name ?? 'プレイヤー'} が「ウノ!」と言いました。`);
  }, [applyState, gameState.players]);

  const handleUnoPenalty = useCallback((playerId: UnoPlayerId) => {
    const player = gameState.players.find((p) => p.id === playerId);
    applyState((state) => applyUnoPenalty(state, playerId), `${player?.name ?? 'プレイヤー'} が言い忘れ! 2まい引きます。`);
  }, [applyState, gameState.players]);

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
          case 'penalty-uno':
            return applyUnoPenalty(prev, action.playerId);
        }
      });
      setMessage(`${actingPlayer.name} が考えました。`);
      setIsCpuThinking(false);
    }, 620);

    return () => clearTimeout(id);
  }, [gameState.currentPlayerId, gameState.pendingAction, gameState.status, gameState.turnCount, gameState.players]);

  const rankings = useMemo(() => {
    return [...gameState.players].sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      return (gameState.hands[a.id]?.length ?? 0) - (gameState.hands[b.id]?.length ?? 0);
    });
  }, [gameState.hands, gameState.players]);

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
            hands={gameState.hands}
            onRestart={handleRestart}
            onBackToSetup={onBackToSetup}
            onBackToHome={onBackToHome}
          />
        )}

        {gameState.status === 'playing' && (
          <>
            <TurnStatus
              player={currentPlayer}
              thinking={isCpuThinking}
              pendingDrawCount={gameState.pendingDrawCount}
              activeColor={gameState.activeColor}
              message={message}
              variant={gameState.variant}
            />

            <UnoTableView
              state={gameState}
              currentPlayer={currentPlayer}
              nextPlayerId={nextPlayerId}
              topCard={topCard}
              currentHand={currentHand}
              playableIds={new Set(playableCards.map((card) => card.id))}
              canAct={canHumanAct && !pending}
              isCpuThinking={isCpuThinking}
              message={message}
              onPlay={handlePlayCard}
              onDraw={handleDraw}
              onAcceptDraw={handleAcceptDraw}
            />

            {pending && (
              <PendingPanel
                state={gameState}
                onColorChoice={handleColorChoice}
                onSwapPick={handleSwapPick}
                onRouletteStep={handleRouletteStep}
                onUnoDeclare={handleUnoDeclare}
                onUnoPenalty={handleUnoPenalty}
              />
            )}

            <button
              onClick={() => setShowRules((show) => !show)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '11px 14px',
                borderRadius: 14,
                border: '1.5px solid var(--border)',
                background: '#faf8f4',
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
        : 'linear-gradient(135deg, #fff8e8, #fdf0d0)',
      color: variant === 'hard' ? '#fff5e8' : '#7a5010',
      border: `1.5px solid ${variant === 'hard' ? '#c33a30' : '#e8d070'}`,
      borderRadius: 15,
      padding: '11px 14px',
      marginBottom: 10,
      textAlign: 'center',
    }}>
      <div className={thinking ? 'cpu-thinking-pulse' : undefined} style={{ fontWeight: 900, fontSize: 14 }}>
        {player.isCpu ? 'CPU ' : ''}{player.name} の番です
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
  onRouletteStep,
  onUnoDeclare,
  onUnoPenalty,
}: {
  state: UnoGameState;
  onColorChoice: (color: UnoColor) => void;
  onSwapPick: (targetPlayerId: UnoPlayerId) => void;
  onRouletteStep: () => void;
  onUnoDeclare: (playerId: UnoPlayerId) => void;
  onUnoPenalty: (playerId: UnoPlayerId) => void;
}) {
  const pending = state.pendingAction;
  if (!pending) return null;

  if (pending.kind === 'color-pick') {
    const player = state.players.find((p) => p.id === pending.chooserPlayerId);
    return (
      <ActionPanel title={`${player?.name ?? 'プレイヤー'}、色をえらんでください`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {COLOR_BUTTONS.map(({ color, bg }) => (
            <button key={color} onClick={() => onColorChoice(color)} style={{
              border: '2px solid #fff',
              background: bg,
              color: color === 'yellow' ? '#3b2600' : '#fff',
              borderRadius: 13,
              padding: '12px 0',
              fontWeight: 900,
              cursor: 'pointer',
            }}>
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
        <div style={{ display: 'grid', gap: 8 }}>
          {state.players.filter((p) => p.id !== pending.swapperPlayerId && !p.isEliminated).map((target) => (
            <Button key={target.id} variant="secondary" onClick={() => onSwapPick(target.id)}>
              {target.name} とこうかん ({state.hands[target.id]?.length ?? 0}まい)
            </Button>
          ))}
        </div>
      </ActionPanel>
    );
  }

  if (pending.kind === 'color-roulette') {
    const target = state.players.find((p) => p.id === pending.targetPlayerId);
    return (
      <ActionPanel title="カラー ルーレット">
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 10 }}>
          {target?.name ?? '次の人'} が {UNO_COLOR_LABELS[pending.targetColor]} のカードを引くまで、1まいずつ引きます。
        </p>
        <Button fullWidth onClick={onRouletteStep}>
          1まい引く
        </Button>
      </ActionPanel>
    );
  }

  if (pending.kind === 'uno-window') {
    const player = state.players.find((p) => p.id === pending.playerWithOneCard);
    return (
      <ActionPanel title="ウノ!">
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 10 }}>
          {player?.name ?? 'プレイヤー'} の手札があと1まいです。言い忘れたら2まい引きます。
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <Button fullWidth onClick={() => onUnoDeclare(pending.playerWithOneCard)}>
            ウノ! と言う
          </Button>
          <Button fullWidth variant="secondary" onClick={() => onUnoPenalty(pending.playerWithOneCard)}>
            言い忘れを指摘する
          </Button>
        </div>
      </ActionPanel>
    );
  }

  return null;
}

function ActionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff8e8',
      border: '1.5px solid #e8c880',
      borderRadius: 18,
      padding: '15px 14px',
      margin: '12px 0',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h2 style={{ fontSize: 15, color: 'var(--brown)', marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}

function ResultPanel({
  winner,
  rankings,
  hands,
  onRestart,
  onBackToSetup,
  onBackToHome,
}: {
  winner: UnoPlayer | null;
  rankings: UnoPlayer[];
  hands: Record<UnoPlayerId, UnoCard[]>;
  onRestart: () => void;
  onBackToSetup: () => void;
  onBackToHome: () => void;
}) {
  return (
    <div className="result-appear" style={{
      background: 'linear-gradient(135deg, #fffbe8, #fdf1bd)',
      border: '2px solid #d8b030',
      borderRadius: 22,
      padding: '22px 18px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-md)',
      marginBottom: 16,
    }}>
      <div className="trophy-bounce" style={{ fontSize: 42 }}>🏆</div>
      <h2 style={{ fontSize: 20, color: 'var(--brown)', marginBottom: 12 }}>
        {winner ? `${winner.name} の勝ち!` : 'ゲーム終了'}
      </h2>
      <div style={{ display: 'grid', gap: 7, marginBottom: 16 }}>
        {rankings.map((player, index) => (
          <div key={player.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            background: index === 0 ? '#fff0b8' : '#fffdf8',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            padding: '8px 10px',
            fontSize: 13,
          }}>
            <strong>{index + 1}. {player.name}</strong>
            <span>{player.isEliminated ? 'アウト' : `${hands[player.id]?.length ?? 0}まい`}</span>
          </div>
        ))}
      </div>
      <div className="game-nav-buttons" style={{ marginTop: 0 }}>
        <Button fullWidth onClick={onRestart}>もう一度あそぶ</Button>
        <div className="game-nav-secondary">
          <Button fullWidth variant="secondary" onClick={onBackToSetup}>UNO設定へ戻る</Button>
          <Button fullWidth variant="secondary" onClick={onBackToHome}>ゲーム選択へ戻る</Button>
        </div>
      </div>
    </div>
  );
}
