import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchReversiRoomMock, joinReversiRoomMock, joinBakuretsuReversiRoomMock } = vi.hoisted(() => ({
  fetchReversiRoomMock: vi.fn(),
  joinReversiRoomMock: vi.fn(),
  joinBakuretsuReversiRoomMock: vi.fn(),
}));

vi.mock('./reversiOnline', () => ({
  fetchReversiRoom: fetchReversiRoomMock,
  joinReversiRoom: joinReversiRoomMock,
}));

vi.mock('./bakuretsuReversiOnline', () => ({
  joinBakuretsuReversiRoom: joinBakuretsuReversiRoomMock,
}));

import { joinReversiRoomAuto } from './reversiOnlineAuto';

describe('joinReversiRoomAuto', () => {
  beforeEach(() => {
    fetchReversiRoomMock.mockReset();
    joinReversiRoomMock.mockReset();
    joinBakuretsuReversiRoomMock.mockReset();
  });

  it('rejects invalid code lengths', async () => {
    await expect(joinReversiRoomAuto('ABC', '客')).rejects.toThrow('コードは6文字で入力してください');
  });

  it('auto-joins normal reversi room when normal room exists', async () => {
    fetchReversiRoomMock.mockResolvedValueOnce({ room_code: 'NORM01' });
    const mockSession = { room: { roomCode: 'NORM01' }, row: {} };
    joinReversiRoomMock.mockResolvedValueOnce(mockSession);

    const result = await joinReversiRoomAuto('norm01', '挑戦者');
    expect(result.variant).toBe('normal');
    expect(result.session).toBe(mockSession);
    expect(joinReversiRoomMock).toHaveBeenCalledWith('NORM01', '挑戦者');
    expect(joinBakuretsuReversiRoomMock).not.toHaveBeenCalled();
  });

  it('auto-joins bakuretsu reversi room when normal room is not found', async () => {
    fetchReversiRoomMock.mockResolvedValueOnce(null);
    const mockBakuretsuSession = { room: { roomCode: 'BAKU01' }, row: {} };
    joinBakuretsuReversiRoomMock.mockResolvedValueOnce(mockBakuretsuSession);

    const result = await joinReversiRoomAuto('baku01', '挑戦者');
    expect(result.variant).toBe('bakuretsu');
    expect(result.session).toBe(mockBakuretsuSession);
    expect(joinBakuretsuReversiRoomMock).toHaveBeenCalledWith('BAKU01', '挑戦者');
  });

  it('throws friendly error when room does not exist anywhere', async () => {
    fetchReversiRoomMock.mockResolvedValueOnce(null);
    joinBakuretsuReversiRoomMock.mockRejectedValueOnce(new Error('爆裂ルームに入れません'));

    await expect(joinReversiRoomAuto('NOTFND', '挑戦者')).rejects.toThrow(
      '入力されたコードのルームが見つかりませんでした（コードを確認してください）',
    );
  });
});
