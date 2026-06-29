import { useState, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { UnoCard, UnoColor, UnoGameState, UnoPlayer, UnoPlayerId, UnoVariant } from './unoTypes';
import { UNO_COLOR_LABELS } from './unoCardMeta';
import { UnoCardView } from './UnoCardView';

const COLOR_DOTS: Record<UnoColor, string> = {
  red: '#df352c',
  yellow: '#f2c436',
  green: '#25a85a',
  blue: '#2581d8',
};

type UnoTableViewProps = {
  state: UnoGameState;
  currentPlayer: UnoPlayer;
  nextPlayerId: UnoPlayerId;
  topCard: UnoCard;
  currentHand: UnoCard[];
  handPlayer?: UnoPlayer;
  playableIds: Set<string>;
  canAct: boolean;
  isCpuThinking: boolean;
  message: string;
  viewPlayerId?: UnoPlayerId;
  pendingOverlay?: ReactNode;
  onPlay: (card: UnoCard) => void;
  onDraw: () => void;
  onAcceptDraw: () => void;
};

export function UnoTableView({
  state,
  currentPlayer,
  nextPlayerId,
  topCard,
  currentHand,
  handPlayer,
  playableIds,
  canAct,
  isCpuThinking,
  message,
  viewPlayerId = 'player-1',
  pendingOverlay,
  onPlay,
  onDraw,
  onAcceptDraw,
}: UnoTableViewProps) {
  const myPlayer = state.players.find((p) => p.id === viewPlayerId) ?? state.players[0]!;
  const opponents = getSeatedOpponents(state, myPlayer.id);
  const opponentSeats = opponents.map((player, index) => ({
    player,
    placement: getOpponentPlacement(index, opponents.length),
    isUno: state.unoDeclaredIds.includes(player.id) && (state.hands[player.id]?.length ?? 0) === 1,
  }));
  const myIsUno = state.unoDeclaredIds.includes(myPlayer.id) && (state.hands[myPlayer.id]?.length ?? 0) === 1;
  const canUseDeck = canAct && (state.pendingDrawCount > 0 || playableIds.size === 0);
  const turnFlow = getTurnFlowPlayers(state);
  const directionLabel = state.direction === 'clockwise' ? '時計回り' : '反時計回り';
  const [helpCard, setHelpCard] = useState<UnoCard | null>(null);
  const [showCardGuide, setShowCardGuide] = useState(false);
  const [unoFlash, setUnoFlash] = useState<{ playerId: string; playerName: string } | null>(null);
  const prevUnoIds = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevUnoIds.current;
    const curr = state.unoDeclaredIds;
    prevUnoIds.current = curr;
    if (state.status !== 'playing') return;
    const newIds = curr.filter((id) => !prev.includes(id));
    if (newIds.length === 0) return;
    const player = state.players.find((p) => p.id === newIds[0]!);
    if (!player) return;
    const name = (player.isCpu ? 'CPU ' : '') + (player.name || 'スーパードラゴン');
    setUnoFlash({ playerId: newIds[0]!, playerName: name });
    const t = setTimeout(() => setUnoFlash(null), 2300);
    return () => clearTimeout(t);
  }, [state.unoDeclaredIds, state.players, state.status]);

  return (
    <section className={`uno-table-view ${state.variant === 'hard' ? 'is-hard' : ''}`}>
      <div className="uno-turn-flow" aria-label={`進行方向 ${directionLabel}`}>
        <span className={`uno-turn-flow-direction ${state.direction === 'clockwise' ? 'is-clockwise' : 'is-counterclockwise'}`}>
          {directionLabel}
        </span>
        <div className="uno-turn-flow-track">
          {turnFlow.map((player, index) => (
            <span
              key={player.id}
              className={`uno-turn-flow-player ${player.id === state.currentPlayerId ? 'is-current' : ''} ${player.id === nextPlayerId ? 'is-next' : ''}`}
            >
              {index > 0 && <span className="uno-turn-flow-arrow">{state.direction === 'clockwise' ? '→' : '←'}</span>}
              <span>{player.isCpu ? 'CPU ' : ''}{player.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="uno-card-tools">
        <button type="button" className="uno-card-guide-button" onClick={() => setShowCardGuide((show) => !show)}>
          カード効果
        </button>
      </div>

      {showCardGuide && (
        <CardGuidePanel
          variant={state.variant}
          onClose={() => setShowCardGuide(false)}
        />
      )}

      {helpCard && (
        <CardHelpPanel
          card={helpCard}
          variant={state.variant}
          onClose={() => setHelpCard(null)}
        />
      )}

      <div className="uno-table-arena">
        <div className="uno-table-glow" />

        {opponentSeats.map(({ player, placement, isUno }) => {
          return (
            <UnoOpponentSeat
              key={player.id}
              player={player}
              cardCount={state.hands[player.id]?.length ?? 0}
              slot={placement.slot}
              style={placement.style}
              isCurrent={player.id === state.currentPlayerId}
              isNext={player.id === nextPlayerId}
              variant={state.variant}
              isUno={isUno}
            />
          );
        })}

        <UnoCenterPile
          variant={state.variant}
          topCard={topCard}
          deckCount={state.deck.length}
          direction={state.direction}
          activeColor={state.activeColor}
          pendingDrawCount={state.pendingDrawCount}
          isCpuThinking={isCpuThinking}
          canDraw={canUseDeck}
          onDeckClick={state.pendingDrawCount > 0 ? onAcceptDraw : onDraw}
          onCardInfo={setHelpCard}
        />

        {unoFlash && (
          <div className="uno-flash-overlay" aria-live="polite" aria-atomic="true">
            <div className="uno-flash-content">
              <span className="uno-flash-word">UNO!</span>
              <span className="uno-flash-player">{unoFlash.playerName}</span>
            </div>
          </div>
        )}

        {pendingOverlay && <div className="uno-table-overlay">{pendingOverlay}</div>}

        <UnoSelfSeat
          player={myPlayer}
          cardCount={state.hands[myPlayer.id]?.length ?? 0}
          isCurrent={myPlayer.id === state.currentPlayerId}
          isNext={myPlayer.id === nextPlayerId}
          isUno={myIsUno}
        />
      </div>

      <div className="uno-table-message">{message}</div>

      <UnoHandFan
        player={handPlayer ?? currentPlayer}
        hand={currentHand}
        playableIds={playableIds}
        variant={state.variant}
        canAct={canAct}
        canUseDeck={canUseDeck}
        pendingDrawCount={state.pendingDrawCount}
        onPlay={onPlay}
        onDrawRequest={state.pendingDrawCount > 0 ? onAcceptDraw : onDraw}
        onCardInfo={setHelpCard}
      />
    </section>
  );
}

type SeatSlot =
  | 'top'
  | 'upper-left'
  | 'upper-right'
  | 'left'
  | 'right'
  | 'far-left'
  | 'far-right'
  | 'top-left'
  | 'top-right';

type SeatPlacement = {
  slot?: SeatSlot;
  style?: CSSProperties;
};


function getOpponentPlacement(index: number, total: number): SeatPlacement {
  const layouts: Record<number, SeatSlot[]> = {
    1: ['top'],
    2: ['upper-left', 'upper-right'],
    3: ['left', 'top', 'right'],
    4: ['left', 'top-left', 'top-right', 'right'],
    5: ['far-left', 'upper-left', 'top', 'upper-right', 'far-right'],
  };
  if (total <= 5) {
    const layout = layouts[total] ?? layouts[5];
    return { slot: layout[Math.min(index, layout.length - 1)]! };
  }

  const progress = total <= 1 ? 0.5 : index / (total - 1);
  const angle = 162 - progress * 144;
  const radians = angle * (Math.PI / 180);
  const xRadius = total >= 8 ? 43 : 40;
  const yRadius = total >= 8 ? 37 : 35;
  const left = 50 + Math.cos(radians) * xRadius;
  const top = 51 - Math.sin(radians) * yRadius;

  return {
    style: {
      left: `${left}%`,
      top: `${top}%`,
    },
  };
}


function getSeatedOpponents(state: UnoGameState, viewPlayerId: UnoPlayerId): UnoPlayer[] {
  const players = state.players;
  const viewIndex = players.findIndex((player) => player.id === viewPlayerId);
  if (viewIndex < 0 || players.length <= 1) {
    return players.filter((player) => player.id !== viewPlayerId);
  }

  const step = state.direction === 'clockwise' ? 1 : -1;
  const ordered = Array.from({ length: players.length - 1 }, (_, offset) => {
    const index = ((viewIndex + step * (offset + 1)) % players.length + players.length) % players.length;
    return players[index]!;
  });

  return state.direction === 'clockwise' ? ordered : ordered.reverse();
}

function getTurnFlowPlayers(state: UnoGameState): UnoPlayer[] {
  const active = state.players.filter((player) => !player.isEliminated);
  if (active.length === 0) return [];

  const currentIndex = active.findIndex((player) => player.id === state.currentPlayerId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const step = state.direction === 'clockwise' ? 1 : -1;

  return Array.from({ length: active.length }, (_, offset) => {
    const index = ((startIndex + step * offset) % active.length + active.length) % active.length;
    return active[index]!;
  });
}

function UnoOpponentSeat({
  player,
  cardCount,
  slot,
  style,
  isCurrent,
  isNext,
  variant,
  isUno,
}: {
  player: UnoPlayer;
  cardCount: number;
  slot?: SeatSlot;
  style?: CSSProperties;
  isCurrent: boolean;
  isNext: boolean;
  variant: UnoVariant;
  isUno: boolean;
}) {
  return (
    <div
      className={`uno-seat ${slot ? `uno-seat-${slot}` : 'uno-seat-arc'} ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`}
      style={style}
    >
      <OpponentCardStack count={cardCount} variant={variant} />
      <SeatBadge player={player} cardCount={cardCount} isCurrent={isCurrent} isNext={isNext} isUno={isUno} />
    </div>
  );
}

function UnoSelfSeat({
  player,
  cardCount,
  isCurrent,
  isNext,
  isUno,
}: {
  player: UnoPlayer;
  cardCount: number;
  isCurrent: boolean;
  isNext: boolean;
  isUno: boolean;
}) {
  return (
    <div className={`uno-seat uno-seat-bottom ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`}>
      <SeatBadge player={player} cardCount={cardCount} isCurrent={isCurrent} isNext={isNext} self isUno={isUno} />
    </div>
  );
}

function SeatBadge({
  player,
  cardCount,
  isCurrent,
  isNext,
  self = false,
  isUno = false,
}: {
  player: UnoPlayer;
  cardCount: number;
  isCurrent: boolean;
  isNext: boolean;
  self?: boolean;
  isUno?: boolean;
}) {
  const stateClass = cardCount >= 22 ? 'is-danger' : cardCount >= 18 ? 'is-warning' : isUno ? 'is-uno' : '';
  return (
    <div className={`uno-seat-badge ${stateClass}`}>
      {isCurrent && <span className="uno-seat-turn">いま</span>}
      {isNext && !isCurrent && <span className="uno-seat-next">つぎ</span>}
      <strong>{self ? 'You ' : ''}{player.isCpu ? 'CPU ' : ''}{player.name}</strong>
      <span>{player.isEliminated ? 'アウト' : `${cardCount}まい`}</span>
    </div>
  );
}

function OpponentCardStack({ count, variant }: { count: number; variant: UnoVariant }) {
  const visible = Math.min(Math.max(count, 1), 8);
  return (
    <div className="uno-opponent-stack" aria-label={`手札 ${count}まい`}>
      {Array.from({ length: visible }, (_, index) => {
        const offset = index - (visible - 1) / 2;
        return (
          <div
            key={index}
            className={`uno-mini-back ${variant === 'hard' ? 'is-hard' : ''}`}
            style={{
              transform: `translateX(${offset * 11}px) rotate(${offset * 4}deg)`,
              zIndex: index,
            }}
          >
            <span className="uno-mini-paw-mark" aria-hidden="true">
              <span className="uno-mini-paw-pad" />
              <span className="uno-mini-paw-toe uno-mini-paw-toe-1" />
              <span className="uno-mini-paw-toe uno-mini-paw-toe-2" />
              <span className="uno-mini-paw-toe uno-mini-paw-toe-3" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UnoCenterPile({
  variant,
  topCard,
  deckCount,
  direction,
  activeColor,
  pendingDrawCount,
  isCpuThinking,
  canDraw,
  onDeckClick,
  onCardInfo,
}: {
  variant: UnoVariant;
  topCard: UnoCard;
  deckCount: number;
  direction: 'clockwise' | 'counterclockwise';
  activeColor: UnoColor;
  pendingDrawCount: number;
  isCpuThinking: boolean;
  canDraw: boolean;
  onDeckClick: () => void;
  onCardInfo: (card: UnoCard) => void;
}) {
  const clockwise = direction === 'clockwise';
  const topCardHasHelp = hasCardEffectHelp(topCard, variant);
  return (
    <div className={`uno-center-pile ${variant === 'hard' ? 'is-hard' : ''} ${isCpuThinking ? 'is-thinking' : ''}`}>
      <div className={`uno-direction-ring ${clockwise ? 'is-clockwise' : 'is-counterclockwise'}`} />

      <span
        key={direction}
        className={`uno-ring-turn-marker ${clockwise ? 'is-clockwise' : 'is-counterclockwise'}`}
        aria-hidden="true"
      />

      <div className="uno-center-cards">
        <div className="uno-center-card-wrap">
          <div className={`uno-deck-button ${canDraw ? 'is-actionable' : ''}`}>
            <UnoCardView
              hidden
              compact
              variant={variant}
              playable={canDraw}
              onClick={canDraw ? onDeckClick : undefined}
            />
          </div>
          <span>{pendingDrawCount > 0 ? `${pendingDrawCount}枚引く` : `山札 ${deckCount}`}</span>
        </div>
        <div className="uno-center-card-wrap">
          <div className="uno-card-info-anchor">
            <UnoCardView card={topCard} compact variant={variant} />
            {topCardHasHelp && (
              <button
                type="button"
                className="uno-card-info-button"
                onClick={() => onCardInfo(topCard)}
                aria-label="場のカードの効果を確認"
              >
                ?
              </button>
            )}
          </div>
          <span>場のカード</span>
        </div>
      </div>

      <div className="uno-center-status">
        <span className="uno-color-dot" style={{ background: COLOR_DOTS[activeColor] }} />
        {UNO_COLOR_LABELS[activeColor]}
        {pendingDrawCount > 0 && <strong> ドロー {pendingDrawCount}</strong>}
      </div>
    </div>
  );
}

function UnoHandFan({
  player,
  hand,
  playableIds,
  variant,
  canAct,
  canUseDeck,
  pendingDrawCount,
  onPlay,
  onDrawRequest,
  onCardInfo,
}: {
  player: UnoPlayer;
  hand: UnoCard[];
  playableIds: Set<string>;
  variant: UnoVariant;
  canAct: boolean;
  canUseDeck: boolean;
  pendingDrawCount: number;
  onPlay: (card: UnoCard) => void;
  onDrawRequest: () => void;
  onCardInfo: (card: UnoCard) => void;
}) {
  const playableCount = hand.filter((card) => canAct && playableIds.has(card.id)).length;
  const maxSpread = hand.length <= 8 ? 48 : hand.length <= 14 ? 38 : playableCount >= 4 ? 34 : 29;
  const center = (hand.length - 1) / 2;
  const fanWidth = Math.max(340, Math.min(980, 112 + Math.max(0, hand.length - 1) * maxSpread));

  return (
    <section className="uno-hand-fan-panel">
      <div className="uno-hand-fan-header">
        <strong>{player.name} の手札</strong>
        <span>{hand.length}まい</span>
      </div>

      <div className="uno-hand-scroll">
        <div className="uno-hand-fan" style={{ width: fanWidth }}>
          {hand.map((card, index) => {
            const offset = index - center;
            const playable = canAct && playableIds.has(card.id);
            const hasHelp = hasCardEffectHelp(card, variant);
            const rotation = hand.length <= 14 ? offset * 2.8 : offset * 1.35;
            return (
              <div
                key={card.id}
                className={`uno-hand-card ${playable ? 'is-playable' : ''}`}
                style={{
                  left: 8 + index * maxSpread,
                  transform: `translateY(${playable ? -34 : Math.abs(offset) * 1.4}px) rotate(${rotation}deg) scale(${playable ? 1.04 : 1})`,
                  zIndex: playable ? 100 + index : index,
                }}
              >
                <UnoCardView
                  card={card}
                  variant={variant}
                  playable={playable}
                  onClick={playable ? () => onPlay(card) : undefined}
                />
                {hasHelp && (
                  <button
                    type="button"
                    className="uno-card-info-button is-hand"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCardInfo(card);
                    }}
                    aria-label="このカードの効果を確認"
                  >
                    ?
                  </button>
                )}
                {playable && <span className="uno-playable-chip">出せる</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="uno-hand-actions">
        <button
          type="button"
          className={`uno-hand-draw-button ${canUseDeck ? 'is-active' : ''}`}
          onClick={onDrawRequest}
          disabled={!canUseDeck}
        >
          {pendingDrawCount > 0 ? `${pendingDrawCount}まい引く` : '山札から引く'}
        </button>
        <span className={`uno-draw-hint ${canUseDeck ? 'is-active' : ''}`}>
          {pendingDrawCount > 0
            ? `中央の山札を押すと${pendingDrawCount}枚引きます`
            : canAct && playableIds.size > 0
              ? '出せるカードがあります'
              : '出せない時は中央の山札を押します'}
        </span>
      </div>
    </section>
  );
}

function hasCardEffectHelp(card: UnoCard, variant: UnoVariant): boolean {
  if (card.kind === 'number') return variant === 'hard' && (card.value === 0 || card.value === 7);
  return true;
}

function CardHelpPanel({
  card,
  variant,
  onClose,
}: {
  card: UnoCard;
  variant: UnoVariant;
  onClose: () => void;
}) {
  const detail = getCardEffectDetail(card, variant);
  return (
    <div className="uno-card-help-panel">
      <div>
        <strong>{detail.title}</strong>
        <p>{detail.description}</p>
        <span>{detail.score}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="カード説明を閉じる">×</button>
    </div>
  );
}

function CardGuidePanel({ variant, onClose }: { variant: UnoVariant; onClose: () => void }) {
  const rows = variant === 'hard' ? HARD_CARD_GUIDE : STANDARD_CARD_GUIDE;
  return (
    <div className={`uno-card-guide-panel ${variant === 'hard' ? 'is-hard' : ''}`}>
      <div className="uno-card-guide-head">
        <strong>カード効果一覧</strong>
        <button type="button" onClick={onClose} aria-label="カード効果一覧を閉じる">×</button>
      </div>
      <div className="uno-card-guide-grid">
        {rows.map((row) => (
          <div key={row.title} className="uno-card-guide-row">
            <strong>{row.title}</strong>
            <span>{row.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CARD_COLOR_LABELS: Record<UnoColor, string> = {
  red: '赤',
  yellow: '黄',
  green: '緑',
  blue: '青',
};

function getCardEffectDetail(card: UnoCard, variant: UnoVariant): { title: string; description: string; score: string } {
  if (card.kind === 'number') {
    if (variant === 'hard' && card.value === 7) {
      return {
        title: `${CARD_COLOR_LABELS[card.color]} 7`,
        description: 'だれか1人を選んで、手札を全部交換します。',
        score: '点数: 7点',
      };
    }
    if (variant === 'hard' && card.value === 0) {
      return {
        title: `${CARD_COLOR_LABELS[card.color]} 0`,
        description: '全員が進行方向の次の人に、手札を全部わたします。',
        score: '点数: 0点',
      };
    }
    return {
      title: `${CARD_COLOR_LABELS[card.color]} ${card.value}`,
      description: '場のカードと同じ色、または同じ数字なら出せます。',
      score: `点数: ${card.value}点`,
    };
  }

  if (card.kind === 'action') {
    const actionDetails: Record<string, { title: string; description: string }> = {
      skip: { title: 'スキップ', description: '次の人を1回休みにします。' },
      reverse: { title: 'リバース', description: '進む向きを反対にします。' },
      draw2: { title: 'ドロー2', description: '次の人に2枚引かせます。' },
      draw4: { title: 'ドロー4', description: '次の人に4枚引かせます。ハード版では色つきの強いドローカードです。' },
      'discard-all': { title: 'ぜんぶすてる', description: '同じ色の手札をまとめて全部出せます。' },
    };
    const detail = actionDetails[card.symbol]!;
    return {
      title: `${CARD_COLOR_LABELS[card.color]} ${detail.title}`,
      description: detail.description,
      score: '点数: 20点',
    };
  }

  const wildDetails: Record<string, { title: string; description: string }> = {
    wild: { title: 'ワイルド', description: '好きな色を選べます。' },
    'wild-draw4': { title: 'ワイルド ドロー4', description: '好きな色を選び、次の人に4枚引かせます。' },
    'wild-draw6': { title: 'ワイルド ドロー6', description: '好きな色を選び、次の人に6枚引かせます。' },
    'wild-draw10': { title: 'ワイルド ドロー10', description: '好きな色を選び、次の人に10枚引かせます。' },
    'wild-reverse-draw4': { title: 'ワイルド リバース ドロー4', description: '進む向きを反対にして、新しく次の人になった人に4枚引かせます。' },
    'wild-color-roulette': { title: 'カラー ルーレット', description: '選んだ色のカードが出るまで、次の人に1枚ずつ引かせます。' },
    'wild-skip-all': { title: 'みんなスキップ', description: '自分以外の全員を1回休みにして、もう一度自分の番になります。' },
  };
  const detail = wildDetails[card.symbol]!;
  return {
    title: detail.title,
    description: detail.description,
    score: '点数: 50点',
  };
}

const STANDARD_CARD_GUIDE = [
  { title: '数字カード', description: '同じ色か同じ数字なら出せます。点数は数字そのままです。' },
  { title: 'スキップ', description: '次の人を1回休みにします。20点です。' },
  { title: 'リバース', description: '進む向きを反対にします。20点です。' },
  { title: 'ドロー2', description: '次の人に2枚引かせます。20点です。' },
  { title: 'ワイルド', description: '好きな色を選べます。50点です。' },
  { title: 'ワイルド ドロー4', description: '好きな色を選び、次の人に4枚引かせます。50点です。' },
];

const HARD_CARD_GUIDE = [
  ...STANDARD_CARD_GUIDE,
  { title: 'ドロー4', description: '色つきのドロー4です。ドロー重ねに使えます。20点です。' },
  { title: 'ドロー6 / ドロー10', description: '次の人に6枚または10枚引かせます。ワイルドなので色も選べます。50点です。' },
  { title: 'リバース ドロー4', description: '向きを反対にして、新しく次の人になった人に4枚引かせます。50点です。' },
  { title: '7', description: 'だれか1人と手札を全部交換します。7点です。' },
  { title: '0', description: '全員が進行方向の次の人に手札を全部わたします。0点です。' },
  { title: 'ぜんぶすてる', description: '同じ色の手札をまとめて全部出せます。20点です。' },
  { title: 'カラー ルーレット', description: '選んだ色が出るまで、次の人に1枚ずつ引かせます。50点です。' },
  { title: 'みんなスキップ', description: '自分以外の全員を休みにして、もう一度自分の番です。50点です。' },
  { title: '25枚アウト', description: 'ハード版では手札が25枚以上になると脱落します。' },
];
