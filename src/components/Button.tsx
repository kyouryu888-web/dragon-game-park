type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  /** primary=メインアクション  secondary=戻る系  ghost=リスタートなど控えめな操作 */
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
};

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(160deg, #a06030, #7a4020)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 3px 12px rgba(90, 48, 16, 0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
  },
  secondary: {
    background: '#ede4d4',
    color: '#5a3a1a',
    border: '1.5px solid #cbb898',
    boxShadow: '0 2px 6px rgba(90, 48, 16, 0.10)',
  },
  ghost: {
    background: 'transparent',
    color: '#7a5038',
    border: '1.5px solid #c8a870',
    boxShadow: 'none',
  },
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 20px',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
    letterSpacing: 0.4,
    lineHeight: 1.3,
    textAlign: 'center',
  };

  return (
    <button
      className={`btn btn-${variant}`}
      style={{ ...base, ...VARIANT_STYLES[variant] }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
