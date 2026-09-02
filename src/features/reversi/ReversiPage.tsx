import { useEffect, useState } from "react";
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from "../../components/gameSetupDefaults";
import { BakuretsuReversiGameScreen } from "./BakuretsuReversiGameScreen";
import { BakuretsuReversiOnlineGame } from "./BakuretsuReversiOnlineGame";
import { BakuretsuReversiWaitingScreen } from "./BakuretsuReversiWaitingScreen";
import {
  createBakuretsuReversiRoom,
  deleteBakuretsuReversiRoom,
  isBakuretsuReversiRoomReady,
  joinBakuretsuReversiRoom,
  subscribeBakuretsuReversiRoom,
  getBakuretsuReversiOnlinePlayerId,
  } from "./bakuretsuReversiOnline";
import { DEFAULT_BAKURETSU_REVERSI_CONFIG, type BakuretsuReversiConfig } from "./bakuretsuUi";

import { ReversiGameScreen } from "./ReversiGameScreen";
import { ReversiOnlineGame } from "./ReversiOnlineGame";
import {
  createReversiRoom,
  deleteReversiRoom,
  isReversiRoomReady,
  joinReversiRoom,
  subscribeReversiRoom,
  } from "./reversiOnline";
import { ReversiWaitingScreen } from "./ReversiWaitingScreen";
import type { ReversiConfig } from "./reversiTypes";

import { ReversiUnifiedSettingsScreen } from "./ReversiUnifiedSettingsScreen";

const STORAGE_KEY_NORMAL = "dragon-game-park:reversi-config-v2";
const DEFAULT_CONFIG_NORMAL: ReversiConfig = {
  mode: DEFAULT_SETUP_MODE,
  name: "",
  name2: "",
  cpuLevel: "normal",
  humanSide: "black",
};

const STORAGE_KEY_BAKURETSU = "dragon-game-park:bakuretsu-reversi-config-v1";

function loadNormalConfig(): ReversiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NORMAL);
    if (!raw) return DEFAULT_CONFIG_NORMAL;
    const parsed = JSON.parse(raw) as Partial<ReversiConfig>;
    return { ...DEFAULT_CONFIG_NORMAL, ...parsed, mode: DEFAULT_SETUP_MODE };
  } catch {
    return DEFAULT_CONFIG_NORMAL;
  }
}

function loadBakuretsuConfig(): BakuretsuReversiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BAKURETSU);
    if (!raw) return DEFAULT_BAKURETSU_REVERSI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BakuretsuReversiConfig>;
    return { ...DEFAULT_BAKURETSU_REVERSI_CONFIG, ...parsed, mode: "cpu" };
  } catch {
    return DEFAULT_BAKURETSU_REVERSI_CONFIG;
  }
}

export function ReversiPage({ onBackToHome }: { onBackToHome: () => void }) {
  const [screen, setScreen] = useState<"settings" | "play" | "waiting" | "online-play">("settings");
  const [variant, setVariant] = useState<"normal" | "bakuretsu">("normal");

  const [normalConfig, setNormalConfig] = useState<ReversiConfig>(loadNormalConfig);
  const [bakuretsuConfig, setBakuretsuConfig] = useState<BakuretsuReversiConfig>(loadBakuretsuConfig);

  const [onlineTab, setOnlineTab] = useState<"create" | "join">(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState("");

  const [room, setRoom] = useState<any>(null);
  const [roomRow, setRoomRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [screen]);

  // Online subscribe
  useEffect(() => {
    if (screen !== "waiting" || !room?.isHost) return;
    
    if (variant === "normal") {
      const unsubscribe = subscribeReversiRoom(room.roomCode, (incoming) => {
        setRoomRow((current: any) => !current || incoming.version > current.version ? incoming : current);
        if (isReversiRoomReady(incoming)) {
          setRoomRow(incoming);
          setScreen("online-play");
          setMessage(`${incoming.guest_name ?? "挑戦者"}が盤の前に現れました`);
        }
      });
      return unsubscribe;
    } else {
      const unsubscribe = subscribeBakuretsuReversiRoom(room.roomCode, getBakuretsuReversiOnlinePlayerId(), (incoming) => {
        setRoomRow((current: any) => !current || incoming.version > current.version ? incoming : current);
        if (isBakuretsuReversiRoomReady(incoming)) {
          setRoomRow(incoming);
          setScreen("online-play");
          setMessage(`${incoming.guest_name ?? "挑戦者"}が盤の前に現れました`);
        }
      });
      return unsubscribe;
    }
  }, [room, screen, variant]);

  function updateNormalConfig(patch: Partial<ReversiConfig>) {
    setNormalConfig((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(STORAGE_KEY_NORMAL, JSON.stringify(next)); } catch { }
      return next;
    });
  }

  function updateBakuretsuConfig(patch: Partial<BakuretsuReversiConfig>) {
    setBakuretsuConfig((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(STORAGE_KEY_BAKURETSU, JSON.stringify(next)); } catch { }
      return next;
    });
  }

  async function handleStart() {
    const config = variant === "normal" ? normalConfig : bakuretsuConfig;
    if (config.mode !== "online") {
      setScreen("play");
      setMessage("");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (variant === "normal") {
        if (onlineTab === "create") {
          const session = await createReversiRoom(config.name);
          setRoom(session.room);
          setRoomRow(session.row);
          setCopied(false);
          setScreen("waiting");
        } else {
          if (joinCode.length !== 6) throw new Error("コードは6文字で入力してください");
          const session = await joinReversiRoom(joinCode, config.name);
          setRoom(session.room);
          setRoomRow(session.row);
          if (session.room.isHost && !isReversiRoomReady(session.row)) {
            setScreen("waiting");
            setMessage("作成したルームへ戻りました");
          } else {
            setScreen("online-play");
            setMessage("ルームへ参加しました");
          }
        }
      } else {
        if (onlineTab === "create") {
          const session = await createBakuretsuReversiRoom(config.name);
          setRoom(session.room);
          setRoomRow(session.row);
          setCopied(false);
          setScreen("waiting");
        } else {
          if (joinCode.length !== 6) throw new Error("コードは6文字で入力してください");
          const session = await joinBakuretsuReversiRoom(joinCode, config.name);
          setRoom(session.room);
          setRoomRow(session.row);
          if (session.room.isHost && !isBakuretsuReversiRoomReady(session.row)) {
            setScreen("waiting");
            setMessage("作成したルームへ戻りました");
          } else {
            setScreen("online-play");
            setMessage("ルームへ参加しました");
          }
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "オンライン対戦を開始できませんでした");
      setScreen("settings");
    } finally {
      setBusy(false);
    }
  }

  function backToSettings() {
    setScreen("settings");
    setRoom(null);
    setRoomRow(null);
    setBusy(false);
  }

  function closeWaitingRoom() {
    if (room?.isHost) {
      if (variant === "normal") void deleteReversiRoom(room.roomCode);
      else void deleteBakuretsuReversiRoom(room.roomCode, getBakuretsuReversiOnlinePlayerId());
    }
    backToSettings();
  }

  function copyRoomCode() {
    if (!room) return;
    void navigator.clipboard.writeText(room.roomCode)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setMessage("コードをコピーできませんでした"));
  }

  if (screen === "play") {
    if (variant === "normal") {
      return <ReversiGameScreen config={normalConfig} onBackToSetup={backToSettings} onBackToHome={onBackToHome} />;
    } else {
      return <BakuretsuReversiGameScreen config={bakuretsuConfig} onBackToSetup={backToSettings} onBackToHome={onBackToHome} />;
    }
  }

  if (screen === "waiting" && room) {
    if (variant === "normal") {
      return <ReversiWaitingScreen roomCode={room.roomCode} copied={copied} onCopy={copyRoomCode} onCancel={closeWaitingRoom} />;
    } else {
      return <BakuretsuReversiWaitingScreen roomCode={room.roomCode} copied={copied} onCopy={copyRoomCode} onCancel={closeWaitingRoom} />;
    }
  }

  if (screen === "online-play" && room && roomRow) {
    if (variant === "normal") {
      return <ReversiOnlineGame room={room} initialRow={roomRow} onBackToSetup={backToSettings} onBackToHome={onBackToHome} />;
    } else {
      return <BakuretsuReversiOnlineGame room={room} initialRow={roomRow} onBackToSetup={backToSettings} onBackToHome={onBackToHome} />;
    }
  }

  return (
    <>
      <ReversiUnifiedSettingsScreen
        variant={variant}
        onVariantChange={setVariant}
        normalConfig={normalConfig}
        onNormalChange={updateNormalConfig}
        bakuretsuConfig={bakuretsuConfig}
        onBakuretsuChange={updateBakuretsuConfig}
        onlineTab={onlineTab}
        onOnlineTabChange={setOnlineTab}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onStart={handleStart}
        onBackToHome={onBackToHome}
      />
      {busy && <div className="game-setup-overlay"><div className="feature-loading">接続中...</div></div>}
      {message && <div className="game-setup-message">{message}</div>}
    </>
  );
}