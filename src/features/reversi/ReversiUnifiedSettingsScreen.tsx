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
import type { ReversiConfig, ReversiCpuLevel } from './reversiTypes';
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

  // mode と name は variant 間で共有・一貫性を保つ
  const mode = variant === 'normal' ? normalConfig.mode : bakuretsuConfig.mode;
  const name = variant === 'normal' ? normalConfig.name : bakuretsuConfig.name;

  function updateMode(newMode: 'cpu' | 'online') {
    onNormalChange({ mode: newMode });
    onBakuretsuChange({ mode: newMode });
  }

  function updateName(newName: string) {
    onNormalChange({ name: newName });
    onBakuretsuChange({ name: newName });
  }

  function getHumanSide(): 'black' | 'white' | 'random' {
    if (variant === 'normal') return normalConfig.humanSide;
    const bSide = bakuretsuConfig.humanSide;
    return bSide === 'RANDOM' ? 'random' : (bSide.toLowerCase() as 'black' | 'white');
  }

  function updateHumanSide(newSide: 'black' | 'white' | 'random') {
    onNormalChange({ humanSide: newSide });
    onBakuretsuChange({ humanSide: newSide === 'random' ? 'RANDOM' : (newSide.toUpperCase() as Side) });
  }

  // ルール（通常版／爆裂版）の切り替え時に、現在の対戦方法（CPU／オンライン）や手番・名前がリセットされないよう確実に同期する
  function handleVariantChange(newVariant: 'normal' | 'bakuretsu') {
    onVariantChange(newVariant);
    const currentSide = getHumanSide();
    onNormalChange({
      mode,
      name,
      humanSide: currentSide,
    });
    onBakuretsuChange({
      mode,
      name,
      humanSide: currentSide === 'random' ? 'RANDOM' : (currentSide.toUpperCase() as Side),
    });
  }

  const isOnlineJoin = mode === 'online' && onlineTab === 'join';
  const isOnlineCreate = mode === 'online' && onlineTab === 'create';

  const shellTitle = variant === 'normal' ? '通常リバーシ' : '爆裂リバーシー';
  const englishTitle = variant === 'normal' ? 'REVERSI' : 'BAKURETSU REVERSI';
  const icon = variant === 'normal' ? '⚫' : '💥';
  const shellDescription = variant === 'normal'
    ? '黒炎と白銀の竜陣。角を制し、一手ごとに敵陣を奪い合って最後の石まで勝敗を奪い合う盤上遊戯。'
    : '爆弾・感染・盾の魔法が飛び交う過激なリバーシ。相手の特殊コマは見えないため心理戦が試される。';

  return (
    <GameSetupShell
      theme="reversi"
      icon={icon}
      title={shellTitle}
      englishTitle={englishTitle}
      description={shellDescription}
      onBack={onBackToHome}
    >
      {/* Step I: モード選択（通常版／爆裂版） - 一番最初に選択 */}
      <SetupStep numeral="I" title="遊戯の掟を選ぶ">
        <div className="game-setup-tabs">
          <button
            type="button"
            className={variant === 'normal' ? 'is-selected' : ''}
            onClick={() => handleVariantChange('normal')}
          >
            ⚫ 通常リバーシ
          </button>
          <button
            type="button"
            className={variant === 'bakuretsu' ? 'is-selected' : ''}
            onClick={() => handleVariantChange('bakuretsu')}
          >
            💥 爆裂リバーシー
          </button>
        </div>
        <SetupSummary>
          {variant === 'normal'
            ? '挟んで裏返す伝統の2人対戦ルールです。'
            : '特殊コマ（爆弾・感染・盾・中立）が戦況を一変させる過激ルールです。'}
        </SetupSummary>
      </SetupStep>

      {/* Step II: 名を刻む */}
      <SetupStep numeral="II" title="名を刻む">
        <input
          className="game-setup-input"
          placeholder="挑戦者の名（なくてもよい）"
          maxLength={10}
          value={name}
          onChange={(e) => updateName(e.target.value)}
        />
      </SetupStep>

      {/* Step III: 対戦方法を選ぶ */}
      <SetupStep numeral="III" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard
            selected={mode === 'cpu'}
            icon="🐉"
            title="ドラゴンと対戦"
            code="VS CPU"
            description="あなたと番人竜で対戦"
            onClick={() => updateMode('cpu')}
          />
          <SetupModeCard
            selected={mode === 'online'}
            icon="🌐"
            title="遠方の者と対戦"
            code="ONLINE"
            description="離れた端末と対戦"
            onClick={() => updateMode('online')}
          />
        </div>
        {mode === 'online' ? (
          <div className="game-setup-online-panel" style={{ marginTop: 12 }}>
            <SetupChoiceTabs value={onlineTab} onChange={onOnlineTabChange} />
          </div>
        ) : null}
      </SetupStep>

      {/* Step IV: 詳細設定（選択した対戦方法に応じて中身がスマートに変化） */}
      {isOnlineJoin ? (
        <SetupStep numeral="IV" title="参加コードを入力">
          <input
            className="game-setup-input game-setup-code-input"
            placeholder="6桁のコードを入力"
            maxLength={6}
            value={joinCode}
            onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <SetupSummary>
            通常版・爆裂版のどちらのコードでも自動判別して即座に参加します。
          </SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button
              fullWidth
              onClick={onStart}
              disabled={joinCode.length !== 6}
            >
              このコードで参加する
            </Button>
          </div>
        </SetupStep>
      ) : isOnlineCreate ? (
        <SetupStep numeral="IV" title="手番を決める">
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: '13px', color: '#c5b597', marginBottom: 6 }}>
              あなたの手番
            </span>
            <div className="reversi-side-choice" role="group" aria-label="自分の石の色">
              {([
                ['black', '黒・先手'],
                ['white', '白・後手'],
                ['random', 'おまかせ'],
              ] as const).map(([side, label]) => (
                <button
                  type="button"
                  key={side}
                  className={getHumanSide() === side ? 'is-selected' : ''}
                  onClick={() => updateHumanSide(side as any)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <SetupSummary>
            ルームコードを発行し、対戦相手の参加を待機します。
          </SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={onStart}>
              ルームを作成する
            </Button>
          </div>
        </SetupStep>
      ) : (
        <SetupStep numeral="IV" title="対戦相手と手番を決める">
          <div className="bakuretsu-setup-names">
            <label>
              <span>CPUの強さ</span>
              {variant === 'normal' ? (
                <select
                  className="game-setup-select"
                  value={normalConfig.cpuLevel}
                  onChange={(e) => onNormalChange({ cpuLevel: e.target.value as ReversiCpuLevel })}
                >
                  {NORMAL_CPU_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {getReversiCpuName(level)}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="game-setup-select"
                  value={bakuretsuConfig.cpuLevel}
                  onChange={(e) => onBakuretsuChange({ cpuLevel: parseInt(e.target.value, 10) as any })}
                >
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
              <select
                className="game-setup-select"
                value={getHumanSide()}
                onChange={(e) => updateHumanSide(e.target.value as any)}
              >
                <option value="black">黒・先手</option>
                <option value="white">白・後手</option>
                <option value="random">おまかせ</option>
              </select>
            </label>
          </div>
          <SetupSummary>
            黒は先手です。白を選ぶとドラゴンが最初の一手を打ちます。
          </SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={onStart}>
              この設定で対戦する
            </Button>
          </div>
        </SetupStep>
      )}

      {/* 最下部: 遊戯の掟 */}
      <div className="game-setup-cta" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="game-setup-rules-toggle"
          onClick={() => setShowRules((show) => !show)}
        >
          {showRules ? '掟を閉じる' : '遊戯の掟を見る'}
        </button>
        {showRules ? (
          <div style={{ marginTop: 12 }}>
            <ul className="game-setup-rules-list">
              {(variant === 'normal' ? NORMAL_RULES : BAKURETSU_RULES).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GameSetupShell>
  );
}
