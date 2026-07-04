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
    background: 'linear-gradient(160deg, #d9b545, #b1852a)',
    color: '#2c2410',
    border: '1px solid #8a6d1f',
    boxShadow: '0 3px 12px rgba(140, 110, 30, 0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
  },
  secondary: {
    background: '#ece5d0',
    color: '#1f4a36',
    border: '1.5px solid #b8ad8a',
    boxShadow: '0 2px 6px rgba(40, 60, 40, 0.10)',
  },
  ghost: {
    background: 'transparent',
    color: '#3f6b52',
    border: '1.5px solid #9fb59a',
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
