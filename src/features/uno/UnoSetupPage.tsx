import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { UnoConfig, UnoCpuLevel, UnoPlayerConfig, UnoVariant } from './unoTypes';
import { getUnoCpuDisplayName, getUnoCpuLevelLabel } from './unoCpu';
import { UnoRulesPanel } from './UnoRulesPanel';
import { UnoCardView } from './UnoCardView';

const STORAGE_KEY = 'dragon-game-park:uno-config-v1';
const CPU_LEVELS: UnoCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];

function defaultPlayers(): UnoPlayerConfig[] {
  return Array.from({ length: 10 }, (_, index) => ({
    name: '',
    isCpu: index > 0,
    cpuLevel: 'normal' as UnoCpuLevel,
  }));
}

function loadSavedConfig(): UnoConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnoConfig;
    if (!parsed.variant || !Array.isArray(parsed.playerConfigs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConfig(config: UnoConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage may be unavailable in some test environments.
  }
}

type UnoSetupPageProps = {
  onStart: (config: UnoConfig) => void;
  onBack: () => void;
  onOnlinePlay: () => void;
};

export function UnoSetupPage({ onStart, onBack, onOnlinePlay }: UnoSetupPageProps) {
  const saved = useMemo(() => loadSavedConfig(), []);
  const [variant, setVariant] = useState<UnoVariant>(saved?.variant ?? 'standard');
  const [playerCount, setPlayerCount] = useState(() => {
    const savedCount = saved?.playerConfigs.length ?? 2;
    return Math.min(Math.max(savedCount, 2), saved?.variant === 'hard' ? 6 : 10);
  });
  const [players, setPlayers] = useState<UnoPlayerConfig[]>(() => {
    const base = defaultPlayers();
    if (!saved?.playerConfigs) return base;
    return base.map((cfg, index) => ({ ...cfg, ...saved.playerConfigs[index] }));
  });
  const [showRules, setShowRules] = useState(true);

  const maxPlayers = variant === 'hard' ? 6 : 10;
  const activePlayers = players.slice(0, playerCount);
  const humanCount = activePlayers.filter((p) => !p.isCpu).length;
  const cpuCount = activePlayers.filter((p) => p.isCpu).length;

  function updateVariant(nextVariant: UnoVariant) {
    setVariant(nextVariant);
    setPlayerCount((count) => Math.min(count, nextVariant === 'hard' ? 6 : 10));
  }

  function updatePlayer(index: number, patch: Partial<UnoPlayerConfig>) {
    setPlayers((prev) => prev.map((player, i) => (i === index ? { ...player, ...patch } : player)));
  }

  function handleStart() {
    const config: UnoConfig = {
      variant,
      playerConfigs: players.slice(0, playerCount).map((player) => ({
        name: player.name,
        isCpu: player.isCpu,
        cpuLevel: player.cpuLevel ?? 'normal',
      })),
    };
    saveConfig(config);
    onStart(config);
  }

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--setup-pt)', paddingBottom: 46 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-mid)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '8px 0',
            marginBottom: 14,
          }}
        >
          ← ゲーム選択へ戻る
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            <UnoCardView hidden compact variant={variant} />
            <UnoCardView
              compact
              variant={variant}
              card={{ id: 'sample', kind: 'wild', symbol: variant === 'hard' ? 'wild-draw10' : 'wild' }}
            />
          </div>
          <h1 style={{ fontSize: 25, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 6 }}>
            UNO
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            みんなで遊べるカードゲーム。ハード版はドローとこうかんが大暴れします。
          </p>
        </div>

        <div style={{
          background: '#fffdf8',
          border: '1.5px solid var(--border-light)',
          borderRadius: 22,
          boxShadow: 'var(--shadow-md)',
          padding: '20px 16px',
          display: 'grid',
          gap: 18,
        }}>
          <section>
            <h2 style={sectionTitleStyle}>モード</h2>
            <div className="mode-cards" style={{ marginBottom: 0 }}>
              <ModeButton
                selected={variant === 'standard'}
                title="通常版"
                text="2〜10人。わかりやすいUNOです。"
                onClick={() => updateVariant('standard')}
              />
              <ModeButton
                selected={variant === 'hard'}
                title="ハード版"
                text="2〜6人。25まいでアウトの凶悪ルールです。"
                danger
                onClick={() => updateVariant('hard')}
              />
            </div>
          </section>

          <section>
            <h2 style={sectionTitleStyle}>プレイヤー人数</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map((count) => (
                <button
                  key={count}
                  onClick={() => setPlayerCount(count)}
                  style={{
                    padding: '9px 0',
                    borderRadius: 12,
                    border: `2px solid ${playerCount === count ? '#c87028' : 'var(--border)'}`,
                    background: playerCount === count ? '#fff3df' : '#faf8f5',
                    color: playerCount === count ? '#8a4010' : 'var(--text-mid)',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {count}人
                </button>
              ))}
            </div>
            <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              人間 {humanCount}人 / CPU {cpuCount}体
            </p>
          </section>

          <section>
            <h2 style={sectionTitleStyle}>プレイヤー設定</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {Array.from({ length: playerCount }, (_, index) => (
                <PlayerSetupRow
                  key={index}
                  index={index}
                  config={players[index]!}
                  onChange={(patch) => updatePlayer(index, patch)}
                />
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gap: 9 }}>
            <Button fullWidth onClick={handleStart}>
              オフラインで遊ぶ
            </Button>
            <Button fullWidth variant="secondary" onClick={onOnlinePlay}>
              オンライン対戦
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowRules((show) => !show)}
            style={{
              width: '100%',
              background: variant === 'hard' ? '#2a1114' : '#faf8f4',
              color: variant === 'hard' ? '#fff4e4' : 'var(--text-mid)',
              border: `1.5px solid ${variant === 'hard' ? '#b93530' : 'var(--border)'}`,
              borderRadius: 14,
              padding: '12px 16px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>カードとルールの説明</span>
            <span>{showRules ? '閉じる' : '開く'}</span>
          </button>
          {showRules && <div style={{ marginTop: 8 }}><UnoRulesPanel variant={variant} /></div>}
        </div>
      </div>
    </Layout>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  color: 'var(--text-muted)',
  marginBottom: 10,
  letterSpacing: 0.5,
};

function ModeButton({
  selected,
  title,
  text,
  danger = false,
  onClick,
}: {
  selected: boolean;
  title: string;
  text: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 16,
        border: `2px solid ${selected ? (danger ? '#c83b32' : '#c87028') : 'var(--border)'}`,
        background: selected
          ? danger ? '#321316' : '#fff3df'
          : '#faf8f5',
        color: selected && danger ? '#fff6e8' : 'var(--text)',
        padding: '14px 14px',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: selected && danger ? '#ffd8c8' : 'var(--text-muted)' }}>{text}</div>
    </button>
  );
}

function PlayerSetupRow({
  index,
  config,
  onChange,
}: {
  index: number;
  config: UnoPlayerConfig;
  onChange: (patch: Partial<UnoPlayerConfig>) => void;
}) {
  const cpuLevel = config.cpuLevel ?? 'normal';
  const accent = ['#c83b32', '#2581d8', '#25a85a', '#d9a520', '#8a55c7'][index % 5]!;
  return (
    <div style={{
      borderRadius: 15,
      border: `1.5px solid ${config.isCpu ? '#8cc58d' : 'var(--border)'}`,
      background: config.isCpu ? '#f0f8ef' : '#faf8f5',
      padding: '12px',
      display: 'grid',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: accent,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 900,
          flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <strong style={{ fontSize: 13, flex: 1 }}>プレイヤー{index + 1}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: '人間', isCpu: false },
            { label: 'CPU', isCpu: true },
          ].map((role) => {
            const selected = config.isCpu === role.isCpu;
            return (
              <button
                key={role.label}
                onClick={() => onChange({ isCpu: role.isCpu })}
                style={{
                  padding: '5px 10px',
                  borderRadius: 9,
                  border: `1.5px solid ${selected ? accent : 'var(--border)'}`,
                  background: selected ? '#fff4df' : 'transparent',
                  color: selected ? '#7a3a10' : 'var(--text-muted)',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>
      <input
        type="text"
        value={config.name}
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder={config.isCpu ? getUnoCpuDisplayName(cpuLevel) : `プレイヤー${index + 1}`}
        maxLength={12}
        style={{
          width: '100%',
          border: '1.5px solid var(--border)',
          borderRadius: 10,
          padding: '8px 10px',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          background: '#fffdf8',
        }}
      />
      {config.isCpu && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {CPU_LEVELS.map((level) => {
            const selected = cpuLevel === level;
            return (
              <button
                key={level}
                onClick={() => onChange({ cpuLevel: level })}
                style={{
                  padding: '5px 8px',
                  borderRadius: 9,
                  border: `1.5px solid ${selected ? '#4e8a4e' : 'var(--border)'}`,
                  background: selected ? '#dff0df' : 'transparent',
                  color: selected ? '#1f641f' : 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {getUnoCpuLevelLabel(level)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
