import type { UnoCard, UnoColor, UnoVariant } from './unoTypes';
import { getUnoCardName } from './unoCardMeta';

const COLOR_STYLES: Record<UnoColor, { bg: string; deep: string; text: string }> = {
  red: { bg: '#df352c', deep: '#9f1717', text: '#fff7ef' },
  yellow: { bg: '#f2c436', deep: '#b77b00', text: '#3b2600' },
  green: { bg: '#25a85a', deep: '#116b34', text: '#f4fff8' },
  blue: { bg: '#2581d8', deep: '#14518f', text: '#f4fbff' },
};

function getSymbol(card: UnoCard): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'action') {
    const symbols = {
      skip: '⊘',
      reverse: '↻',
      draw2: '+2',
      draw4: '+4',
      'discard-all': 'ALL',
    } as const;
    return symbols[card.symbol];
  }
  const symbols = {
    wild: '◆',
    'wild-draw4': '+4',
    'wild-draw6': '+6',
    'wild-draw10': '+10',
    'wild-reverse-draw4': '↻+4',
    'wild-color-roulette': '◎',
    'wild-skip-all': '⊘ALL',
  } as const;
  return symbols[card.symbol];
}

function WildColorWheel() {
  return (
    <div style={{
      width: '52%',
      aspectRatio: '1',
      borderRadius: '50%',
      background: 'conic-gradient(#df352c 0 25%, #f2c436 0 50%, #25a85a 0 75%, #2581d8 0)',
      border: '3px solid rgba(255,255,255,0.9)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      margin: '0 auto 6px',
    }} />
  );
}

function PawBackIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`uno-paw-back-mark ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <span className="uno-paw-pad" />
      <span className="uno-paw-toe uno-paw-toe-1" />
      <span className="uno-paw-toe uno-paw-toe-2" />
      <span className="uno-paw-toe uno-paw-toe-3" />
    </span>
  );
}

type UnoCardViewProps = {
  card?: UnoCard;
  variant?: UnoVariant;
  playable?: boolean;
  selected?: boolean;
  hidden?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

export function UnoCardView({
  card,
  variant = 'standard',
  playable = false,
  selected = false,
  hidden = false,
  compact = false,
  onClick,
}: UnoCardViewProps) {
  const isHard = variant === 'hard';
  const isWild = !hidden && card?.kind === 'wild';
  const color = !hidden && card && card.kind !== 'wild' ? COLOR_STYLES[card.color] : null;
  const background = hidden
    ? (isHard ? 'linear-gradient(145deg, #151010, #590c12)' : 'linear-gradient(145deg, #7c1d18, #151010)')
    : isWild
    ? 'linear-gradient(145deg, #111, #292929 48%, #050505)'
    : `linear-gradient(145deg, ${color?.bg}, ${color?.deep})`;
  const textColor = !hidden && color ? color.text : '#fff7e8';
  const label = hidden ? '' : card ? getUnoCardName(card) : '';
  const symbol = hidden ? '' : card ? getSymbol(card) : '';

  return (
    <button
      type="button"
      aria-label={hidden ? '山札カード' : label}
      onClick={onClick}
      disabled={!onClick}
      className={`uno-card ${playable ? 'is-playable' : ''} ${selected ? 'is-selected' : ''} ${isHard ? 'is-hard' : ''}`}
      style={{
        width: compact ? 66 : 92,
        aspectRatio: '0.68',
        borderRadius: compact ? 10 : 14,
        border: isHard ? '3px solid #17110f' : '3px solid #fff7e8',
        background,
        color: textColor,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: selected
          ? '0 0 0 3px #ffd34d, 0 8px 24px rgba(0,0,0,0.28)'
          : playable
          ? '0 5px 18px rgba(255, 205, 60, 0.34)'
          : '0 4px 14px rgba(0,0,0,0.20)',
        padding: compact ? 5 : 7,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'inherit',
        flexShrink: 0,
        opacity: onClick || hidden || playable ? 1 : 0.96,
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 5,
        borderRadius: compact ? 7 : 10,
        border: '1.5px solid rgba(255,255,255,0.76)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: hidden ? '15% 16%' : '19% 12%',
        borderRadius: '50%',
        background: hidden
          ? 'radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0.03))'
          : isWild
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(255,255,255,0.88)',
        transform: 'rotate(-16deg)',
      }} />
      {!hidden && card?.kind === 'wild' && <WildColorWheel />}
      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', fontSize: compact ? 11 : 13, fontWeight: 900 }}>
          <span>{hidden ? '' : symbol}</span>
          <span>{hidden ? '' : symbol}</span>
        </div>
        <div style={{
          fontSize: compact ? 24 : symbol.length >= 4 ? 22 : 34,
          fontWeight: 900,
          lineHeight: 1,
          color: isWild || hidden ? '#fff7e8' : color?.deep,
          textShadow: isWild || hidden ? '0 2px 0 rgba(0,0,0,0.35)' : 'none',
          transform: hidden ? 'rotate(-10deg)' : 'rotate(-8deg)',
        }}>
          {hidden ? <PawBackIcon compact={compact} /> : symbol}
        </div>
        <div style={{
          minHeight: compact ? 20 : 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px 4px',
          borderRadius: 8,
          background: isHard ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.24)',
          color: isWild || hidden ? '#fff7e8' : textColor,
          fontSize: compact ? 8 : 10,
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: 'center',
          width: '100%',
        }}>
          {label}
        </div>
      </div>
    </button>
  );
}
