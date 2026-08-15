import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BabanukiPlayer, BabanukiState, Card } from './babanukiTypes';
import { isJoker } from './babanukiTypes';
import { getCpuDisplayName } from './babanukiCpu';

/**
 * 盤面の描画とカードの飛行アニメーション。
 *
 * 座標の取り方はマンカラの石アニメ（MancalaBoard.tsx）と同じ考え方:
 * スロットの DOM を登録しておき、飛ばすときに両端の矩形を測って
 * position:fixed の要素を double-RAF ＋ CSS transition で移動させる。
 */

export type Flight = {
  id: string;
  fromKey: string;
  toKey: string;
  card: Card | null;
  faceUp: boolean;
  durationMs: number;
  /** 手札まるごと飛ばすときの見た目の枚数 */
  stack?: number;
  delayMs?: number;
};

type Props = {
  state: BabanukiState;
  viewerId: string;
  drawTargetId: string | null;
  canDraw: boolean;
  selectedIndex: number | null;
  onDrawCard: (index: number) => void;
  onSelectOwnCard: (index: number) => void;
  flights: Flight[];
  /** 飛行中のため、元の位置では見えなくするカード */
  hidden: string[];
  pairFlashPlayerId: string | null;
  leavingPlayerId: string | null;
  /** CPUが迷っている間、狙われている札（引く相手の手札の位置） */
  hesitationIndex?: number | null;
  /** 引く候補として選んでいる札。もう一度タップするか確認ボタンで確定する */
  drawCandidateIndex?: number | null;
  /**
   * シャッフルボタンの状態。
   * ready = まだ権利がある（黄色）/ used = 使用済み（グレー）/ locked = 残り2名で消滅（グレー）
   */
  shuffleState: 'ready' | 'used' | 'locked';
  /** 今この瞬間に押せるか（ジョーカー保持・このターン未使用・アニメ中でない） */
  canShuffle: boolean;
  onShuffle: () => void;
};

const SUIT_MARK: Record<string, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
  joker: '🃏',
};

function rankLabel(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

function isRed(card: Card): boolean {
  return card.suit === 'heart' || card.suit === 'diamond';
}

// ---------------------------------------------------------------- カード

function CardFace({ card, width, height }: { card: Card; width: number; height: number }) {
  if (isJoker(card)) {
    return (
      <div
        style={{
          width, height, borderRadius: 6,
          background: 'linear-gradient(160deg,#2a1836,#4a2a5e 60%,#1d1226)',
          border: '1px solid #8a5cb0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(height * 0.42),
          boxShadow: 'inset 0 0 10px rgba(0,0,0,.6)',
        }}
      >
        🃏
      </div>
    );
  }
  return (
    <div
      style={{
        width, height, borderRadius: 6,
        background: 'linear-gradient(165deg,#f6eeda,#dccdae)',
        border: '1px solid #b9a67c',
        color: isRed(card) ? '#a02a2a' : '#2a2420',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
        boxShadow: '0 2px 6px rgba(0,0,0,.45)',
      }}
    >
      <span style={{ fontSize: Math.round(height * 0.3), fontWeight: 'bold' }}>{rankLabel(card.rank)}</span>
      <span style={{ fontSize: Math.round(height * 0.26) }}>{SUIT_MARK[card.suit]}</span>
    </div>
  );
}

function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        width, height, borderRadius: 6,
        background:
          'repeating-linear-gradient(135deg,#3a2350 0 4px,#2a1a3c 4px 8px)',
        border: '1px solid #6f4a8e',
        boxShadow: 'inset 0 0 8px rgba(0,0,0,.55), 0 2px 5px rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(height * 0.34),
        opacity: 0.95,
      }}
    >
      <span style={{ opacity: 0.5 }}>🐉</span>
    </div>
  );
}

// ---------------------------------------------------------------- 飛行体

function FlyingCard({
  flight,
  from,
  to,
}: {
  flight: Flight;
  from: DOMRect;
  to: DOMRect;
}) {
  const [atTarget, setAtTarget] = useState(false);

  useEffect(() => {
    // double-RAF: 開始位置を1度描いてから目標位置を代入して transition を発火させる
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAtTarget(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const width = 34;
  const height = 48;
  const start = { left: from.left + from.width / 2 - width / 2, top: from.top + from.height / 2 - height / 2 };
  const end = { left: to.left + to.width / 2 - width / 2, top: to.top + to.height / 2 - height / 2 };
  const pos = atTarget ? end : start;
  const stack = flight.stack ?? 1;

  return (
    <div
      className="babanuki-flying"
      style={{
        left: pos.left,
        top: pos.top,
        transition: `left ${flight.durationMs}ms cubic-bezier(.35,.05,.25,1), top ${flight.durationMs}ms cubic-bezier(.35,.05,.25,1), transform ${flight.durationMs}ms ease`,
        transitionDelay: `${flight.delayMs ?? 0}ms`,
        transform: atTarget ? 'rotate(0deg) scale(1)' : 'rotate(-8deg) scale(1.06)',
      }}
    >
      <div style={{ position: 'relative', width, height }}>
        {Array.from({ length: Math.min(stack, 3) }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: i * 3, top: -i * 3 }}>
            {flight.faceUp && flight.card ? (
              <CardFace card={flight.card} width={width} height={height} />
            ) : (
              <CardBack width={width} height={height} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 本体

export function BabanukiTable({
  state,
  viewerId,
  drawTargetId,
  canDraw,
  selectedIndex,
  onDrawCard,
  onSelectOwnCard,
  flights,
  hidden,
  pairFlashPlayerId,
  leavingPlayerId,
  hesitationIndex = null,
  drawCandidateIndex = null,
  shuffleState,
  canShuffle,
  onShuffle,
}: Props) {
  const hiddenIds = useMemo(() => new Set(hidden), [hidden]);
  const elsRef = useRef(new Map<string, HTMLElement>());
  const rectsRef = useRef(new Map<string, DOMRect>());
  const flightRectsRef = useRef(new Map<string, { from: DOMRect; to: DOMRect }>());

  const registerSlot = (key: string) => (el: HTMLElement | null) => {
    if (el) elsRef.current.set(key, el);
    else elsRef.current.delete(key);
  };

  // 毎レンダー後に、今ある全スロットの矩形を控えておく。
  // 消えたスロット（引かれたカードなど）の矩形も残るので、飛行の始点に使える。
  useLayoutEffect(() => {
    for (const [key, el] of elsRef.current.entries()) {
      rectsRef.current.set(key, el.getBoundingClientRect());
    }
  });

  const viewer = state.players.find((p) => p.id === viewerId) ?? state.players[0];
  // 残り2名になったら全員の権利が消滅する
  const shuffleLocked = state.players.filter((p) => p.finishedRank === null).length <= 2;
  const others = useMemo(() => {
    const order = state.seatOrder;
    const start = order.indexOf(viewer.id);
    const rest: BabanukiPlayer[] = [];
    for (let i = 1; i < order.length; i += 1) {
      const id = order[(start + i) % order.length];
      const player = state.players.find((p) => p.id === id);
      if (player) rest.push(player);
    }
    return rest;
  }, [state.players, state.seatOrder, viewer.id]);

  // 座席は楕円上に配置する。自分は常に下、左隣（次の手番）は画面左。
  const seatStyle = (index: number, total: number, pickable: boolean) => {
    const angle = (90 + ((index + 1) * 360) / total) * (Math.PI / 180);
    // 横は 37% まで。4人のとき真横に座る席が画面からはみ出すのを防ぐ。
    // 引く相手の席は札を広げるぶん横幅が要るので、少し内側へ寄せる
    const left = 50 + (pickable ? 29 : 37) * Math.cos(angle);
    const top = 48 + (pickable ? 34 : 40) * Math.sin(angle);
    return { left: `${left}%`, top: `${top}%` };
  };

  const resolveFlight = (flight: Flight) => {
    const cached = flightRectsRef.current.get(flight.id);
    if (cached) return cached;
    const from = rectsRef.current.get(flight.fromKey);
    const to = rectsRef.current.get(flight.toKey);
    if (!from || !to) return null;
    const pair = { from, to };
    flightRectsRef.current.set(flight.id, pair);
    return pair;
  };

  // 終わった飛行のキャッシュは捨てる
  const liveIds = new Set(flights.map((f) => f.id));
  for (const id of Array.from(flightRectsRef.current.keys())) {
    if (!liveIds.has(id)) flightRectsRef.current.delete(id);
  }

  const viewerHand = viewer.hand;
  const overlap = viewerHand.length <= 7 ? 0 : Math.min(28, ((viewerHand.length * 50) - 330) / Math.max(1, viewerHand.length - 1));

  return (
    <div style={{ position: 'relative' }}>
      {/* ---- テーブル（他のプレイヤー＋中央の捨て札） ---- */}
      <div
        style={{
          position: 'relative',
          height: 268,
          margin: '0 auto 6px',
          maxWidth: 420,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 45%, rgba(90,50,120,.28), rgba(20,12,28,.55) 70%)',
          border: '1px solid rgba(140,90,180,.28)',
        }}
      >
        {/* 中央の捨て札 */}
        <div
          ref={registerSlot('pile')}
          style={{
            position: 'absolute', left: '50%', top: '36%', transform: 'translate(-50%,-50%)',
            width: 52, height: 50, borderRadius: 10,
            border: '1px dashed rgba(200,160,240,.35)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#b8a6cf', fontSize: 11, gap: 1,
          }}
        >
          <span style={{ fontSize: 15 }}>🗑</span>
          <span>{state.discardPile.length}</span>
        </div>

        {/* 自分のシャッフルボタン（手札のすぐ上・盤面の下端中央）。他プレイヤーの札と同じくらいの大きさ */}
        <button
          type="button"
          className="btn babanuki-shuffle-button"
          disabled={!canShuffle}
          onClick={onShuffle}
          aria-label="シャッフルタイム"
          title={
            shuffleState === 'used'
              ? 'シャッフルタイムは使用済み'
              : shuffleState === 'locked'
                ? '残り2名になったので使えない'
                : 'シャッフルタイム（ジョーカーを持っているときに押せる）'
          }
          style={{
            position: 'absolute', left: '50%', top: '92%', transform: 'translate(-50%,-50%)',
            zIndex: 6,
            width: 40, height: 38, borderRadius: 10, padding: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            border: `1px solid ${shuffleState === 'ready' ? '#e6c877' : 'rgba(140,130,110,.5)'}`,
            background:
              shuffleState === 'ready'
                ? 'linear-gradient(180deg,#f0d98a,#c9a24b)'
                : 'rgba(58,54,48,.92)',
            color: shuffleState === 'ready' ? '#2a2010' : '#8a8272',
            boxShadow: canShuffle ? '0 0 16px rgba(230,200,119,.6)' : 'none',
            opacity: shuffleState === 'ready' && !canShuffle ? 0.55 : 1,
            cursor: canShuffle ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 17 }}>🎲</span>
          <span style={{ fontSize: 8, marginTop: 1 }}>
            {shuffleState === 'used' ? '使用済' : shuffleState === 'locked' ? '—' : 'シャッフル'}
          </span>
        </button>

        {others.map((player, index) => {
          const isTarget = player.id === drawTargetId;
          const finished = player.finishedRank !== null;
          const showCount = Math.min(player.hand.length, 8);
          // 引く相手の札は大きめにして、**重ならないよう折り返して**並べる。
          // 重なりが無いので隣の札を誤って選ぶことがない。
          const pickable = isTarget && canDraw;
          const cardW = pickable ? 30 : 28;
          const cardH = pickable ? 42 : 38;
          // 引く相手だけ広く取り、折り返しの行数を減らす
          const rowWidth = pickable ? 150 : 132;
          const step = showCount > 1 ? Math.min(cardW + 2, (rowWidth - cardW) / (showCount - 1)) : 0;
          const overlap = pickable ? -3 : showCount > 1 ? cardW - step : 0;
          return (
            <div
              key={player.id}
              className={`babanuki-seat${leavingPlayerId === player.id ? ' is-leaving' : ''}`}
              style={{
                position: 'absolute',
                ...seatStyle(index, state.seatOrder.length, pickable),
                transform: 'translate(-50%,-50%)',
                width: pickable ? rowWidth : 112,
                zIndex: pickable ? 5 : 1,
                background: pickable ? 'rgba(24,16,32,.92)' : 'none',
                borderRadius: pickable ? 10 : 0,
                padding: pickable ? '2px 0 4px' : 0,
                textAlign: 'center',
                opacity: finished ? 0.45 : 1,
              }}
            >
              <div style={{ fontSize: 11, color: '#e0d3b8', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {player.name || (player.isCpu ? getCpuDisplayName(player.cpuLevel) : 'プレイヤー')}
              </div>
              <div
                ref={registerSlot(`hand:${player.id}`)}
                className={isTarget ? 'babanuki-target' : undefined}
                style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
                  flexWrap: pickable ? 'wrap' : 'nowrap',
                  rowGap: 4,
                  minHeight: pickable ? 50 : 42, padding: 3,
                }}
              >
                {finished ? (
                  <span style={{ fontSize: 11, color: '#e6c877' }}>{player.finishedRank}位 ぬけ</span>
                ) : (
                  player.hand.slice(0, showCount).map((card, cardIndex) => {
                    const spot = player.spotlightCardId === card.id;
                    const eyed = isTarget && hesitationIndex === cardIndex;
                    const candidate = pickable && drawCandidateIndex === cardIndex;
                    return (
                      <button
                        key={card.id}
                        ref={registerSlot(`card:${player.id}:${card.id}`)}
                        type="button"
                        className={`babanuki-card${pickable ? ' is-pickable' : ''}${spot ? ' is-spotlight' : ''}${eyed ? ' is-eyeing' : ''}${candidate ? ' is-candidate' : ''}`}
                        disabled={!pickable}
                        onClick={() => onDrawCard(cardIndex)}
                        style={{
                          border: 'none', background: 'none', padding: 0,
                          // 折り返す場合は各行の先頭でも同じ余白でよい（重なりが無いため）
                          marginLeft: pickable ? 3 : cardIndex === 0 ? 0 : -overlap,
                          zIndex: candidate ? 3 : 1,
                          cursor: pickable ? 'pointer' : 'default',
                          visibility: hiddenIds.has(card.id) ? 'hidden' : 'visible',
                        }}
                      >
                        <CardBack width={cardW} height={cardH} />
                      </button>
                    );
                  })
                )}
                {!finished && player.hand.length > showCount && (
                  <span style={{ fontSize: 10, color: '#c9b48f', marginLeft: 3 }}>+{player.hand.length - showCount}</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#b5a68c', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {finished ? '' : `${player.hand.length}枚`}
                {!finished && (
                  // 他プレイヤーのシャッフル権。カードの1/4ほどの丸いしるし
                  <span
                    title={player.shuffleRight && !shuffleLocked ? 'シャッフルタイム未使用' : 'シャッフルタイムは使えない'}
                    style={{
                      width: 12, height: 12, borderRadius: '50%', display: 'inline-block',
                      background:
                        player.shuffleRight && !shuffleLocked
                          ? 'radial-gradient(circle at 35% 30%, #ffe9a8, #c9a24b)'
                          : 'rgba(80,76,68,.9)',
                      border: `1px solid ${player.shuffleRight && !shuffleLocked ? '#e6c877' : 'rgba(140,130,110,.5)'}`,
                      boxShadow: player.shuffleRight && !shuffleLocked ? '0 0 6px rgba(230,200,119,.6)' : 'none',
                    }}
                  />
                )}
              </div>
              {pairFlashPlayerId === player.id && (
                <div className="babanuki-pair-flash" style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', color: '#e6c877', fontSize: 13, fontWeight: 'bold' }}>
                  ペア！
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- 自分の手札 ---- */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#b5a68c', marginBottom: 4 }}>
          あなたの手札 {viewer.hand.length}枚
          {viewer.finishedRank !== null && ` ・ ${viewer.finishedRank}位で勝ち抜け`}
        </div>
        <div
          ref={registerSlot(`hand:${viewer.id}`)}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: 74, padding: '10px 4px 4px' }}
        >
          {viewerHand.map((card, index) => {
            const spot = viewer.spotlightCardId === card.id;
            const selected = selectedIndex === index;
            // 自分が引かれる側のとき、CPUがどの札を狙っているかが見える
            const eyed = drawTargetId === viewer.id && hesitationIndex === index;
            return (
              <button
                key={card.id}
                ref={registerSlot(`card:${viewer.id}:${card.id}`)}
                type="button"
                className={`babanuki-card is-pickable${spot ? ' is-spotlight' : ''}${selected ? ' is-selected' : ''}${eyed ? ' is-eyeing' : ''}`}
                onClick={() => onSelectOwnCard(index)}
                style={{
                  border: 'none', background: 'none', padding: 0,
                  marginLeft: index === 0 ? 0 : -overlap,
                  cursor: 'pointer',
                  borderRadius: 6,
                  visibility: hiddenIds.has(card.id) ? 'hidden' : 'visible',
                }}
              >
                <CardFace card={card} width={44} height={62} />
              </button>
            );
          })}
        </div>
        {pairFlashPlayerId === viewer.id && (
          <div className="babanuki-pair-flash" style={{ color: '#e6c877', fontSize: 15, fontWeight: 'bold' }}>ペア成立！</div>
        )}
      </div>

      {/* ---- 飛んでいるカード ---- */}
      {flights.map((flight) => {
        const rects = resolveFlight(flight);
        if (!rects) return null;
        return <FlyingCard key={flight.id} flight={flight} from={rects.from} to={rects.to} />;
      })}
    </div>
  );
}
