import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BABANUKI_ONLINE_PLAYER_ID_KEY,
  getOnlinePlayerId,
} from './babanukiOnline';

function storageFor(values = new Map<string, string>()): Storage {
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    get length() {
      return values.size;
    },
  };
}

describe('babanuki online player identity', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps one identity in the same tab session', () => {
    const storage = storageFor();
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'tab-a') });

    expect(getOnlinePlayerId()).toBe('tab-a');
    expect(getOnlinePlayerId()).toBe('tab-a');
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledWith(BABANUKI_ONLINE_PLAYER_ID_KEY, 'tab-a');
  });

  it('assigns different identities to separate tab sessions', () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce('tab-a')
      .mockReturnValueOnce('tab-b');
    vi.stubGlobal('crypto', { randomUUID });

    vi.stubGlobal('sessionStorage', storageFor());
    expect(getOnlinePlayerId()).toBe('tab-a');

    vi.stubGlobal('sessionStorage', storageFor());
    expect(getOnlinePlayerId()).toBe('tab-b');
  });
});
