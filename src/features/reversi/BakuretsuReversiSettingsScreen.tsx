import { useState } from 'react';
import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';
import {
  BAKURETSU_CPU_LEVELS,
  BAKURETSU_CPU_NAME,
} from './bakuretsuCpu';
import type { BakuretsuReversiConfig } from './bakuretsuUi';
import type { Side } from './bakuretsu/types.ts';
const RULES = [
  '着手してすべて裏返してから、爆弾・感染・盾を深度順に解決します',
  '爆弾は配置者自身のコマを破壊しません',
  '中立コマは壁です。置いた手では1枚も裏返らず、挟み込みの端にもなれません',
  '盾は裏返しや爆発を1回だけ吸収し、所有者を変えず通常コマになります',
  '両者が動けないか盤が埋まると終了。石数同数なら角数で勝敗を決めます',
  '持ち時間は各20分。演出中は次のプレイヤーの時間を減らしません',
];

export function BakuretsuReversiSettingsScreen({
  config,
  onChange,
  onStart,
  onBack,
  onlineTab,
  onOnlineTabChange,
  joinCode,
  onJoinCodeChange,
}: {
  config: BakuretsuReversiConfig;
  onChange: (patch: Partial<BakuretsuReversiConfig>) => void;
  onStart: () => void;
  onBack: () => void;
  onlineTab: 'create' | 'join';
  onOnlineTabChange: (tab: 'create' | 'join') => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const ctaLabel = config.mode === 'online'
    ? onlineTab === 'create' ? '爆裂ルームを作成する' : 'このコードで爆裂対戦へ参加する'
    : 'この設定で爆裂対戦する';

  return (
    <GameSetupShell
      theme="reversi"
      icon="爆"
      title="爆裂リバーシ"
      englishTitle="BAKURETSU REVERSI"
      description="黒炎と白銀の竜陣へ、爆弾・感染・盾・中立の力が加わる。連鎖を読み、最後の石まで支配してください。"
      onBack={onBack}
    >
      <SetupStep numeral="I" title={config.mode === 'local' ? '二人の名を刻む' : '名を刻む'}>
        <div className="bakuretsu-setup-names">
          <label>
            <span>{config.mode === 'local' ? '黒炎・先手' : config.mode === 'online' ? 'オンライン名' : '挑戦者'}</span>
            <input
              className="game-setup-input"
              value={config.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder={config.mode === 'local' ? '黒の名（なくてもよい）' : 'プレイヤー名（なくてもよい）'}
              maxLength={12}
            />
          </label>
          {config.mode === 'local' ? <label>
            <span>白銀・後手</span>
            <input
              className="game-setup-input"
              value={config.name2}
              onChange={(event) => onChange({ name2: event.target.value })}
              placeholder="白の名（なくてもよい）"
              maxLength={12}
            />
          </label> : null}
        </div>
      </SetupStep>

      <SetupStep numeral="II" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard
            selected={config.mode === 'cpu'}
            icon="🐉"
            title="ドラゴンと対戦"
            code="VS CPU"
            description="5段階の思考を持つ番人竜と対戦"
            onClick={() => onChange({ mode: 'cpu' })}
          />
          <SetupModeCard
            selected={config.mode === 'local'}
            icon="⚔"
            title="同じ盤で対戦"
            code="VS HUMAN"
            description="1台の端末を交互に使って遊ぶ"
            onClick={() => onChange({ mode: 'local' })}
          />
          <SetupModeCard
            selected={config.mode === 'online'}
            icon="♜"
            title="遠方の者と対戦"
            code="ONLINE"
            description="6桁コードで同じ爆裂盤を共有"
            onClick={() => onChange({ mode: 'online' })}
          />
        </div>
        {config.mode === 'online' ? (
          <div className="game-setup-online-panel">
            <SetupChoiceTabs value={onlineTab} onChange={onOnlineTabChange} />
            {onlineTab === 'join' ? (
              <input
                className="game-setup-input game-setup-code-input"
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="6桁コードを入力"
                maxLength={6}
              />
            ) : null}
          </div>
        ) : null}
      </SetupStep>

      <SetupStep numeral="III" title={config.mode === 'online' && onlineTab === 'join' ? 'コードで参加する' : '対戦相手と石を決める'}>
        {config.mode === 'cpu' ? (
          <>
            <div className="game-setup-opponent-row reversi-opponent-row">
              <strong>{BAKURETSU_CPU_NAME[config.cpuLevel]}</strong>
              <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
              <select
                className="game-setup-select"
                aria-label="CPUの強さ"
                value={config.cpuLevel}
                onChange={(event) => onChange({ cpuLevel: Number(event.target.value) as BakuretsuReversiConfig['cpuLevel'] })}
              >
                {BAKURETSU_CPU_LEVELS.map((level) => (
                  <option key={level} value={level}>Lv{level}・{BAKURETSU_CPU_NAME[level]}</option>
                ))}
              </select>
            </div>
            <div className="reversi-side-choice" role="group" aria-label="自分の石の色">
              {([
                ['BLACK', '黒・先手'],
                ['WHITE', '白・後手'],
                ['RANDOM', 'おまかせ'],
              ] as const).map(([side, label]) => (
                <button
                  type="button"
                  key={side}
                  className={config.humanSide === side ? 'is-selected' : ''}
                  onClick={() => onChange({ humanSide: side as Side | 'RANDOM' })}
                >
                  {label}
                </button>
              ))}
            </div>
            <SetupSummary>黒は必ず先手です。白を選ぶとドラゴンが最初の一手を考えます。</SetupSummary>
          </>
        ) : config.mode === 'local' ? (
          <SetupSummary>黒が先手です。1台の端末を交互に使う2人対戦です。</SetupSummary>
        ) : (
          <SetupSummary>
            {onlineTab === 'create'
              ? '黒・先手の爆裂ルームを作り、6桁コードを相手へ伝えます。参加者は白・後手です。'
              : '入力した6桁コードの爆裂ルームへ白・後手として参加します。'}
          </SetupSummary>
        )}
      </SetupStep>

      <div className="game-setup-cta">
        <Button fullWidth onClick={onStart} disabled={config.mode === 'online' && onlineTab === 'join' && joinCode.length !== 6}>
          {ctaLabel}
        </Button>
        <button type="button" className="game-setup-rules-toggle" onClick={() => setShowRules((value) => !value)}>
          {showRules ? '爆裂の掟を閉じる' : '爆裂の掟を見る'}
        </button>
        {showRules ? <ul className="game-setup-rules-list">{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
      </div>
    </GameSetupShell>
  );
}
