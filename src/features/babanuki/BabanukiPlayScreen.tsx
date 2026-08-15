import { useEffect, useMemo, useRef, useState } from 'react';
import type { BabanukiConfig, BabanukiState } from './babanukiTypes';
import {
  activePlayers,
  canDeclareShuffle,
  createBabanukiRematchState,
  createInitialBabanukiState,
  declareShuffle,
  drawCard,
  getPlayer,
  getRightNeighborId,
  reorderHand,
  setSpotlight,
  resolveShuffle,
} from './babanukiRules';
import { chooseCpuDraw, chooseSpotlight, getCpuDisplayName, shouldDeclareShuffle } from './babanukiCpu';
import { DICE_MS } from './babanukiPlayback';
import { CPU_THINK_MS } from './babanukiTypes';
import { useBabanukiPlayback } from './useBabanukiPlayback';
import { BabanukiTable } from './BabanukiTable';
import { BabanukiFinale } from './BabanukiFinale';
import { DiceResultPanel } from './BabanukiShufflePanel';

const VIEWER_ID = 'player-1';
const DOUBLE_TAP_MS = 320;

type Props = {
  config: BabanukiConfig;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function BabanukiPlayScreen({ config, onBackToSetup, onBackToHome }: Props) {
  const [logic, setLogic] = useState<BabanukiState>(() => createInitialBabanukiState(config));
  const playback = useBabanukiPlayback(logic, VIEWER_ID);
  const { display, isAnimating } = playback;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hesitationIndex, setHesitationIndex] = useState<number | null>(null);
  const [drawCandidate, setDrawCandidate] = useState<number | null>(null);
  const drawCandidateRef = useRef<number | null>(null);
  const spotlightDecisionRef = useRef<string | null>(null);
  const lastTapRef = useRef<{ index: number; at: number } | null>(null);

  const viewer = logic.players.find((p) => p.id === VIEWER_ID) ?? logic.players[0];
  const drawTargetId = useMemo(
    () => (logic.phase === 'awaiting-draw' ? getRightNeighborId(logic, logic.currentPlayerId) : null),
    [logic],
  );
  const canDraw = !isAnimating && logic.phase === 'awaiting-draw' && logic.currentPlayerId === VIEWER_ID;

  /**
   * タイマーを張り直す条件。
   * **`logic` そのものを依存に入れてはいけない。** 手札の並べ替えやブラフのたびに
   * 状態オブジェクトが変わり、CPUの3秒タイマーが毎回リセットされて進行が止まる。
   * 局面が本当に変わったとき（手番・フェーズ・イベント）だけ張り直す。
   */
  const turnKey = `${logic.currentPlayerId}:${logic.phase}:${logic.eventSeq}`;
  const logicRef = useRef(logic);
  logicRef.current = logic;

  // CPUの割り込み宣言。CPUが引くまでの間に決める
  useEffect(() => {
    const current = logicRef.current;
    if (isAnimating || current.phase !== 'awaiting-draw') return;
    const declarer = activePlayers(current).find(
      (p) => p.isCpu && canDeclareShuffle(current, p.id) && shouldDeclareShuffle(current, p.id, p.cpuLevel),
    );
    if (!declarer) return;
    const timer = setTimeout(() => setLogic((s) => declareShuffle(s, declarer.id)), 700 + Math.random() * 900);
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating]);

  // サイコロ演出のあとに手札を動かす
  useEffect(() => {
    if (isAnimating || logicRef.current.phase !== 'rolling') return;
    const timer = setTimeout(() => setLogic((s) => resolveShuffle(s)), DICE_MS);
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating]);

  // 引かれる側のCPUがブラフを決める（1ターンにつき1回だけ判断する）
  useEffect(() => {
    const logic = logicRef.current;
    if (isAnimating || logic.phase !== 'awaiting-draw') return;
    const targetId = getRightNeighborId(logic, logic.currentPlayerId);
    if (!targetId) return;
    if (spotlightDecisionRef.current === turnKey) return;
    spotlightDecisionRef.current = turnKey;

    const target = getPlayer(logic, targetId);
    if (!target.isCpu || target.spotlightCardId !== null) return;
    const cardId = chooseSpotlight(logic, targetId, target.cpuLevel);
    if (cardId === null) return;
    setLogic((s) => setSpotlight(s, targetId, cardId));
  }, [turnKey, isAnimating]);

  // CPUの手番。すぐには引かず、迷っているような間を置く。
  // この3秒が、人間がシャッフルタイムを使うか考える時間になる。
  useEffect(() => {
    const snapshot = logicRef.current;
    if (isAnimating || snapshot.phase !== 'awaiting-draw') return;
    if (!getPlayer(snapshot, snapshot.currentPlayerId).isCpu) return;
    const timer = setTimeout(() => {
      setLogic((s) => {
        if (s.phase !== 'awaiting-draw') return s;
        const current = getPlayer(s, s.currentPlayerId);
        if (!current.isCpu) return s;
        const index = chooseCpuDraw(s, s.currentPlayerId, current.cpuLevel);
        return index < 0 ? s : drawCard(s, index);
      });
    }, CPU_THINK_MS);
    return () => clearTimeout(timer);
  }, [turnKey, isAnimating]);

  // 迷っている見た目：CPUが考えている間、狙う札が移り変わる
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

  // 誤タップ防止：1回目のタップは候補を選ぶだけ。同じ札をもう一度タップするか
  // 「この札を引く」を押したときに初めて引く。
  // 素早い2連続タップでも効くよう、判定は ref（同期的な値）で行う。
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
    setLogic((s) => drawCard(s, index));
  };

  const confirmDraw = () => {
    if (!canDraw || drawCandidateRef.current === null) return;
    const index = drawCandidateRef.current;
    drawCandidateRef.current = null;
    setDrawCandidate(null);
    setLogic((s) => drawCard(s, index));
  };

  const cancelDrawCandidate = () => {
    drawCandidateRef.current = null;
    setDrawCandidate(null);
  };

  // 自分の番でなくなったら候補は消す（次のターンに持ち越さない）
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
      if (cardId) setLogic((s) => setSpotlight(s, VIEWER_ID, cardId));
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
    setLogic((s) => reorderHand(s, VIEWER_ID, selectedIndex, index));
    setSelectedIndex(null);
  };

  const clearBluff = () => {
    const cardId = viewer.spotlightCardId;
    if (!cardId || isAnimating) return;
    setSelectedIndex(null);
    setLogic((state) => setSpotlight(state, VIEWER_ID, cardId));
  };

  const currentPlayer = getPlayer(logic, logic.currentPlayerId);
  const currentName = currentPlayer.name || (currentPlayer.isCpu ? getCpuDisplayName(currentPlayer.cpuLevel) : 'プレイヤー');
  const activeShuffleEvent = playback.activeEvent?.kind === 'shuffle' ? playback.activeEvent : null;
  const shufflePresentation = logic.pendingShuffle
    ? { ...logic.pendingShuffle, stage: 'dice' as const }
    : activeShuffleEvent
      ? { declarerId: activeShuffleEvent.declarerId, dice: activeShuffleEvent.dice, stage: 'moving' as const }
      : null;
  const shuffleDeclarer = shufflePresentation ? getPlayer(logic, shufflePresentation.declarerId) : null;
  const shuffleDeclarerName = shuffleDeclarer
    ? shuffleDeclarer.name || (shuffleDeclarer.isCpu ? getCpuDisplayName(shuffleDeclarer.cpuLevel) : 'プレイヤー')
    : '';
  const shuffleState: 'ready' | 'used' | 'locked' = !viewer.shuffleRight
    ? 'used'
    : activePlayers(logic).length <= 2
      ? 'locked'
      : 'ready';

  return (
    <div className="babanuki-game-screen" style={{ minHeight: '100vh', padding: '10px 12px 28px', color: '#e0d3b8' }}>
      <div className="babanuki-top-nav">
        <button
          type="button"
          className="btn"
          onClick={onBackToSetup}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
        >
          ゲーム設定に戻る
        </button>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: '.2em', color: '#8a7a58' }}>BABANUKI</span>
        <button
          type="button"
          className="btn babanuki-home-button"
          onClick={onBackToHome}
        >
          ゲーム選択に戻る
        </button>
      </div>

      {/* 手番バナー */}
      <div
        key={logic.currentPlayerId + logic.phase}
        className="turn-slide"
        style={{
          textAlign: 'center', padding: '7px 10px', marginBottom: 8, borderRadius: 8,
          background: logic.currentPlayerId === VIEWER_ID ? 'rgba(110,74,142,.28)' : 'rgba(40,32,26,.6)',
          border: `1px solid ${logic.currentPlayerId === VIEWER_ID ? 'rgba(160,100,210,.5)' : 'rgba(201,162,75,.22)'}`,
          fontSize: 13,
        }}
      >
        {logic.phase === 'finished'
          ? '決着'
          : logic.currentPlayerId === VIEWER_ID
            ? canDraw
              ? drawCandidate === null
                ? '👉 あなたの番：右隣の札をタップして選ぶ'
                : '👉 もう一度タップ、または下のボタンで引く'
              : 'あなたの番'
            : `${currentName} の番`}
      </div>

      <BabanukiTable
        state={display}
        viewerId={VIEWER_ID}
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
        canShuffle={!isAnimating && canDeclareShuffle(logic, VIEWER_ID)}
        onShuffle={() => setLogic((s) => declareShuffle(s, VIEWER_ID))}
        shuffleDice={shufflePresentation?.stage === 'moving' ? shufflePresentation.dice : null}
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

      {/* 手札の操作 */}
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

      {shufflePresentation && (
        <DiceResultPanel
          dice={shufflePresentation.dice}
          declarerName={shuffleDeclarerName}
          stage={shufflePresentation.stage}
        />
      )}

      {logic.phase === 'finished' && !isAnimating && (
        <BabanukiFinale
          state={logic}
          viewerId={VIEWER_ID}
          onRestart={() => {
            setSelectedIndex(null);
            setLogic((state) => createBabanukiRematchState(state));
          }}
          onChangeSettings={onBackToSetup}
          onBackToSetup={onBackToSetup}
          onBackToHome={onBackToHome}
        />
      )}
    </div>
  );
}
