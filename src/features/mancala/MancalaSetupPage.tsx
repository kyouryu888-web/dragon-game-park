import { useState } from 'react';
import type { MancalaMode } from './mancalaTypes';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';

const STORAGE_KEY = 'dragon-game-park:mancala-mode';

function loadSavedMode(): MancalaMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'cpu' || saved === 'local-2p') return saved;
  } catch { /* ignore */ }
  return 'cpu';
}

function saveMode(mode: MancalaMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
}

// ---- ルール ----
const RULES = [
  { icon: '👋', text: '自分側の穴を選び、石を1個ずつ隣へ配ります' },
  { icon: '🔄', text: '最後の石が自分のストアに入ると、もう一度自分の番です' },
  { icon: '✨', text: '最後の石が自分側の空穴に入ると、向かいの石を捕獲できます' },
  { icon: '🏁', text: 'どちらかの側の穴が全て空になると終了です' },
];

// ---- コンポーネント ----
type MancalaSetupPageProps = {
  onStart: (mode: MancalaMode) => void;
  onBack: () => void;
};

export function MancalaSetupPage({ onStart, onBack }: MancalaSetupPageProps) {
  const [selectedMode, setSelectedMode] = useState<MancalaMode>(loadSavedMode);
  const [showRules, setShowRules] = useState(false);

  function handleModeSelect(mode: MancalaMode) {
    setSelectedMode(mode);
    saveMode(mode);
  }

  function handleStart() {
    saveMode(selectedMode);
    onStart(selectedMode);
  }

  return (
    <Layout>
      {/* --setup-pt はスマホ横向きで縮小される（global.css 参照） */}
      <div style={{ paddingTop: 'var(--setup-pt)', paddingBottom: 48 }}>

        {/* 戻るボタン */}
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-mid)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '8px 0',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
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

        {/* モード選択カード */}
        <div
          style={{
            background: '#fffdf8',
            borderRadius: 22,
            padding: '22px 18px',
            boxShadow: 'var(--shadow-md)',
            border: '1.5px solid var(--border-light)',
            marginBottom: 18,
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: 0.5 }}>
            対戦モードを選んでください
          </h2>

          {/*
            mode-cards: スマホ縦並び → 640px+ で横並び（global.css 参照）
          */}
          <div className="mode-cards">
            {/* CPU モード */}
            <ModeCard
              mode="cpu"
              selectedMode={selectedMode}
              onSelect={handleModeSelect}
              icon="🐲"
              label="人間 vs CPU"
              sublabel="こどもドラゴンCPU"
              description="こどもドラゴンCPUと対戦します。追加ターンや捕獲を狙う賢いCPUです！"
              accentColor="#c87028"
              accentBg="#fff8ed"
            />
            {/* 2P モード */}
            <ModeCard
              mode="local-2p"
              selectedMode={selectedMode}
              onSelect={handleModeSelect}
              icon="👥"
              label="人間 vs 人間"
              sublabel="ローカル2人対戦"
              description="同じ端末で2人が交互に遊びます。友達や家族と対戦しよう！"
              accentColor="#4e8a4e"
              accentBg="#f0f8f0"
            />
          </div>

          <Button fullWidth onClick={handleStart}>
            ゲームスタート！ 🎮
          </Button>
        </div>

        {/* ルール説明（開閉式） */}
        <div>
          <button
            onClick={() => setShowRules(!showRules)}
            style={{
              width: '100%',
              background: '#faf8f4',
              border: '1.5px solid var(--border)',
              borderRadius: 14,
              padding: '13px 18px',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text-mid)',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>📖 かんたんルール</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {showRules ? '▲ 閉じる' : '▼ 開く'}
            </span>
          </button>

          {showRules && (
            <div
              style={{
                marginTop: 6,
                background: '#fffdf4',
                border: '1.5px solid var(--border)',
                borderRadius: 14,
                padding: '18px 16px',
              }}
            >
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {RULES.map((rule, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-mid)',
                      lineHeight: 1.7,
                      marginBottom: i < RULES.length - 1 ? 12 : 0,
                    }}
                  >
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
  mode: MancalaMode;
  selectedMode: MancalaMode;
  onSelect: (mode: MancalaMode) => void;
  icon: string;
  label: string;
  sublabel: string;
  description: string;
  accentColor: string;
  accentBg: string;
};

function ModeCard({
  mode, selectedMode, onSelect,
  icon, label, sublabel, description,
  accentColor, accentBg,
}: ModeCardProps) {
  const isSelected = selectedMode === mode;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(mode)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(mode); }}
      aria-pressed={isSelected}
      style={{
        padding: '16px',
        borderRadius: 16,
        border: `2px solid ${isSelected ? accentColor : 'var(--border)'}`,
        backgroundColor: isSelected ? accentBg : '#faf8f5',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: isSelected ? `0 3px 12px ${accentColor}30` : 'none',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}
    >
      {/* アイコン */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: isSelected ? accentColor : '#d8cfc4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
          boxShadow: isSelected ? `0 3px 10px ${accentColor}50` : 'none',
          transition: 'background-color 0.15s ease',
        }}
      >
        {icon}
      </div>

      {/* テキスト */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--text)' }}>
            {label}
          </span>
          {isSelected && (
            <span
              style={{
                fontSize: 10,
                backgroundColor: accentColor,
                color: '#fff',
                padding: '2px 9px',
                borderRadius: 20,
                fontWeight: 'bold',
                letterSpacing: 0.5,
              }}
            >
              選択中
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: accentColor, fontWeight: 'bold', marginBottom: 4 }}>
          {sublabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {description}
        </div>
      </div>
    </div>
  );
}
