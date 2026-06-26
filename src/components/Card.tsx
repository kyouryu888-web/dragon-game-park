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
        backgroundColor: '#fffdf8',
        borderRadius: 20,
        padding,
        boxShadow: selected
          ? '0 4px 20px rgba(122, 64, 32, 0.22), 0 0 0 2.5px #8b5a30'
          : '0 2px 14px rgba(92, 48, 24, 0.10)',
        border: selected ? '2px solid #8b5a30' : '1.5px solid #e8ddd0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
