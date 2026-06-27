import type { Pit } from './mancalaTypes';
import type { CSSProperties } from 'react';

// ---- 宝石風の石カラーパレット（MancalaBoard でも使用するためエクスポート） ----
export const GEM_COLORS = [
  { main: '#e63a2a', shine: '#ff8a7a' },  // ルビー
  { main: '#2878cc', shine: '#74b9ff' },  // サファイア
  { main: '#d4a408', shine: '#ffe060' },  // トパーズ
  { main: '#25a855', shine: '#6fcf97' },  // エメラルド
  { main: '#8e44c0', shine: '#d4a4e0' },  // アメジスト
  { main: '#d46018', shine: '#f0a960' },  // アンバー
  { main: '#12a896', shine: '#5fe0c8' },  // アクアマリン
  { main: '#c81060', shine: '#f48fb1' },  // ローズクォーツ
];

// ---- 宝石1個 ----
function Gem({ index, size }: { index: number; size: number }) {
  const c = GEM_COLORS[index % GEM_COLORS.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, ${c.shine}, ${c.main})`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.35)`,
        flexShrink: 0,
      }}
    />
  );
}

// ---- ポケット用の石表示（穴の中：宝石のみ、個数はMancalaBoardで穴の外に表示） ----
function PocketGems({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', lineHeight: 1 }}>
        ○
      </span>
    );
  }

  const showGems = Math.min(count, 6);
  const gemSize  = count > 4 ? 5 : 6;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: count > 4 ? 1.5 : 2,
        justifyContent: 'center',
        maxWidth: '88%',
      }}
    >
      {Array.from({ length: showGems }).map((_, i) => (
        <Gem key={i} index={i} size={gemSize} />
      ))}
    </div>
  );
}

// ---- ストア用の石表示 ----
function StoreGems({ count }: { count: number }) {
  const showCount = Math.min(count, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {/* 宝石ドット */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          /* ストア列が小さい画面でも石がはみ出ないよう 80% に制限 */
          maxWidth: '80%',
        }}
      >
        {Array.from({ length: showCount }).map((_, i) => (
          <Gem key={i} index={i} size={6} />
        ))}
      </div>
      {/* スコア数: clamp でストア列幅に合わせてフォントが縮小 */}
      <div
        style={{
          fontSize: 'clamp(14px, 4.2vw, 20px)',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          lineHeight: 1,
        }}
      >
        {count}
      </div>
    </div>
  );
}

// ============================================================
// ポケット（小さい穴）
// ============================================================

type PocketPitProps = {
  pit: Pit;
  isSelectable: boolean;
  onClick: () => void;
  /** true: 石が着地した（バウンスアニメーション） */
  isActive?: boolean;
  /** true: 石を拾い上げた元の穴（くぼみアニメーション） */
  isSource?: boolean;
  /** true: 穴の下に石数を数字で表示する（3P/4P用） */
  showCount?: boolean;
};

export function PocketPit({
  pit, isSelectable, onClick, isActive = false, isSource = false, showCount = false,
}: PocketPitProps) {
  const cls = [
    'pit-btn',
    isSelectable ? 'is-selectable' : '',
    isActive     ? 'is-active'     : '',
    isSource     ? 'is-source'     : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={cls}
      onClick={isSelectable ? onClick : undefined}
      disabled={!isSelectable}
      aria-label={`${pit.stones}個の石${isSelectable ? '（選択可能）' : ''}`}
      style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '50%',
        border: isActive
          ? '3px solid #ffe060'
          : isSource
          ? '3px solid rgba(255,255,255,0.25)'
          : isSelectable
          ? '3px solid #ffd700'
          : '2px solid rgba(255,255,255,0.10)',
        background: isActive
          ? 'radial-gradient(circle at 40% 35%, #e8a850, #a06030)'
          : isSource
          ? 'radial-gradient(circle at 40% 35%, #4a2808, #2a1004)'
          : isSelectable
          ? 'radial-gradient(circle at 40% 35%, #d8884a, #8a4818)'
          : pit.stones === 0
          ? 'radial-gradient(circle at 40% 35%, #5a3010, #3a1c08)'
          : 'radial-gradient(circle at 40% 35%, #8a5428, #5a2e10)',
        cursor: isSelectable ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: showCount ? 'flex-start' : 'center',
        padding: showCount ? '3px 3px 1px' : 3,
        boxShadow: isActive
          ? '0 0 0 3px rgba(255,240,80,0.85), 0 0 20px 5px rgba(255,220,0,0.70), inset 0 3px 8px rgba(0,0,0,0.45)'
          : isSource
          ? 'inset 0 4px 14px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.25)'
          : isSelectable
          ? '0 0 12px rgba(255,215,0,0.60), 0 2px 8px rgba(0,0,0,0.4), inset 0 3px 8px rgba(0,0,0,0.45)'
          : 'inset 0 3px 10px rgba(0,0,0,0.50), 0 1px 3px rgba(0,0,0,0.25)',
        outline: 'none',
      }}
    >
      <PocketGems count={pit.stones} />
      {showCount && (
        <span style={{
          fontSize: 'clamp(7px, 1.8vw, 10px)',
          fontWeight: 'bold',
          color: 'rgba(255,255,255,0.90)',
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          marginTop: 1,
        }}>
          {pit.stones}
        </span>
      )}
    </button>
  );
}

// ============================================================
// ストア（大きい得点穴）
// ============================================================

type StorePitProps = {
  pit: Pit;
  /** true: コンパクト表示（3P/4Pの小さいセル用） */
  compact?: boolean;
};

export function StorePit({ pit, compact = false }: StorePitProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: compact ? '50%' : 14,
        background: 'radial-gradient(ellipse at 50% 30%, #6a3818, #3a1c08)',
        border: '2px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)',
        padding: compact ? 2 : 6,
        overflow: 'hidden',
      }}
    >
      {compact ? (
        <>
          <div style={{
            fontSize: 'clamp(9px, 3vw, 16px)',
            fontWeight: 'bold',
            color: '#fff',
            lineHeight: 1,
            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          }}>
            {pit.stones}
          </div>
          <div style={{ fontSize: 'clamp(5px, 1.5vw, 8px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1, marginTop: 1 }}>
            石
          </div>
        </>
      ) : (
        <StoreGems count={pit.stones} />
      )}
    </div>
  );
}

// ============================================================
// PlayerPlank（1プレイヤーの横長の板）
// ============================================================

export type PlayerPlankProps = {
  pits: Pit[];           // pit-0〜pit-5（board配列順）
  store: Pit;
  playerName: string;
  colorAccent: string;   // プレイヤーカラー（アクセントに使用）
  isCurrentTurn: boolean;
  selectableIds: Set<string>;
  onPitClick: (id: string) => void;
  curActiveId: string | null;
  sourcePitId: string | null;
  animIdx: number | undefined;
  setCellRef: (id: string) => (el: HTMLElement | null) => void;
  /** absolute配置時の transform 値（board側で制御） */
  style?: CSSProperties;
  /** true: 2Pフェイスツーフェイス専用スタイル（cssクラス使用） */
  facingMode?: boolean;
  /** true: ピットの順序を逆にする（2P上プレイヤーなど） */
  reversed?: boolean;
  /** 'left': ストアを左に配置（2P上プレイヤー）/ 'right': 右に配置（2P下プレイヤー） */
  storePosition?: 'left' | 'right';
  /** 表示用石数ラベルを外部に出さず内部に表示（3P/4P プランクモード） */
  showCount?: boolean;
};

export const PLAYER_ACCENT_COLORS = [
  '#e05030', // P1: 赤系
  '#2878cc', // P2: 青系
  '#9b59b6', // P3: 紫系
  '#27ae60', // P4: 緑系
];

export function PlayerPlank({
  pits, store, playerName, colorAccent, isCurrentTurn,
  selectableIds, onPitClick, curActiveId, sourcePitId,
  animIdx, setCellRef, style, facingMode = false, reversed = false,
  storePosition = 'left', showCount = true,
}: PlayerPlankProps) {
  const displayPits = reversed ? [...pits].reverse() : pits;

  const pitCells = displayPits.map((pit) => {
    const isActive = curActiveId === pit.id;
    const isSource = sourcePitId === pit.id && animIdx === 0;
    return (
      <div
        key={isActive ? `${pit.id}-${animIdx}` : pit.id}
        ref={setCellRef(pit.id)}
        className="plank-2p-pit-cell"
      >
        <PocketPit
          pit={pit}
          isSelectable={selectableIds.has(pit.id)}
          onClick={() => onPitClick(pit.id)}
          isActive={isActive}
          isSource={isSource}
          showCount={showCount}
        />
      </div>
    );
  });

  const storeCell = (
    <div className="plank-2p-store-cell" ref={setCellRef(store.id)}>
      <StorePit pit={store} />
    </div>
  );

  if (facingMode) {
    // 2P フェイスツーフェイス専用レイアウト
    return (
      <div className="plank-2p" style={style}>
        {/* アクセントバー */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          borderRadius: '9px 9px 0 0',
          background: colorAccent, opacity: 0.70,
        }} />
        {storePosition === 'left' ? (
          <>{storeCell}{pitCells}</>
        ) : (
          <>{pitCells}{storeCell}</>
        )}
      </div>
    );
  }

  // 4P / 3P 絶対配置モード（style で transform が渡される）
  return (
    <div className="player-plank" style={style}>
      {/* プレイヤーカラーアクセントバー */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        borderRadius: '9px 9px 0 0',
        background: colorAccent,
        opacity: isCurrentTurn ? 0.90 : 0.50,
      }} />
      {/* ピット列 */}
      <div className="plank-pits">
        {displayPits.map((pit) => {
          const isActive = curActiveId === pit.id;
          const isSource = sourcePitId === pit.id && animIdx === 0;
          return (
            <div
              key={isActive ? `${pit.id}-${animIdx}` : pit.id}
              ref={setCellRef(pit.id)}
              className="plank-pit-cell"
            >
              <PocketPit
                pit={pit}
                isSelectable={selectableIds.has(pit.id)}
                onClick={() => onPitClick(pit.id)}
                isActive={isActive}
                isSource={isSource}
                showCount={showCount}
              />
            </div>
          );
        })}
      </div>
      {/* ストア */}
      <div className="plank-store-cell" ref={setCellRef(store.id)}>
        <StorePit pit={store} compact />
      </div>
      {/* プレイヤー名ラベル */}
      <div className="plank-label" style={{ top: -18, left: 4 }}>
        {isCurrentTurn ? '▶ ' : ''}{playerName}
      </div>
    </div>
  );
}
