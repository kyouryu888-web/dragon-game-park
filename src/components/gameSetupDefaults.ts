export const DEFAULT_SETUP_MODE = 'online' as const;
export const DEFAULT_ONLINE_ENTRY_MODE = 'join' as const;

export function shouldAutoJoinOnlineRoom(mode: 'create' | 'join', code: string): boolean {
  return mode === 'join' && /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase());
}
