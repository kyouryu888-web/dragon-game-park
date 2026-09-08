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
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from '../../components/gameSetupDefaults';

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
  playerCount?: 2 | 3 | 4;
  cpuSlots?: [boolean, boolean, boolean];
  cpuLevels?: [CpuLevel, CpuLevel, CpuLevel];
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
  const [mode, setMode] = useState<'cpu' | 'online'>(DEFAULT_SETUP_MODE);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [onlinePlayerCount, setOnlinePlayerCount] = useState<2 | 3 | 4>(2);
  const [onlineCpuSlots, setOnlineCpuSlots] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [onlineCpuLevels, setOnlineCpuLevels] = useState<[CpuLevel, CpuLevel, CpuLevel]>(['normal', 'normal', 'normal']);
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

  function updatePlayer(index: number, patch: Partial<PlayerConfig>) {
    setPlayers((previous) => previous.map((player, playerIndex) => playerIndex === index ? { ...player, ...patch } : player));
  }

  function toggleOnlineCpuSlot(idx: number, isCpu: boolean) {
    setOnlineCpuSlots((prev) => {
      const next: [boolean, boolean, boolean] = [...prev];
      next[idx] = isCpu;
      return next;
    });
  }

  function updateOnlineCpuLevel(idx: number, level: CpuLevel) {
    setOnlineCpuLevels((prev) => {
      const next: [CpuLevel, CpuLevel, CpuLevel] = [...prev];
      next[idx] = level;
      return next;
    });
  }

  function handleStart() {
    if (mode === 'online') {
      onOnlinePlay?.({
        mode: onlineTab,
        name: players[0]?.name ?? '',
        code: joinCode.trim().toUpperCase(),
        playerCount: onlinePlayerCount,
        cpuSlots: onlineCpuSlots,
        cpuLevels: onlineCpuLevels,
      });
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

  const isOnlineJoin = mode === 'online' && onlineTab === 'join';
  const isOnlineCreate = mode === 'online' && onlineTab === 'create';

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
        <input
          className="game-setup-input"
          value={players[0]?.name ?? ''}
          onChange={(event) => updatePlayer(0, { name: event.target.value, isCpu: false })}
          placeholder="挑戦者の名（なくてもよい）"
          maxLength={12}
        />
      </SetupStep>

      <SetupStep numeral="II" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid">
          <SetupModeCard
            selected={mode === 'cpu'}
            icon="🐉"
            title="ドラゴンと対戦"
            code="VS CPU"
            description="あなたとCPUで対戦"
            onClick={() => setMode('cpu')}
          />
          <SetupModeCard
            selected={mode === 'online'}
            icon="♜"
            title="遠方の者と対戦"
            code="ONLINE"
            description="ルームコードで離れた相手と対戦"
            onClick={() => setMode('online')}
          />
        </div>
        {mode === 'online' ? (
          <div className="game-setup-online-panel" style={{ marginTop: 12 }}>
            <SetupChoiceTabs value={onlineTab} onChange={setOnlineTab} />
          </div>
        ) : null}
      </SetupStep>

      {isOnlineJoin ? (
        <SetupStep numeral="III" title="参加コードを入力">
          <input
            className="game-setup-input game-setup-code-input"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="6桁のコードを入力"
            maxLength={6}
          />
          <SetupSummary>入力したコードのルームへ参加します。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button
              fullWidth
              onClick={handleStart}
              disabled={joinCode.length !== 6}
            >
              このコードで参加する
            </Button>
          </div>
        </SetupStep>
      ) : isOnlineCreate ? (
        <SetupStep numeral="III" title="対戦人数と席を決める">
          <div className="game-setup-count-grid" style={{ marginBottom: 12 }}>
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                type="button"
                className={onlinePlayerCount === count ? 'is-selected' : ''}
                onClick={() => setOnlinePlayerCount(count)}
              >
                {count}人
              </button>
            ))}
          </div>
          <div className="game-setup-opponent-list">
            {Array.from({ length: onlinePlayerCount - 1 }, (_, i) => {
              const isCpu = onlineCpuSlots[i];
              const level = onlineCpuLevels[i];
              return (
                <div className="game-setup-opponent-row" key={i}>
                  <strong>{i + 2}人目の席</strong>
                  <span className="game-setup-role-tabs">
                    <button
                      type="button"
                      className={!isCpu ? 'is-selected' : ''}
                      onClick={() => toggleOnlineCpuSlot(i, false)}
                    >
                      👤 人間
                    </button>
                    <button
                      type="button"
                      className={isCpu ? 'is-selected' : ''}
                      onClick={() => toggleOnlineCpuSlot(i, true)}
                    >
                      🐉 CPU
                    </button>
                  </span>
                  {isCpu ? (
                    <select
                      className="game-setup-select"
                      value={level}
                      onChange={(e) => updateOnlineCpuLevel(i, e.target.value as CpuLevel)}
                    >
                      {CPU_LEVELS.map(({ level: l, label }) => (
                        <option key={l} value={l}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>参加待ち</span>
                  )}
                </div>
              );
            })}
          </div>
          <SetupSummary>ルームコードを発行し、参加者を待機します。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={handleStart}>
              ルームを作成する
            </Button>
          </div>
        </SetupStep>
      ) : (
        <SetupStep numeral="III" title="対戦相手を決める">
          <div className="game-setup-count-grid">
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                type="button"
                className={playerCount === count ? 'is-selected' : ''}
                onClick={() => setPlayerCount(count)}
              >
                {count}人
              </button>
            ))}
          </div>
          <div className="game-setup-opponent-list">
            {players.slice(1, playerCount).map((player, index) => (
              <div className="game-setup-opponent-row" key={index}>
                <strong>{player.name || getCpuDisplayName(player.cpuLevel)}</strong>
                <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
                <select
                  className="game-setup-select"
                  value={player.cpuLevel}
                  onChange={(event) => updatePlayer(index + 1, { isCpu: true, cpuLevel: event.target.value as CpuLevel })}
                >
                  {CPU_LEVELS.map(({ level, label }) => (
                    <option key={level} value={level}>{label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <SetupSummary>人間 1人 / CPU {playerCount - 1}体で対戦します。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={handleStart}>
              この設定で対戦する
            </Button>
          </div>
        </SetupStep>
      )}

      <div className="game-setup-cta" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="game-setup-rules-toggle"
          onClick={() => setShowRules((show) => !show)}
        >
          {showRules ? '遊戯の掟を閉じる' : '遊戯の掟を見る'}
        </button>
        {showRules ? (
          <ul className="game-setup-rules-list">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </GameSetupShell>
  );
}
