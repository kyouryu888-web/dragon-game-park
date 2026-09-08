/**
 * クリップボードへのテキストコピー（フォールバック対応）
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. モダンブラウザの Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 権限エラーや非セキュア環境等の場合はフォールバックへ
    }
  }

  // 2. レガシー・セキュリティ制限環境向け execCommand フォールバック
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // 画面外に配置し、ズームやスクロールを防止
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) return true;
    } catch {
      // execCommand も失敗した場合は false
    }
  }

  return false;
}

/**
 * ゲームサイトのベースURLを取得する
 */
export function getGameSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname.endsWith('/') ? pathname : `${pathname}/`}`;
  }
  return 'https://dragon-game-park.vercel.app/';
}
