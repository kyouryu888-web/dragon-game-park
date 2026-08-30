import { useCallback, useEffect, useRef, useState } from 'react';
import { ReversiGameScreen } from './ReversiGameScreen';
import {
  createOnlineReversiState,
  fetchReversiRoom,
  pushReversiState,
  subscribeReversiRoom,
  type ReversiRoomInfo,
  type ReversiRoomRow,
} from './reversiOnline';
import type { ReversiConfig, ReversiGameState } from './reversiTypes';

type Props = {
  room: ReversiRoomInfo;
  initialRow: ReversiRoomRow;
  onBackToSetup: () => void;
  onBackToHome: () => void;
};

export function ReversiOnlineGame({ room, initialRow, onBackToSetup, onBackToHome }: Props) {
  const [row, setRow] = useState<ReversiRoomRow>(initialRow);
  const [syncMessage, setSyncMessage] = useState('');
  const rowRef = useRef(row);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  rowRef.current = row;

  useEffect(() => {
    let cancelled = false;
    void fetchReversiRoom(room.roomCode).then((fresh) => {
      if (!cancelled && fresh) setRow((current) => fresh.version > current.version ? fresh : current);
    });
    const unsubscribe = subscribeReversiRoom(room.roomCode, (incoming) => {
      setRow((current) => incoming.version > current.version ? incoming : current);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.roomCode]);

  const commitState = useCallback((nextState: ReversiGameState) => {
    writeChainRef.current = writeChainRef.current
      .then(async () => {
        const current = rowRef.current;
        const optimistic: ReversiRoomRow = {
          ...current,
          game_state: nextState,
          version: current.version + 1,
        };
        rowRef.current = optimistic;
        setRow(optimistic);
        const saved = await pushReversiState(room.roomCode, nextState, current.version);
        if (saved) {
          rowRef.current = saved;
          setRow(saved);
          setSyncMessage('');
          return;
        }
        const fresh = await fetchReversiRoom(room.roomCode);
        if (fresh) {
          rowRef.current = fresh;
          setRow(fresh);
          setSyncMessage('相手の一手を優先して盤面を同期しました');
        } else {
          setSyncMessage('通信が途切れました。ゲーム設定へ戻って入り直してください');
        }
      })
      .catch(() => setSyncMessage('盤面を送信できませんでした。通信を確認してください'));
  }, [room.roomCode]);

  const rematch = useCallback(() => {
    if (!room.isHost) return;
    const current = rowRef.current;
    commitState(createOnlineReversiState(current.host_name, current.guest_name ?? '挑戦者'));
  }, [commitState, room.isHost]);

  const config: ReversiConfig = {
    mode: 'online',
    name: row.host_name,
    name2: row.guest_name ?? '挑戦者',
    cpuLevel: 'normal',
    humanSide: room.myColor,
  };

  return (
    <div className="reversi-online-game-wrapper">
      {syncMessage ? <div className="reversi-online-sync-message" role="status">{syncMessage}</div> : null}
      <ReversiGameScreen
        config={config}
        initialState={initialRow.game_state}
        synchronizedState={row.game_state}
        viewerColor={room.myColor}
        roomCode={room.roomCode}
        canRematch={room.isHost}
        rematchWaitingMessage="ルームの主が再戦を選ぶと、このまま次の対局が始まります。"
        onStateCommit={commitState}
        onRematch={rematch}
        onBackToSetup={onBackToSetup}
        onBackToHome={onBackToHome}
      />
    </div>
  );
}
