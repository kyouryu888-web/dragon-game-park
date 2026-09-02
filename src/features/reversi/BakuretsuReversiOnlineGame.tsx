import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BakuretsuReversiGameScreen } from './BakuretsuReversiGameScreen';
import {
  acknowledgeBakuretsuReversiPlayback,
  fetchBakuretsuReversiRoom,
  rematchBakuretsuReversiRoom,
  snapshotFromBakuretsuReversiRow,
  submitBakuretsuReversiMove,
  subscribeBakuretsuReversiRoom,
  type BakuretsuReversiRoomInfo,
  type BakuretsuReversiRoomRow,
} from './bakuretsuReversiOnline';
import type { Move } from './bakuretsu/types';
import type { BakuretsuReversiConfig } from './bakuretsuUi';

export function BakuretsuReversiOnlineGame({
  room,
  initialRow,
  onBackToSetup,
  onBackToHome,
}: {
  room: BakuretsuReversiRoomInfo;
  initialRow: BakuretsuReversiRoomRow;
  onBackToSetup: () => void;
  onBackToHome: () => void;
}) {
  const [row, setRow] = useState(initialRow);
  const [syncMessage, setSyncMessage] = useState('');
  const [serverPending, setServerPending] = useState(false);
  const [synchronizedResetKey, setSynchronizedResetKey] = useState(0);
  const rowRef = useRef(row);
  const mountedRef = useRef(true);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const initialSnapshotRef = useRef(snapshotFromBakuretsuReversiRow(initialRow));
  rowRef.current = row;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchBakuretsuReversiRoom(room.roomCode, room.myOnlineId).then((fresh) => {
      if (!cancelled && fresh) setRow((current) => fresh.version >= current.version ? fresh : current);
    });
    const unsubscribe = subscribeBakuretsuReversiRoom(room.roomCode, room.myOnlineId, (incoming) => {
      setRow((current) => incoming.version >= current.version ? incoming : current);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.myOnlineId, room.roomCode]);

  const submitMove = useCallback((move: Move | null, timeout: boolean) => {
    setServerPending(true);
    writeChainRef.current = writeChainRef.current
      .then(async () => {
        const current = rowRef.current;
        const saved = await submitBakuretsuReversiMove(
          room.roomCode,
          room.myOnlineId,
          move,
          timeout,
          current.version,
        );
        if (saved) {
          if (saved.version >= rowRef.current.version) {
            rowRef.current = saved;
            setRow(saved);
          }
          setSyncMessage('');
          setServerPending(false);
          return;
        }
        const fresh = await fetchBakuretsuReversiRoom(room.roomCode, room.myOnlineId);
        const authoritative = fresh && fresh.version >= rowRef.current.version ? fresh : rowRef.current;
        rowRef.current = authoritative;
        setRow(authoritative);
        setSynchronizedResetKey((value) => value + 1);
        setServerPending(false);
        setSyncMessage(fresh
          ? '相手の一手を優先して爆裂盤を同期しました'
          : 'サーバーで着手を確認できないため、最後に確認できた爆裂盤へ戻しました');
      })
      .catch(() => {
        const authoritative = rowRef.current;
        setRow(authoritative);
        setSynchronizedResetKey((value) => value + 1);
        setServerPending(false);
        setSyncMessage('着手をサーバーへ送信できませんでした。通信を確認してください');
      });
  }, [room.myOnlineId, room.roomCode]);

  const acknowledgeTurnReady = useCallback((matchNo: number, moveNo: number) => {
    void (async () => {
      let attempt = 0;
      while (mountedRef.current) {
        const current = rowRef.current;
        if (
          current.game_state.status !== 'PLAYING'
          || current.match_no !== matchNo
          || current.game_state.moveNo !== moveNo
          || current.game_state.currentTurn !== room.mySide
          || current.turn_started_at !== null
        ) return;
        const saved = await acknowledgeBakuretsuReversiPlayback(
          room.roomCode,
          room.myOnlineId,
          current.version,
        );
        if (saved) {
          const isCurrent = saved.version >= rowRef.current.version;
          if (isCurrent) {
            rowRef.current = saved;
            if (mountedRef.current) {
              setRow((currentRow) => saved.version >= currentRow.version ? saved : currentRow);
              setSyncMessage('');
            }
          }
          return;
        }
        const fresh = await fetchBakuretsuReversiRoom(room.roomCode, room.myOnlineId);
        if (fresh && fresh.version >= rowRef.current.version) {
          rowRef.current = fresh;
          if (mountedRef.current) setRow(fresh);
          if (fresh.turn_started_at !== null || fresh.game_state.currentTurn !== room.mySide) return;
        }
        attempt += 1;
        if (attempt === 5 && mountedRef.current) {
          setSyncMessage('演出完了を確認できません。通信の回復後に自動で再試行します');
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
      }
    })().catch(() => {
      if (mountedRef.current) setSyncMessage('演出完了をサーバーへ送信できませんでした。通信を確認してください');
    });
  }, [room.myOnlineId, room.mySide, room.roomCode]);

  const rematch = useCallback(() => {
    if (!room.isHost) return;
    setServerPending(true);
    writeChainRef.current = writeChainRef.current.then(async () => {
      const saved = await rematchBakuretsuReversiRoom(
        room.roomCode,
        room.myOnlineId,
        rowRef.current.version,
      );
      if (saved) {
        rowRef.current = saved;
        setRow(saved);
        setSyncMessage('');
      } else {
        setSyncMessage('再戦をサーバーで開始できませんでした');
      }
      setServerPending(false);
    }).catch(() => {
      setServerPending(false);
      setSyncMessage('再戦をサーバーへ送信できませんでした');
    });
  }, [room.isHost, room.myOnlineId, room.roomCode]);

  const synchronizedSnapshot = useMemo(() => snapshotFromBakuretsuReversiRow(row), [row]);
  const config: BakuretsuReversiConfig = {
    mode: 'online',
    name: row.host_name,
    name2: row.guest_name ?? '挑戦者',
    cpuLevel: 3,
    humanSide: room.mySide,
  };

  return (
    <div className="reversi-online-game-wrapper">
      {syncMessage ? <div className="reversi-online-sync-message" role="status">{syncMessage}</div> : null}
      <BakuretsuReversiGameScreen
        config={config}
        initialSnapshot={initialSnapshotRef.current}
        synchronizedSnapshot={synchronizedSnapshot}
        synchronizedResetKey={synchronizedResetKey}
        viewerSide={room.mySide}
        roomCode={room.roomCode}
        canRematch={room.isHost && !serverPending}
        onlineMovePending={serverPending}
        rematchWaitingMessage="ルームの主が再戦を選ぶと、このまま次の爆裂対局が始まります。"
        onMoveRequest={submitMove}
        onTurnReadyRequest={acknowledgeTurnReady}
        onRematch={rematch}
        onBackToSetup={onBackToSetup}
        onBackToHome={onBackToHome}
      />
    </div>
  );
}
