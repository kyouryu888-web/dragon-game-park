import { useState } from 'react';
import type { MancalaMode, CpuLevel, MancalaConfig } from './mancalaTypes';
import { getCpuDisplayName } from './mancalaCpu';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

const CONFIG_STORAGE_KEY = 'dragon-game-park:mancala-config';

type SavedConfig = {
  mode: MancalaMode;
  cpuLevel: CpuLevel;
  player1Name: string;
  player2Name: string;
};

function loadSavedConfig(): Partial<SavedConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      // 旧バージョンとの互換性
      const oldMode = localStorage.getItem('dragon-game-park:mancala-mode');
      if (oldMode === 'cpu' || oldMode === 'local-2p') return { mode: oldMode };
      return {};
    }
    return JSON.parse(raw) as Partial<SavedConfig>;
  } catch { return {}; }
}

function saveConfig(config: SavedConfig): void {
  try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

// ---- CPU 強さ一覧 ----
const CPU_LEVELS: { level: CpuLevel; label: string; emoji: string; desc: string }[] = [
  { level: 'very-easy', label: 'とてもかんたん', emoji: '🥚', desc: 'ランダムに動く' },
  { level: 'easy',      label: 'かんたん',       emoji: '🐣', desc: '追加ターンを狙う' },
  { level: 'normal',    label: 'ふつう',          emoji: '🐲', desc: '追加ターン・捕獲を狙う' },
  { level: 'hard',      label: 'むずかしい',      emoji: '🔥', desc: '相手の強手も防ぐ' },
  { level: 'very-hard', label: 'とてもむずかしい', emoji: '💀', desc: '深く読んで最善手を選ぶ' },
];

// ---- ルール ----
const RULES = [
  { icon: '👋', text: '自分側の穴を選び、石を1個ずつ隣へ配ります' },
  { icon: '🔄', text: '最後の石が自分のストアに入ると、もう一度自分の番です' },
  { icon: '✨', text: '最後の石が自分側の空穴に入ると、向かいの石を捕獲できます' },
  { icon: '🏁', text: 'どちらかの側の穴が全て空になると終了です' },
];

// ---- コンポーネント ----
type MancalaSetupPageProps = {
  onStart: (config: MancalaConfig) => void;
  onBack: () => void;
};

export function MancalaSetupPage({ onStart, onBack }: MancalaSetupPageProps) {
  const saved = loadSavedConfig();

  const [selectedMode,  setSelectedMode]  = useState<MancalaMode>(saved.mode ?? 'cpu');
  const [selectedLevel, setSelectedLevel] = useState<CpuLevel>(saved.cpuLevel ?? 'normal');
  const [player1Name,   setPlayer1Name]   = useState(saved.player1Name ?? '');
  const [player2Name,   setPlayer2Name]   = useState(saved.player2Name ?? '');
  const [showRules,     setShowRules]     = useState(false);

  function handleStart() {
    const config: MancalaConfig = {
      mode: selectedMode,
      cpuLevel: selectedLevel,
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
    };
    saveConfig({
      mode: selectedMode,
      cpuLevel: selectedLevel,
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
    });
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

          {/* モード選択 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              対戦モード
            </h2>
            <div className="mode-cards">
              <ModeCard
                mode="cpu" selectedMode={selectedMode} onSelect={setSelectedMode}
                icon="🐲" label="人間 vs CPU" sublabel="CPU対戦"
                description="ドラゴンCPUと対戦します。強さは下で選べます！"
                accentColor="#c87028" accentBg="#fff8ed"
              />
              <ModeCard
                mode="local-2p" selectedMode={selectedMode} onSelect={setSelectedMode}
                icon="👥" label="人間 vs 人間" sublabel="ローカル2人対戦"
                description="同じ端末で2人が交互に遊びます。友達や家族と！"
                accentColor="#4e8a4e" accentBg="#f0f8f0"
              />
            </div>
          </section>

          {/* CPU 強さ選択（cpu モード時のみ） */}
          {selectedMode === 'cpu' && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.5 }}>
                CPUの強さ
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {CPU_LEVELS.map(({ level, label, emoji, desc }) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 12,
                        border: `2px solid ${isSelected ? '#c87028' : 'var(--border)'}`,
                        background: isSelected ? '#fff3e0' : '#faf8f5',
                        cursor: 'pointer', textAlign: 'left',
                        boxShadow: isSelected ? '0 2px 10px rgba(200,112,40,0.22)' : 'none',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', fontSize: 13, color: isSelected ? '#8a4010' : 'var(--text)', display: 'block' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {getCpuDisplayName(level)}　— {desc}
                        </span>
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: 16, color: '#c87028' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* プレイヤー名入力 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.5 }}>
              プレイヤー名（省略可）
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <NameInput
                label={selectedMode === 'cpu' ? 'あなたの名前' : 'プレイヤー1の名前'}
                placeholder={selectedMode === 'cpu' ? 'あなた' : 'プレイヤー1'}
                value={player1Name}
                onChange={setPlayer1Name}
              />
              {selectedMode === 'local-2p' && (
                <NameInput
                  label="プレイヤー2の名前"
                  placeholder="プレイヤー2"
                  value={player2Name}
                  onChange={setPlayer2Name}
                />
              )}
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

// ---- モード選択カード ----
type ModeCardProps = {
  mode: MancalaMode; selectedMode: MancalaMode; onSelect: (mode: MancalaMode) => void;
  icon: string; label: string; sublabel: string; description: string;
  accentColor: string; accentBg: string;
};

function ModeCard({ mode, selectedMode, onSelect, icon, label, sublabel, description, accentColor, accentBg }: ModeCardProps) {
  const isSelected = selectedMode === mode;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onSelect(mode)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(mode); }}
      aria-pressed={isSelected}
      style={{
        padding: '16px', borderRadius: 16,
        border: `2px solid ${isSelected ? accentColor : 'var(--border)'}`,
        backgroundColor: isSelected ? accentBg : '#faf8f5',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: isSelected ? `0 3px 12px ${accentColor}30` : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        backgroundColor: isSelected ? accentColor : '#d8cfc4',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        boxShadow: isSelected ? `0 3px 10px ${accentColor}50` : 'none',
        transition: 'background-color 0.15s ease',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--text)' }}>{label}</span>
          {isSelected && (
            <span style={{
              fontSize: 10, backgroundColor: accentColor, color: '#fff',
              padding: '2px 9px', borderRadius: 20, fontWeight: 'bold', letterSpacing: 0.5,
            }}>選択中</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: accentColor, fontWeight: 'bold', marginBottom: 4 }}>{sublabel}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{description}</div>
      </div>
    </div>
  );
}

// ---- 名前入力フィールド ----
function NameInput({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-mid)', whiteSpace: 'nowrap', minWidth: 110 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={12}
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: '1.5px solid var(--border)', fontSize: 14, color: 'var(--text)',
          background: '#faf8f5', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#c87028'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />
    </div>
  );
}
