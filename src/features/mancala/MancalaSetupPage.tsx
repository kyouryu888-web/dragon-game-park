import { useState } from 'react';
import type { CpuLevel, MancalaConfig, PlayerConfig } from './mancalaTypes';
import { getCpuDisplayName } from './mancalaCpu';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

const CONFIG_STORAGE_KEY = 'dragon-game-park:mancala-config-v2';

// ---- CPU 強さ一覧 ----
const CPU_LEVELS: { level: CpuLevel; label: string; emoji: string }[] = [
  { level: 'very-easy', label: 'とてもかんたん', emoji: '🥚' },
  { level: 'easy',      label: 'かんたん',       emoji: '🐣' },
  { level: 'normal',    label: 'ふつう',          emoji: '🐲' },
  { level: 'hard',      label: 'むずかしい',      emoji: '🔥' },
  { level: 'very-hard', label: 'とてもむずかしい', emoji: '💀' },
];

// ---- ルール ----
const RULES = [
  { icon: '👋', text: '自分側の穴を選び、石を1個ずつ隣へ時計回りに配ります' },
  { icon: '🔄', text: '最後の石が自分のストアに入ると、もう一度自分の番です' },
  { icon: '✨', text: '【2人時のみ】最後の石が自分側の空穴に入ると向かいの石を捕獲できます' },
  { icon: '🏁', text: 'いずれかのプレイヤーの穴が全て空になると終了です' },
];

function loadSavedConfig(): MancalaConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MancalaConfig;
  } catch { return null; }
}

function saveConfig(config: MancalaConfig): void {
  try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

const DEFAULT_PLAYER_CONFIGS: PlayerConfig[] = [
  { name: '', isCpu: false, cpuLevel: 'normal' },
  { name: '', isCpu: true,  cpuLevel: 'normal' },
  { name: '', isCpu: false, cpuLevel: 'normal' },
  { name: '', isCpu: false, cpuLevel: 'normal' },
];

// ============================================================
// メインコンポーネント
// ============================================================

type MancalaSetupPageProps = {
  onStart: (config: MancalaConfig) => void;
  onBack: () => void;
  onOnlinePlay?: () => void;
};

export function MancalaSetupPage({ onStart, onBack, onOnlinePlay }: MancalaSetupPageProps) {
  const saved = loadSavedConfig();

  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(saved?.playerCount ?? 2);
  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    if (saved?.players && saved.players.length >= 4) return saved.players;
    const base = saved?.players ?? [];
    return Array.from({ length: 4 }, (_, i) => base[i] ?? DEFAULT_PLAYER_CONFIGS[i]);
  });
  const [showRules, setShowRules] = useState(false);

  function updatePlayer(idx: number, patch: Partial<PlayerConfig>) {
    setPlayers((prev) => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }

  function handleStart() {
    const config: MancalaConfig = {
      playerCount,
      players: players.slice(0, playerCount),
    };
    saveConfig({ playerCount, players });
    onStart(config);
  }

  const activePlayers = players.slice(0, playerCount);
  const humanCount = activePlayers.filter((p) => !p.isCpu).length;
  const cpuCount   = activePlayers.filter((p) => p.isCpu).length;

  return (
    <Layout>
      <div style={{ paddingTop: 'var(--setup-pt)', paddingBottom: 48 }}>

        {/* 戻るボタン */}
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--text-mid)',
            cursor: 'pointer', fontSize: 14, padding: '8px 0', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          ← ゲーム選択画面へ戻る
        </button>

        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎯</div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
            マンカラ
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            木製ボードとカラフルな宝石石で遊ぶ<br />
            かわいいカラハ式マンカラです
          </p>
        </div>

        {/* ─── 設定カード ─── */}
        <div style={{
          background: '#fffdf8', borderRadius: 22, padding: '22px 18px',
          boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--border-light)',
          marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* プレイヤー数選択 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              プレイヤー数
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 'bold',
                    fontSize: 15, cursor: 'pointer',
                    border: `2px solid ${playerCount === n ? '#c87028' : 'var(--border)'}`,
                    background: playerCount === n ? '#fff3e0' : '#faf8f5',
                    color: playerCount === n ? '#8a4010' : 'var(--text)',
                    boxShadow: playerCount === n ? '0 2px 10px rgba(200,112,40,0.22)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {n}人
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {playerCount === 2 ? '🟦 通常の横長ボード（捕獲ルールあり）'
               : playerCount === 3 ? '🔺 三角形ボード（捕獲ルールなし）'
               : '🟥 長方形フレームボード（捕獲ルールなし）'}
            </div>
          </section>

          {/* プレイヤー個別設定 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              プレイヤー設定
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: playerCount }, (_, i) => (
                <PlayerSetupRow
                  key={i}
                  index={i}
                  config={players[i]}
                  onChange={(patch) => updatePlayer(i, patch)}
                />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {humanCount > 0 && cpuCount > 0
                ? `人間 ${humanCount}人 vs CPU ${cpuCount}体`
                : humanCount === 0
                ? `CPU ${cpuCount}体だけの対戦`
                : `人間 ${humanCount}人の対戦`}
            </div>
          </section>

          <Button fullWidth onClick={handleStart}>
            ゲームスタート！ 🎮
          </Button>
        </div>

        {/* オンライン対戦 */}
        {onOnlinePlay && (
          <div style={{
            background: '#f0f8ff', border: '1.5px solid #b0d4f0',
            borderRadius: 18, padding: '16px 18px', marginBottom: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1a5a8a', marginBottom: 4 }}>
              🌐 オンライン対戦
            </div>
            <div style={{ fontSize: 11, color: '#4a7a9a', marginBottom: 12 }}>
              ルームコードを使って離れた相手と対戦できます（2人対戦）
            </div>
            <Button fullWidth variant="secondary" onClick={onOnlinePlay}>
              オンライン対戦を始める
            </Button>
          </div>
        )}

        {/* ルール説明（開閉式） */}
        <div>
          <button
            onClick={() => setShowRules(!showRules)}
            style={{
              width: '100%', background: '#faf8f4', border: '1.5px solid var(--border)',
              borderRadius: 14, padding: '13px 18px', cursor: 'pointer', fontSize: 14,
              color: 'var(--text-mid)', fontWeight: 'bold',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>📖 かんたんルール</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {showRules ? '▲ 閉じる' : '▼ 開く'}
            </span>
          </button>

          {showRules && (
            <div style={{
              marginTop: 6, background: '#fffdf4', border: '1.5px solid var(--border)',
              borderRadius: 14, padding: '18px 16px',
            }}>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {RULES.map((rule, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7,
                    marginBottom: i < RULES.length - 1 ? 12 : 0,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{rule.icon}</span>
                    {rule.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}

// ============================================================
// プレイヤー1人分の設定行
// ============================================================

const PLAYER_COLORS = ['#c87028', '#4e8a4e', '#7040a0', '#2060a8'];
const PLAYER_ICONS  = ['👤', '🐲', '🦊', '🤖'];

function PlayerSetupRow({
  index, config, onChange,
}: {
  index: number;
  config: PlayerConfig;
  onChange: (patch: Partial<PlayerConfig>) => void;
}) {
  const color = PLAYER_COLORS[index];

  return (
    <div style={{
      border: `1.5px solid ${config.isCpu ? '#90b090' : 'var(--border)'}`,
      borderRadius: 14, padding: '12px 14px',
      background: config.isCpu ? '#f0f8f0' : '#faf8f5',
      transition: 'all 0.15s',
    }}>
      {/* ヘッダー行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, flexShrink: 0,
        }}>
          {PLAYER_ICONS[index]}
        </div>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--text)', flex: 1 }}>
          プレイヤー{index + 1}
        </span>

        {/* 人間 / CPU トグル */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['人間', 'CPU'] as const).map((role) => {
            const isCpuRole = role === 'CPU';
            const isSelected = config.isCpu === isCpuRole;
            return (
              <button
                key={role}
                onClick={() => onChange({ isCpu: isCpuRole })}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 'bold',
                  border: `1.5px solid ${isSelected ? (isCpuRole ? '#4e8a4e' : color) : 'var(--border)'}`,
                  background: isSelected ? (isCpuRole ? '#e8f4e8' : '#fff3e0') : 'transparent',
                  color: isSelected ? (isCpuRole ? '#2a6a2a' : '#8a4010') : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {role}
              </button>
            );
          })}
        </div>
      </div>

      {/* 名前入力 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: config.isCpu ? 10 : 0 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 50 }}>
          名前
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={config.isCpu ? getCpuDisplayName(config.cpuLevel) : `プレイヤー${index + 1}`}
          maxLength={12}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)',
            background: '#faf8f5', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = color; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* CPU 強さ選択 */}
      {config.isCpu && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CPU_LEVELS.map(({ level, label, emoji }) => {
            const isSelected = config.cpuLevel === level;
            return (
              <button
                key={level}
                onClick={() => onChange({ cpuLevel: level })}
                style={{
                  padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 'bold',
                  border: `1.5px solid ${isSelected ? '#4e8a4e' : 'var(--border)'}`,
                  background: isSelected ? '#d0ecd0' : 'transparent',
                  color: isSelected ? '#1a5a1a' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {emoji} {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
