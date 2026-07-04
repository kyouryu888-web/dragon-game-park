import { useState } from 'react';
import type { BackgammonConfig, CpuLevel, PlayerConfig } from './backgammonTypes';
import { getCpuDisplayName } from './backgammonCpu';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

const CONFIG_STORAGE_KEY = 'dragon-game-park:backgammon-config-v1';

// ---- CPU 強さ一覧（マンカラと共通のドラゴン段位） ----
const CPU_LEVELS: { level: CpuLevel; label: string; emoji: string }[] = [
  { level: 'very-easy', label: 'ベビードラゴン',   emoji: '🥚' },
  { level: 'easy',      label: 'ドラゴン',        emoji: '🐲' },
  { level: 'normal',    label: 'スーパードラゴン', emoji: '🐉' },
  { level: 'hard',      label: 'ドラゴンキング', emoji: '👑' },
  { level: 'very-hard', label: 'ゴッドドラゴン', emoji: '⚡' },
];

// ---- ルール ----
const RULES = [
  { icon: '🎲', text: 'サイコロ2個を振り、出た目の数だけ自分の駒を進めます（ゾロ目は4回動けます）' },
  { icon: '🛡️', text: '相手の駒が2個以上あるポイントには入れません' },
  { icon: '💥', text: '相手の駒が1個だけのポイントに乗ると、その駒をバー（中央）へ送れます' },
  { icon: '🏠', text: '全部の駒を自分のホーム（ゴール手前の6マス）に集めると、駒を上げられるようになります' },
  { icon: '🏆', text: '先に15個全部の駒を上げた方の勝ちです' },
  { icon: '✖️', text: 'ダブリングキューブで点数を2倍に釣り上げる駆け引きもできます（設定でオフにもできます）' },
];

function loadSavedConfig(): BackgammonConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackgammonConfig;
  } catch { return null; }
}

function saveConfig(config: BackgammonConfig): void {
  try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

const DEFAULT_PLAYERS: [PlayerConfig, PlayerConfig] = [
  { name: '', isCpu: false, cpuLevel: 'normal' },
  { name: '', isCpu: true,  cpuLevel: 'normal' },
];

// ============================================================
// メインコンポーネント
// ============================================================

type BackgammonSetupPageProps = {
  onStart: (config: BackgammonConfig) => void;
  onBack: () => void;
};

export function BackgammonSetupPage({ onStart, onBack }: BackgammonSetupPageProps) {
  const saved = loadSavedConfig();

  const [players, setPlayers] = useState<[PlayerConfig, PlayerConfig]>(() => {
    if (saved?.players && saved.players.length === 2) return saved.players;
    return DEFAULT_PLAYERS;
  });
  const [useDoublingCube, setUseDoublingCube] = useState(saved?.useDoublingCube ?? true);
  const [showRules, setShowRules] = useState(false);

  function updatePlayer(idx: 0 | 1, patch: Partial<PlayerConfig>) {
    setPlayers((prev) => {
      const next: [PlayerConfig, PlayerConfig] = [prev[0], prev[1]];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function handleStart() {
    const config: BackgammonConfig = { players, useDoublingCube };
    saveConfig(config);
    onStart(config);
  }

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
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎲</div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--brown)', marginBottom: 8 }}>
            バックギャモン
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            サイコロと駆け引きで競う、世界最古のボードゲームです
          </p>
        </div>

        {/* ─── 設定カード ─── */}
        <div style={{
          background: '#fffdf8', borderRadius: 22, padding: '22px 18px',
          boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--border-light)',
          marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* プレイヤー個別設定 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              プレイヤー設定
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([0, 1] as const).map((i) => (
                <PlayerSetupRow
                  key={i}
                  index={i}
                  config={players[i]}
                  onChange={(patch) => updatePlayer(i, patch)}
                />
              ))}
            </div>
          </section>

          {/* ダブリングキューブ */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              ダブリングキューブ
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {([true, false] as const).map((on) => (
                <button
                  key={String(on)}
                  onClick={() => setUseDoublingCube(on)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 'bold',
                    fontSize: 14, cursor: 'pointer',
                    border: `2px solid ${useDoublingCube === on ? '#c87028' : 'var(--border)'}`,
                    background: useDoublingCube === on ? '#fff3e0' : '#faf8f5',
                    color: useDoublingCube === on ? '#8a4010' : 'var(--text)',
                    transition: 'all 0.15s',
                  }}
                >
                  {on ? '✖️ 使う' : 'ー 使わない'}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {useDoublingCube
                ? '点数を2倍・4倍…に釣り上げる駆け引きが楽しめます'
                : '1ゲームごとの勝敗だけで遊びます（はじめての方におすすめ）'}
            </div>
          </section>

          <Button fullWidth onClick={handleStart}>
            ゲームスタート！ 🎮
          </Button>
        </div>

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

const PLAYER_META = [
  { label: '金の龍（先攻候補）', color: '#c9a227', checker: 'white' },
  { label: '翠の龍', color: '#2d6e4f', checker: 'black' },
] as const;

function PlayerSetupRow({
  index, config, onChange,
}: {
  index: 0 | 1;
  config: PlayerConfig;
  onChange: (patch: Partial<PlayerConfig>) => void;
}) {
  const meta = PLAYER_META[index];

  return (
    <div style={{
      border: `1.5px solid ${config.isCpu ? '#90b090' : 'var(--border)'}`,
      borderRadius: 14, padding: '12px 14px',
      background: config.isCpu ? '#f0f8f0' : '#faf8f5',
      transition: 'all 0.15s',
    }}>
      {/* ヘッダー行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className={`bg-checker ${meta.checker}`} style={{ width: 26, height: 26, flexShrink: 0 }} />
        <span style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--text)', flex: 1 }}>
          {meta.label}
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
                  border: `1.5px solid ${isSelected ? (isCpuRole ? '#4e8a4e' : meta.color) : 'var(--border)'}`,
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
            flex: 1, minWidth: 0, boxSizing: 'border-box',
            padding: '6px 10px', borderRadius: 8,
            border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)',
            background: '#faf8f5', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = meta.color; }}
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
