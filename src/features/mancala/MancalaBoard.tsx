import { useRef, useLayoutEffect } from 'react';
import type { GameState, PlayerId, Pit } from './mancalaTypes';
import type { CaptureAnimInfo } from './MancalaGamePage';
import { getSelectablePits } from './mancalaRules';
import { PocketPit, StorePit, GEM_COLORS, PlayerPlank, PLAYER_ACCENT_COLORS } from './MancalaPit';

// ============================================================
// スライドアニメーション用の型と定数
// ============================================================

const SLIDE_CSS_MS = 520;

export type PlankSlideEntry = {
  playerId: string;
  pits: Pit[];
  store: Pit;
  playerName: string;
  colorAccent: string;
  isCurrentTurn: boolean;
  sourceLeft: string;
  sourceTop: string;
  sourceRot: number;
  targetLeft: string;
  targetTop: string;
  targetRot: number;
};

/** 各プレイヤー数レイアウトのプランク中心位置（plank-board-outer 内の %） */
export const PLANK_POSITIONS: Record<string, Array<{ left: string; top: string; rot: number }>> = {
  '4': [
    { left: '50%', top: '91%', rot: 0   },  // 下
    { left: '91%', top: '50%', rot: -90 },  // 右
    { left: '50%', top: '9%',  rot: 180 },  // 上
    { left: '9%',  top: '50%', rot: 90  },  // 左
  ],
  '3': [
    { left: '50%', top: '89%', rot: 0    },  // 下
    { left: '82%', top: '19%', rot: -120 },  // 右上
    { left: '18%', top: '19%', rot: 120  },  // 左上
  ],
  '2': [
    { left: '50%', top: '75%', rot: 0   },  // 下
    { left: '50%', top: '25%', rot: 180 },  // 上
  ],
};

// ============================================================
// TransitionPlankBoard: 脱落後のスライドアニメーション用ボード
// ============================================================

function TransitionPlankBoard({
  slides, isAtTarget, setCellRef,
}: {
  slides: PlankSlideEntry[];
  isAtTarget: boolean;
  setCellRef: (id: string) => (el: HTMLElement | null) => void;
}) {
  return (
    <div className="plank-board-outer">
      <div style={{
        position: 'absolute', inset: '14%',
        background: 'linear-gradient(160deg, #7c4a20 0%, #5e3010 22%, #8a5828 44%, #5e3010 66%, #7c4a20 88%, #6a4018 100%)',
        borderRadius: 16,
        boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.35)',
        border: '3px solid #3a1e08',
      }}>
        <div className="plank-center-deco">🐉</div>
      </div>
      {slides.map(({
        playerId, pits, store, playerName, colorAccent, isCurrentTurn,
        sourceLeft, sourceTop, sourceRot, targetLeft, targetTop, targetRot,
      }) => (
        <PlayerPlank
          key={playerId}
          pits={pits}
          store={store}
          playerName={playerName}
          colorAccent={colorAccent}
          isCurrentTurn={isCurrentTurn}
          selectableIds={new Set()}
          onPitClick={() => {}}
          curActiveId={null}
          sourcePitId={null}
          animIdx={undefined}
          setCellRef={setCellRef}
          showCount
          style={{
            left:      isAtTarget ? targetLeft : sourceLeft,
            top:       isAtTarget ? targetTop  : sourceTop,
            transform: isAtTarget
              ? `translate(-50%, -50%) rotate(${targetRot}deg)`
              : `translate(-50%, -50%) rotate(${sourceRot}deg)`,
            transition: isAtTarget
              ? [
                  `left ${SLIDE_CSS_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                  `top ${SLIDE_CSS_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                  `transform ${SLIDE_CSS_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                ].join(', ')
              : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// DroppingStone: 塊から1個の石が穴へ落ちる
// ============================================================

function DroppingStone({
  pitId, colorIndex, stepMs, cellRefMap,
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
    const fromY = rect.top - 35;
    const toY   = rect.top + rect.height / 2;
    const dy    = toY - fromY;

    el.style.left = `${cx - 10}px`;
    el.style.top  = `${fromY - 10}px`;

    const delay    = Math.round(stepMs * 0.54);
    const duration = Math.round(stepMs * 0.44);

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
        position: 'fixed', left: -9999, top: -9999,
        width: 20, height: 20, borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, ${gem.shine}, ${gem.main})`,
        boxShadow: `0 3px 10px rgba(0,0,0,0.70), inset 0 1px 2px rgba(255,255,255,0.50)`,
        zIndex: 9999, pointerEvents: 'none',
      }}
    />
  );
}

// ============================================================
// FloatingCluster: 石の塊が宙に浮いて横移動する
// ============================================================

function FloatingCluster({
  activeIds, animIdx, totalStones, stepMs, cellRefMap,
}: {
  activeIds: string[];
  animIdx: number;
  totalStones: number;
  stepMs: number;
  cellRefMap: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const currentId       = activeIds[Math.min(animIdx, activeIds.length - 1)];
  const stonesInCluster = Math.max(0, totalStones - animIdx);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el        = cellRefMap.current.get(currentId);
    if (!container || !el) return;

    const rect    = el.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top - 35;

    if (animIdx === 0) {
      const pitCenterY = rect.top + rect.height / 2;
      container.style.transition = 'none';
      container.style.left      = `${targetX}px`;
      container.style.top       = `${pitCenterY}px`;
      container.style.opacity   = '0';
      container.style.transform = 'translateX(-50%) scale(0.5)';

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
        position: 'fixed', left: -9999, top: -9999,
        transform: 'translateX(-50%)',
        display: 'flex', flexWrap: 'wrap', gap: 3, width: 46,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 9998, pointerEvents: 'none',
        background: 'rgba(15, 8, 0, 0.55)', borderRadius: 10, padding: '5px 4px',
        boxShadow: '0 3px 14px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,220,80,0.30)',
      }}
    >
      {Array.from({ length: stonesInCluster }).map((_, i) => {
        const gem = GEM_COLORS[(animIdx + i) % GEM_COLORS.length];
        return (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: `radial-gradient(circle at 32% 28%, ${gem.shine}, ${gem.main})`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.65)',
          }} />
        );
      })}
    </div>
  );
}

// ============================================================
// CaptureFlyingCluster: 捕獲石の塊が穴間を飛ぶ
// ============================================================

function CaptureFlyingCluster({
  fromPitId, toPitId, stoneCount, stepMs, cellRefMap,
}: {
  fromPitId: string;
  toPitId: string;
  stoneCount: number;
  stepMs: number;
  cellRefMap: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const fromEl    = cellRefMap.current.get(fromPitId);
    const toEl      = cellRefMap.current.get(toPitId);
    if (!container || !fromEl || !toEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const toRect   = toEl.getBoundingClientRect();
    const fromX    = fromRect.left + fromRect.width  / 2;
    const fromY    = fromRect.top  - 35;
    const toX      = toRect.left   + toRect.width    / 2;
    const toY      = toRect.top    - 35;

    container.style.transition = 'none';
    container.style.left       = `${fromX}px`;
    container.style.top        = `${fromY}px`;
    container.style.opacity    = '1';
    container.style.transform  = 'translateX(-50%) scale(1.0)';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = containerRef.current;
      if (!c) return;
      c.style.transition = [
        `left ${stepMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        `top  ${stepMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      ].join(', ');
      c.style.left = `${toX}px`;
      c.style.top  = `${toY}px`;
    }));
  }, [fromPitId, toPitId, stepMs]);

  const displayCount = Math.min(stoneCount, 10);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', left: -9999, top: -9999,
        transform: 'translateX(-50%)',
        display: 'flex', flexWrap: 'wrap', gap: 3, width: 52,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 9998, pointerEvents: 'none',
        background: 'rgba(80, 30, 0, 0.72)', borderRadius: 10, padding: '5px 4px',
        boxShadow: '0 3px 14px rgba(0,0,0,0.60), 0 0 0 1.5px rgba(255,140,30,0.70)',
      }}
    >
      {Array.from({ length: displayCount }).map((_, i) => {
        const gem = GEM_COLORS[(i + 5) % GEM_COLORS.length];
        return (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: `radial-gradient(circle at 32% 28%, ${gem.shine}, ${gem.main})`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.65)',
          }} />
        );
      })}
    </div>
  );
}

// ============================================================
// 共通の prop 型
// ============================================================

type MancalaBoardProps = {
  gameState: GameState;
  onPitClick: (pitId: string) => void;
  disabled?: boolean;
  animActiveIds?: string[];
  animIdx?: number;
  animStepMs?: number;
  captureAnimInfo?: CaptureAnimInfo | null;
  capturePhase?: 'gather' | 'to-store' | null;
  captureStepMs?: number;
  /** 現在フェードアウト中の脱落プレイヤーID（Board4P専用） */
  eliminatingId?: string | null;
  /** スライドアニメーション用データ（設定されていると TransitionPlankBoard を表示） */
  transitionSlides?: PlankSlideEntry[] | null;
  /** true: プランクがターゲット位置に移動中（CSS transition 発火） */
  slideAtTarget?: boolean;
};

type InternalBoardProps = {
  gameState: GameState;
  selectableIds: Set<string>;
  onPitClick: (id: string) => void;
  curActiveId: string | null;
  sourcePitId: string | null;
  animIdx: number | undefined;
  setCellRef: (id: string) => (el: HTMLElement | null) => void;
};

// ============================================================
// 3人プレイ：三角形ボード（SVG フレーム + 絶対配置）
// ============================================================

const TRI_W = 420, TRI_H = 340;

const TRI_PIT_POS_BY_SLOT: [number, number][][] = [
  [[104,310],[146,310],[189,310],[231,310],[274,310],[316,310]],
  [[341,267],[320,230],[299,193],[277,156],[256,120],[235,83]],
  [[185,83], [164,120],[143,157],[121,194],[100,230],[79,267]],
];

const TRI_STORE_POS_BY_SLOT: [number, number][] = [
  [366, 310],
  [210,  40],
  [ 54, 310],
];

const PIT_D   = 34;
const STORE_D = 42;

function Board3P({
  gameState, selectableIds, onPitClick, curActiveId, sourcePitId, animIdx, setCellRef,
}: InternalBoardProps) {
  const slotIds = gameState.activePlayerIds.slice(0, 3) as PlayerId[];

  const pitStyle = (x: number, y: number): React.CSSProperties => ({
    position: 'absolute',
    left:   `${(x - PIT_D / 2) / TRI_W * 100}%`,
    top:    `${(y - PIT_D / 2) / TRI_H * 100}%`,
    width:  `${PIT_D / TRI_W * 100}%`,
    aspectRatio: '1',
  });

  const storeStyle = (x: number, y: number): React.CSSProperties => ({
    position: 'absolute',
    left:   `${(x - STORE_D / 2) / TRI_W * 100}%`,
    top:    `${(y - STORE_D / 2) / TRI_H * 100}%`,
    width:  `${STORE_D / TRI_W * 100}%`,
    aspectRatio: '1',
  });

  return (
    <div style={{
      position: 'relative', width: '100%',
      maxWidth: TRI_W, aspectRatio: `${TRI_W}/${TRI_H}`, margin: '0 auto',
    }}>
      <svg
        viewBox={`0 0 ${TRI_W} ${TRI_H}`}
        style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="wood3p" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8a5028"/>
            <stop offset="45%"  stopColor="#5e3010"/>
            <stop offset="55%"  stopColor="#7c4820"/>
            <stop offset="100%" stopColor="#6a3810"/>
          </linearGradient>
        </defs>
        <polygon points="210,40 366,310 54,310" fill="none"
          stroke="rgba(0,0,0,0.35)" strokeWidth="58" strokeLinejoin="round"
          style={{ filter: 'blur(4px)' }}
        />
        <polygon points="210,40 366,310 54,310" fill="none"
          stroke="url(#wood3p)" strokeWidth="52" strokeLinejoin="round"
        />
        <polygon points="210,40 366,310 54,310" fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="48" strokeLinejoin="round"
        />
        <polygon points="210,40 366,310 54,310" fill="none"
          stroke="rgba(0,0,0,0.25)" strokeWidth="8" strokeLinejoin="round"
          style={{ transform: 'scale(0.82)', transformOrigin: '210px 220px' }}
        />
        <text x="210" y="200" textAnchor="middle" dominantBaseline="middle"
          fontSize="52" opacity="0.10" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          🐉
        </text>
      </svg>

      {slotIds.flatMap((playerId, slot) =>
        gameState.board
          .filter(p => p.ownerPlayerId === playerId && !p.isStore)
          .map((pit, i) => {
            const [x, y] = TRI_PIT_POS_BY_SLOT[slot][i];
            const isActive = curActiveId === pit.id;
            const isSource = sourcePitId === pit.id && animIdx === 0;
            return (
              <div
                key={isActive ? `${pit.id}-${animIdx}` : pit.id}
                ref={setCellRef(pit.id)}
                style={pitStyle(x, y)}
              >
                <PocketPit
                  pit={pit}
                  isSelectable={selectableIds.has(pit.id)}
                  onClick={() => onPitClick(pit.id)}
                  isActive={isActive}
                  isSource={isSource}
                  showCount
                />
              </div>
            );
          })
      )}

      {slotIds.map((playerId, slot) => {
        const store = gameState.board.find(p => p.ownerPlayerId === playerId && p.isStore)!;
        const [x, y] = TRI_STORE_POS_BY_SLOT[slot];
        return (
          <div key={store.id} ref={setCellRef(store.id)} style={storeStyle(x, y)}>
            <StorePit pit={store} compact />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 4人プレイ：長方形フレーム（4枚のプランク）
// ============================================================

function Board4P({
  gameState, selectableIds, onPitClick, curActiveId, sourcePitId, animIdx, setCellRef,
  eliminatingId,
}: InternalBoardProps & { eliminatingId?: string | null }) {
  const ids = gameState.activePlayerIds as PlayerId[];
  const [id0, id1, id2, id3] = ids;

  const allPlayerIds = gameState.players.map(p => p.id);

  const getPlankData = (playerId: PlayerId) => ({
    pits: gameState.board.filter(p => p.ownerPlayerId === playerId && !p.isStore),
    store: gameState.board.find(p => p.ownerPlayerId === playerId && p.isStore)!,
    playerIdx: allPlayerIds.indexOf(playerId),
    playerName: gameState.players.find(p => p.id === playerId)!.name,
    isCurrentTurn: gameState.currentPlayerId === playerId,
  });

  // コンテナ(min(88vw,400px)) のサイズ比で配置
  // left/top はコンテナ内の絶対位置(%)、transform: translate(-50%,-50%) で中心を合わせた後に rotate
  const configs: Array<{ id: PlayerId; left: string; top: string; rot: number }> = [
    { id: id0, left: '50%',  top: '91%',  rot: 0   }, // 下
    { id: id1, left: '91%',  top: '50%',  rot: -90 }, // 右
    { id: id2, left: '50%',  top: '9%',   rot: 180 }, // 上
    { id: id3, left: '9%',   top: '50%',  rot: 90  }, // 左
  ];

  return (
    <div className="plank-board-outer">
      {/* 木製背景パネル（中央装飾） */}
      <div style={{
        position: 'absolute', inset: '14%',
        background: 'linear-gradient(160deg, #7c4a20 0%, #5e3010 22%, #8a5828 44%, #5e3010 66%, #7c4a20 88%, #6a4018 100%)',
        borderRadius: 16,
        boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.35)',
        border: '3px solid #3a1e08',
      }}>
        <div className="plank-center-deco">🐉</div>
      </div>

      {/* 4枚のプランク */}
      {configs.map(({ id, left, top, rot }) => {
        const { pits, store, playerIdx, playerName, isCurrentTurn } = getPlankData(id);
        const isEliminating = eliminatingId === id;
        return (
          <PlayerPlank
            key={id}
            pits={pits}
            store={store}
            playerName={playerName}
            colorAccent={PLAYER_ACCENT_COLORS[playerIdx]}
            isCurrentTurn={isCurrentTurn}
            selectableIds={selectableIds}
            onPitClick={onPitClick}
            curActiveId={curActiveId}
            sourcePitId={sourcePitId}
            animIdx={animIdx}
            setCellRef={setCellRef}
            showCount
            style={{
              left,
              top,
              transform: isEliminating
                ? `translate(-50%, -50%) rotate(${rot}deg) scale(0.12)`
                : `translate(-50%, -50%) rotate(${rot}deg)`,
              opacity: isEliminating ? 0 : 1,
              transition: isEliminating
                ? 'opacity 440ms ease, transform 440ms cubic-bezier(0.4, 0, 1, 1)'
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// MancalaBoard（エントリーポイント）
// ============================================================

export function MancalaBoard({
  gameState,
  onPitClick,
  disabled         = false,
  animActiveIds,
  animIdx,
  animStepMs       = 400,
  captureAnimInfo  = null,
  capturePhase     = null,
  captureStepMs    = 700,
  eliminatingId    = null,
  transitionSlides = null,
  slideAtTarget    = false,
}: MancalaBoardProps) {
  const cellRefMap = useRef<Map<string, HTMLElement>>(new Map());
  const setCellRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cellRefMap.current.set(id, el);
    else    cellRefMap.current.delete(id);
  };

  // スライドアニメーション中: TransitionPlankBoard を表示
  if (transitionSlides) {
    return (
      <TransitionPlankBoard
        slides={transitionSlides}
        isAtTarget={slideAtTarget}
        setCellRef={setCellRef}
      />
    );
  }

  const selectableIds = disabled
    ? new Set<string>()
    : new Set(getSelectablePits(gameState).map((p) => p.id));

  const hasAnim      = !!(animActiveIds && animActiveIds.length > 0 && animIdx !== undefined);
  const totalStones  = hasAnim ? animActiveIds!.length - 1 : 0;
  const sourcePitId  = hasAnim ? animActiveIds![0] : null;

  const curActiveId = (hasAnim && animIdx! > 0)
    ? animActiveIds![Math.min(animIdx!, animActiveIds!.length - 1)]
    : null;

  const showCluster = hasAnim && animIdx! <= totalStones;
  const showDrop    = hasAnim && animIdx! > 0 && animIdx! <= totalStones;
  const dropPitId   = showDrop ? animActiveIds![animIdx!] : null;

  const showCapture   = capturePhase !== null && captureAnimInfo !== null;
  const captureFromId = showCapture
    ? (capturePhase === 'gather' ? captureAnimInfo!.oppositePitId : captureAnimInfo!.landingPitId)
    : '';
  const captureToId   = showCapture
    ? (capturePhase === 'gather' ? captureAnimInfo!.landingPitId : captureAnimInfo!.storeId)
    : '';

  const internalProps: InternalBoardProps = {
    gameState, selectableIds, onPitClick, curActiveId, sourcePitId, animIdx, setCellRef,
  };

  const animOverlay = (
    <>
      {showCluster && (
        <FloatingCluster
          activeIds={animActiveIds!} animIdx={animIdx!}
          totalStones={totalStones} stepMs={animStepMs} cellRefMap={cellRefMap}
        />
      )}
      {showDrop && dropPitId && (
        <DroppingStone key={animIdx} pitId={dropPitId}
          colorIndex={animIdx! - 1} stepMs={animStepMs} cellRefMap={cellRefMap}
        />
      )}
    </>
  );

  const activeCount = gameState.activePlayerIds.length;

  if (activeCount === 3) {
    return (
      <>
        <Board3P {...internalProps} />
        {animOverlay}
      </>
    );
  }

  if (activeCount === 4) {
    return (
      <>
        <Board4P {...internalProps} eliminatingId={eliminatingId} />
        {animOverlay}
      </>
    );
  }

  // ── 2人プレイ：フェイスツーフェイス ──
  const [bottomId, topId] = gameState.activePlayerIds as [PlayerId, PlayerId];
  const allPlayerIds = gameState.players.map(p => p.id);
  const bottomPits     = gameState.board.filter(p => p.ownerPlayerId === bottomId && !p.isStore);
  const topPits        = gameState.board.filter(p => p.ownerPlayerId === topId && !p.isStore);
  const bottomStore    = gameState.board.find(p => p.ownerPlayerId === bottomId && p.isStore)!;
  const topStore       = gameState.board.find(p => p.ownerPlayerId === topId && p.isStore)!;
  const bottomPlayerIdx = allPlayerIds.indexOf(bottomId);
  const topPlayerIdx    = allPlayerIds.indexOf(topId);
  const bottomPlayer    = gameState.players.find(p => p.id === bottomId)!;
  const topPlayer       = gameState.players.find(p => p.id === topId)!;

  return (
    <div className="board-container">
      <div className="board-2p-face">
        {/* 上プレイヤーのプランク（反転表示: store左, pitsをpit5→pit0の順）*/}
        <PlayerPlank
          pits={topPits}
          store={topStore}
          playerName={topPlayer.name}
          colorAccent={PLAYER_ACCENT_COLORS[topPlayerIdx]}
          isCurrentTurn={gameState.currentPlayerId === topId}
          selectableIds={selectableIds}
          onPitClick={onPitClick}
          curActiveId={curActiveId}
          sourcePitId={sourcePitId}
          animIdx={animIdx}
          setCellRef={setCellRef}
          facingMode
          reversed
          storePosition="left"
          style={{ borderRadius: '12px 12px 0 0', borderBottom: 'none' }}
        />
        {/* 区切りライン */}
        <div className="board-2p-divider" />
        {/* 下プレイヤーのプランク（store右, pitsをpit0→pit5の順）*/}
        <PlayerPlank
          pits={bottomPits}
          store={bottomStore}
          playerName={bottomPlayer.name}
          colorAccent={PLAYER_ACCENT_COLORS[bottomPlayerIdx]}
          isCurrentTurn={gameState.currentPlayerId === bottomId}
          selectableIds={selectableIds}
          onPitClick={onPitClick}
          curActiveId={curActiveId}
          sourcePitId={sourcePitId}
          animIdx={animIdx}
          setCellRef={setCellRef}
          facingMode
          storePosition="right"
          style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}
        />
      </div>

      {animOverlay}
      {showCapture && (
        <CaptureFlyingCluster
          key={capturePhase}
          fromPitId={captureFromId} toPitId={captureToId}
          stoneCount={captureAnimInfo!.stoneCount}
          stepMs={captureStepMs} cellRefMap={cellRefMap}
        />
      )}
    </div>
  );
}
