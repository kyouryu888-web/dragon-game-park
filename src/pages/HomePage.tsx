import { games } from '../data/games';
import type { GameInfo } from '../data/games';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Embers } from '../components/Embers';

const GAME_ICONS: Record<string, string> = {
  mancala: '🎯',
  uno: '🃏',
  backgammon: '🎲',
  babanuki: '💀',
  reversi: '⚫',
  gomoku: '🔵',
  checkers: '♟️',
};

// 金彩×熾火の世界観に馴染むアクセント
const GAME_ACCENT: Record<string, string> = {
  mancala:  '#c9a24b',
  uno:      '#b8502e',
  backgammon: '#e0733a',
  babanuki: '#6f4a8e',
  reversi:  '#8a6f3a',
  gomoku:   '#5c7a8a',
  checkers: '#8a6f3a',
};

// カードに刻むゲームごとの誘い文句
const GAME_EN: Record<string, string> = {
  mancala: 'MANCALA',
  uno: 'UNO',
  backgammon: 'BACKGAMMON',
  babanuki: 'BABANUKI',
  reversi: 'REVERSI',
};

type HomePageProps = {
  onSelectGame: (gameId: string) => void;
};

function GameCard({ game, onSelect }: { game: GameInfo; onSelect: () => void }) {
  const icon    = GAME_ICONS[game.id]  ?? '🎮';
  const accent  = GAME_ACCENT[game.id] ?? '#c9a24b';
  const isAvail = game.status === 'available';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        {/* 紋章 */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: `1.5px solid ${isAvail ? accent : 'rgba(201,162,75,.25)'}`,
            background: 'radial-gradient(circle at 50% 38%, #2a1e2b 0%, #191320 75%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            flexShrink: 0,
            boxShadow: isAvail ? `0 0 18px ${accent}44, inset 0 0 12px rgba(0,0,0,.6)` : 'inset 0 0 12px rgba(0,0,0,.6)',
            filter: isAvail ? 'none' : 'grayscale(.6)',
          }}
        >
          {icon}
        </div>
        <div>
          {/* ジャンルの銘 */}
          <div
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 'bold',
              letterSpacing: '.18em',
              background: isAvail ? 'rgba(201,162,75,.14)' : 'rgba(255,255,255,.04)',
              color: isAvail ? '#d8c79a' : '#7a6f5c',
              border: `1px solid ${isAvail ? 'rgba(201,162,75,.35)' : 'rgba(201,162,75,.15)'}`,
              padding: '2px 10px',
              borderRadius: 3,
              marginBottom: 6,
            }}
          >
            {game.themeLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--text)', letterSpacing: '.08em' }}>
              {game.title}
            </span>
            {GAME_EN[game.id] && (
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, letterSpacing: '.2em', color: '#8a7a58' }}>
                {GAME_EN[game.id]}
              </span>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.75, marginBottom: 16 }}>
        {game.description}
      </p>

      {isAvail ? (
        <Button fullWidth onClick={onSelect}>
          {`${game.title}の盤へ進む`}
        </Button>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '12px',
            background: 'rgba(13,11,16,.5)',
            borderRadius: 6,
            color: '#7a6f5c',
            fontSize: 13,
            letterSpacing: '.08em',
            border: '1px dashed rgba(201,162,75,.25)',
          }}
        >
          🔒 いずれ封印が解かれる…
        </div>
      )}
    </Card>
  );
}

export function HomePage({ onSelectGame }: HomePageProps) {
  return (
    <Layout>
      <Embers />

      {/* ヒーロー */}
      <div
        style={{
          textAlign: 'center',
          paddingTop: 'var(--hero-pt)',
          paddingBottom: 'var(--hero-pb)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#8a6f3a', marginBottom: 12 }}>
          <div style={{ height: 1, width: 52, background: 'linear-gradient(90deg,transparent,#8a6f3a)' }} />
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0 L7.6 4.4 L12 6 L7.6 7.6 L6 12 L4.4 7.6 L0 6 L4.4 4.4 Z" fill="#8a6f3a" /></svg>
          <div style={{ height: 1, width: 52, background: 'linear-gradient(270deg,transparent,#8a6f3a)' }} />
        </div>
        <div
          className="dragon-float"
          style={{
            fontSize: 64,
            marginBottom: 10,
            filter: 'drop-shadow(0 0 22px rgba(224, 115, 58, 0.45))',
          }}
        >
          🐉
        </div>
        <h1
          style={{
            fontFamily: 'Cinzel,serif',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '.14em',
            color: '#e6c877',
            textShadow: '0 0 24px rgba(224,115,58,.35), 0 2px 2px rgba(0,0,0,.6)',
            marginBottom: 6,
          }}
        >
          DRAGON GAME PARK
        </h1>
        <div style={{ fontSize: 13, letterSpacing: '.3em', color: '#9a8d75' }}>
          ドラゴンゲームパーク
        </div>
      </div>

      {/* 番人ドラゴンの口上 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(201,162,75,.08)',
          border: '1px solid rgba(201,162,75,.28)',
          borderRadius: 6,
          padding: '14px 16px',
          marginBottom: 22,
        }}
      >
        <span style={{ fontSize: 26, flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(224,115,58,.4))' }}>🐲</span>
        <p style={{ fontSize: 13.5, color: '#d8cbb0', lineHeight: 1.7 }}>
          よくぞ参った、挑戦者よ。焚き火のそばで、挑む遊戯を選ぶがいい。
        </p>
      </div>

      {/* ゲームカード一覧 */}
      <div className="game-grid" style={{ position: 'relative', zIndex: 2 }}>
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onSelect={() => onSelectGame(game.id)}
          />
        ))}
      </div>

      {/* 追加予定の告知 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          padding: '14px 16px',
          background: 'rgba(13,11,16,.5)',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 13,
          letterSpacing: '.08em',
          color: '#9a8d75',
          border: '1px dashed rgba(201,162,75,.3)',
        }}
      >
        ✦ 新たな遊戯が、闇の中で目覚めのときを待っている…
      </div>

      {/* フッター */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          paddingBottom: 36,
          fontFamily: 'Cinzel,serif',
          fontSize: 10,
          color: '#5f5443',
          letterSpacing: '.3em',
        }}
      >
        DRAGON-GAME-PARK
      </div>

    </Layout>
  );
}
