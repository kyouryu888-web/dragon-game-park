import type { BabanukiConfig, CpuLevel } from './babanukiTypes';
import { MAX_PLAYERS, MIN_PLAYERS } from './babanukiTypes';
import { CPU_LEVELS, getCpuLevelLabel } from './babanukiCpu';

type Props = {
  config: BabanukiConfig;
  onChange: (next: BabanukiConfig) => void;
  onStart: () => void;
  onOnlinePlay: () => void;
  onBack: () => void;
};

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export function BabanukiSettingsScreen({ config, onChange, onStart, onOnlinePlay, onBack }: Props) {
  const setPlayerCount = (count: number) => {
    const players = config.players.slice();
    while (players.length < count) {
      players.push({ name: '', isCpu: true, cpuLevel: 'normal' });
    }
    onChange({ playerCount: count, players: players.slice(0, count) });
  };

  const setMyName = (name: string) => {
    const players = config.players.slice();
    players[0] = { ...players[0], name };
    onChange({ ...config, players });
  };

  const setCpuLevel = (index: number, level: CpuLevel) => {
    const players = config.players.slice();
    players[index] = { ...players[index], cpuLevel: level };
    onChange({ ...config, players });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '14px 16px 32px', color: '#e0d3b8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          className="btn"
          onClick={onBack}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(140,120,90,.4)', background: 'rgba(30,26,22,.8)', color: '#c9b48f', fontSize: 12, cursor: 'pointer' }}
        >
          ← ホーム
        </button>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: '.2em', color: '#8a7a58' }}>BABANUKI</span>
      </div>

      <h1 style={{ fontSize: 22, margin: '0 0 4px', letterSpacing: '.08em' }}>💀 最弱王ババ抜き</h1>
      <p style={{ fontSize: 12, color: '#9a8d75', lineHeight: 1.7, margin: '0 0 18px' }}>
        ジョーカーを最後まで抱えた者が「最弱王」。
        1人1回だけ使えるシャッフルタイムで、全員の手札をまとめてひっくり返せる。
      </p>

      <section style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>人数（3〜6人）</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className="btn"
              onClick={() => setPlayerCount(count)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                border: `1px solid ${config.playerCount === count ? '#b98ad6' : 'rgba(140,120,90,.4)'}`,
                background: config.playerCount === count ? 'rgba(90,52,120,.55)' : 'rgba(30,26,22,.8)',
                color: config.playerCount === count ? '#f0dcff' : '#c9b48f',
              }}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>あなたの名前</div>
        <input
          className="bg-dark-input"
          value={config.players[0]?.name ?? ''}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="プレイヤー"
          maxLength={10}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            border: '1px solid rgba(140,120,90,.4)', background: 'rgba(20,17,14,.9)', color: '#e0d3b8',
          }}
        />
      </section>

      <section style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#b5a68c', marginBottom: 6 }}>ドラゴンたちの強さ</div>
        {config.players.slice(1, config.playerCount).map((player, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#9a8d75', width: 62 }}>{i + 1}体目</span>
            <select
              value={player.cpuLevel}
              onChange={(e) => setCpuLevel(i + 1, e.target.value as CpuLevel)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 13,
                border: '1px solid rgba(140,120,90,.4)', background: 'rgba(20,17,14,.9)', color: '#e0d3b8',
              }}
            >
              {CPU_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {getCpuLevelLabel(level)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>

      <button
        type="button"
        className="btn"
        onClick={onStart}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 10, marginBottom: 10, cursor: 'pointer',
          border: '1px solid rgba(200,140,240,.6)',
          background: 'linear-gradient(180deg,#5a3478,#3a2050)',
          color: '#f0dcff', fontSize: 16, fontWeight: 'bold',
        }}
      >
        ドラゴンと対戦する
      </button>
      <button
        type="button"
        className="btn"
        onClick={onOnlinePlay}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer',
          border: '1px solid rgba(201,162,75,.5)', background: 'rgba(60,44,30,.8)', color: '#e6c877', fontSize: 14,
        }}
      >
        オンラインで対戦する（ルームコード）
      </button>
      <p style={{ fontSize: 11, color: '#7a6f5c', lineHeight: 1.7, marginTop: 14 }}>
        ※ この端末での対戦は、手札を伏せる都合上「あなた1人 ＋ ドラゴン」になります。
        人どうしで遊ぶときはオンラインを使ってください。
      </p>
    </div>
  );
}
