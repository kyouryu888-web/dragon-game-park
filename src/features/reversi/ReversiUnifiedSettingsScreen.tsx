import { useState } from 'react';
import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';
import { getReversiCpuName } from './reversiRules';
import { BAKURETSU_CPU_NAME } from './bakuretsuCpu';
import type { ReversiConfig, ReversiCpuLevel, ReversiSideChoice } from './reversiTypes';
import type { BakuretsuReversiConfig } from './bakuretsuUi';
import type { Side } from './bakuretsu/types.ts';

const NORMAL_CPU_LEVELS: ReversiCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
const BAKURETSU_CPU_LEVELS: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

const NORMAL_RULES = [
  '黒が先手。縦・横・斜めに相手の石を挟んで、自分の色へ返します',
  '相手を1枚以上返せる場所だけに石を置けます',
  '置ける場所がない番は自動でパスします',
  '両者とも置けなくなったら終了。石が多い側の勝ちです',
];

const BAKURETSU_RULES = [
  '着手してすべて裏返してから、爆弾・感染・盾を深度順に解決します',
  '爆風は配置者自身のコマを破壊しません',
  '中立コマは壁です。置いた手では1枚も裏返らず、挟み込みの端にもなれません',
  '盾は裏返しや爆発を1回だけ吸収し、所有者を変えず通常コマになります',
  '両者動けないか盤が埋まると終了。石数同数なら角数で勝敗を決めます',
  '持ち時間は各20分。演出中は次のプレイヤーの時間を減らしません',
];

type Props = {
  variant: 'normal' | 'bakuretsu';
  onVariantChange: (v: 'normal' | 'bakuretsu') => void;
  normalConfig: ReversiConfig;
  onNormalChange: (patch: Partial<ReversiConfig>) => void;
  bakuretsuConfig: BakuretsuReversiConfig;
  onBakuretsuChange: (patch: Partial<BakuretsuReversiConfig>) => void;
  onlineTab: 'create' | 'join';
  onOnlineTabChange: (tab: 'create' | 'join') => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onStart: () => void;
  onBackToHome: () => void;
};

export function ReversiUnifiedSettingsScreen({
  variant,
  onVariantChange,
  normalConfig,
  onNormalChange,
  bakuretsuConfig,
  onBakuretsuChange,
  onlineTab,
  onOnlineTabChange,
  joinCode,
  onJoinCodeChange,
  onStart,
  onBackToHome,
}: Props) {
  const [showRules, setShowRules] = useState(false);

  const mode = variant === 'normal' ? normalConfig.mode : bakuretsuConfig.mode;
  const name = variant === 'normal' ? normalConfig.name : bakuretsuConfig.name;

  function updateMode(newMode: 'cpu' | 'online') {
    if (variant === 'normal') onNormalChange({ mode: newMode });
    else onBakuretsuChange({ mode: newMode });
  }

  function updateName(newName: string) {
    onNormalChange({ name: newName });
    onBakuretsuChange({ name: newName });
  }

  function getHumanSide() {
    if (variant === 'normal') return normalConfig.humanSide;
    const bSide = bakuretsuConfig.humanSide;
    return bSide === 'RANDOM' ? 'random' : bSide.toLowerCase();
  }

  function updateHumanSide(newSide: 'black' | 'white' | 'random') {
    if (variant === 'normal') onNormalChange({ humanSide: newSide as ReversiSideChoice });
    else onBakuretsuChange({ humanSide: newSide === 'random' ? 'RANDOM' : (newSide.toUpperCase() as Side) });
  }

  return (
    <GameSetupShell
      theme="reversi"
      icon={variant === 'normal' ? '⚫' : '💥'}
      title={variant === 'normal' ? '通常リバーシ' : '爆裂リバーシー'}
      englishTitle={variant === 'normal' ? 'REVERSI' : 'BAKURETSU REVERSI'}
      description={
        variant === 'normal'
          ? '黒炎と白銀の竜陣。角を制し、一手ごとに敵陣を奪い合って最後の石まで勝敗を奪い合う。'
          : '爆弾・感染・盾の魔法が飛び交う過激なリバーシ。相手の特殊コマは見えないため心理戦が試される。'
      }
      onBack={onBackToHome}
    >
      <SetupStep numeral="I" title="名を刻む">
        <input
          className="game-setup-input"
          placeholder="プレイヤー名（任意）"
          maxLength={10}
          value={name}
          onChange={(e) => updateName(e.target.value)}
        />
      </SetupStep>

      <SetupStep numeral="II" title="モード選択">
        <div className="game-setup-tabs" style={{ marginBottom: 12 }}>
          <button type="button" className={variant === 'normal' ? 'is-selected' : ''} onClick={() => onVariantChange('normal')}>
            通常版
          </button>
          <button type="button" className={variant === 'bakuretsu' ? 'is-selected' : ''} onClick={() => onVariantChange('bakuretsu')}>
            爆裂版
          </button>
        </div>
      </SetupStep>

      <SetupStep numeral="III" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard
            selected={mode === 'cpu'}
            icon="🐉"
            title="ドラゴンと対戦"
            code="VS CPU"
            description="あなたとCPUで対戦"
            onClick={() => updateMode('cpu')}
          />
          <SetupModeCard
            selected={mode === 'online'}
            icon="🌐"
            title="遠方の者と対戦"
            code="ONLINE"
            description="ルームコードで離れた相手と対戦"
            onClick={() => updateMode('online')}
          />
        </div>
        {mode === 'online' ? (
          <div className="game-setup-online-panel">
            <SetupChoiceTabs value={onlineTab} onChange={onOnlineTabChange} />
            {onlineTab === 'join' ? (
              <>
                <input
                  className="game-setup-input game-setup-code-input"
                  placeholder="6桁のコード"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
                />
                <div style={{ marginTop: 8 }}>
                  <Button
                    fullWidth
                    onClick={onStart}
                    disabled={joinCode.length !== 6}
                  >
                    このコードで参加する
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </SetupStep>

      <SetupStep numeral="IV" title="対戦相手を決める">
        {mode === 'cpu' ? (
          <div className="bakuretsu-setup-names">
            <label>
              <span>CPUの強さ</span>
              {variant === 'normal' ? (
                <select className="game-setup-select" value={normalConfig.cpuLevel} onChange={(e) => onNormalChange({ cpuLevel: e.target.value as ReversiCpuLevel })}>
                  {NORMAL_CPU_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {getReversiCpuName(level)}
                    </option>
                  ))}
                </select>
              ) : (
                <select className="game-setup-select" value={bakuretsuConfig.cpuLevel} onChange={(e) => onBakuretsuChange({ cpuLevel: parseInt(e.target.value, 10) as any })}>
                  {BAKURETSU_CPU_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      Lv{level}・{BAKURETSU_CPU_NAME[level]}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              <span>あなたの手番</span>
              <select className="game-setup-select" value={getHumanSide()} onChange={(e) => updateHumanSide(e.target.value as any)}>
                <option value="black">黒・先手</option>
                <option value="white">白・後手</option>
                <option value="random">おまかせ</option>
              </select>
            </label>
          </div>
        ) : (
          <SetupSummary>
            オンライン対戦では対戦相手や手番（先手/後手）はルームの設定またはランダムで決定されます。
          </SetupSummary>
        )}
      </SetupStep>

      <div className="game-setup-cta">
        {mode === 'cpu' || onlineTab === 'create' ? (
          <Button fullWidth onClick={onStart}>
            {mode === 'cpu' ? 'この設定で対戦する' : 'ルーム設定へ進む'}
          </Button>
        ) : null}

        <button type="button" className="game-setup-rules-toggle" onClick={() => setShowRules((show) => !show)}>
          {showRules ? '掟を閉じる' : '掟を見る'}
        </button>
        {showRules ? (
          <ul className="game-setup-rules-list" style={{ marginTop: 12 }}>
            {(variant === 'normal' ? NORMAL_RULES : BAKURETSU_RULES).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </GameSetupShell>
  );
}
