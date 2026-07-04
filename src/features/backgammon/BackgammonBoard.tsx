import { useLayoutEffect, useRef, useState } from 'react';
import type { GameState, PlayerId } from './backgammonTypes';
import { BackgammonPoint } from './BackgammonPoint';

/** 直近に適用した1手（移動アニメーション用）。seq が変わるたびに再生する */
export type AnimatedMove = {
  seq: number;
  player: PlayerId;
  from: number | 'bar';
  to: number | 'off';
};

type BackgammonBoardProps = {
  state: GameState;
  /** 移動元として選べる場所。'bar' または ポイント index の文字列 */
  selectableSources: Set<string>;
  selected: 'bar' | number | null;
  /** 移動先候補のポイント index */
  destinations: Set<number>;
  onTapPoint: (index: number) => void;
  onTapBar: () => void;
  lastMove: AnimatedMove | null;
};

// 盤の並び（左→右）。伝統的な配置: white のホームは右下、black のホームは右上
const TOP_LEFT     = [12, 13, 14, 15, 16, 17];
const TOP_RIGHT    = [18, 19, 20, 21, 22, 23];
const BOTTOM_LEFT  = [11, 10, 9, 8, 7, 6];
const BOTTOM_RIGHT = [5, 4, 3, 2, 1, 0];

type FlyState = {
  key: number;
  player: PlayerId;
  size: number;
  x: number;
  y: number;
};

export function BackgammonBoard({
  state, selectableSources, selected, destinations, onTapPoint, onTapBar, lastMove,
}: BackgammonBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const [fly, setFly] = useState<FlyState | null>(null);

  function register(key: string) {
    return (el: HTMLElement | null) => {
      if (el) refs.current.set(key, el);
      else refs.current.delete(key);
    };
  }

  // 駒の移動アニメーション: 移動元→移動先へ浮遊駒をスライドさせる
  useLayoutEffect(() => {
    if (!lastMove || !boardRef.current) return;
    const fromKey = lastMove.from === 'bar' ? `bar-${lastMove.player}` : `p${lastMove.from}`;
    const toKey = lastMove.to === 'off' ? null : `p${lastMove.to}`;
    const fromEl = refs.current.get(fromKey);
    const toEl = toKey ? refs.current.get(toKey) : null;
    if (!fromEl || !toEl) return; // ベアオフ等はアニメーションなし

    const b = boardRef.current.getBoundingClientRect();
    const f = fromEl.getBoundingClientRect();
    const t = toEl.getBoundingClientRect();
    const size = Math.min(f.width, t.width) * 0.8;
    const start = {
      key: lastMove.seq,
      player: lastMove.player,
      size,
      x: f.left - b.left + f.width / 2 - size / 2,
      y: f.top - b.top + f.height / 2 - size / 2,
    };
    setFly(start);

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFly((prev) =>
          prev && prev.key === lastMove.seq
            ? {
                ...prev,
                x: t.left - b.left + t.width / 2 - size / 2,
                y: t.top - b.top + t.height / 2 - size / 2,
              }
            : prev,
        );
      });
    });
    const timer = setTimeout(() => {
      setFly((prev) => (prev && prev.key === lastMove.seq ? null : prev));
    }, 340);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [lastMove]);

  function renderPoint(index: number, row: 'top' | 'bottom') {
    return (
      <BackgammonPoint
        key={index}
        index={index}
        point={state.points[index]}
        row={row}
        selectable={selectableSources.has(String(index))}
        selected={selected === index}
        isDest={destinations.has(index)}
        onTap={() =>
          onTapPoint(index)
        }
        registerRef={register(`p${index}`)}
      />
    );
  }

  function renderBar(player: PlayerId) {
    const count = state.bar[player];
    const isSelectable = selectableSources.has('bar') && state.currentPlayer === player;
    return (
      <button
        ref={register(`bar-${player}`)}
        className={`bg-bar${selected === 'bar' && state.currentPlayer === player ? ' selected' : ''}`}
        onClick={onTapBar}
        disabled={!isSelectable}
        style={isSelectable ? { cursor: 'pointer' } : undefined}
        aria-label={`バー（${player === 'white' ? '金' : '翠'}）`}
      >
        {Array.from({ length: Math.min(count, 4) }, (_, i) => (
          <div key={i} className={`bg-checker ${player}`}>
            {count > 4 && i === 0 && <span className="bg-count">{count}</span>}
          </div>
        ))}
      </button>
    );
  }

  return (
    <div className="bg-board" ref={boardRef}>
      <div className="bg-row bg-row-top">
        {TOP_LEFT.map((i) => renderPoint(i, 'top'))}
        {renderBar('white')}
        {TOP_RIGHT.map((i) => renderPoint(i, 'top'))}
      </div>
      <div className="bg-row bg-row-bottom">
        {BOTTOM_LEFT.map((i) => renderPoint(i, 'bottom'))}
        {renderBar('black')}
        {BOTTOM_RIGHT.map((i) => renderPoint(i, 'bottom'))}
      </div>
      {fly && (
        <div
          className={`bg-checker ${fly.player} bg-fly`}
          style={{
            width: fly.size,
            height: fly.size,
            transform: `translate(${fly.x}px, ${fly.y}px)`,
          }}
        />
      )}
    </div>
  );
}
