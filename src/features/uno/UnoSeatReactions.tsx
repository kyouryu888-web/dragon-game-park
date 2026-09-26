import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { DragonReactionWipe, type DragonReactionEvent } from '../../components/dragonReactions';
import type { DragonCpu, DragonPresentationPreference } from '../../components/dragonReactions';
import type { UnoPlayer } from './unoTypes';
import './UnoSeatReactions.css';

type Anchor = { id: string; x: number; y: number; side: 'left' | 'right'; size: number };
const levels = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'];

function cpuOf(player: UnoPlayer): DragonCpu | null {
  if (!player.isCpu || !player.cpuLevel) return null;
  const index = levels.indexOf(player.cpuLevel);
  return index < 0 ? null : { id: player.id, name: player.name, level: (index + 1) as DragonCpu['level'] };
}

/** A single shared cue above the table keeps crowded CPU seats and their cards clear. */
export function UnoSharedReaction({ players, currentPlayerId, active, preference = 'lively' }: {
  players: UnoPlayer[];
  currentPlayerId: string;
  active: DragonReactionEvent | null;
  preference?: DragonPresentationPreference;
}) {
  if (preference === 'off') return null;
  const player = active
    ? players.find(entry => entry.id === active.cpu.id)
    : players.find(entry => entry.id === currentPlayerId && entry.isCpu);
  const cpu = player && cpuOf(player);
  if (!cpu) return null;
  return (
    <div className="uno-shared-reaction">
      <DragonReactionWipe
        cpu={cpu}
        event={active}
        preference={preference}
        className="uno-shared-dragon"
        style={{ '--dragon-face-size': '32px' } as CSSProperties}
      />
      {!active && <span className="uno-shared-reaction-name">{player.name} Lv{cpu.level}</span>}
    </div>
  );
}

export function UnoSeatReactions({ arenaRef, players, active, preference = 'lively' }: {
  arenaRef: RefObject<HTMLDivElement | null>;
  players: UnoPlayer[];
  active: DragonReactionEvent | null;
  preference?: DragonPresentationPreference;
}) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena || preference === 'off') { setAnchors([]); return; }
    let frame = 0, disposed = false;
    const measure = () => {
      if (disposed) return;
      const board = arena.getBoundingClientRect();
      const size = window.innerWidth <= 560 ? 44 : 64;
      const edge = window.innerWidth <= 560 ? 7 : 12;
      const next = players.filter(player => player.isCpu && !player.isEliminated).flatMap(player => {
        const seat = [...arena.querySelectorAll<HTMLElement>('.uno-seat')].find(element => element.dataset.playerId === player.id);
        if (!seat) return [];
        const bounds = seat.getBoundingClientRect();
        const side = bounds.x + bounds.width / 2 < board.x + board.width / 2 ? 'left' : 'right';
        const x = side === 'left' ? edge : board.width - size - edge - 2;
        const seatLeft = bounds.left - board.left;
        const overlapsSeatX = x < seatLeft + bounds.width + 5 && x + size > seatLeft - 5;
        const wantedY = overlapsSeatX ? bounds.top - board.top - size - 12 : bounds.top - board.top + bounds.height / 2 - size / 2;
        const y = Math.max(60, Math.min(wantedY, board.height - size - 12));
        return [{ id: player.id, x, y, side, size } satisfies Anchor];
      });
      setAnchors(next);
    };
    const schedule = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(arena);
    arena.querySelectorAll<HTMLElement>('.uno-seat').forEach(seat => observer.observe(seat));
    window.addEventListener('resize', schedule);
    void document.fonts.ready.then(schedule);
    return () => { disposed = true; window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); };
  }, [arenaRef, players, preference]);

  return <>{anchors.map(anchor => {
    const player = players.find(entry => entry.id === anchor.id);
    const cpu = player && cpuOf(player);
    if (!cpu) return null;
    const style = { position: 'absolute', left: anchor.x, top: anchor.y, '--dragon-face-size': `${anchor.size}px` } as CSSProperties;
    return <DragonReactionWipe key={cpu.id} cpu={cpu} event={active} preference={preference} side={anchor.side} style={style} />;
  })}</>;
}
