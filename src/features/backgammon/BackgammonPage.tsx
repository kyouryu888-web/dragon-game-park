import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackgammonConfig } from './backgammonTypes';
import { BackgammonSettingsScreen } from './BackgammonSettingsScreen';
import { BackgammonLocalGame } from './BackgammonLocalGame';
import { BackgammonOnlineGame } from './BackgammonOnlineGame';
import {
  type BackgammonRoomInfo, type OnlinePayload,
  createRoom, fetchRoom, joinRoom, subscribeRoom,
} from './backgammonOnline';
import { BG, BackButton, Brand } from './BackgammonUi';
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from '../../components/gameSetupDefaults';

const CONFIG_STORAGE_KEY = 'dragon-game-park:backgammon-config-v2';

type Screen = 'settings' | 'waiting' | 'play' | 'online-play';

function loadSavedConfig(): BackgammonConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackgammonConfig;
    if (typeof parsed.mode !== 'string') return null;
    return parsed;
  } catch { return null; }
}

const DEFAULT_CONFIG: BackgammonConfig = { mode: DEFAULT_SETUP_MODE, name: '', name2: '', cpuLevel: 'normal' };

type BackgammonPageProps = {
  onBackToHome: () => void;
};

export function BackgammonPage({ onBackToHome }: BackgammonPageProps) {
  const [screen, setScreen] = useState<Screen>('settings');
  const [config, setConfig] = useState<BackgammonConfig>(() => ({
    ...(loadSavedConfig() ?? DEFAULT_CONFIG),
    mode: DEFAULT_SETUP_MODE,
  }));
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<BackgammonRoomInfo | null>(null);
  const [roomPayload, setRoomPayload] = useState<OnlinePayload | null>(null);
  const [isJoiner, setIsJoiner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function updateConfig(patch: Partial<BackgammonConfig>) {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // ---- 開始 ----
  async function handleStart() {
    // 名前は空でもよい（名もなき挑戦者として遊べる）
    const myName = config.name.trim() || '名もなき挑戦者';

    if (config.mode !== 'online') {
      setScreen('play');
      showToast(config.mode === 'cpu' ? 'そなたから振るがよい' : `${myName}から振るがよい`);
      return;
    }

    // オンライン
    if (onlineTab === 'join') {
      if (joinCode.length < 4) { showToast('コードは4文字以上で入力を'); return; }
      setIsJoiner(true);
      setScreen('waiting');
      try {
        const info = await joinRoom(joinCode, myName);
        const row = await fetchRoom(info.roomCode);
        if (!row) throw new Error('その紋章のルームは見つからぬ');
        setRoom(info);
        setRoomPayload(row.game_state);
        setScreen('online-play');
        showToast('盤の前に着いた');
      } catch (e) {
        showToast(e instanceof Error ? e.message : '入室できなかった');
        setScreen('settings');
      }
    } else {
      try {
        const info = await createRoom(myName);
        setRoom(info);
        setIsJoiner(false);
        setCopied(false);
        setScreen('waiting');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'ルームを開けなかった');
      }
    }
  }

  // ---- ホストの待機: ゲスト参加を監視 ----
  useEffect(() => {
    if (screen !== 'waiting' || isJoiner || !room) return;
    const unsubscribe = subscribeRoom(room.roomCode, (row) => {
      if (row.guest_id && row.game_state.guestName) {
        setRoomPayload(row.game_state);
        setScreen('online-play');
        showToast(`${row.game_state.guestName}が現れた!`);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, isJoiner, room]);

  function copyCode() {
    if (!room) return;
    try { void navigator.clipboard.writeText(room.roomCode); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  // ---- 火の粉 ----
  const embers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const left = 4 + Math.random() * 92;
      const dur = 5 + Math.random() * 6;
      const delay = Math.random() * 8;
      const size = 2 + Math.random() * 3;
      return (
        <span
          key={i}
          style={{
            position: 'absolute', left: `${left}%`, bottom: -8,
            width: size, height: size, borderRadius: '50%',
            background: i % 3 === 0 ? '#e6c877' : '#e0733a',
            filter: 'blur(.5px)',
            animation: `emberRise ${dur}s ${delay}s linear infinite`,
            opacity: 0,
          }}
        />
      );
    });
  }, []);

  const backToSettings = () => {
    setScreen('settings');
    setRoom(null);
    setRoomPayload(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg,#0d0b10 0%,#141017 45%,#1c1119 100%)',
      display: 'flex', justifyContent: 'center',
      fontFamily: BG.serifJa, color: BG.text, touchAction: 'manipulation',
    }}>
      <div className={`backgammon-page-shell is-${screen}`} style={{
        width: '100%', minHeight: '100vh', position: 'relative', overflow: 'hidden',
        background: [
          'radial-gradient(ellipse 120% 55% at 50% 108%, rgba(224,115,58,.22) 0%, rgba(224,115,58,.05) 45%, transparent 70%)',
          'repeating-linear-gradient(0deg, rgba(255,255,255,.014) 0px, rgba(255,255,255,.014) 1px, transparent 1px, transparent 7px)',
          'linear-gradient(180deg,#15121a 0%,#191320 60%,#1e1420 100%)',
        ].join(', '),
        boxShadow: '0 0 80px rgba(0,0,0,.8)',
      }}>
        {/* rising embers */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
          {embers}
        </div>

        {screen === 'settings' && (
          <BackgammonSettingsScreen
            config={config}
            onChange={updateConfig}
            onlineTab={onlineTab}
            onOnlineTabChange={setOnlineTab}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            onStart={() => { void handleStart(); }}
            onBackToHome={onBackToHome}
          />
        )}

        {screen === 'waiting' && (
          <div style={{
            position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
            minHeight: '100vh', padding: '0 20px 32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px', borderBottom: '1px solid rgba(201,162,75,.22)' }}>
              <BackButton label="設定に戻る" onClick={backToSettings} />
            </div>

            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center', gap: 8,
            }}>
              {!isJoiner && room && (
                <>
                  <div style={{ fontFamily: BG.serifEn, fontSize: 11, letterSpacing: '.3em', color: BG.goldDim }}>ROOM CODE</div>
                  <div style={{
                    marginTop: 4, padding: '18px 30px', border: '1.5px solid rgba(201,162,75,.5)',
                    borderRadius: 8, background: 'rgba(13,11,16,.6)',
                    boxShadow: '0 0 30px rgba(224,115,58,.15), inset 0 0 20px rgba(0,0,0,.5)',
                  }}>
                    <div style={{
                      fontFamily: BG.serifEn, fontSize: 40, fontWeight: 700, letterSpacing: '.28em',
                      color: BG.goldBright, textShadow: '0 0 18px rgba(224,115,58,.45)', paddingLeft: '.28em',
                    }}>
                      {room.roomCode}
                    </div>
                  </div>
                  <button
                    onClick={copyCode}
                    style={{
                      marginTop: 10, minHeight: 44, padding: '0 22px', borderRadius: 4, cursor: 'pointer',
                      border: '1px solid rgba(201,162,75,.4)', background: 'rgba(201,162,75,.08)',
                      color: '#d8c79a', fontFamily: BG.serifJa, fontSize: 13.5, letterSpacing: '.1em',
                    }}
                  >
                    {copied ? '写し取った ✓' : 'コードを写す'}
                  </button>
                </>
              )}

              <div style={{
                marginTop: 34, display: 'flex', alignItems: 'center', gap: 10,
                color: BG.textMid, fontSize: 14.5, letterSpacing: '.12em',
              }}>
                <span>{isJoiner ? 'ルームの扉を叩いています' : '対戦相手を待っています'}</span>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {[0, 0.2, 0.4].map((d) => (
                    <span key={d} style={{
                      width: 5, height: 5, borderRadius: '50%', background: BG.ember,
                      animation: `dotPulse 1.4s ${d}s infinite`,
                    }} />
                  ))}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#7a6f5c', marginTop: 4 }}>
                {isJoiner ? '主が招き入れるまでしばし待たれよ' : 'このコードを相手に伝えるべし'}
              </div>
            </div>

            <Brand />
          </div>
        )}

        {screen === 'play' && (
          <BackgammonLocalGame
            config={config}
            showToast={showToast}
            onExitToSettings={backToSettings}
            onBackToHome={onBackToHome}
          />
        )}

        {screen === 'online-play' && room && roomPayload && (
          <BackgammonOnlineGame
            room={room}
            initialPayload={roomPayload}
            showToast={showToast}
            onExitToSettings={backToSettings}
            onBackToHome={onBackToHome}
          />
        )}

        {/* toast */}
        {toast && (
          <div style={{
            position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)', zIndex: 50,
            padding: '12px 20px', background: 'rgba(30,22,18,.95)',
            border: '1px solid rgba(224,115,58,.5)', borderRadius: 6,
            color: BG.goldPale, fontSize: 13.5, letterSpacing: '.06em',
            boxShadow: '0 6px 24px rgba(0,0,0,.6)', whiteSpace: 'nowrap',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
