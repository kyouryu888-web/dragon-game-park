import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';
import type { BackgammonConfig, CpuLevel } from './backgammonTypes';

const CPU_LEVELS: { level: CpuLevel; label: string }[] = [
  { level: 'very-easy', label: 'ベビードラゴン' },
  { level: 'easy', label: 'ドラゴン' },
  { level: 'normal', label: 'スーパードラゴン' },
  { level: 'hard', label: 'ドラゴンキング' },
  { level: 'very-hard', label: 'ゴッドドラゴン' },
];

type Props = {
  config: BackgammonConfig;
  onChange: (patch: Partial<BackgammonConfig>) => void;
  onlineTab: 'create' | 'join';
  onOnlineTabChange: (tab: 'create' | 'join') => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  showMascot?: boolean;
  onStart: () => void;
  onBackToHome: () => void;
};

export function BackgammonSettingsScreen({
  config,
  onChange,
  onlineTab,
  onOnlineTabChange,
  joinCode,
  onJoinCodeChange,
  onStart,
  onBackToHome,
}: Props) {
  

  return (
    <GameSetupShell
      theme="backgammon"
      icon="🎲"
      title="バックギャモン"
      englishTitle="BACKGAMMON"
      description="骰子に運命を委ね、15の駒を先に故郷へ帰す、世界最古の盤上遊戯です。"
      onBack={onBackToHome}
    >
      <SetupStep numeral="I" title="名を刻む">
        <input className="game-setup-input" value={config.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="挑戦者の名（なくてもよい）" maxLength={12} />
      </SetupStep>

      <SetupStep numeral="II" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard selected={config.mode === 'cpu'} icon="🐉" title="ドラゴンと対戦" code="VS CPU" description="番人ドラゴンと一騎打ち" onClick={() => onChange({ mode: 'cpu' })} />
          <SetupModeCard selected={config.mode === 'online'} icon="♜" title="遠方の者と対戦" code="ONLIE" description="ルームコードで離れた相手と対戦" onClick={() => onChange({ mode: 'online' })} />
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

      <SetupStep numeral="III" title={config.mode === 'online' && onlineTab === 'join' ? 'コードで参加する' : '対戦相手を決める'}>
        <div className="game-setup-count-grid" style={{ marginBottom: 12 }}>
          <button type="button" className="is-selected">2人</button>
        </div>
        {config.mode === 'cpu' ? (
          <div className="game-setup-opponent-row">
            <strong>番人ドラゴン</strong>
            <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
            <select className="game-setup-select" value={config.cpuLevel} onChange={(event) => onChange({ cpuLevel: event.target.value as CpuLevel })}>
              {CPU_LEVELS.map(({ level, label }) => <option key={level} value={level}>{label}</option>)}
            </select>
          </div>
        ) : (
          <SetupSummary>{onlineTab === 'create' ? '人間2人のルームを作り、コードを相手へ伝えます。' : '入力したコードの2人用ルームへ参加します。'}</SetupSummary>
        )}
      </SetupStep>

      <div className="game-setup-cta">
        <Button fullWidth onClick={onStart} disabled={config.mode === 'online' && onlineTab === 'join' && joinCode.length < 4}>
          この設定で対戦する
        </Button>
      </div>
    </GameSetupShell>
  );
}
