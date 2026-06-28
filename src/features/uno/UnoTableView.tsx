import type { CSSProperties } from 'react';
import type { UnoCard, UnoColor, UnoGameState, UnoPlayer, UnoPlayerId, UnoVariant } from './unoTypes';
import { UNO_COLOR_LABELS } from './unoCardMeta';
import { UnoCardView } from './UnoCardView';
import { Button } from '../../components/Button';

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
  onPlay,
  onDraw,
  onAcceptDraw,
}: UnoTableViewProps) {
  const myPlayer = state.players.find((p) => p.id === viewPlayerId) ?? state.players[0]!;
  const opponents = state.players.filter((p) => p.id !== myPlayer.id);

  return (
    <section className={`uno-table-view ${state.variant === 'hard' ? 'is-hard' : ''}`}>
      <div className="uno-table-header">
        <strong>{currentPlayer.isCpu ? 'CPU ' : ''}{currentPlayer.name} の番です</strong>
        <span>
          色: {UNO_COLOR_LABELS[state.activeColor]}
          {state.pendingDrawCount > 0 ? ` / ドロー ${state.pendingDrawCount}まい` : ''}
        </span>
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
        />

        <UnoSelfSeat
          player={myPlayer}
          cardCount={state.hands[myPlayer.id]?.length ?? 0}
          isCurrent={myPlayer.id === state.currentPlayerId}
          isNext={myPlayer.id === nextPlayerId}
        />
      </div>

      <div className="uno-table-message">{message}</div>

      <UnoHandFan
        player={handPlayer ?? currentPlayer}
        hand={currentHand}
        playableIds={playableIds}
        variant={state.variant}
        canAct={canAct}
        pendingDrawCount={state.pendingDrawCount}
        onPlay={onPlay}
        onDraw={onDraw}
        onAcceptDraw={onAcceptDraw}
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
}: {
  player: UnoPlayer;
  cardCount: number;
  isCurrent: boolean;
  isNext: boolean;
}) {
  return (
    <div className={`uno-seat uno-seat-bottom ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`}>
      <SeatBadge player={player} cardCount={cardCount} isCurrent={isCurrent} isNext={isNext} self />
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
}: {
  variant: UnoVariant;
  topCard: UnoCard;
  deckCount: number;
  direction: 'clockwise' | 'counterclockwise';
  activeColor: UnoColor;
  pendingDrawCount: number;
  isCpuThinking: boolean;
}) {
  const clockwise = direction === 'clockwise';
  return (
    <div className={`uno-center-pile ${variant === 'hard' ? 'is-hard' : ''} ${isCpuThinking ? 'is-thinking' : ''}`}>
      <div className={`uno-direction-ring ${clockwise ? 'is-clockwise' : 'is-counterclockwise'}`}>
        <span className="uno-ring-arrow uno-ring-arrow-a">{clockwise ? '↻' : '↺'}</span>
        <span className="uno-ring-arrow uno-ring-arrow-b">{clockwise ? '↻' : '↺'}</span>
      </div>

      <div className="uno-center-cards">
        <div className="uno-center-card-wrap">
          <UnoCardView hidden compact variant={variant} />
          <span>山札 {deckCount}</span>
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
  pendingDrawCount,
  onPlay,
  onDraw,
  onAcceptDraw,
}: {
  player: UnoPlayer;
  hand: UnoCard[];
  playableIds: Set<string>;
  variant: UnoVariant;
  canAct: boolean;
  pendingDrawCount: number;
  onPlay: (card: UnoCard) => void;
  onDraw: () => void;
  onAcceptDraw: () => void;
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
        {pendingDrawCount > 0 ? (
          <Button variant="secondary" onClick={onAcceptDraw} disabled={!canAct}>
            {pendingDrawCount}まい引く
          </Button>
        ) : (
          <Button variant="secondary" onClick={onDraw} disabled={!canAct}>
            カードを引く
          </Button>
        )}
      </div>
    </section>
  );
}
