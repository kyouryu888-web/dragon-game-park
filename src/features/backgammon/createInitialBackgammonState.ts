import type { GameState, Point } from './backgammonTypes';

/**
 * 標準初期配置の盤面を作る。
 * white は index 23→0 へ進む（ホーム: 0-5）。black は 0→23 へ進む（ホーム: 18-23）。
 */
export function createInitialBackgammonState(): GameState {
  const points: Point[] = Array.from({ length: 24 }, () => null);

  // white: 24ポイント(23)に2、13ポイント(12)に5、8ポイント(7)に3、6ポイント(5)に5
  points[23] = { owner: 'white', count: 2 };
  points[12] = { owner: 'white', count: 5 };
  points[7]  = { owner: 'white', count: 3 };
  points[5]  = { owner: 'white', count: 5 };

  // black: 対称配置
  points[0]  = { owner: 'black', count: 2 };
  points[11] = { owner: 'black', count: 5 };
  points[16] = { owner: 'black', count: 3 };
  points[18] = { owner: 'black', count: 5 };

  return {
    points,
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    currentPlayer: 'white',
    phase: 'opening-roll',
    dice: [],
    rolled: null,
    openingRoll: null,
    cube: { value: 1, owner: null },
    doubleOfferedBy: null,
    winner: null,
    winKind: null,
    resultPoints: null,
    turnCount: 0,
  };
}
