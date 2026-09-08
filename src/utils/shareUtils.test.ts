import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, getGameSiteUrl } from './shareUtils';

describe('shareUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('copyToClipboard', () => {
    it('returns false for empty text', async () => {
      const result = await copyToClipboard('');
      expect(result).toBe(false);
    });

    it('copies using navigator.clipboard when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const result = await copyToClipboard('ABC123');
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('ABC123');
    });

    it('falls back to document.execCommand when clipboard API throws', async () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('document', {
        createElement: () => ({
          style: {},
          focus: vi.fn(),
          select: vi.fn(),
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        execCommand: execCommandMock,
      });

      const result = await copyToClipboard('XYZ789');
      expect(result).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
  });

  describe('getGameSiteUrl', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns formatted URL from window.location', () => {
      vi.stubGlobal('window', {
        location: {
          origin: 'https://dragon-game-park.vercel.app',
          pathname: '/game',
        },
      });

      expect(getGameSiteUrl()).toBe('https://dragon-game-park.vercel.app/game/');
    });
  });
});
