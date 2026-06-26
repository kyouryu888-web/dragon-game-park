import { useRef, useLayoutEffect } from 'react';
import type { GameState } from './mancalaTypes';
import { getSelectablePits } from './mancalaRules';
import { PocketPit, StorePit, GEM_COLORS } from './MancalaPit';

// ============================================================
// DroppingStone: 塊から1個の石が穴へ落ちる
// ============================================================

/**
 * FloatingCluster が穴の上空に到達した直後、1個の石が塊から落下する。
 * pitId の穴の上（clusterY = pitTop - 35px）から穴の中心まで落下する。
 * key={animIdx} で毎ステップ再マウントしてアニメーションをリセット。
 */
function DroppingStone({
  pitId,
  colorIndex,
  stepMs,
  cellRefMap,
}: {
  pitId: string;
  colorIndex: number;
  stepMs: number;
  cellRefMap: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const pitEl = cellRefMap.current.get(pitId);
    if (!el || !pitEl) return;

    const rect = pitEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;

    // 塊は穴の上端から 35px 上に浮いている
    const fromY = rect.top - 35;
    const toY   = rect.top + rect.height / 2; // 穴の中心
    const dy    = toY - fromY;

    el.style.left = `${cx - 10}px`;
    el.style.top  = `${fromY - 10}px`; // 石サイズ 20px の半分を引く

    const delay    = Math.round(stepMs * 0.54); // 塊が到着してから落下開始
    const duration = Math.round(stepMs * 0.44); // 落下アニメーション時間

    el.animate(
      [
        { transform: 'translate(0, 0) scale(1.2)', opacity: '1' },
        { transform: `translate(0, ${(dy * 0.55).toFixed(1)}px) scale(1.0)`, opacity: '1', offset: 0.5 },
        { transform: `translate(0, ${dy.toFixed(1)}px) scale(0.75)`, opacity: '0' },
      ],
      { delay, duration, easing: 'ease-in', fill: 'forwards' }
    );
  }, [pitId, stepMs]);

  const gem = GEM_COLORS[colorIndex % GEM_COLORS.length];

  return (
    <div
      ref={ref}
      style={{
        position:      'fixed',
        left:          -9999,
        top:           -9999,
        width:         20,
        height:        20,
        borderRadius:  '50%',
        background:    `radial-gradient(circle at 32% 28%, ${gem.shine}, ${gem.main})`,
        boxShadow:     `0 3px 10px rgba(0,0,0,0.70), inset 0 1px 2px rgba(255,255,255,0.50)`,
        zIndex:        9999,
        pointerEvents: 'none',
      }}
    />
  );
}

// ============================================================
// FloatingCluster: 石の塊が宙に浮いて横移動する
// ============================================================

/**
 * 石を拾い上げたあと、全石が小さな塊として穴の上を漂いながら移動する。
 * animIdx が増えるたびに塊は次の穴へ移動し、DroppingStone が1個落下する。
 * 塊に残っている石数 = totalStones - animIdx（animIdx が増えるほど減る）。
 */
function FloatingCluster({
  activeIds,
  animIdx,
  totalStones,
  stepMs,
  cellRefMap,
}: {
  activeIds: string[];
  animIdx: number;
  totalStones: number;
  stepMs: number;
  cellRefMap: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 現在の位置基準となる穴 ID
  const currentId      = activeIds[Math.min(animIdx, activeIds.length - 1)];
  const stonesInCluster = Math.max(0, totalStones - animIdx);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el        = cellRefMap.current.get(currentId);
    if (!container || !el) return;

    const rect    = el.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top - 35; // 穴の上端より 35px 上

    if (animIdx === 0) {
      // ─── Step 0: 元の穴から石の塊が浮き上がる ───────────────
      const pitCenterY = rect.top + rect.height / 2;

      // 初期状態（穴の中心、透明・小さい）を即時セット
      container.style.transition = 'none';
      container.style.left      = `${targetX}px`;
      container.style.top       = `${pitCenterY}px`;
      container.style.opacity   = '0';
      container.style.transform = 'translateX(-50%) scale(0.5)';

      // 2フレーム後にアニメーション開始（transition:none を確実に適用してから）
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const c = containerRef.current;
        if (!c) return;
        const upMs = Math.round(stepMs * 0.52);
        c.style.transition = [
          `top ${upMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
          `opacity ${Math.round(stepMs * 0.32)}ms ease`,
          `transform ${upMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
        ].join(', ');
        c.style.top       = `${targetY}px`;
        c.style.opacity   = '1';
        c.style.transform = 'translateX(-50%) scale(1.0)';
      }));
    } else {
      // ─── Step 1+: 次の穴へ横移動 ──────────────────────────────
      const moveMs = Math.round(stepMs * 0.60);
      container.style.transition = [
        `left ${moveMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        `top  ${moveMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      ].join(', ');
      container.style.left      = `${targetX}px`;
      container.style.top       = `${targetY}px`;
      container.style.opacity   = '1';
      container.style.transform = 'translateX(-50%) scale(1.0)';
    }
  }, [currentId, animIdx, stepMs]);

  return (
    <div
      ref={containerRef}
      style={{
        position:       'fixed',
        left:           -9999,
        top:            -9999,
        transform:      'translateX(-50%)',
        display:        'flex',
        flexWrap:       'wrap',
        gap:            3,
        width:          46,
        justifyContent: 'center',
        alignItems:     'center',
        zIndex:         9998,
        pointerEvents:  'none',
        background:     'rgba(15, 8, 0, 0.55)',
        borderRadius:   10,
        padding:        '5px 4px',
        boxShadow:      '0 3px 14px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,220,80,0.30)',
      }}
    >
      {Array.from({ length: stonesInCluster }).map((_, i) => {
        const gem = GEM_COLORS[(animIdx + i) % GEM_COLORS.length];
        return (
          <div
            key={i}
            style={{
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   `radial-gradient(circle at 32% 28%, ${gem.shine}, ${gem.main})`,
              boxShadow:    '0 1px 3px rgba(0,0,0,0.65)',
              flexShrink:   0,
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// MancalaBoard
// ============================================================

type MancalaBoardProps = {
  gameState: GameState;
  onPitClick: (pitId: string) => void;
  disabled?: boolean;
  /**
   * アニメーション中の穴訪問順 ID 配列。
   *   [0]   = 石を拾い上げた元の穴
   *   [1..N] = 石が着地していく各穴（配布順）
   */
  animActiveIds?: string[];
  /** 現在表示中のアニメーションステップ番号 */
  animIdx?: number;
  /** 石 1 個あたりのアニメーション時間（ms） */
  animStepMs?: number;
};

/**
 * マンカラ盤
 *
 * 見た目（木製ボード横長）:
 *  [P2-store] | P2-pit-5 P2-pit-4 P2-pit-3 P2-pit-2 P2-pit-1 P2-pit-0 | [P1-store]
 *             | P1-pit-0 P1-pit-1 P1-pit-2 P1-pit-3 P1-pit-4 P1-pit-5 |
 */
export function MancalaBoard({
  gameState,
  onPitClick,
  disabled   = false,
  animActiveIds,
  animIdx,
  animStepMs = 400,
}: MancalaBoardProps) {
  // ---- 各穴セル DOM ref map（FloatingCluster / DroppingStone が位置計算に使う） ----
  const cellRefMap = useRef<Map<string, HTMLElement>>(new Map());
  const setCellRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cellRefMap.current.set(id, el);
    else    cellRefMap.current.delete(id);
  };

  // ---- 選択可能な穴 ----
  const selectableIds = disabled
    ? new Set<string>()
    : new Set(getSelectablePits(gameState).map((p) => p.id));

  // ---- 盤面データ ----
  const p1Pits = gameState.board.filter(
    (p) => p.ownerPlayerId === 'player-1' && !p.isStore
  );
  const p2PitsDisplay = [...gameState.board.filter(
    (p) => p.ownerPlayerId === 'player-2' && !p.isStore
  )].reverse();

  const p1Store = gameState.board.find(
    (p) => p.ownerPlayerId === 'player-1' && p.isStore
  )!;
  const p2Store = gameState.board.find(
    (p) => p.ownerPlayerId === 'player-2' && p.isStore
  )!;

  // ---- アニメーション状態 ----
  const hasAnim     = !!(animActiveIds && animActiveIds.length > 0 && animIdx !== undefined);
  const totalStones = hasAnim ? animActiveIds!.length - 1 : 0; // [0] = source, [1..N] = destinations
  const sourcePitId = hasAnim ? animActiveIds![0] : null;

  // 現在アクティブ（着地先）な穴：step > 0 のみ（step 0 は "source"）
  const curActiveId = (hasAnim && animIdx! > 0)
    ? animActiveIds![Math.min(animIdx!, animActiveIds!.length - 1)]
    : null;

  // FloatingCluster: アニメーション中ずっと表示（石がある間）
  const showCluster = hasAnim && animIdx! <= totalStones;

  // DroppingStone: step 1 以降、着地先に石を落とす
  const showDrop  = hasAnim && animIdx! > 0 && animIdx! <= totalStones;
  const dropPitId = showDrop ? animActiveIds![animIdx!] : null;

  return (
    <div className="board-container">

      {/* P2 穴の石の数（ボードの上） */}
      <div className="board-count-row" style={{ marginBottom: 5 }}>
        <div />
        {p2PitsDisplay.map(pit => (
          <div
            key={pit.id}
            className="pit-count"
            style={{ color: pit.stones > 0 ? '#6a3810' : '#c4b0a0' }}
          >
            {pit.stones}
          </div>
        ))}
        <div />
      </div>

      {/* 木製ボード */}
      <div
        style={{
          background:    'linear-gradient(160deg, #7c4a20 0%, #5e3010 22%, #8a5828 44%, #5e3010 66%, #7c4a20 88%, #6a4018 100%)',
          borderRadius:  'var(--board-radius)',
          padding:       'var(--board-py) var(--board-px)',
          position:      'relative',
          boxShadow:     [
            '0 8px 32px rgba(0,0,0,0.45)',
            '0 2px 8px rgba(0,0,0,0.30)',
            'inset 0 2px 6px rgba(255,255,255,0.07)',
            'inset 0 -4px 12px rgba(0,0,0,0.32)',
          ].join(', '),
          border:        '4px solid #3a1e08',
          outline:       '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* 中央のドラゴン紋章（装飾） */}
        <div
          aria-hidden="true"
          style={{
            position:      'absolute',
            top:           '50%',
            left:          '50%',
            transform:     'translate(-50%, -50%)',
            fontSize:      16,
            opacity:       0.15,
            pointerEvents: 'none',
            userSelect:    'none',
            lineHeight:    1,
          }}
        >
          🐉
        </div>

        <div className="board-grid">
          {/* P2 ストア（左端・2行分） */}
          <div
            ref={setCellRef('p2-store')}
            style={{ gridColumn: 1, gridRow: '1 / 3', display: 'flex' }}
          >
            <StorePit pit={p2Store} />
          </div>

          {/* P2 の穴（上の行：左=pit-5、右=pit-0） */}
          {p2PitsDisplay.map((pit, i) => {
            const isActive = curActiveId === pit.id;
            const isSource = sourcePitId === pit.id && animIdx === 0;
            return (
              <div
                ref={setCellRef(pit.id)}
                key={isActive ? `${pit.id}-${animIdx}` : pit.id}
                style={{ gridColumn: i + 2, gridRow: 1 }}
              >
                <PocketPit
                  pit={pit}
                  isSelectable={selectableIds.has(pit.id)}
                  onClick={() => onPitClick(pit.id)}
                  isActive={isActive}
                  isSource={isSource}
                />
              </div>
            );
          })}

          {/* P1 の穴（下の行：左=pit-0、右=pit-5） */}
          {p1Pits.map((pit, i) => {
            const isActive = curActiveId === pit.id;
            const isSource = sourcePitId === pit.id && animIdx === 0;
            return (
              <div
                ref={setCellRef(pit.id)}
                key={isActive ? `${pit.id}-${animIdx}` : pit.id}
                style={{ gridColumn: i + 2, gridRow: 2 }}
              >
                <PocketPit
                  pit={pit}
                  isSelectable={selectableIds.has(pit.id)}
                  onClick={() => onPitClick(pit.id)}
                  isActive={isActive}
                  isSource={isSource}
                />
              </div>
            );
          })}

          {/* P1 ストア（右端・2行分） */}
          <div
            ref={setCellRef('p1-store')}
            style={{ gridColumn: 8, gridRow: '1 / 3', display: 'flex' }}
          >
            <StorePit pit={p1Store} />
          </div>
        </div>
      </div>

      {/* P1 穴の石の数（ボードの下） */}
      <div className="board-count-row" style={{ marginTop: 5 }}>
        <div />
        {p1Pits.map(pit => (
          <div
            key={pit.id}
            className="pit-count"
            style={{ color: pit.stones > 0 ? '#6a3810' : '#c4b0a0' }}
          >
            {pit.stones}
          </div>
        ))}
        <div />
      </div>

      {/* ─── アニメーションオーバーレイ ─── */}

      {/* 石の塊が浮いて横移動 */}
      {showCluster && (
        <FloatingCluster
          activeIds={animActiveIds!}
          animIdx={animIdx!}
          totalStones={totalStones}
          stepMs={animStepMs}
          cellRefMap={cellRefMap}
        />
      )}

      {/* 1個の石が塊から穴へ落下 */}
      {showDrop && dropPitId && (
        <DroppingStone
          key={animIdx}
          pitId={dropPitId}
          colorIndex={animIdx! - 1}
          stepMs={animStepMs}
          cellRefMap={cellRefMap}
        />
      )}

    </div>
  );
}
