import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BabanukiState } from './babanukiTypes';
import { CPU_THINK_MS } from './babanukiTypes';
import {
  activePlayers,
  canDeclareShuffle,
  createBabanukiRematchState,
  declareShuffle,
  drawCard,
  getPlayer,
  getRightNeighborId,
  reorderHand,
  resolveShuffle,
  setSpotlight,
} from './babanukiRules';
import { chooseCpuDraw, chooseSpotlight, getCpuDisplayName, shouldDeclareShuffle } from './babanukiCpu';
import { DICE_MS } from './babanukiPlayback';
import type { BabanukiRoomInfo, BabanukiRoomRow } from './babanukiOnline';
import { fetchRoom, pushState, subscribeRoom } from './babanukiOnline';
import { useBabanukiPlayback } from './useBabanukiPlayback';
import { BabanukiTable } from './BabanukiTable';
import { BabanukiFinale } from './BabanukiFinale';
import { DiceResultPanel } from './BabanukiShufflePanel';

const DOUBLE_TAP_MS = 320;

type Props = {
  room: BabanukiRoomInfo;
  onBackToRoom: () => void;
  onBackToHome: () => void;
};

export function BabanukiOnlineGame({ room, onBackToRoom, onBackToHome }: Props) {
  const [row, setRow] = useState<BabanukiRoomRow | null>(null);
  const rowRef = useRef<BabanukiRoomRow | null>(null);
  rowRef.current = row;
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void fetchRoom(room.roomCode).then((fresh) => {
      if (!cancelled && fresh) setRow((prev) => (prev && fresh.version < prev.version ? prev : fresh));
    });
    const unsubscribe = subscribeRoom(room.roomCode, (incoming) => {
      // 楽観的に進めた自分の書き込みより古い行は無視する
      setRow((prev) => (prev && incoming.version < prev.version ? prev : incoming));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.roomCode]);

  /**
   * 状態を進めて共有する。version が合わなければ最新を取り直す（先に書けた人が勝ち）。
   *
   * 書き込みは**直列につなぐ**。以前は書き込み中の操作を捨てていたが、それだと
   * 「並べ替えの書き込み中にCPUの手番が来た」ときにその手が消えて進行が止まる。
   * updater は実行時点の最新状態に対して走るので、順番待ちでも結果は正しい。
   */
  const applyAction = useCallback(
    (updater: (state: BabanukiState) => BabanukiState) => {
      writeChainRef.current = writeChainRef.current
        .then(async () => {
          const current = rowRef.current;
          if (!current) return;

          const next = updater(current.game_state);
          if (next === current.game_state) return;

          setRow({ ...current, game_state: next, version: current.version + 1 });
          const ok = await pushState(room.roomCode, next, current.version);
          if (!ok) {
            const fresh = await fetchRoom(room.roomCode);
            if (fresh) setRow(fresh);
          }
        })
        .catch(() => {
          // 通信に失敗しても次の操作は受け付ける（次のpushで整合が取れる）
        });
    },
    [room.roomCode],
  );

  if (!row) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9b48f', fontSize: 13 }}>
        <span className="cpu-thinking-pulse">盤を整えています…</span>
      </div>
    );
  }

  return (
    <OnlineBoard
      logic={row.game_state}
      viewerId={room.myPlayerId}
      isHost={room.myPlayerId === 'player-1'}
      applyAction={applyAction}
      onBackToRoom={onBackToRoom}
      onBackToHome={onBackToHome}
    />
  );
}

type BoardProps = {
  logic: BabanukiState;
  viewerId: string;
  isHost: boolean;
  applyAction: (updater: (state: BabanukiState) => BabanukiState) => void;
  onBackToRoom: () => void;
  onBackToHome: () => void;
};

function OnlineBoard({ logic, viewerId, isHost, applyAction, onBackToRoom, onBackToHome }: BoardProps) {
  const playback = useBabanukiPlayback(logic, viewerId);
  const { display, isAnimating } = playback;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hesitationIndex, setHesitationIndex] = useState<number | null>(null);
  const [drawCandidate, setDrawCandidate] = useState<number | null>(null);
  const drawCandidateRef = useRef<number | null>(null);
  const spotlightDecisionRef = useRef<string | null>(null);
  const lastTapRef = useRef<{ index: number; at: number } | null>(null);
  const previousPhaseRef = useRef(logic.phase);

  const viewer = logic.players.find((p) => p.id === viewerId) ?? logic.players[0];
  const drawTargetId = useMemo(
    () => (logic.phase === 'awaiting-draw' ? getRightNeighborId(logic, logic.currentPlayerId) : null),
    [logic],
  );
  const canDraw = !isAnimating && logic.phase === 'awaiting-draw' && logic.currentPlayerId === viewerId;

  // ホストが同じルームで再戦を始めたら、ゲスト側も前局の選択状態を捨てて新しい盤面へ移る。
  useEffect(() => {
    const previous = previousPhaseRef.current;
    previousPhaseRef.current = logic.phase;
    if (previous !== 'finished' || logic.phase === 'finished') return;
    lastTapRef.current = null;
    drawCandidateRef.current = null;
    spotlightDecisionRef.current = null;
    setSelectedIndex(null);
    setDrawCandidate(null);
    setHesitationIndex(null);
  }, [logic.phase]);

  /**
   * タイマーを張り直す条件。**`logic` そのものを依存に入れてはいけない。**
   * 手札の並べ替えやブラフのたびに状態が変わり、CPUの3秒タイマーが毎回
   * リセットされて進行が止まってしまう。局面が本当に変わったときだけ張り直す。
   */
  const turnKey = `${logic.currentPlayerId}:${logic.phase}:${logic.eventSeq}`;
  const logicRef = useRef(logic);
  logicRef.current = logic;

  // --- ここから下はホストだけが実行する（CPUの判断を1台に集約する） ---

  useEffect(() => {
    const snapshot = logicRef.current;
    if (!isHost || isAnimating || snapshot.phase !== 'awaiting-draw') return;
    const declarer = activePlayers(snapshot).find(
      (p) => p.isCpu && canDeclareShuffle(snapshot, p.id) && shouldDeclareShuffle(snapshot, p.id, p.cpuLevel),
    );
    if (!declarer) return;
    const timer = setTimeout(
      () => applyAction((s) => declareShuffle(s, declarer.id)),
      700 + Math.random() * 900,
    );
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating, isHost, applyAction]);

  useEffect(() => {
    if (!isHost || isAnimating || logicRef.current.phase !== 'rolling') return;
    const timer = setTimeout(() => applyAction((s) => resolveShuffle(s)), DICE_MS);
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating, isHost, applyAction]);

  // 引かれる側のCPUのブラフ（1ターンにつき1回だけ判断する）
  useEffect(() => {
    const snapshot = logicRef.current;
    if (!isHost || isAnimating || snapshot.phase !== 'awaiting-draw') return;
    const targetId = getRightNeighborId(snapshot, snapshot.currentPlayerId);
    if (!targetId) return;
    if (spotlightDecisionRef.current === turnKey) return;
    spotlightDecisionRef.current = turnKey;

    const target = getPlayer(snapshot, targetId);
    if (!target.isCpu || target.spotlightCardId !== null) return;
    const cardId = chooseSpotlight(snapshot, targetId, target.cpuLevel);
    if (cardId === null) return;
    applyAction((s) => setSpotlight(s, targetId, cardId));
  }, [turnKey, isAnimating, isHost, applyAction]);

  // CPUの手番。すぐには引かず、迷っているような間を置く。
  // この3秒が、ジョーカー持ちがシャッフルタイムを使うか考える時間になる。
  useEffect(() => {
    const snapshot = logicRef.current;
    if (!isHost || isAnimating || snapshot.phase !== 'awaiting-draw') return;
    if (!getPlayer(snapshot, snapshot.currentPlayerId).isCpu) return;
    const timer = setTimeout(() => {
      applyAction((s) => {
        if (s.phase !== 'awaiting-draw') return s;
        const current = getPlayer(s, s.currentPlayerId);
        if (!current.isCpu) return s;
        const index = chooseCpuDraw(s, s.currentPlayerId, current.cpuLevel);
        return index < 0 ? s : drawCard(s, index);
      });
    }, CPU_THINK_MS);
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating, isHost, applyAction]);

  // 迷っている見た目は各端末で描く（同期しない）
  useEffect(() => {
    const snapshot = logicRef.current;
    if (
      isAnimating ||
      snapshot.phase !== 'awaiting-draw' ||
      !getPlayer(snapshot, snapshot.currentPlayerId).isCpu ||
      !drawTargetId
    ) {
      setHesitationIndex(null);
      return;
    }
    const pick = () => {
      const size = getPlayer(logicRef.current, drawTargetId).hand.length;
      if (size > 0) setHesitationIndex(Math.floor(Math.random() * size));
    };
    pick();
    const timer = setInterval(pick, 620);
    return () => clearInterval(timer);
  }, [turnKey, isAnimating, drawTargetId]);

  // --- ここから下は各自の操作 ---

  // 誤タップ防止：1回目のタップは候補を選ぶだけ。判定は ref で同期的に行う
  const handleDraw = (index: number) => {
    if (!canDraw) return;
    setSelectedIndex(null);
    if (drawCandidateRef.current !== index) {
      drawCandidateRef.current = index;
      setDrawCandidate(index);
      return;
    }
    drawCandidateRef.current = null;
    setDrawCandidate(null);
    applyAction((s) => drawCard(s, index));
  };

  const confirmDraw = () => {
    if (!canDraw || drawCandidateRef.current === null) return;
    const index = drawCandidateRef.current;
    drawCandidateRef.current = null;
    setDrawCandidate(null);
    applyAction((s) => drawCard(s, index));
  };

  const cancelDrawCandidate = () => {
    drawCandidateRef.current = null;
    setDrawCandidate(null);
  };

  // 自分の番でなくなったら候補は消す
  useEffect(() => {
    if (!canDraw) cancelDrawCandidate();
  }, [canDraw]);

  // シングルタップ＝選択／移動、ダブルタップ＝ブラフ（飛び出し）の切り替え
  const handleSelectOwnCard = (index: number) => {
    if (isAnimating) return;
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.index === index && now - last.at < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      setSelectedIndex(null);
      const cardId = viewer.hand[index]?.id;
      if (cardId) applyAction((s) => setSpotlight(s, viewerId, cardId));
      return;
    }
    lastTapRef.current = { index, at: now };

    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    applyAction((s) => reorderHand(s, viewerId, selectedIndex, index));
    setSelectedIndex(null);
  };

  const clearBluff = () => {
    const cardId = viewer.spotlightCardId;
    if (!cardId || isAnimating) return;
    setSelectedIndex(null);
    applyAction((state) => setSpotlight(state, viewerId, cardId));
  };

  const currentPlayer = getPlayer(logic, logic.currentPlayerId);
  const currentName = currentPlayer.name || (currentPlayer.isCpu ? getCpuDisplayName(currentPlayer.cpuLevel) : 'プレイヤー');
  const pendingDeclarer = logic.pendingShuffle ? getPlayer(logic, logic.pendingShuffle.declarerId) : null;
  const pendingDeclarerName = pendingDeclarer
    ? pendingDeclarer.name || (pendingDeclarer.isCpu ? getCpuDisplayName(pendingDeclarer.cpuLevel) : 'プレイヤー')
    : '';
  const shuffleState: 'ready' | 'used' | 'locked' = !viewer.shuffleRight
    ? 'used'
    : activePlayers(logic).length <= 2
      ? 'locked'
      : 'ready';

  return (
    <div style={{ minHeight: '100vh', padding: '10px 12px 28px', color: '#e0d3b8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button
          type="button"
          className="btn"
          onClick={onBackToRoom}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
        >
          ← ルーム
        </button>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: '.2em', color: '#8a7a58' }}>BABANUKI ONLINE</span>
      </div>

      <div
        key={logic.currentPlayerId + logic.phase}
        className="turn-slide"
        style={{
          textAlign: 'center', padding: '7px 10px', marginBottom: 8, borderRadius: 8,
          background: logic.currentPlayerId === viewerId ? 'rgba(110,74,142,.28)' : 'rgba(40,32,26,.6)',
          border: `1px solid ${logic.currentPlayerId === viewerId ? 'rgba(160,100,210,.5)' : 'rgba(201,162,75,.22)'}`,
          fontSize: 13,
        }}
      >
        {logic.phase === 'finished'
          ? '決着'
          : logic.currentPlayerId === viewerId
            ? canDraw
              ? drawCandidate === null
                ? '👉 あなたの番：右隣の札をタップして選ぶ'
                : '👉 もう一度タップ、または下のボタンで引く'
              : 'あなたの番'
            : `${currentName} の番`}
      </div>

      <BabanukiTable
        state={display}
        viewerId={viewerId}
        drawTargetId={drawTargetId}
        canDraw={canDraw}
        selectedIndex={selectedIndex}
        onDrawCard={handleDraw}
        onSelectOwnCard={handleSelectOwnCard}
        flights={playback.flights}
        hidden={playback.hidden}
        pairFlashPlayerId={playback.pairFlashPlayerId}
        leavingPlayerId={playback.leavingPlayerId}
        hesitationIndex={hesitationIndex}
        drawCandidateIndex={drawCandidate}
        shuffleState={shuffleState}
        canShuffle={!isAnimating && canDeclareShuffle(logic, viewerId)}
        onShuffle={() => applyAction((s) => declareShuffle(s, viewerId))}
      />

      {/* 引く札の確認 */}
      {canDraw && drawCandidate !== null && (
        <div
          className="babanuki-window"
          style={{
            marginTop: 6, padding: '8px 10px', borderRadius: 10, textAlign: 'center',
            background: 'rgba(46,28,62,.72)', border: '1px solid rgba(160,100,210,.45)',
          }}
        >
          <div style={{ fontSize: 11, color: '#d8c79a', marginBottom: 6 }}>この札を引きますか？</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={confirmDraw}
              style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(200,140,240,.7)', background: 'linear-gradient(180deg,#5a3478,#3a2050)', color: '#f0dcff', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
            >
              この札を引く
            </button>
            <button
              type="button"
              className="btn"
              onClick={cancelDrawCandidate}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
            >
              選び直す
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, textAlign: 'center', fontSize: 11, color: '#9a8d75', minHeight: 40 }}>
        {selectedIndex === null ? (
          'タップで選ぶ → もう1枚タップでその位置へ移動　／　ダブルタップでブラフ'
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <span>移動先の札をタップ／同じ札をもう一度タップでブラフ</span>
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedIndex(null)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
            >
              選択解除
            </button>
          </div>
        )}
        {viewer.spotlightCardId && (
          <button
            type="button"
            className="btn"
            onClick={clearBluff}
            disabled={isAnimating}
            style={{ marginTop: 7, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(200,140,240,.55)', background: 'rgba(70,42,88,.82)', color: '#ead8f5', fontSize: 12, cursor: isAnimating ? 'default' : 'pointer' }}
          >
            ブラフを解除
          </button>
        )}
      </div>

      {logic.phase === 'rolling' && logic.pendingShuffle && (
        <DiceResultPanel
          dice={logic.pendingShuffle.dice}
          declarerName={pendingDeclarerName}
        />
      )}

      {logic.phase === 'finished' && !isAnimating && (
        <BabanukiFinale
          state={logic}
          viewerId={viewerId}
          onRestart={isHost ? () => applyAction((state) => createBabanukiRematchState(state)) : undefined}
          restartLabel="同じ設定で再戦"
          onChangeSettings={isHost ? onBackToRoom : undefined}
          waitingMessage={isHost ? undefined : 'ホストが再戦を選ぶと、このまま自動で次の対局が始まります。'}
          onBackToHome={onBackToHome}
        />
      )}
    </div>
  );
}
