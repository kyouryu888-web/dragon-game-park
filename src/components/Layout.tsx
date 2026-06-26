type LayoutProps = {
  children: React.ReactNode;
};

/**
 * 画面共通のレイアウト枠
 * スマホ: 最大520px、タブレット: 最大680px、PC: 最大800px
 * 詳細は global.css の .app-layout を参照
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-layout">
      {children}
    </div>
  );
}
