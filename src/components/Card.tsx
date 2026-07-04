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
        backgroundColor: '#fbf7ec',
        borderRadius: 20,
        padding,
        boxShadow: selected
          ? '0 4px 20px rgba(160, 130, 40, 0.28), 0 0 0 2.5px #c9a227'
          : '0 2px 14px rgba(40, 60, 40, 0.10)',
        border: selected ? '2px solid #c9a227' : '1.5px solid #ddd2ac',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
