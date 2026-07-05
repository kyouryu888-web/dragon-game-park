type CardProps = {
  children: React.ReactNode;
  onClick?: () => void;
  /** 選択中のカードを強調表示する */
  selected?: boolean;
  padding?: string | number;
};

export function Card({ children, onClick, selected = false, padding = '20px' }: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        backgroundColor: 'rgba(13, 11, 16, 0.55)',
        borderRadius: 10,
        padding,
        boxShadow: selected
          ? '0 0 20px rgba(201, 162, 75, 0.3), 0 0 0 1.5px #c9a24b, inset 0 0 12px rgba(201, 162, 75, 0.08)'
          : '0 4px 18px rgba(0, 0, 0, 0.4)',
        border: selected ? '1.5px solid #c9a24b' : '1px solid rgba(201, 162, 75, 0.25)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
