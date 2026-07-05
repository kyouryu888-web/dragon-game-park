// バックギャモン ダークファンタジーUIの共有パーツ
// claude.ai/design の Backgammon.dc.html デザインを忠実に移植したもの

export const BG = {
  gold: '#c9a24b',
  goldBright: '#e6c877',
  goldPale: '#f0dfae',
  goldDim: '#8a6f3a',
  ember: '#e0733a',
  text: '#e8ddc8',
  textMid: '#b9a888',
  muted: '#9a8d75',
  dim: '#8a7a58',
  faint: '#5f5443',
  ink: '#efe4c9',
  panelBg: 'rgba(13,11,16,.55)',
  panelBorder: 'rgba(201,162,75,.25)',
  serifJa: "'Shippori Mincho B1',serif",
  serifEn: 'Cinzel,serif',
} as const;

/** 番人ドラゴンのSVG。variant: gold=マスコット / crimson=対戦相手アバター */
export function DragonIcon({ size, variant = 'gold' }: { size: number; variant?: 'gold' | 'crimson' }) {
  const body = variant === 'gold' ? '#c9a24b' : '#e0733a';
  const horn = variant === 'gold' ? '#8a6f3a' : '#b8502e';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M28 15 C24 5 14 2 8 6 C15 7 19 11 21 17 Z" fill={horn} />
      {variant === 'gold' && <path d="M34 13 C33 7 28 3 23 3 C27 6 29 9 30 13 Z" fill={horn} />}
      <path d="M21 17 C28 10 40 10 48 17 L59 24 L58 27 L45 28 L54 37 L51 39 L40 33 C38 38 37 44 38 50 L40 58 L22 58 C24 48 22 38 20 32 C19 26 19 21 21 17 Z" fill={body} />
      {variant === 'gold' && (
        <>
          <path d="M23 30 L14 26 L21 37 Z" fill={horn} />
          <path d="M25 43 L16 40 L23 50 Z" fill={horn} />
        </>
      )}
      <circle cx="39" cy="20" r="2.4" fill="#15121a" />
      {variant === 'gold' && <path d="M57 30 L63 33 L56 34 Z" fill="#e0733a" />}
    </svg>
  );
}

export function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2 L4 7 L9 12" stroke={BG.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flex: 'none' }}>
      <path d="M3.5 9.5 L7.5 13 L14.5 5" stroke={BG.goldBright} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ヘッダーの「←戻る」枠付きボタン */
export function BackButton({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: small ? 6 : 8, minHeight: 44,
        padding: small ? '0 10px 0 6px' : '0 12px 0 8px',
        color: BG.gold, border: '1px solid rgba(201,162,75,.35)', borderRadius: 4,
        background: 'rgba(201,162,75,.06)', fontSize: small ? 12.5 : 13,
        letterSpacing: '.06em', cursor: 'pointer', fontFamily: BG.serifJa,
      }}
    >
      <ChevronLeft />
      <span>{label}</span>
    </button>
  );
}

/** 金縁のメインCTAボタン */
export function GoldButton({
  children, onClick, minHeight = 58, fontSize = 17, letterSpacing = '.22em',
}: {
  children: React.ReactNode; onClick: () => void;
  minHeight?: number; fontSize?: number; letterSpacing?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', minHeight, borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${BG.gold}`,
        background: 'linear-gradient(180deg,#3a2c17 0%,#2a1f12 100%)',
        color: BG.goldPale, fontFamily: BG.serifJa, fontSize, fontWeight: 700, letterSpacing,
        boxShadow: '0 0 26px rgba(224,115,58,.22), inset 0 1px 0 rgba(255,235,180,.18)',
      }}
    >
      {children}
    </button>
  );
}

/** セクション見出し「I. 名を刻む」 */
export function SectionHeading({ numeral, text }: { numeral: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
      <span style={{ fontFamily: BG.serifEn, fontSize: 11, letterSpacing: '.24em', color: BG.goldDim }}>{numeral}</span>
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.14em', color: BG.goldBright }}>{text}</span>
    </div>
  );
}

/** ダーク背景のテキスト入力 */
export function DarkInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  height?: number;
  codeStyle?: boolean;
}) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      maxLength={props.maxLength ?? 12}
      placeholder={props.placeholder}
      style={{
        width: '100%', boxSizing: 'border-box', height: props.height ?? 52, padding: '0 16px',
        background: 'rgba(13,11,16,.7)', border: '1px solid rgba(201,162,75,.35)', borderRadius: 5,
        color: BG.ink, outline: 'none',
        ...(props.codeStyle
          ? { fontFamily: BG.serifEn, fontSize: 18, letterSpacing: '.3em', textTransform: 'uppercase' as const }
          : { fontFamily: BG.serifJa, fontSize: 16, letterSpacing: '.06em' }),
      }}
      onFocus={(e) => { e.target.style.border = `1px solid ${BG.gold}`; e.target.style.boxShadow = '0 0 0 3px rgba(201,162,75,.15)'; }}
      onBlur={(e) => { e.target.style.border = '1px solid rgba(201,162,75,.35)'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

/** 画面下部の刻印 */
export function Brand() {
  return (
    <div style={{ textAlign: 'center', fontFamily: BG.serifEn, fontSize: 10, letterSpacing: '.3em', color: BG.faint }}>
      DRAGON-GAME-PARK
    </div>
  );
}
