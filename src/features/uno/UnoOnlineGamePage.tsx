import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import type { UnoCard, UnoColor, UnoCpuLevel, UnoGameState, UnoPlayerConfig, UnoPlayerId, UnoVariant } from './unoTypes';
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
  sanitizeUnoStateForVariant,
} from './unoRules';
import { chooseUnoCpuAction, getUnoCpuDisplayName, getUnoCpuLevelLabel } from './unoCpu';
import { getUnoCardName, UNO_COLOR_LABELS } from './unoCardMeta';
import { UnoTableView } from './UnoTableView';
import { PendingPanel, StarterDecisionPanel } from './UnoGamePage';
import { UnoRulesPanel } from './UnoRulesPanel';
import { createInitialUnoState } from './createInitialUnoState';
import { UnoCinematicOverlay } from './UnoCinematicOverlay';
import { useUnoCinematics } from './useUnoCinematics';
import {
  canApplyUnoOnlineAction,
  countUnoJoined,
  getUnoGuestFieldByPlayerIndex,
  getUnoSlotValue,
  getUnoOnlinePlayerId,
  isUnoRoomReady,
  UNO_CPU_LEVELS,
  UNO_GUEST_FIELDS,
  type UnoRoomRow,
} from './unoOnline';
import { getUnoRankings } from './unoScoring';
import { GameEndActions } from '../../components/GameEndActions';

type UnoOnlineGamePageProps = {
  roomCode: string;
  myPlayerId: UnoPlayerId;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

const UNO_ROOM_SELECT = 'game_state, version, host_id, variant, player_count, guest_id, guest2_id, guest3_id, guest4_id, guest5_id, guest6_id, guest7_id, guest8_id, guest9_id';

export function UnoOnlineGamePage({ roomCode, myPlayerId, onBackToSetup, onBackToHome }: UnoOnlineGamePageProps) {
  const [gameState, setGameState] = useState<UnoGameState | null>(null);
  const [roomRow, setRoomRow] = useState<UnoRoomRow | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);
  const [isHostClient, setIsHostClient] = useState(myPlayerId === 'player-1');
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [message, setMessage] = useState('オンラインルームを読み込み中です。');
  const [rematchVariant, setRematchVariant] = useState<UnoVariant>('standard');
  const [rematchPlayerCount, setRematchPlayerCount] = useState(2);
  const [rematchPlayers, setRematchPlayers] = useState<UnoPlayerConfig[]>([]);
  const [rematchSeedGameId, setRematchSeedGameId] = useState<string | null>(null);

  const stateRef = useRef<UnoGameState | null>(null);
  const rowRef = useRef<UnoRoomRow | null>(null);
  const versionRef = useRef(0);
  const writingRef = useRef(false);
  stateRef.current = gameState;
  rowRef.current = roomRow;
  versionRef.current = roomVersion;
  writingRef.current = isWriting;
  const { activeEvent: cinematicEvent, isBlocking: isCinematicBlocking } = useUnoCinematics(gameState);

  const fetchLatest = useCallback(async (nextMessage?: string) => {
    const { data, error } = await supabase
      .from('uno_rooms')
      .select(UNO_ROOM_SELECT)
      .eq('room_code', roomCode)
      .single();

    if (error || !data?.game_state) {
      setMessage('ルームの気配が途絶えた…。');
      setLoading(false);
      return;
    }

    const row = data as UnoRoomRow;
    const cleanState = sanitizeUnoStateForVariant(row.game_state as UnoGameState);
    setRoomRow(row);
    setGameState(cleanState);
    setRoomVersion(row.version);
    setIsHostClient(row.host_id === getUnoOnlinePlayerId() || myPlayerId === 'player-1');
    if (nextMessage) setMessage(nextMessage);
    setLoading(false);
  }, [myPlayerId, roomCode]);

  const updateRemoteState = useCallback(async (
    updater: (state: UnoGameState) => UnoGameState,
    nextMessage?: string,
  ) => {
    const current = stateRef.current;
    const version = versionRef.current;
    if (!current || writingRef.current) return;

    const next = updater(current);
    if (next === current) return;

    setIsWriting(true);
    const { data, error } = await supabase
      .from('uno_rooms')
      .update({
        game_state: next,
        version: version + 1,
      })
      .eq('room_code', roomCode)
      .eq('version', version)
      .select(UNO_ROOM_SELECT)
      .maybeSingle();

    if (error || !data) {
      await fetchLatest('ほかの操作が先に反映されました。最新状態に更新しました。');
      setIsWriting(false);
      return;
    }

    const row = data as UnoRoomRow;
    const cleanState = sanitizeUnoStateForVariant(row.game_state as UnoGameState);
    setRoomRow(row);
    setGameState(cleanState);
    setRoomVersion(row.version);
    if (nextMessage) setMessage(nextMessage);
    setIsWriting(false);
  }, [fetchLatest, roomCode]);

  useEffect(() => {
    let cancelled = false;

    void fetchLatest();

    const channel = supabase
      .channel(`uno-online-game-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'uno_rooms', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as UnoRoomRow;
          if ((row.version ?? 0) < versionRef.current) return;
          const cleanState = sanitizeUnoStateForVariant(row.game_state as UnoGameState);
          setRoomRow(row);
          setGameState(cleanState);
          setRoomVersion(row.version);
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !cancelled) await fetchLatest();
      });

    const poll = setInterval(() => { void fetchLatest(); }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [fetchLatest, roomCode]);

  const currentPlayer = gameState?.players.find((player) => player.id === gameState.currentPlayerId);
  const myPlayer = gameState?.players.find((player) => player.id === myPlayerId);
  const topCard = gameState?.discardPile[0] ?? null;
  const nextPlayerId = useMemo(() => (gameState ? getNextPlayerId(gameState) : myPlayerId), [gameState, myPlayerId]);
  const myHand = gameState?.hands[myPlayerId] ?? [];
  const playableCards = gameState ? getPlayableCards(gameState, myPlayerId) : [];
  const canTakeTurn = !!gameState && canApplyUnoOnlineAction(gameState, myPlayerId, 'turn') && !isWriting && !isCpuThinking && !isCinematicBlocking;
  const winner = gameState?.winnerPlayerId ? gameState.players.find((player) => player.id === gameState.winnerPlayerId) : null;
  const rankings = gameState ? getUnoRankings(gameState) : [];

  useEffect(() => {
    if (gameState?.status !== 'finished') return;
    if (rematchSeedGameId === gameState.gameId) return;
    setRematchVariant(gameState.variant);
    setRematchPlayerCount(gameState.players.length);
    setRematchPlayers(gameState.players.map((player) => ({
      name: player.name,
      isCpu: player.isCpu,
      cpuLevel: player.cpuLevel ?? 'normal',
    })));
    setRematchSeedGameId(gameState.gameId);
  }, [gameState, rematchSeedGameId]);

  const updateRematchPlayer = useCallback((index: number, patch: Partial<UnoPlayerConfig>) => {
    setRematchPlayers((players) => {
      const next = [...players];
      const current = next[index] ?? {
        name: index === 0 ? 'ホスト' : getUnoCpuDisplayName('normal'),
        isCpu: index !== 0,
        cpuLevel: 'normal' as UnoCpuLevel,
      };
      next[index] = { ...current, ...patch };
      return next;
    });
  }, []);

  const handleRematch = useCallback(() => {
    const row = rowRef.current;
    if (!gameState || !row || !isHostClient || isWriting) return;
    if (rematchVariant === 'hard' && rematchPlayerCount > 6) return;

    const playerConfigs = Array.from({ length: rematchPlayerCount }, (_, index) => {
      const fallback: UnoPlayerConfig = {
        name: index === 0 ? gameState.players[0]?.name ?? 'ホスト' : getUnoCpuDisplayName('normal'),
        isCpu: index !== 0,
        cpuLevel: 'normal',
      };
      const config = rematchPlayers[index] ?? fallback;
      return {
        name: config.name.trim() || fallback.name,
        isCpu: index === 0 ? false : config.isCpu,
        cpuLevel: config.cpuLevel ?? 'normal',
      };
    });

    const guestUpdates: Partial<UnoRoomRow> = {};
    for (const field of UNO_GUEST_FIELDS) guestUpdates[field] = null;
    for (let index = 1; index < rematchPlayerCount; index++) {
      const field = getUnoGuestFieldByPlayerIndex(index);
      if (!field) continue;
      const existingSlot = getUnoSlotValue(row, index);
      guestUpdates[field] = playerConfigs[index]?.isCpu
        ? `cpu-player-${index + 1}`
        : existingSlot && !existingSlot.startsWith('cpu-player-')
          ? existingSlot
          : null;
    }

    const next = createInitialUnoState({ variant: rematchVariant, playerConfigs });
    const version = versionRef.current;
    setIsWriting(true);
    void supabase
      .from('uno_rooms')
      .update({
        ...guestUpdates,
        variant: rematchVariant,
        player_count: rematchPlayerCount,
        game_state: next,
        version: version + 1,
      })
      .eq('room_code', roomCode)
      .eq('version', version)
      .select(UNO_ROOM_SELECT)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) {
          await fetchLatest('ほかの操作が先に反映されました。最新状態に更新しました。');
          setIsWriting(false);
          return;
        }
        const nextRow = data as UnoRoomRow;
        setRoomRow(nextRow);
        setGameState(nextRow.game_state as UnoGameState);
        setRoomVersion(nextRow.version);
        setMessage(isUnoRoomReady(nextRow) ? '同じルームで新しいUNOを始めます。' : '人間プレイヤーの参加を待っています。');
        setIsWriting(false);
      });
  }, [
    fetchLatest,
    gameState,
    isHostClient,
    isWriting,
    rematchPlayerCount,
    rematchPlayers,
    rematchVariant,
    roomCode,
  ]);

  const handlePlayCard = useCallback((card: UnoCard) => {
    if (!gameState || !canTakeTurn) return;
    if (!canPlayCard(gameState, card)) return;
    void updateRemoteState(
      (state) => applyPlayCard(state, card.id),
      `${myPlayer?.name ?? 'あなた'} が ${getUnoCardName(card)} を出しました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleDraw = useCallback(() => {
    if (!gameState || !canTakeTurn) return;
    void updateRemoteState(
      (state) => applyDrawCard(state),
      `${myPlayer?.name ?? 'あなた'} が山札から1まい引きました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handlePassDrawnCard = useCallback(() => {
    if (!gameState || !canTakeTurn) return;
    void updateRemoteState(
      (state) => applyPassDrawnCard(state),
      `${myPlayer?.name ?? 'あなた'} は引いたカードを出さずに進めました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleDecideStarter = useCallback(() => {
    if (!gameState || !isHostClient || isWriting) return;
    void updateRemoteState((state) => applyStarterDraw(state), '引いたカードを確認してください。');
  }, [gameState, isHostClient, isWriting, updateRemoteState]);

  const handleStartGame = useCallback(() => {
    if (!gameState || !isHostClient || isWriting) return;
    const starterName = gameState.players.find((player) => player.id === gameState.currentPlayerId)?.name ?? 'スタートプレイヤー';
    void updateRemoteState((state) => applyStartGame(state), `${starterName} から始めます。`);
  }, [gameState, isHostClient, isWriting, updateRemoteState]);

  const handleAcceptDraw = useCallback(() => {
    if (!gameState || !canTakeTurn || gameState.pendingDrawCount <= 0) return;
    const count = gameState.pendingDrawCount;
    void updateRemoteState(
      (state) => applyAcceptDraw(state),
      `${myPlayer?.name ?? 'あなた'} が${count}まい引きました。`,
    );
  }, [canTakeTurn, gameState, myPlayer?.name, updateRemoteState]);

  const handleColorChoice = useCallback((color: UnoColor) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'color-pick')) return;
    void updateRemoteState((state) => applyColorChoice(state, color), `${UNO_COLOR_LABELS[color]}をえらびました。`);
  }, [gameState, myPlayerId, updateRemoteState]);

  const handleSwapPick = useCallback((targetPlayerId: UnoPlayerId) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'swap-pick')) return;
    const target = gameState.players.find((player) => player.id === targetPlayerId);
    void updateRemoteState((state) => applySwapPick(state, targetPlayerId), `${target?.name ?? '相手'} と手札をこうかんしました。`);
  }, [gameState, myPlayerId, updateRemoteState]);

  const handleUnoDeclare = useCallback((playerId: UnoPlayerId) => {
    if (!gameState || !canApplyUnoOnlineAction(gameState, myPlayerId, 'uno-declare')) return;
    void updateRemoteState((state) => applyUnoDeclaration(state, playerId), 'ウノ! と言いました。');
  }, [gameState, myPlayerId, updateRemoteState]);

  useEffect(() => {
    if (isCinematicBlocking) {
      setIsCpuThinking(false);
      return;
    }
    if (!gameState || !isHostClient || isWriting || gameState.status !== 'playing') {
      setIsCpuThinking(false);
      return;
    }

    const pending = gameState.pendingAction;
    if (pending?.kind === 'color-roulette') {
      setIsCpuThinking(true);
      const id = setTimeout(() => {
        void updateRemoteState((state) => applyColorRouletteStep(state), 'カラー ルーレット中...');
        setIsCpuThinking(false);
      }, 520);
      return () => clearTimeout(id);
    }

    const actingPlayerId =
      pending?.kind === 'color-pick' ? pending.chooserPlayerId
      : pending?.kind === 'swap-pick' ? pending.swapperPlayerId
      : pending?.kind === 'uno-window' ? pending.playerWithOneCard
      : gameState.currentPlayerId;
    const actingPlayer = gameState.players.find((player) => player.id === actingPlayerId);
    if (!actingPlayer?.isCpu) {
      setIsCpuThinking(false);
      return;
    }

    setIsCpuThinking(true);
    const id = setTimeout(() => {
      const state = stateRef.current;
      if (!state) {
        setIsCpuThinking(false);
        return;
      }
      const action = chooseUnoCpuAction(state, actingPlayer.id, actingPlayer.cpuLevel ?? 'normal');
      if (!action) {
        setIsCpuThinking(false);
        return;
      }

      void updateRemoteState((prev) => {
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
      }, `${actingPlayer.name} が考えました。`);
      setIsCpuThinking(false);
    }, 760);

    return () => clearTimeout(id);
  }, [gameState, isCinematicBlocking, isHostClient, isWriting, updateRemoteState]);

  if (loading) {
    return (
      <Layout>
        <div className="cpu-thinking-pulse" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          UNOルームを読み込み中...
        </div>
      </Layout>
    );
  }

  if (!gameState || !currentPlayer || !myPlayer || !topCard) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>ルームの気配が途絶えた…。</p>
          <Button onClick={onBackToHome}>ゲーム選択に戻る</Button>
        </div>
      </Layout>
    );
  }

  if (roomRow && !isUnoRoomReady(roomRow)) {
    return (
      <Layout>
        <div style={{ padding: '36px 20px' }}>
          <UnoOnlineWaitingPanel
            roomCode={roomCode}
            joinedCount={countUnoJoined(roomRow)}
            playerCount={roomRow.player_count}
            onBackToHome={onBackToHome}
          />
        </div>
      </Layout>
    );
  }

  if (gameState.status === 'finished') {
    return (
      <Layout>
        <UnoCinematicOverlay event={cinematicEvent} />
        <div style={{ paddingTop: 32, paddingBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>WIN</div>
          <h1 style={{ fontSize: 22, color: 'var(--brown)', marginBottom: 12 }}>
            {winner ? `${winner.name} の勝ち!` : 'ゲーム終了'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            ルーム: <strong style={{ fontFamily: 'monospace' }}>{roomCode}</strong>
          </p>
          <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
            {rankings.map((entry, index) => (
              <div key={entry.player.id} className="rank-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                background: index === 0 ? 'rgba(230,200,119,.25)' : '#1d1723',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                padding: '9px 10px',
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
          <div style={{ display: 'grid', gap: 10 }}>
            {isHostClient ? (
              <RematchSettingsPanel
                variant={rematchVariant}
                playerCount={rematchPlayerCount}
                players={rematchPlayers}
                roomRow={roomRow}
                isWriting={isWriting}
                onVariantChange={(variant) => {
                  setRematchVariant(variant);
                  if (variant === 'hard' && rematchPlayerCount > 6) setRematchPlayerCount(6);
                }}
                onPlayerCountChange={(count) => {
                  const nextCount = rematchVariant === 'hard' ? Math.min(count, 6) : count;
                  setRematchPlayerCount(nextCount);
                  setRematchPlayers((players) => {
                    const next = [...players];
                    for (let i = next.length; i < nextCount; i++) {
                      next[i] = { name: getUnoCpuDisplayName('normal'), isCpu: true, cpuLevel: 'normal' };
                    }
                    return next;
                  });
                }}
                onPlayerChange={updateRematchPlayer}
                onStart={handleRematch}
              />
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
                ルームの主が「もう一度遊ぶ」を押すと、このまま新しいゲームに切り替わります。
              </p>
            )}
            <GameEndActions
              onRematch={isHostClient ? handleRematch : undefined}
              onChangeSettings={onBackToSetup}
              onBackToSetup={onBackToSetup}
              onBackToHome={onBackToHome}
              canRematch={isHostClient}
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <UnoCinematicOverlay event={cinematicEvent} />
      <div style={{ paddingTop: 'var(--game-page-pt)', paddingBottom: 'var(--game-page-pb)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, color: 'var(--brown)', marginBottom: 3 }}>
            {gameState.variant === 'hard' ? 'ハード版 UNO オンライン' : '通常版 UNO オンライン'}
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            ルーム: <strong>{roomCode}</strong> / あなた: {myPlayer.name} / v{roomVersion}
          </div>
        </div>

        <div style={{
          background: gameState.status === 'deciding-starter' ? '#fff8df' : canTakeTurn ? 'rgba(138,111,58,.14)' : 'rgba(255,255,255,.06)',
          color: canTakeTurn ? '#2e7d32' : 'var(--text-muted)',
          border: `1.5px solid ${canTakeTurn ? '#9ac99b' : 'var(--border)'}`,
          borderRadius: 15,
          padding: '10px 14px',
          marginBottom: 10,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 900,
        }}>
          {gameState.status === 'deciding-starter'
            ? 'スタートプレイヤーを決めます'
            : canTakeTurn ? '⚔ そなたの番' : `${currentPlayer.name} の番…`}
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700 }}>
            {isCpuThinking ? 'CPU思考中...' : isWriting ? '同期中...' : message}
          </div>
        </div>

        <UnoTableView
          state={gameState}
          currentPlayer={currentPlayer}
          nextPlayerId={nextPlayerId}
          topCard={topCard}
          currentHand={myHand}
          handPlayer={myPlayer}
          playableIds={new Set(playableCards.map((card) => card.id))}
          canAct={canTakeTurn}
          isCpuThinking={isCpuThinking}
          message={message}
          viewPlayerId={myPlayerId}
          pendingOverlay={gameState.status === 'deciding-starter' || gameState.status === 'starter-ready' ? (
            <StarterDecisionPanel
              state={gameState}
              onDecideStarter={handleDecideStarter}
              onStartGame={handleStartGame}
              hostOnly
              canDecide={isHostClient && !isWriting}
            />
          ) : gameState.pendingAction ? (
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

        <div style={{ marginTop: 14 }}>
          <Button variant="ghost" fullWidth onClick={onBackToHome}>ゲーム選択に戻る</Button>
        </div>
      </div>
    </Layout>
  );
}

function UnoOnlineWaitingPanel({
  roomCode,
  joinedCount,
  playerCount,
  onBackToHome,
}: {
  roomCode: string;
  joinedCount: number;
  playerCount: number;
  onBackToHome: () => void;
}) {
  const [copyMessage, setCopyMessage] = useState('');

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyMessage('コピーしました');
    } catch {
      setCopyMessage('コピーできませんでした。コードを選んでコピーしてください。');
    }
  }

  return (
    <div className="uno-rematch-panel" style={{ textAlign: 'center' }}>
      <strong>参加待ちです</strong>
      <span>人間プレイヤーにこのコードを送って、ルームに参加してもらってください。</span>
      <div className="uno-room-code-card">
        <span>{roomCode}</span>
        <button type="button" onClick={copyRoomCode}>コードをコピー</button>
      </div>
      {copyMessage && <small>{copyMessage}</small>}
      <span>{joinedCount} / {playerCount} 人参加済み</span>
      <Button variant="ghost" fullWidth onClick={onBackToHome}>ゲーム選択に戻る</Button>
    </div>
  );
}

function RematchSettingsPanel({
  variant,
  playerCount,
  players,
  roomRow,
  isWriting,
  onVariantChange,
  onPlayerCountChange,
  onPlayerChange,
  onStart,
}: {
  variant: UnoVariant;
  playerCount: number;
  players: UnoPlayerConfig[];
  roomRow: UnoRoomRow | null;
  isWriting: boolean;
  onVariantChange: (variant: UnoVariant) => void;
  onPlayerCountChange: (count: number) => void;
  onPlayerChange: (index: number, patch: Partial<UnoPlayerConfig>) => void;
  onStart: () => void;
}) {
  const maxPlayers = variant === 'hard' ? 6 : 10;
  const activePlayers = Array.from({ length: playerCount }, (_, index) => {
    const fallback: UnoPlayerConfig = {
      name: index === 0 ? 'ホスト' : getUnoCpuDisplayName('normal'),
      isCpu: index !== 0,
      cpuLevel: 'normal',
    };
    return players[index] ?? fallback;
  });

  return (
    <div className="uno-rematch-panel">
      <strong>同じルームで設定して再戦</strong>
      <span>人数とCPUを選び直してから始めます。新しい対戦も、開始前にカードを引いて先手を決めます。</span>

      <div className="uno-rematch-options">
        <button type="button" onClick={() => onVariantChange('standard')} disabled={isWriting} className={variant === 'standard' ? 'is-selected' : ''}>
          通常版
        </button>
        <button type="button" onClick={() => onVariantChange('hard')} disabled={isWriting} className={variant === 'hard' ? 'is-selected' : ''}>
          ハード版
        </button>
      </div>

      <div className="uno-rematch-count-grid" aria-label="人数選択">
        {Array.from({ length: maxPlayers - 1 }, (_, index) => index + 2).map((count) => (
          <button
            key={count}
            type="button"
            className={playerCount === count ? 'is-selected' : ''}
            onClick={() => onPlayerCountChange(count)}
            disabled={isWriting}
          >
            {count}人
          </button>
        ))}
      </div>

      <div className="uno-rematch-player-list">
        {activePlayers.map((player, index) => {
          const slotValue = getUnoSlotValue(roomRow ?? {}, index);
          const humanJoined = index === 0 || (!!slotValue && !slotValue.startsWith('cpu-player-'));
          const cpuLevel = player.cpuLevel ?? 'normal';
          return (
            <div key={index} className="uno-rematch-player-row">
              <div className="uno-rematch-player-head">
                <strong>プレイヤー{index + 1}</strong>
                <span>{index === 0 ? 'ルームの主' : humanJoined ? '参加済み' : player.isCpu ? 'CPU' : '未参加'}</span>
              </div>
              <input
                value={player.name}
                onChange={(event) => onPlayerChange(index, { name: event.target.value })}
                placeholder={index === 0 ? 'ホスト' : player.isCpu ? getUnoCpuDisplayName(cpuLevel) : `プレイヤー${index + 1}`}
                disabled={isWriting}
              />
              {index > 0 && (
                <div className="uno-rematch-toggle">
                  <button
                    type="button"
                    className={!player.isCpu ? 'is-selected' : ''}
                    onClick={() => onPlayerChange(index, { isCpu: false })}
                    disabled={isWriting}
                  >
                    人間
                  </button>
                  <button
                    type="button"
                    className={player.isCpu ? 'is-selected' : ''}
                    onClick={() => onPlayerChange(index, { isCpu: true, name: player.name || getUnoCpuDisplayName(cpuLevel) })}
                    disabled={isWriting}
                  >
                    CPU
                  </button>
                </div>
              )}
              {player.isCpu && index > 0 && (
                <div className="uno-rematch-level-grid">
                  {UNO_CPU_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={cpuLevel === level ? 'is-selected' : ''}
                      onClick={() => onPlayerChange(index, { cpuLevel: level, name: getUnoCpuDisplayName(level) })}
                      disabled={isWriting}
                    >
                      {getUnoCpuLevelLabel(level).replace(/^[^ ]+ /, '')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="uno-rematch-start-button" onClick={onStart} disabled={isWriting}>
        この設定で再戦
      </button>
    </div>
  );
}
