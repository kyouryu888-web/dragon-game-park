import { chooseMove, newMemory, type AiMemory, type Level } from './bakuretsu/ai.ts';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { makeRng } from './bakuretsu/rules.ts';
import type { GameState, Move } from './bakuretsu/types.ts';
import { redact } from './bakuretsu/view.ts';

export const BAKURETSU_CPU_LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export const BAKURETSU_CPU_NAME: Record<Level, string> = {
  1: 'ベビードラゴン',
  2: 'ドラゴン',
  3: 'スーパードラゴン',
  4: 'ドラゴンキング',
  5: 'ゴッドドラゴン',
};

export type BakuretsuCpuRequest = {
  id: number;
  publicState: GameState;
  level: Level;
  seed: number;
  memory: AiMemory;
};

export type BakuretsuCpuResponse = {
  id: number;
  move?: Move;
  error?: string;
};

/** 完全状態を扱う唯一の境界。Workerへ渡す前に必ずCPU視点へ遮蔽する。 */
export function createBakuretsuCpuRequest(
  id: number,
  fullState: GameState,
  level: Level,
  seed: number,
  memory: AiMemory = newMemory(),
): BakuretsuCpuRequest {
  return {
    id,
    publicState: redact(fullState, fullState.currentTurn),
    level,
    seed,
    memory,
  };
}

/** AI本体はredact済みの状態だけを受け取る。ブラウザではWorkerから呼ぶ。 */
export function runBakuretsuCpuRequest(request: BakuretsuCpuRequest): BakuretsuCpuResponse {
  try {
    return {
      id: request.id,
      move: chooseMove(
        request.publicState,
        DEFAULT_CONFIG,
        { level: request.level },
        makeRng(request.seed),
        request.memory,
      ),
    };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  }
}
