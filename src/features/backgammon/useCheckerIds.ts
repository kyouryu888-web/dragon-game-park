import { useRef } from 'react';
import type { GameState, PlayerId } from './backgammonTypes';

type Loc = 'bar' | 'off' | number;

type CheckerPos = {
  id: string;
  owner: PlayerId;
  loc: Loc;
};

function countByLoc(state: GameState, owner: PlayerId) {
  const counts = new Map<Loc, number>();
  counts.set('bar', state.bar[owner]);
  counts.set('off', state.borneOff[owner]);
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    if (pt && pt.owner === owner) {
      counts.set(i, pt.count);
    }
  }
  return counts;
}

export function useCheckerIds(state: GameState) {
  const ref = useRef<CheckerPos[]>([]);

  if (ref.current.length === 0) {
    const init = (owner: PlayerId) => {
      let idCounter = 0;
      const counts = countByLoc(state, owner);
      for (const [loc, count] of counts.entries()) {
        for (let i = 0; i < count; i++) {
          ref.current.push({ id: `c-${owner}-${idCounter++}`, owner, loc });
        }
      }
    };
    init('white');
    init('black');
  } else {
    const updateFor = (owner: PlayerId) => {
      const targetCounts = countByLoc(state, owner);
      const currentCounts = new Map<Loc, number>();
      ref.current.filter((c) => c.owner === owner).forEach((c) => {
        currentCounts.set(c.loc, (currentCounts.get(c.loc) || 0) + 1);
      });

      const deficits: { loc: Loc; count: number }[] = [];
      const surpluses: { loc: Loc; count: number }[] = [];

      for (const [loc, tCount] of targetCounts.entries()) {
        const cCount = currentCounts.get(loc) || 0;
        if (tCount > cCount) deficits.push({ loc, count: tCount - cCount });
        else if (tCount < cCount) surpluses.push({ loc, count: cCount - tCount });
      }
      for (const [loc, cCount] of currentCounts.entries()) {
        if (!targetCounts.has(loc) && cCount > 0) {
          surpluses.push({ loc, count: cCount });
        }
      }

      for (const surp of surpluses) {
        for (let i = 0; i < surp.count; i++) {
          // 同じ owner かつ 余剰がある loc の駒を探す
          const checker = ref.current.find((c) => c.owner === owner && c.loc === surp.loc);
          if (checker && deficits.length > 0) {
            const def = deficits[0];
            checker.loc = def.loc;
            def.count--;
            if (def.count <= 0) deficits.shift();
          }
        }
      }
    };

    updateFor('white');
    updateFor('black');
  }

  const byLoc = new Map<Loc, CheckerPos[]>();
  for (const c of ref.current) {
    if (!byLoc.has(c.loc)) byLoc.set(c.loc, []);
    byLoc.get(c.loc)!.push(c);
  }

  return byLoc;
}
