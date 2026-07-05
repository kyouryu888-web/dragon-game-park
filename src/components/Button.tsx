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
    background: 'linear-gradient(180deg, #3a2c17 0%, #2a1f12 100%)',
    color: '#f0dfae',
    border: '1px solid #c9a24b',
    boxShadow: '0 0 20px rgba(224, 115, 58, 0.22), inset 0 1px 0 rgba(255, 235, 180, 0.18)',
  },
  secondary: {
    background: 'rgba(201, 162, 75, 0.08)',
    color: '#d8c79a',
    border: '1px solid rgba(201, 162, 75, 0.4)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: '#9a8d75',
    border: '1px solid rgba(201, 162, 75, 0.25)',
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
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: '.12em',
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
