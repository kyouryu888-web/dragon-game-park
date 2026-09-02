import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from '../../components/gameSetupDefaults';
import type { UnoConfig, UnoCpuLevel, UnoPlayerConfig, UnoVariant } from './unoTypes';
import { getUnoCpuDisplayName, getUnoCpuLevelLabel } from './unoCpu';
import { UnoRulesPanel } from './UnoRulesPanel';

const STORAGE_KEY = 'dragon-game-park:uno-config-v1';
const CPU_LEVELS: UnoCpuLevel[] = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];

export type UnoOnlineEntry = {
  mode: 'create' | 'join';
  name: string;
  code: string;
};

function defaultPlayers(): UnoPlayerConfig[] {
  return Array.from({ length: 10 }, (_, index) => ({
    name: '',
    isCpu: index > 0,
    cpuLevel: 'normal' as UnoCpuLevel,
  }));
}

function loadSavedConfig(): UnoConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnoConfig;
    if (!parsed.variant || !Array.isArray(parsed.playerConfigs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConfig(config: UnoConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage may be unavailable in some test environments.
  }
}

type UnoSetupPageProps = {
  onStart: (config: UnoConfig) => void;
  onBack: () => void;
  onOnlinePlay: (entry: UnoOnlineEntry) => void;
};

export function UnoSetupPage({ onStart, onBack, onOnlinePlay }: UnoSetupPageProps) {
  const saved = useMemo(() => loadSavedConfig(), []);
  const [variant, setVariant] = useState<UnoVariant>(saved?.variant ?? 'standard');
  const [playerCount, setPlayerCount] = useState(() => Math.min(Math.max(saved?.playerConfigs.length ?? 2, 2), saved?.variant === 'hard' ? 6 : 10));
  const [players, setPlayers] = useState<UnoPlayerConfig[]>(() => {
    const base = defaultPlayers();
    if (!saved?.playerConfigs) return base;
    return base.map((config, index) => ({ ...config, ...saved.playerConfigs[index], isCpu: index > 0 }));
  });
  const [mode, setMode] = useState<'cpu' | 'online'>(DEFAULT_SETUP_MODE);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

  const maxPlayers = variant === 'hard' ? 6 : 10;

  function updateVariant(nextVariant: UnoVariant) {
    setVariant(nextVariant);
    setPlayerCount((count) => Math.min(count, nextVariant === 'hard' ? 6 : 10));
  }

  function updatePlayer(index: number, patch: Partial<UnoPlayerConfig>) {
    setPlayers((previous) => previous.map((player, playerIndex) => playerIndex === index ? { ...player, ...patch } : player));
  }

  function handleStart() {
    if (mode === 'online') {
      onOnlinePlay({ mode: onlineTab, name: players[0]?.name ?? '', code: joinCode.trim().toUpperCase() });
      return;
    }
    const config: UnoConfig = {
      variant,
      playerConfigs: players.slice(0, playerCount).map((player, index) => ({
        name: player.name,
        isCpu: index > 0,
        cpuLevel: player.cpuLevel ?? 'normal',
      })),
    };
    saveConfig(config);
    onStart(config);
  }

  return (
    <GameSetupShell
      theme="uno"
      icon="🃏"
      title="UNO"
      englishTitle="UNO"
      description="色と数字をつないで手札を燃やし尽くすカードの決闘。通常版とハード版を選べます。"
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
        <div className="game-setup-mode-grid game-setup-mode-grid-card-game">
          <SetupModeCard selected={mode === 'cpu'} icon="🐉" title="ドラゴンと対戦" code="VS CPU" description="あなた1人とCPUで対戦" onClick={() => setMode('cpu')} />
          <SetupModeCard selected={mode === 'online'} icon="♜" title="遠方の者と対戦" code="ONLIE" description="離れた端末からルームコードで参加" onClick={() => setMode('online')} />
        </div>
        {mode === 'online' ? (
          <div className="game-setup-online-panel">
            <SetupChoiceTabs value={onlineTab} onChange={setOnlineTab} />
            {onlineTab === 'join' ? (
              <>
                <input
                  className="game-setup-input game-setup-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="コードを入力"
                  maxLength={6}
                />
                <div style={{ marginTop: 8 }}>
                  <Button fullWidth onClick={handleStart} disabled={joinCode.length !== 6}>このコードで参加する</Button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Button fullWidth onClick={handleStart}>ルーム設定へ進む</Button>
              </div>
            )}
          </div>
        ) : null}
      </SetupStep>

      {mode === 'cpu' ? (
        <SetupStep numeral="III" title="対戦相手を決める" description="カードゲームのため、同じ端末で人どうしの対戦は行いません。">
          <div className="game-setup-tabs" style={{ marginBottom: 12 }}>
            <button type="button" className={variant === 'standard' ? 'is-selected' : ''} onClick={() => updateVariant('standard')}>通常版</button>
            <button type="button" className={variant === 'hard' ? 'is-selected' : ''} onClick={() => updateVariant('hard')}>ハード版</button>
          </div>
          <div className="game-setup-count-grid">
            {Array.from({ length: maxPlayers - 1 }, (_, index) => index + 2).map((count) => (
              <button key={count} type="button" className={playerCount === count ? 'is-selected' : ''} onClick={() => setPlayerCount(count)}>{count}人</button>
            ))}
          </div>
          <div className="game-setup-opponent-list">
            {players.slice(1, playerCount).map((player, index) => (
              <div className="game-setup-opponent-row" key={index}>
                <strong>{player.name || getUnoCpuDisplayName(player.cpuLevel ?? 'normal')}</strong>
                <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
                <select className="game-setup-select" value={player.cpuLevel ?? 'normal'} onChange={(event) => updatePlayer(index + 1, { isCpu: true, cpuLevel: event.target.value as UnoCpuLevel })}>
                  {CPU_LEVELS.map((level) => <option key={level} value={level}>{getUnoCpuLevelLabel(level)}</option>)}
                </select>
              </div>
            ))}
          </div>
          <SetupSummary>人間1人 / CPU {playerCount - 1}体、{variant === 'hard' ? 'ハード版' : '通常版'}で対戦します。</SetupSummary>
        </SetupStep>
      ) : (
        <SetupStep numeral="III" title={onlineTab === 'create' ? 'ルームを作る' : 'コードで参加する'}>
          <SetupSummary>{onlineTab === 'create' ? '次の画面でUNOの種類・人数・人間/CPUの席を設定します。' : '入力したコードのルームへ参加します。'}</SetupSummary>
        </SetupStep>
      )}

      <div className="game-setup-cta">
        {mode === 'cpu' ? (
          <Button fullWidth onClick={handleStart}>
            この設定で対戦する
          </Button>
        ) : null}
        <button type="button" className="game-setup-rules-toggle" onClick={() => setShowRules((show) => !show)}>
          {showRules ? 'カードとルールを閉じる' : 'カードとルールを見る'}
        </button>
        {showRules ? <div style={{ marginTop: 10 }}><UnoRulesPanel variant={variant} /></div> : null}
      </div>
    </GameSetupShell>
  );
}
