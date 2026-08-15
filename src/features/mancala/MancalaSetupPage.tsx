import { useMemo, useState } from 'react';
import type { CpuLevel, MancalaConfig, PlayerConfig } from './mancalaTypes';
import { getCpuDisplayName } from './mancalaCpu';
import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';

const CONFIG_STORAGE_KEY = 'dragon-game-park:mancala-config-v2';
const CPU_LEVELS: { level: CpuLevel; label: string }[] = [
  { level: 'very-easy', label: 'ベビードラゴン' },
  { level: 'easy', label: 'ドラゴン' },
  { level: 'normal', label: 'スーパードラゴン' },
  { level: 'hard', label: 'ドラゴンキング' },
  { level: 'very-hard', label: 'ゴッドドラゴン' },
];
const RULES = [
  '自分側の穴を選び、石を1個ずつ隣へ時計回りに配ります',
  '最後の石が自分のストアに入ると、もう一度自分の番です',
  '2人時は、自分側の空穴に着地すると向かいの石を捕獲できます',
  'いずれかのプレイヤーの穴が全て空になると終了です',
];
const DEFAULT_PLAYERS: PlayerConfig[] = [
  { name: '', isCpu: false, cpuLevel: 'normal' },
  { name: '', isCpu: true, cpuLevel: 'normal' },
  { name: '', isCpu: true, cpuLevel: 'normal' },
  { name: '', isCpu: true, cpuLevel: 'normal' },
];

export type MancalaOnlineEntry = {
  mode: 'create' | 'join';
  name: string;
  code: string;
};

function loadSavedConfig(): MancalaConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) as MancalaConfig : null;
  } catch {
    return null;
  }
}

function saveConfig(config: MancalaConfig): void {
  try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); } catch { /* optional persistence */ }
}

type Props = {
  onStart: (config: MancalaConfig) => void;
  onBack: () => void;
  onOnlinePlay?: (entry: MancalaOnlineEntry) => void;
};

export function MancalaSetupPage({ onStart, onBack, onOnlinePlay }: Props) {
  const saved = useMemo(() => loadSavedConfig(), []);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(saved?.playerCount ?? 2);
  const [players, setPlayers] = useState<PlayerConfig[]>(() => Array.from({ length: 4 }, (_, index) => ({ ...DEFAULT_PLAYERS[index], ...saved?.players[index] })));
  const [mode, setMode] = useState<'cpu' | 'local' | 'online'>('cpu');
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

  function updatePlayer(index: number, patch: Partial<PlayerConfig>) {
    setPlayers((previous) => previous.map((player, playerIndex) => playerIndex === index ? { ...player, ...patch } : player));
  }

  function handleStart() {
    if (mode === 'online') {
      onOnlinePlay?.({ mode: onlineTab, name: players[0]?.name ?? '', code: joinCode.trim().toUpperCase() });
      return;
    }
    const config: MancalaConfig = {
      playerCount,
      players: players.slice(0, playerCount).map((player, index) => ({
        ...player,
        isCpu: index === 0 ? false : mode === 'cpu',
      })),
    };
    saveConfig({ playerCount, players: [...players] });
    onStart(config);
  }

  return (
    <GameSetupShell
      theme="mancala"
      icon="🎯"
      title="マンカラ"
      englishTitle="MANCALA"
      description="古木の盤に石を配り、先を読んで自分のストアへ集める、いにしえの盤上遊戯です。"
      onBack={onBack}
    >
      <SetupStep numeral="I" title="名を刻む">
        <input className="game-setup-input" value={players[0]?.name ?? ''} onChange={(event) => updatePlayer(0, { name: event.target.value, isCpu: false })} placeholder="挑戦者の名（なくてもよい）" maxLength={12} />
      </SetupStep>

      <SetupStep numeral="II" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard selected={mode === 'cpu'} icon="🐉" title="ドラゴンと対戦" code="VS CPU" description="あなたとCPUで対戦" onClick={() => setMode('cpu')} />
          <SetupModeCard selected={mode === 'local'} icon="⚔" title="同じ盤で対戦" code="VS HUMAN" description="1台の端末を囲んで遊ぶ" onClick={() => setMode('local')} />
          <SetupModeCard selected={mode === 'online'} icon="♜" title="遠方の者と対戦" code="ONLIE" description="ルームコードで離れた相手と対戦" onClick={() => setMode('online')} />
        </div>
        {mode === 'online' ? (
          <div className="game-setup-online-panel">
            <SetupChoiceTabs value={onlineTab} onChange={setOnlineTab} />
            {onlineTab === 'join' ? (
              <input className="game-setup-input game-setup-code-input" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="コードを入力" maxLength={6} />
            ) : null}
          </div>
        ) : null}
      </SetupStep>

      {mode !== 'online' ? (
        <SetupStep numeral="III" title="対戦相手を決める">
          <div className="game-setup-count-grid">
            {([2, 3, 4] as const).map((count) => <button key={count} type="button" className={playerCount === count ? 'is-selected' : ''} onClick={() => setPlayerCount(count)}>{count}人</button>)}
          </div>
          <div className="game-setup-opponent-list">
            {players.slice(1, playerCount).map((player, index) => (
              <div className="game-setup-opponent-row" key={index}>
                {mode === 'local' ? (
                  <input className="game-setup-input" style={{ minHeight: 38 }} value={player.name} onChange={(event) => updatePlayer(index + 1, { name: event.target.value, isCpu: false })} placeholder={`対戦相手${index + 1}の名`} maxLength={12} />
                ) : <strong>{player.name || getCpuDisplayName(player.cpuLevel)}</strong>}
                <span className="game-setup-role-tabs"><button type="button" className="is-selected">{mode === 'cpu' ? 'CPU' : '人間'}</button></span>
                {mode === 'cpu' ? (
                  <select className="game-setup-select" value={player.cpuLevel} onChange={(event) => updatePlayer(index + 1, { isCpu: true, cpuLevel: event.target.value as CpuLevel })}>
                    {CPU_LEVELS.map(({ level, label }) => <option key={level} value={level}>{label}</option>)}
                  </select>
                ) : <span />}
              </div>
            ))}
          </div>
          <SetupSummary>人間 {mode === 'local' ? playerCount : 1}人 / CPU {mode === 'cpu' ? playerCount - 1 : 0}体で対戦します。</SetupSummary>
        </SetupStep>
      ) : (
        <SetupStep numeral="III" title={onlineTab === 'create' ? 'ルームを作る' : 'コードで参加する'}>
          <SetupSummary>{onlineTab === 'create' ? '次の画面で人数と、人間・CPUの席を設定します。' : '入力したコードのルームへ参加します。'}</SetupSummary>
        </SetupStep>
      )}

      <div className="game-setup-cta">
        <Button fullWidth onClick={handleStart} disabled={mode === 'online' && onlineTab === 'join' && joinCode.length !== 6}>
          {mode === 'online' ? onlineTab === 'create' ? 'ルーム設定へ進む' : 'このコードで参加する' : 'この設定で対戦する'}
        </Button>
        <button type="button" className="game-setup-rules-toggle" onClick={() => setShowRules((show) => !show)}>{showRules ? '遊戯の掟を閉じる' : '遊戯の掟を見る'}</button>
        {showRules ? <ul className="game-setup-rules-list">{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
      </div>
    </GameSetupShell>
  );
}
