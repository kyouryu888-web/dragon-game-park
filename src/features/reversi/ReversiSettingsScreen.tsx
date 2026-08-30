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
import type { ReversiConfig, ReversiCpuLevel, ReversiSideChoice } from './reversiTypes';

const CPU_LEVELS: ReversiCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];
const RULES = [
  '黒が先手。縦・横・斜めに相手の石をはさんで、自分の色へ返します',
  '相手を1枚以上返せる場所だけに石を置けます',
  '置ける場所がない手番は自動でパスします',
  '両者とも置けなくなったら終了。石が多い側の勝ちです',
];

type Props = {
  config: ReversiConfig;
  onChange: (patch: Partial<ReversiConfig>) => void;
  onlineTab: 'create' | 'join';
  onOnlineTabChange: (tab: 'create' | 'join') => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onStart: () => void;
  onBackToHome: () => void;
};

export function ReversiSettingsScreen({
  config,
  onChange,
  onlineTab,
  onOnlineTabChange,
  joinCode,
  onJoinCodeChange,
  onStart,
  onBackToHome,
}: Props) {
  const [showRules, setShowRules] = useState(false);
  const ctaLabel = config.mode === 'online'
    ? onlineTab === 'create' ? 'ルームを作成する' : 'このコードで参加する'
    : 'この設定で対戦する';

  return (
    <GameSetupShell
      theme="reversi"
      icon="◐"
      title="リバーシ"
      englishTitle="REVERSI"
      description="黒炎と白銀、二頭の竜が盤上で陣を奪い合う。角を制し、最後の一手まで形勢を覆す盤上遊戯です。"
      onBack={onBackToHome}
    >
      <SetupStep numeral="I" title="名を刻む">
        <input
          className="game-setup-input"
          value={config.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="挑戦者の名（なくてもよい）"
          maxLength={12}
        />
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
            description="ルームコードで離れた相手と対戦"
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
                placeholder="コードを入力"
                maxLength={6}
              />
            ) : null}
          </div>
        ) : null}
      </SetupStep>

      <SetupStep
        numeral="III"
        title={config.mode === 'online' && onlineTab === 'join' ? 'コードで参加する' : '対戦相手と石を決める'}
      >
        {config.mode === 'cpu' ? (
          <>
            <div className="game-setup-opponent-row reversi-opponent-row">
              <strong>{getReversiCpuName(config.cpuLevel)}</strong>
              <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
              <select
                className="game-setup-select"
                aria-label="CPUの強さ"
                value={config.cpuLevel}
                onChange={(event) => onChange({ cpuLevel: event.target.value as ReversiCpuLevel })}
              >
                {CPU_LEVELS.map((level) => <option key={level} value={level}>{getReversiCpuName(level)}</option>)}
              </select>
            </div>
            <div className="reversi-side-choice" role="group" aria-label="自分の石の色">
              {([
                ['black', '黒・先手'],
                ['white', '白・後手'],
                ['random', 'おまかせ'],
              ] as const).map(([side, label]) => (
                <button
                  type="button"
                  key={side}
                  className={config.humanSide === side ? 'is-selected' : ''}
                  onClick={() => onChange({ humanSide: side as ReversiSideChoice })}
                >
                  {label}
                </button>
              ))}
            </div>
            <SetupSummary>黒は必ず先手です。白を選ぶとドラゴンが最初の一手を打ちます。</SetupSummary>
          </>
        ) : config.mode === 'local' ? (
          <>
            <div className="game-setup-opponent-row reversi-opponent-row">
              <input
                className="game-setup-input"
                value={config.name2}
                onChange={(event) => onChange({ name2: event.target.value })}
                placeholder="対戦相手の名（なくてもよい）"
                maxLength={12}
              />
              <span className="game-setup-role-tabs"><button type="button" className="is-selected">人間</button></span>
              <span />
            </div>
            <SetupSummary>最初の名前が黒・先手、対戦相手が白・後手です。</SetupSummary>
          </>
        ) : (
          <SetupSummary>
            {onlineTab === 'create'
              ? '黒・先手のルームを作り、6桁コードを相手へ伝えます。参加者は白・後手です。'
              : '入力した6桁コードのルームへ白・後手として参加します。'}
          </SetupSummary>
        )}
      </SetupStep>

      <div className="game-setup-cta">
        <Button
          fullWidth
          onClick={onStart}
          disabled={config.mode === 'online' && onlineTab === 'join' && joinCode.length !== 6}
        >
          {ctaLabel}
        </Button>
        <button type="button" className="game-setup-rules-toggle" onClick={() => setShowRules((value) => !value)}>
          {showRules ? '遊戯の掟を閉じる' : '遊戯の掟を見る'}
        </button>
        {showRules ? <ul className="game-setup-rules-list">{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
      </div>
    </GameSetupShell>
  );
}
