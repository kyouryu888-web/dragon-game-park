import type { GameState, Pit, PlayerId } from './mancalaTypes';

// ============================================================
// ヘルパー関数（補助）
// ============================================================

/** 現在の手番プレイヤーを返す */
export function getCurrentPlayer(state: GameState) {
  return state.players.find((p) => p.id === state.currentPlayerId)!;
}

/**
 * 次の手番プレイヤーIDを返す（時計回り）
 * activePlayerIds の順番に従い、脱落者をスキップして循環する
 */
export function getNextPlayerId(state: GameState): PlayerId {
  const ids = state.activePlayerIds;
  const idx = ids.indexOf(state.currentPlayerId);
  return ids[(idx + 1) % ids.length];
}

/** 指定プレイヤーの小さい穴（ストア以外）を返す */
export function getPlayerPits(state: GameState, playerId: PlayerId): Pit[] {
  return state.board.filter((p) => p.ownerPlayerId === playerId && !p.isStore);
}

/** 指定プレイヤーのストア（得点穴）を返す */
export function getPlayerStore(state: GameState, playerId: PlayerId): Pit {
  return state.board.find((p) => p.ownerPlayerId === playerId && p.isStore)!;
}

/**
 * 指定した穴の向かい側にあるピットIDを返す。
 * - 元々の2人プレイ: pit.oppositePitId を使用
 * - 多人数から2人に縮小した場合: activePlayerIds を基に動的に計算
 */
export function getEffectiveOppositePitId(state: GameState, pit: Pit): string | undefined {
  if (pit.isStore) return undefined;
  if (!state.activePlayerIds.includes(pit.ownerPlayerId as PlayerId)) return undefined;

  // 元々の2人プレイ: 静的に設定済みの oppositePitId を使用
  if (pit.oppositePitId) return pit.oppositePitId;

  // 多人数から実質2人になった場合: 動的に計算
  if (state.activePlayerIds.length !== 2) return undefined;

  const [p1Id, p2Id] = state.activePlayerIds;
  const opponentId = pit.ownerPlayerId === p1Id ? p2Id : p1Id;

  const myPits  = state.board.filter(p => p.ownerPlayerId === pit.ownerPlayerId && !p.isStore);
  const oppPits = state.board.filter(p => p.ownerPlayerId === opponentId && !p.isStore);

  const myIdx = myPits.findIndex(p => p.id === pit.id);
  if (myIdx === -1 || myIdx >= oppPits.length) return undefined;

  return oppPits[oppPits.length - 1 - myIdx].id;
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 指定した穴を選択できるか判定する
 */
export function canSelectPit(state: GameState, pitId: string): boolean {
  if (state.status !== 'playing') return false;

  const pit = state.board.find((p) => p.id === pitId);
  if (!pit) return false;
  if (pit.isStore) return false;
  if (pit.ownerPlayerId !== state.currentPlayerId) return false;
  if (pit.stones === 0) return false;

  return true;
}

/** 現在のターンで選択可能な穴の一覧を返す */
export function getSelectablePits(state: GameState): Pit[] {
  return state.board.filter((p) => canSelectPit(state, p.id));
}

/**
 * 石を配る処理。元の gameState は変更せず、新しい GameState を返す。
 *
 * 処理の流れ：
 * 1. 選んだ穴から石を全部取り出す
 * 2. 盤面配列を前に進みながら1個ずつ石を置く
 *    - 脱落プレイヤーの穴・ストアはスキップ
 *    - 他の残存プレイヤーのストアもスキップ
 * 3. 追加ターン判定（最後の石が自分のストアに落ちたか）
 * 4. 捕獲判定（実質2人プレイ時のみ）
 * 5. 次の手番プレイヤーを決める
 * 6. ゲーム終了チェック（脱落 or 終了）
 */
export function applyMove(state: GameState, pitId: string): GameState {
  if (!canSelectPit(state, pitId)) return state;

  const board = state.board.map((p) => ({ ...p }));
  const myStore = board.find((p) => p.ownerPlayerId === state.currentPlayerId && p.isStore)!;

  const startIdx = board.findIndex((p) => p.id === pitId);
  let stones = board[startIdx].stones;
  board[startIdx].stones = 0;

  let idx = startIdx;
  while (stones > 0) {
    idx = (idx + 1) % board.length;
    // 脱落プレイヤーの穴・ストアをスキップ
    if (!state.activePlayerIds.includes(board[idx].ownerPlayerId as PlayerId)) continue;
    // 他の残存プレイヤーのストアをスキップ
    if (board[idx].isStore && board[idx].ownerPlayerId !== state.currentPlayerId) continue;
    board[idx].stones += 1;
    stones -= 1;
  }

  const landedPit = board[idx];
  const isExtraTurn = landedPit.id === myStore.id;

  // ---- 捕獲判定（実質2人プレイ時のみ） ----
  if (
    state.activePlayerIds.length === 2 &&
    !isExtraTurn &&
    !landedPit.isStore &&
    landedPit.ownerPlayerId === state.currentPlayerId &&
    landedPit.stones === 1 // 置く前は空だったことを意味する
  ) {
    const originalLandedPit = state.board.find(p => p.id === landedPit.id)!;
    const oppPitId = getEffectiveOppositePitId(state, originalLandedPit);
    if (oppPitId) {
      const oppPit = board.find(p => p.id === oppPitId);
      if (oppPit && oppPit.stones > 0) {
        myStore.stones += landedPit.stones + oppPit.stones;
        landedPit.stones = 0;
        oppPit.stones = 0;
      }
    }
  }

  const nextPlayerId = isExtraTurn ? state.currentPlayerId : getNextPlayerId(state);

  const nextState: GameState = {
    ...state,
    board,
    currentPlayerId: nextPlayerId,
    turnCount: state.turnCount + 1,
  };

  return checkGameEnd(nextState);
}

/**
 * ゲーム終了チェック
 *
 * 実質2人プレイ（activePlayerIds.length === 2）：
 *   いずれかのプレイヤーの穴が全て空になったら終了。
 *   全残存プレイヤーの石をストアに移してスコア比較。
 *
 * 3人以上（activePlayerIds.length >= 3）：脱落制
 *   穴が全て空になったプレイヤーを脱落させる（石をストアへ移す）。
 *   残り1人になったら終了。
 *   残り2人になったら次回から2人ルールが適用される。
 */
export function checkGameEnd(state: GameState): GameState {
  const board = state.board.map((p) => ({ ...p }));
  let activePlayerIds = [...state.activePlayerIds];

  // ── 実質2人プレイ（標準終了ルール） ──────────────────────────
  if (activePlayerIds.length === 2) {
    const anyEmpty = activePlayerIds.some(pid =>
      board.filter(p => p.ownerPlayerId === pid && !p.isStore).every(p => p.stones === 0)
    );

    if (anyEmpty) {
      // 全残存プレイヤーの石をストアへ
      for (const pid of activePlayerIds) {
        const store = board.find(pit => pit.ownerPlayerId === pid && pit.isStore)!;
        board.filter(pit => pit.ownerPlayerId === pid && !pit.isStore)
          .forEach(pocket => { store.stones += pocket.stones; pocket.stones = 0; });
      }
      const scores = activePlayerIds.map(pid => ({
        playerId: pid as PlayerId,
        stones: board.find(pit => pit.ownerPlayerId === pid && pit.isStore)!.stones,
      }));
      const maxScore = Math.max(...scores.map(s => s.stones));
      const winners = scores.filter(s => s.stones === maxScore);
      const isDraw = winners.length > 1;
      return {
        ...state, board, activePlayerIds,
        status: 'finished',
        winnerPlayerId: isDraw ? null : winners[0].playerId,
        isDraw,
      };
    }
    return { ...state, board, activePlayerIds };
  }

  // ── 3人以上：脱落制 ──────────────────────────────────────────
  const eliminated: PlayerId[] = [];
  for (const pid of [...activePlayerIds]) {
    const pockets = board.filter(p => p.ownerPlayerId === pid && !p.isStore);
    if (pockets.every(p => p.stones === 0)) {
      // 脱落：残り石をストアへ掃き込む
      const store = board.find(pit => pit.ownerPlayerId === pid && pit.isStore)!;
      pockets.forEach(pocket => { store.stones += pocket.stones; pocket.stones = 0; });
      eliminated.push(pid as PlayerId);
    }
  }

  if (eliminated.length > 0) {
    activePlayerIds = activePlayerIds.filter(id => !eliminated.includes(id));

    if (activePlayerIds.length === 1) {
      // 最後の1人が勝者（残り石もストアへ）
      const winnerId = activePlayerIds[0];
      const store = board.find(pit => pit.ownerPlayerId === winnerId && pit.isStore)!;
      board.filter(pit => pit.ownerPlayerId === winnerId && !pit.isStore)
        .forEach(p => { store.stones += p.stones; p.stones = 0; });
      return {
        ...state, board, activePlayerIds,
        status: 'finished', winnerPlayerId: winnerId as PlayerId, isDraw: false,
      };
    }

    if (activePlayerIds.length === 0) {
      return { ...state, board, activePlayerIds, status: 'finished', winnerPlayerId: null, isDraw: true };
    }

    // currentPlayerId が脱落していた場合、次のアクティブプレイヤーへ
    let currentPlayerId = state.currentPlayerId;
    if (!activePlayerIds.includes(currentPlayerId)) {
      const allIds = state.players.map(p => p.id);
      const startAt = allIds.indexOf(currentPlayerId);
      for (let offset = 1; offset <= allIds.length; offset++) {
        const candidate = allIds[(startAt + offset) % allIds.length] as PlayerId;
        if (activePlayerIds.includes(candidate)) { currentPlayerId = candidate; break; }
      }
    }

    return { ...state, board, activePlayerIds, currentPlayerId };
  }

  return { ...state, board, activePlayerIds };
}
