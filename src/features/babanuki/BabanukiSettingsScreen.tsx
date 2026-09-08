import { useState } from 'react';
import { Button } from '../../components/Button';
import {
  GameSetupShell,
  SetupChoiceTabs,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';
import { DEFAULT_ONLINE_ENTRY_MODE, DEFAULT_SETUP_MODE } from '../../components/gameSetupDefaults';
import type { BabanukiConfig, CpuLevel } from './babanukiTypes';
import { MAX_PLAYERS, MIN_PLAYERS } from './babanukiTypes';
import { CPU_LEVELS, getCpuLevelLabel } from './babanukiCpu';

export type BabanukiOnlineEntry = {
  mode: 'create' | 'join';
  name: string;
  code: string;
};

type Props = {
  config: BabanukiConfig;
  onChange: (next: BabanukiConfig) => void;
  onStart: () => void;
  onOnlinePlay: (entry: BabanukiOnlineEntry) => void;
  onBack: () => void;
};

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export function BabanukiSettingsScreen({ config, onChange, onStart, onOnlinePlay, onBack }: Props) {
  const [mode, setMode] = useState<'cpu' | 'online'>(DEFAULT_SETUP_MODE);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>(DEFAULT_ONLINE_ENTRY_MODE);
  const [joinCode, setJoinCode] = useState('');

  const setPlayerCount = (count: number) => {
    const players = config.players.slice();
    while (players.length < count) players.push({ name: '', isCpu: true, cpuLevel: 'normal' });
    onChange({ playerCount: count, players: players.slice(0, count) });
  };

  const setMyName = (name: string) => {
    const players = config.players.slice();
    players[0] = { ...players[0], name };
    onChange({ ...config, players });
  };

  const setCpuLevel = (index: number, level: CpuLevel) => {
    const players = config.players.slice();
    players[index] = { ...players[index], isCpu: true, cpuLevel: level };
    onChange({ ...config, players });
  };

  const handleStart = () => {
    if (mode === 'cpu') {
      onStart();
      return;
    }
    onOnlinePlay({
      mode: onlineTab,
      name: config.players[0]?.name ?? '',
      code: joinCode.trim().toUpperCase(),
    });
  };

  const isOnlineJoin = mode === 'online' && onlineTab === 'join';
  const isOnlineCreate = mode === 'online' && onlineTab === 'create';

  return (
    <GameSetupShell
      theme="babanuki"
      icon="💀"
      title="最弱王ババ抜き"
      englishTitle="BABANUKI"
      description="ジョーカーを最後まで抱えた者が最弱王。シャッフルタイムで全員の運命が動きます。"
      onBack={onBack}
    >
      <SetupStep numeral="I" title="名を刻む">
        <input
          className="game-setup-input"
          value={config.players[0]?.name ?? ''}
          onChange={(event) => setMyName(event.target.value)}
          placeholder="挑戦者の名（なくてもよい）"
          maxLength={10}
        />
      </SetupStep>

      <SetupStep numeral="II" title="対戦方法を選ぶ">
        <div className="game-setup-mode-grid game-setup-mode-grid-card-game">
          <SetupModeCard
            selected={mode === 'cpu'}
            icon="🐉"
            title="ドラゴンと対戦"
            code="VS CPU"
            description="あなた1人とドラゴンたちで対戦"
            onClick={() => setMode('cpu')}
          />
          <SetupModeCard
            selected={mode === 'online'}
            icon="♜"
            title="遠方の者と対戦"
            code="ONLINE"
            description="離れた端末からルームコードで参加"
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
        <SetupStep numeral="III" title="ルーム作成の準備">
          <SetupSummary>次の画面で対戦人数と、人間・CPUの席を選び、ルームコードを発行します。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={handleStart}>
              ルーム設定へ進む
            </Button>
          </div>
        </SetupStep>
      ) : (
        <SetupStep numeral="III" title="対戦相手を決める" description="カードゲームのため、同じ端末で人どうしの対戦は行いません。">
          <div className="game-setup-count-grid">
            {PLAYER_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className={config.playerCount === count ? 'is-selected' : ''}
                onClick={() => setPlayerCount(count)}
              >
                {count}人
              </button>
            ))}
          </div>
          <div className="game-setup-opponent-list">
            {config.players.slice(1, config.playerCount).map((player, index) => (
              <div className="game-setup-opponent-row" key={index}>
                <strong>ドラゴン{index + 1}</strong>
                <span className="game-setup-role-tabs"><button type="button" className="is-selected">CPU</button></span>
                <select
                  className="game-setup-select"
                  value={player.cpuLevel}
                  onChange={(event) => setCpuLevel(index + 1, event.target.value as CpuLevel)}
                >
                  {CPU_LEVELS.map((level) => (
                    <option key={level} value={level}>{getCpuLevelLabel(level)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <SetupSummary>人間1人 / CPU {config.playerCount - 1}体で対戦します。</SetupSummary>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={handleStart}>
              この設定で対戦する
            </Button>
          </div>
        </SetupStep>
      )}
    </GameSetupShell>
  );
}
