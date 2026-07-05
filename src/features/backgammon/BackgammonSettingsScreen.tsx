import type { BackgammonConfig, BackgammonMode, CpuLevel } from './backgammonTypes';
import { BG, Brand, CheckMark, ChevronLeft, DarkInput, DragonIcon, GoldButton, SectionHeading } from './BackgammonUi';

// ---- CPU 強さ一覧（ドラゴン段位） ----
const CPU_LEVELS: { level: CpuLevel; label: string; emoji: string }[] = [
  { level: 'very-easy', label: 'ベビードラゴン',   emoji: '🥚' },
  { level: 'easy',      label: 'ドラゴン',        emoji: '🐲' },
  { level: 'normal',    label: 'スーパードラゴン', emoji: '🐉' },
  { level: 'hard',      label: 'ドラゴンキング', emoji: '👑' },
  { level: 'very-hard', label: 'ゴッドドラゴン', emoji: '⚡' },
];

type OnlineTab = 'create' | 'join';

type SettingsScreenProps = {
  config: BackgammonConfig;
  onChange: (patch: Partial<BackgammonConfig>) => void;
  onlineTab: OnlineTab;
  onOnlineTabChange: (tab: OnlineTab) => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  showMascot?: boolean;
  onStart: () => void;
  onBackToHome: () => void;
};

const MODE_BTN_STYLE: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center', gap: 14, minHeight: 64,
  padding: '12px 16px', textAlign: 'left', background: 'rgba(13,11,16,.55)',
  border: '1px solid rgba(201,162,75,.25)', borderRadius: 6, cursor: 'pointer',
  color: BG.text, fontFamily: BG.serifJa,
};

function SelectedFrame() {
  return (
    <div style={{
      position: 'absolute', inset: -1, border: `1.5px solid ${BG.gold}`, borderRadius: 6,
      boxShadow: '0 0 16px rgba(201,162,75,.25), inset 0 0 12px rgba(201,162,75,.08)',
      pointerEvents: 'none',
    }} />
  );
}

/** モード選択ボタンの下に付くサブパネル */
function SubPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '2px 0 0 14px', padding: '14px 16px',
      borderLeft: '2px solid rgba(224,115,58,.45)', background: 'rgba(224,115,58,.05)',
      borderRadius: '0 6px 6px 0', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {children}
    </div>
  );
}

export function BackgammonSettingsScreen({
  config, onChange, onlineTab, onOnlineTabChange, joinCode, onJoinCodeChange,
  showMascot = true, onStart, onBackToHome,
}: SettingsScreenProps) {
  const tabOn = { border: BG.gold, bg: 'rgba(201,162,75,.16)', color: BG.goldPale };
  const tabOff = { border: 'rgba(201,162,75,.25)', bg: 'rgba(13,11,16,.5)', color: BG.muted };
  const ct = onlineTab === 'create' ? tabOn : tabOff;
  const jt = onlineTab === 'join' ? tabOn : tabOff;

  let ctaLabel = '盤へ進む';
  if (config.mode === 'online') ctaLabel = onlineTab === 'create' ? 'ルームを開く' : 'ルームに入る';

  const modeButton = (
    mode: BackgammonMode, icon: React.ReactNode, title: string, en: string, sub: string,
  ) => {
    const selected = config.mode === mode;
    return (
      <button onClick={() => onChange({ mode })} style={MODE_BTN_STYLE}>
        {selected && <SelectedFrame />}
        {icon}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '.08em' }}>
            {title} <span style={{ fontFamily: BG.serifEn, fontSize: 10, letterSpacing: '.18em', color: BG.dim }}>{en}</span>
          </div>
          <div style={{ fontSize: 12, color: BG.muted, marginTop: 3 }}>{sub}</div>
        </div>
        {selected && <CheckMark />}
      </button>
    );
  };

  return (
    <div style={{
      position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
      minHeight: '100vh', padding: '0 20px 32px',
    }}>
      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0 10px', borderBottom: '1px solid rgba(201,162,75,.22)',
      }}>
        <button
          onClick={onBackToHome}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px 0 8px',
            color: BG.gold, border: '1px solid rgba(201,162,75,.35)', borderRadius: 4,
            background: 'rgba(201,162,75,.06)', fontSize: 13, letterSpacing: '.06em',
            cursor: 'pointer', fontFamily: BG.serifJa,
          }}
        >
          <ChevronLeft />
          <span>TOPへ戻る</span>
        </button>
        <div style={{ fontFamily: BG.serifEn, fontSize: 11, letterSpacing: '.22em', color: BG.dim, textTransform: 'uppercase' }}>
          dragon-game-park
        </div>
      </div>

      {/* title */}
      <div style={{ textAlign: 'center', padding: '26px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: BG.goldDim }}>
          <div style={{ height: 1, width: 52, background: `linear-gradient(90deg,transparent,${BG.goldDim})` }} />
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0 L7.6 4.4 L12 6 L7.6 7.6 L6 12 L4.4 7.6 L0 6 L4.4 4.4 Z" fill={BG.goldDim} /></svg>
          <div style={{ height: 1, width: 52, background: `linear-gradient(270deg,transparent,${BG.goldDim})` }} />
        </div>
        <h1 style={{
          margin: '10px 0 6px', fontFamily: BG.serifEn, fontWeight: 700, fontSize: 34,
          letterSpacing: '.12em', color: BG.goldBright,
          textShadow: '0 0 24px rgba(224,115,58,.35), 0 2px 2px rgba(0,0,0,.6)',
        }}>
          BACKGAMMON
        </h1>
      </div>

      {/* dragon mascot */}
      {showMascot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 2px 6px' }}>
          <div style={{
            flex: 'none', width: 78, height: 78, borderRadius: '50%',
            border: '1.5px solid rgba(201,162,75,.5)',
            background: 'radial-gradient(circle at 50% 38%, #2a1e2b 0%, #191320 75%)',
            boxShadow: '0 0 22px rgba(224,115,58,.18), inset 0 0 14px rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'dragonBob 3.4s ease-in-out infinite',
          }}>
            <DragonIcon size={54} />
          </div>
          <div style={{
            position: 'relative', flex: 1, background: 'rgba(201,162,75,.08)',
            border: '1px solid rgba(201,162,75,.28)', borderRadius: 6, padding: '12px 14px',
            fontSize: 13.5, lineHeight: 1.7, color: '#d8cbb0',
          }}>
            <div style={{
              position: 'absolute', left: -6, top: 30, width: 10, height: 10, background: '#1d1723',
              borderLeft: '1px solid rgba(201,162,75,.28)', borderBottom: '1px solid rgba(201,162,75,.28)',
              transform: 'rotate(45deg)',
            }} />
            ようこそ、挑戦者よ。名を刻み、対戦の作法を選ぶがいい。
          </div>
        </div>
      )}

      {/* name */}
      <div style={{ marginTop: 22 }}>
        <SectionHeading numeral="I." text="名を刻む" />
        <DarkInput value={config.name} onChange={(v) => onChange({ name: v })} placeholder="挑戦者の名（なくてもよい）" />
      </div>

      {/* mode select */}
      <div style={{ marginTop: 26 }}>
        <SectionHeading numeral="II." text="対戦の作法を選ぶ" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {modeButton(
            'cpu',
            <div style={{ flex: 'none' }}><DragonIcon size={30} /></div>,
            '龍と対戦', 'VS CPU', '番人ドラゴンが相手を務める',
          )}

          {/* CPU 強さサブパネル */}
          {config.mode === 'cpu' && (
            <SubPanel>
              <div style={{ fontSize: 12, color: BG.muted, letterSpacing: '.06em' }}>龍の強さを選ぶ</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CPU_LEVELS.map(({ level, label, emoji }) => {
                  const selected = config.cpuLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => onChange({ cpuLevel: level })}
                      style={{
                        minHeight: 40, padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
                        fontFamily: BG.serifJa, fontSize: 12.5, letterSpacing: '.06em',
                        border: `1px solid ${selected ? BG.gold : 'rgba(201,162,75,.25)'}`,
                        background: selected ? 'rgba(201,162,75,.16)' : 'rgba(13,11,16,.5)',
                        color: selected ? BG.goldPale : BG.muted,
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {emoji} {label}
                    </button>
                  );
                })}
              </div>
            </SubPanel>
          )}

          {modeButton(
            'local',
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" style={{ flex: 'none' }}>
              <path d="M6 26 L20 8 L24 4 L26 6 L22 10 L8 24 Z" fill={BG.gold} />
              <path d="M26 26 L12 8 L8 4 L6 6 L10 10 L24 24 Z" fill={BG.goldDim} />
              <rect x="5" y="23" width="6" height="2.4" rx="1" transform="rotate(45 8 24)" fill={BG.ember} />
              <rect x="21" y="23" width="6" height="2.4" rx="1" transform="rotate(135 24 24)" fill={BG.ember} />
            </svg>,
            '同じ盤で対戦', 'VS HUMAN', '一台の端末を交互に使って遊ぶ',
          )}

          {/* 2人対戦サブパネル */}
          {config.mode === 'local' && (
            <SubPanel>
              <div style={{ fontSize: 12, color: BG.muted, letterSpacing: '.06em' }}>お相手の名</div>
              <DarkInput value={config.name2} onChange={(v) => onChange({ name2: v })} placeholder="お相手の名（なくてもよい）" height={48} />
            </SubPanel>
          )}

          {modeButton(
            'online',
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" style={{ flex: 'none' }}>
              <path d="M9 28 L9 12 L6 12 L11 4 L16 12 L13 12 L13 28 Z" fill={BG.gold} />
              <path d="M19 28 L19 16 L17 16 L21 10 L25 16 L23 16 L23 28 Z" fill={BG.goldDim} />
              <path d="M4 8 C7 5 12 4 16 6" stroke={BG.ember} strokeWidth="1.6" strokeLinecap="round" fill="none" strokeDasharray="2 3" />
            </svg>,
            '遠方の者と対戦', 'ONLINE', 'ルームコードで招き、招かれる',
          )}

          {/* オンラインサブパネル */}
          {config.mode === 'online' && (
            <SubPanel>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onOnlineTabChange('create')}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 4, cursor: 'pointer',
                    fontFamily: BG.serifJa, fontSize: 13.5, letterSpacing: '.08em',
                    border: `1px solid ${ct.border}`, background: ct.bg, color: ct.color,
                  }}
                >
                  ルームを作成
                </button>
                <button
                  onClick={() => onOnlineTabChange('join')}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 4, cursor: 'pointer',
                    fontFamily: BG.serifJa, fontSize: 13.5, letterSpacing: '.08em',
                    border: `1px solid ${jt.border}`, background: jt.bg, color: jt.color,
                  }}
                >
                  コードで参加
                </button>
              </div>
              {onlineTab === 'join' && (
                <DarkInput
                  value={joinCode}
                  onChange={(v) => onJoinCodeChange(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="例: DRGN42"
                  maxLength={6}
                  height={48}
                  codeStyle
                />
              )}
              {onlineTab === 'create' && (
                <div style={{ fontSize: 12, color: BG.muted, lineHeight: 1.7 }}>
                  開始すると招待の紋章(コード)が発行される。相手に伝えて待つべし。
                </div>
              )}
            </SubPanel>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 'auto', paddingTop: 30 }}>
        <GoldButton onClick={onStart}>{ctaLabel}</GoldButton>
        <div style={{ marginTop: 12 }}>
          <Brand />
        </div>
      </div>
    </div>
  );
}
