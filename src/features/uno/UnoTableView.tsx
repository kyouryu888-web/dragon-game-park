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
  const opponents = state.players.filter((p) => p.id !== myPlayer.id);
  const canUseDeck = canAct && (state.pendingDrawCount > 0 || playableIds.size === 0);
  const turnFlow = getTurnFlowPlayers(state);
  const directionLabel = state.direction === 'clockwise' ? '時計回り' : '反時計回り';

  return (
    <section className={`uno-table-view ${state.variant === 'hard' ? 'is-hard' : ''}`}>
      <div className="uno-table-header">
        <strong>{currentPlayer.isCpu ? 'CPU ' : ''}{currentPlayer.name} の番です</strong>
        <span>
          色: {UNO_COLOR_LABELS[state.activeColor]}
          {state.pendingDrawCount > 0 ? ` / ドロー ${state.pendingDrawCount}まい` : ''}
        </span>
      </div>

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

      <div className="uno-table-arena">
        <div className="uno-table-glow" />

        {opponents.map((player, index) => {
          const placement = getOpponentPlacement(index, opponents.length);
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
          turnMarker={`${state.currentPlayerId}-${state.turnCount}-${state.direction}`}
          onDeckClick={state.pendingDrawCount > 0 ? onAcceptDraw : onDraw}
        />

        {pendingOverlay && <div className="uno-table-overlay">{pendingOverlay}</div>}

        <UnoSelfSeat
          player={myPlayer}
          cardCount={state.hands[myPlayer.id]?.length ?? 0}
          isCurrent={myPlayer.id === state.currentPlayerId}
          isNext={myPlayer.id === nextPlayerId}
          autoUno={state.unoDeclaredIds.includes(myPlayer.id) && (state.hands[myPlayer.id]?.length ?? 0) === 1}
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
}: {
  player: UnoPlayer;
  cardCount: number;
  slot?: SeatSlot;
  style?: CSSProperties;
  isCurrent: boolean;
  isNext: boolean;
  variant: UnoVariant;
}) {
  return (
    <div
      className={`uno-seat ${slot ? `uno-seat-${slot}` : 'uno-seat-arc'} ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`}
      style={style}
    >
      <OpponentCardStack count={cardCount} variant={variant} />
      <SeatBadge player={player} cardCount={cardCount} isCurrent={isCurrent} isNext={isNext} />
    </div>
  );
}

function UnoSelfSeat({
  player,
  cardCount,
  isCurrent,
  isNext,
  autoUno,
}: {
  player: UnoPlayer;
  cardCount: number;
  isCurrent: boolean;
  isNext: boolean;
  autoUno: boolean;
}) {
  return (
    <div className={`uno-seat uno-seat-bottom ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`}>
      <SeatBadge player={player} cardCount={cardCount} isCurrent={isCurrent} isNext={isNext} self />
      {autoUno && <span className="uno-auto-badge">UNO! 自動</span>}
    </div>
  );
}

function SeatBadge({
  player,
  cardCount,
  isCurrent,
  isNext,
  self = false,
}: {
  player: UnoPlayer;
  cardCount: number;
  isCurrent: boolean;
  isNext: boolean;
  self?: boolean;
}) {
  return (
    <div className={`uno-seat-badge ${cardCount >= 22 ? 'is-danger' : cardCount >= 18 ? 'is-warning' : ''}`}>
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
            龍
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
  turnMarker,
  onDeckClick,
}: {
  variant: UnoVariant;
  topCard: UnoCard;
  deckCount: number;
  direction: 'clockwise' | 'counterclockwise';
  activeColor: UnoColor;
  pendingDrawCount: number;
  isCpuThinking: boolean;
  canDraw: boolean;
  turnMarker: string;
  onDeckClick: () => void;
}) {
  const clockwise = direction === 'clockwise';
  return (
    <div className={`uno-center-pile ${variant === 'hard' ? 'is-hard' : ''} ${isCpuThinking ? 'is-thinking' : ''}`}>
      <div className={`uno-direction-ring ${clockwise ? 'is-clockwise' : 'is-counterclockwise'}`}>
        <span className="uno-ring-direction-label">{clockwise ? '時計回り' : '反時計回り'}</span>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`uno-ring-marker uno-ring-marker-${index}`}
            aria-hidden="true"
          >
            {clockwise ? '➜' : '➜'}
          </span>
        ))}
        <span key={turnMarker} className={`uno-turn-orbit ${clockwise ? 'is-clockwise' : 'is-counterclockwise'}`}>
          <span>{clockwise ? '›' : '‹'}</span>
        </span>
      </div>

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
        <div className="uno-center-arrow">{clockwise ? '→' : '←'}</div>
        <div className="uno-center-card-wrap">
          <UnoCardView card={topCard} compact variant={variant} />
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
}: {
  player: UnoPlayer;
  hand: UnoCard[];
  playableIds: Set<string>;
  variant: UnoVariant;
  canAct: boolean;
  canUseDeck: boolean;
  pendingDrawCount: number;
  onPlay: (card: UnoCard) => void;
}) {
  const maxSpread = hand.length <= 8 ? 42 : hand.length <= 14 ? 32 : 24;
  const center = (hand.length - 1) / 2;
  const fanWidth = Math.max(300, Math.min(720, 94 + Math.max(0, hand.length - 1) * maxSpread));

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
            const rotation = hand.length <= 18 ? offset * 3.4 : offset * 1.7;
            return (
              <div
                key={card.id}
                className={`uno-hand-card ${playable ? 'is-playable' : ''}`}
                style={{
                  left: 8 + index * maxSpread,
                  transform: `translateY(${playable ? -22 : Math.abs(offset) * 2}px) rotate(${rotation}deg)`,
                  zIndex: playable ? 100 + index : index,
                }}
              >
                <UnoCardView
                  card={card}
                  variant={variant}
                  playable={playable}
                  onClick={playable ? () => onPlay(card) : undefined}
                />
                {playable && <span className="uno-playable-chip">出せる</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="uno-hand-actions">
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
