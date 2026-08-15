import { useEffect, useMemo, useState } from 'react';
import type { BabanukiState } from './babanukiTypes';
import { getRankings } from './babanukiRules';
import { getCpuDisplayName } from './babanukiCpu';
import { GameEndActions } from '../../components/GameEndActions';

/**
 * 最弱王の戴冠式。
 * 暗転 → スポットライト → ジョーカーがめくれ上がる → 💀の王冠が降下 → 称号 → 順位表。
 */

const CONFETTI_COLORS = ['#e6c877', '#b98ad6', '#e0733a', '#c9a24b', '#8a5cb0'];

function Confetti() {
  const dots = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${5 + Math.random() * 90}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${(Math.random() * 1.2).toFixed(2)}s`,
        duration: `${(1.8 + Math.random() * 0.8).toFixed(2)}s`,
        size: `${6 + Math.round(Math.random() * 5)}px`,
      })),
    [],
  );
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 10 }}>
      {dots.map((d) => (
        <div
          key={d.id}
          className="confetti-dot"
          style={{ left: d.left, width: d.size, height: d.size, background: d.color, animationDelay: d.delay, animationDuration: d.duration }}
        />
      ))}
    </div>
  );
}

type Props = {
  state: BabanukiState;
  viewerId: string;
  /** 同じ設定で再戦できる場合だけ渡す */
  onRestart?: () => void;
  /** 人数やCPUの強さを変えてから遊び直したいとき。無ければボタンを出さない */
  onChangeSettings?: () => void;
  onBackToSetup: () => void;
  /** オンラインのゲストなど、自分では再戦を開始できないときの案内 */
  waitingMessage?: string;
  onBackToHome: () => void;
};

const STAGE_TIMINGS = [700, 900, 1000, 900];

export function BabanukiFinale({
  state,
  viewerId,
  onRestart,
  onChangeSettings,
  onBackToSetup,
  waitingMessage,
  onBackToHome,
}: Props) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGE_TIMINGS.length) return;
    const timer = setTimeout(() => setStage((s) => s + 1), STAGE_TIMINGS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  const rankings = useMemo(() => getRankings(state), [state]);
  const loser = state.players.find((p) => p.id === state.loserId) ?? null;
  const loserName = loser ? loser.name || (loser.isCpu ? getCpuDisplayName(loser.cpuLevel) : 'プレイヤー') : '';
  const isViewerLoser = state.loserId === viewerId;

  return (
    <div
      className="babanuki-blackout"
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'radial-gradient(ellipse at 50% 38%, rgba(60,30,80,.55), rgba(6,4,10,.97) 62%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflowY: 'auto',
      }}
    >
      {/* スポットライト */}
      {stage >= 1 && (
        <div
          className="babanuki-spotlight"
          style={{
            position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
            width: 260, height: 360,
            background: 'linear-gradient(180deg, rgba(230,200,255,.22), rgba(230,200,255,0) 78%)',
            clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2, width: '100%', maxWidth: 380 }}>
        {/* ジョーカーがめくれ上がる */}
        {stage >= 1 && (
          <div className="babanuki-joker-reveal" style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
            {stage >= 2 && (
              <div className="babanuki-crown-drop" style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)', fontSize: 34 }}>
                💀
              </div>
            )}
            <div
              style={{
                width: 92, height: 130, borderRadius: 10,
                background: 'linear-gradient(160deg,#2a1836,#4a2a5e 60%,#1d1226)',
                border: '2px solid #8a5cb0',
                boxShadow: '0 0 34px rgba(150,90,200,.55), inset 0 0 18px rgba(0,0,0,.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46,
              }}
            >
              🃏
            </div>
          </div>
        )}

        {/* 称号 */}
        {stage >= 3 && (
          <div style={{ marginTop: 10 }}>
            <div className="babanuki-title-carve" style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: '#9a8d75', letterSpacing: '.3em' }}>
              THE WEAKEST KING
            </div>
            <div className="babanuki-loser-glow babanuki-title-carve" style={{ fontSize: 30, fontWeight: 'bold', margin: '4px 0 2px', letterSpacing: '.18em' }}>
              最弱王
            </div>
            <div style={{ fontSize: 18, color: '#e0d3b8' }}>{loserName}</div>
            <div style={{ fontSize: 12, color: '#9a8d75', marginTop: 6 }}>
              {isViewerLoser ? 'ジョーカーを抱えたまま、玉座に取り残された。' : `${loserName} がジョーカーを引き受けた。`}
            </div>
          </div>
        )}

        {/* 順位表 */}
        {stage >= 4 && (
          <div className="result-appear" style={{ position: 'relative', marginTop: 18, textAlign: 'left' }}>
            <Confetti />
            <div style={{ fontSize: 12, color: '#9a8d75', letterSpacing: '.2em', marginBottom: 8, textAlign: 'center' }}>けっか</div>
            {rankings.map((entry, index) => {
              const player = state.players.find((p) => p.id === entry.playerId);
              if (!player) return null;
              const name = player.name || (player.isCpu ? getCpuDisplayName(player.cpuLevel) : 'プレイヤー');
              const isLast = entry.playerId === state.loserId;
              return (
                <div
                  key={entry.playerId}
                  className="rank-card"
                  style={{
                    animationDelay: `${index * 90}ms`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', marginBottom: 6, borderRadius: 8,
                    background: isLast ? 'rgba(90,50,120,.3)' : 'rgba(40,32,26,.6)',
                    border: `1px solid ${isLast ? 'rgba(160,100,210,.5)' : 'rgba(201,162,75,.25)'}`,
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                    {isLast ? '💀' : entry.rank === 1 ? <span className="trophy-bounce">🏆</span> : `${entry.rank}`}
                  </span>
                  <span className={entry.rank === 1 ? 'winner-glow' : undefined} style={{ flex: 1, fontSize: 14, color: isLast ? '#c9a6e0' : '#e0d3b8' }}>
                    {name}
                    {player.id === viewerId && <span style={{ fontSize: 11, color: '#9a8d75' }}> （あなた）</span>}
                  </span>
                  <span style={{ fontSize: 12, color: '#9a8d75' }}>{isLast ? '最弱王' : `${entry.rank}位`}</span>
                </div>
              );
            })}

            <GameEndActions
              onRematch={onRestart}
              canRematch={Boolean(onRestart)}
              onChangeSettings={onChangeSettings ?? onBackToSetup}
              onBackToSetup={onBackToSetup}
              onBackToHome={onBackToHome}
            />
            {waitingMessage && (
              <p style={{ fontSize: 12, color: '#c9b48f', marginTop: 10, textAlign: 'center' }}>
                {waitingMessage}
              </p>
            )}
            {onChangeSettings && (
              <p style={{ fontSize: 11, color: '#7a6f5c', marginTop: 8, textAlign: 'center' }}>
                「設定を変更して再戦する」で人数やドラゴンの強さを選び直せます
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
