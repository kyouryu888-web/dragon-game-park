import { games } from '../data/games';
import type { GameInfo } from '../data/games';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

const GAME_ICONS: Record<string, string> = {
  mancala: '🎯',
  uno: '🃏',
  reversi: '⚫',
  gomoku: '🔵',
  checkers: '♟️',
};

const GAME_ACCENT: Record<string, string> = {
  mancala:  '#c87038',
  uno:      '#d63a30',
  reversi:  '#444',
  gomoku:   '#3a8adc',
  checkers: '#6a5028',
};

type HomePageProps = {
  onSelectGame: (gameId: string) => void;
};

function GameCard({ game, onSelect }: { game: GameInfo; onSelect: () => void }) {
  const icon    = GAME_ICONS[game.id]  ?? '🎮';
  const accent  = GAME_ACCENT[game.id] ?? '#888';
  const isAvail = game.status === 'available';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        {/* アイコン */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            backgroundColor: isAvail ? accent : '#c8b898',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            flexShrink: 0,
            boxShadow: isAvail
              ? `0 4px 14px ${accent}55`
              : '0 2px 6px rgba(0,0,0,0.10)',
          }}
        >
          {icon}
        </div>
        <div>
          {/* ジャンルラベル */}
          <div
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 'bold',
              backgroundColor: isAvail ? `${accent}22` : '#f0ece8',
              color: isAvail ? accent : '#9a8070',
              padding: '2px 10px',
              borderRadius: 20,
              marginBottom: 5,
              letterSpacing: 0.5,
            }}
          >
            {game.themeLabel}
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--text)' }}>
            {game.title}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.75, marginBottom: 16 }}>
        {game.description}
      </p>

      {isAvail ? (
        <Button fullWidth onClick={onSelect}>
          {game.title}をはじめる →
        </Button>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '12px',
            background: '#f4f0ec',
            borderRadius: 12,
            color: '#b0a090',
            fontSize: 13,
            border: '1px dashed #d8cfc4',
          }}
        >
          🔜 近日公開予定
        </div>
      )}
    </Card>
  );
}

export function HomePage({ onSelectGame }: HomePageProps) {
  return (
    <Layout>

      {/* ヒーローバナー: --hero-pt / --hero-pb はスマホ横向きで縮小 */}
      <div
        style={{
          textAlign: 'center',
          paddingTop: 'var(--hero-pt)',
          paddingBottom: 'var(--hero-pb)',
        }}
      >
        <div className="dragon-float" style={{ fontSize: 68, marginBottom: 10 }}>
          🐉
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 'bold',
            color: 'var(--brown)',
            marginBottom: 8,
            letterSpacing: 1.5,
          }}
        >
          ドラゴンゲームパーク
        </h1>
      </div>

      {/* ドラゴン案内メッセージ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(135deg, #fff8ed, #fdf0d8)',
          border: '1.5px solid #e8c880',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 22,
          boxShadow: '0 2px 10px rgba(200, 150, 40, 0.12)',
        }}
      >
        <span style={{ fontSize: 26, flexShrink: 0 }}>🐲</span>
        <p style={{ fontSize: 14, color: '#7a5010', fontWeight: 'bold' }}>
          ゲームを選択してください。
        </p>
      </div>

      {/*
        ゲームカード一覧
        game-grid: スマホ縦1列 → 680px+ で横2列グリッド（global.css 参照）
      */}
      <div className="game-grid">
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
          textAlign: 'center',
          padding: '14px 16px',
          background: '#f0ece6',
          borderRadius: 14,
          marginBottom: 16,
          fontSize: 13,
          color: '#9a7a58',
          border: '1px dashed #d4c0a0',
        }}
      >
        🎲 今後、いろいろなゲームを追加予定！
      </div>

      {/* フッター */}
      <div
        style={{
          textAlign: 'center',
          paddingBottom: 36,
          fontSize: 11,
          color: '#c0a880',
          letterSpacing: 0.5,
        }}
      >
        🐉 Dragon Game Park
      </div>

    </Layout>
  );
}
