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
  

  const isOnlineJoin = config.mode === 'online' && onlineTab === 'join';
  const isOnlineCreate = config.mode === 'online' && onlineTab === 'create';

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
            description="番人ドラゴンと一騎打ち"
            onClick={() => onChange({ mode: 'cpu' })}
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
          <div className="game-setup-online-panel" style={{ marginTop: 12 }}>
            <SetupChoiceTabs value={onlineTab} onChange={onOnlineTabChange} />
          </div>
        ) : null}
      </SetupStep>

      {isOnlineJoin ? (
        <SetupStep numeral="III" title="参加コードを入力">
          <input
            className="game-setup-input game-setup-code-input"
            value={joinCode}
            onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="コードを入力"
            maxLength={6}
          />
          <SetupSummary>入力したコードの2人用ルームへ参加します。勝敗条件はルーム作成者に従います。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button
              fullWidth
              onClick={onStart}
              disabled={joinCode.length < 4}
            >
              このコードで参加する
            </Button>
          </div>
        </SetupStep>
      ) : isOnlineCreate ? (
        <>
          <SetupStep numeral="III" title="勝利条件を決める">
            <div className="game-setup-opponent-row">
              <strong>マッチプレイ</strong>
              <select
                className="game-setup-select"
                value={config.matchLength}
                onChange={(event) => onChange({ matchLength: Number(event.target.value) })}
              >
                <option value={1}>1局完結 (マネーゲーム)</option>
                <option value={3}>3点先取</option>
                <option value={5}>5点先取</option>
              </select>
            </div>
          </SetupStep>
          <SetupStep numeral="IV" title="ルームコードを発行する">
            <SetupSummary>対戦用のルームを作成し、相手へ伝える6桁コードを発行します。</SetupSummary>
            <div style={{ marginTop: 14 }}>
              <Button fullWidth onClick={onStart}>
                ルームを作成する
              </Button>
            </div>
          </SetupStep>
        </>
      ) : (
        <>
          <SetupStep numeral="III" title="対戦設定を決める">
            <div className="game-setup-opponent-row" style={{ marginBottom: 12 }}>
              <strong>番人ドラゴン</strong>
              <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
              <select
                className="game-setup-select"
                value={config.cpuLevel}
                onChange={(event) => onChange({ cpuLevel: event.target.value as CpuLevel })}
              >
                {CPU_LEVELS.map(({ level, label }) => (
                  <option key={level} value={level}>{label}</option>
                ))}
              </select>
            </div>
            <div className="game-setup-opponent-row">
              <strong>勝利条件</strong>
              <select
                className="game-setup-select"
                value={config.matchLength}
                onChange={(event) => onChange({ matchLength: Number(event.target.value) })}
              >
                <option value={1}>1局完結 (マネーゲーム)</option>
                <option value={3}>3点先取</option>
                <option value={5}>5点先取</option>
              </select>
            </div>
          </SetupStep>
          <SetupStep numeral="IV" title="対戦開始">
            <SetupSummary>
              {config.matchLength > 1 ? `番人ドラゴンと${config.matchLength}点先取で対戦します。` : '番人ドラゴンと1局完結で対戦します。'}
            </SetupSummary>
            <div style={{ marginTop: 14 }}>
              <Button fullWidth onClick={onStart}>
                この設定で対戦する
              </Button>
            </div>
          </SetupStep>
        </>
      )}
    </GameSetupShell>
  );
}
