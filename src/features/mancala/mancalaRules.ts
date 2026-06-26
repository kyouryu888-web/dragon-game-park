import type { GameState, Pit, PlayerId } from './mancalaTypes';

// ============================================================
// ヘルパー関数（補助）
// ============================================================

/** 現在の手番プレイヤーを返す */
export function getCurrentPlayer(state: GameState) {
  return state.players.find((p) => p.id === state.currentPlayerId)!;
}

/** 相手のプレイヤーIDを返す */
export function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return playerId === 'player-1' ? 'player-2' : 'player-1';
}

/** 指定プレイヤーの小さい穴（ストア以外）を返す */
export function getPlayerPits(state: GameState, playerId: PlayerId): Pit[] {
  return state.board.filter((p) => p.ownerPlayerId === playerId && !p.isStore);
}

/** 指定プレイヤーのストア（得点穴）を返す */
export function getPlayerStore(state: GameState, playerId: PlayerId): Pit {
  return state.board.find((p) => p.ownerPlayerId === playerId && p.isStore)!;
}

/** 指定した穴の向かい側にある穴を返す（ストアの場合はundefined） */
export function getOppositePit(state: GameState, pit: Pit): Pit | undefined {
  if (!pit.oppositePitId) return undefined;
  return state.board.find((p) => p.id === pit.oppositePitId);
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 指定した穴を選択できるか判定する
 *
 * 選べる条件：
 * - ゲームが進行中
 * - 穴が存在する
 * - ストアでない（小さい穴のみ選べる）
 * - 自分の穴
 * - 石が1個以上入っている
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
 * 2. 盤面配列を前に進みながら1個ずつ石を置く（相手のストアはスキップ）
 * 3. 追加ターン判定（最後の石が自分のストアに落ちたか）
 * 4. 捕獲判定（最後の石が自分の空の穴に落ちて、向かいに石があるか）
 * 5. 次の手番プレイヤーを決める
 * 6. ゲーム終了チェック
 */
export function applyMove(state: GameState, pitId: string): GameState {
  // 不正な手はそのまま返す
  if (!canSelectPit(state, pitId)) return state;

  // 盤面をコピーする（元の state を直接変えないようにする）
  const board = state.board.map((p) => ({ ...p }));

  const opponentId = getOpponentPlayerId(state.currentPlayerId);

  // コピーした board からストアを取得
  const myStore = board.find((p) => p.ownerPlayerId === state.currentPlayerId && p.isStore)!;
  const opponentStore = board.find((p) => p.ownerPlayerId === opponentId && p.isStore)!;

  // 選んだ穴から石を全部取り出す
  const startIdx = board.findIndex((p) => p.id === pitId);
  let stones = board[startIdx].stones;
  board[startIdx].stones = 0;

  // 石を1つずつ配る（盤面配列を順番に進む）
  // ※ 相手のストアには石を置かない
  let idx = startIdx;
  while (stones > 0) {
    idx = (idx + 1) % board.length;
    if (board[idx].id === opponentStore.id) continue; // 相手のストアはスキップ
    board[idx].stones += 1;
    stones -= 1;
  }

  // 最後に石を置いた穴
  const landedPit = board[idx];

  // ---- 追加ターン判定 ----
  // 最後の石が「自分のストア」に入ったら、同じプレイヤーがもう一度手番を行う
  const isExtraTurn = landedPit.id === myStore.id;

  // ---- 捕獲判定 ----
  // 最後の石が「自分側の穴」に入り、かつその穴に石が1個だけ（=今置いたばかりで空だった）
  // そして向かいの相手の穴に石がある場合、両方の石を自分のストアへ
  if (
    !isExtraTurn &&
    !landedPit.isStore &&
    landedPit.ownerPlayerId === state.currentPlayerId &&
    landedPit.stones === 1 // 置く前は空だったことを意味する
  ) {
    const oppositePit = board.find((p) => p.id === landedPit.oppositePitId);
    if (oppositePit && oppositePit.stones > 0) {
      // 自分の石 + 向かいの石を全部自分のストアへ
      myStore.stones += landedPit.stones + oppositePit.stones;
      landedPit.stones = 0;
      oppositePit.stones = 0;
    }
  }

  // 次の手番プレイヤーを決める
  const nextPlayerId = isExtraTurn ? state.currentPlayerId : opponentId;

  const nextState: GameState = {
    ...state,
    board,
    currentPlayerId: nextPlayerId,
    turnCount: state.turnCount + 1,
  };

  // ゲーム終了チェックを行って返す
  return checkGameEnd(nextState);
}

/**
 * ゲーム終了チェック
 *
 * どちらかのプレイヤーの小さい穴が全て空になったら終了。
 * 残っている石は、その石を持つプレイヤーのストアに全て入れる。
 * その後、ストアの石数を比べて勝敗を決める。
 */
export function checkGameEnd(state: GameState): GameState {
  const board = state.board.map((p) => ({ ...p }));

  for (const player of state.players) {
    const pockets = board.filter((p) => p.ownerPlayerId === player.id && !p.isStore);
    const allEmpty = pockets.every((p) => p.stones === 0);

    if (allEmpty) {
      // 全プレイヤーの残り石をそれぞれのストアに集める
      for (const p of state.players) {
        const store = board.find((pit) => pit.ownerPlayerId === p.id && pit.isStore)!;
        const remaining = board.filter((pit) => pit.ownerPlayerId === p.id && !pit.isStore);
        for (const pocket of remaining) {
          store.stones += pocket.stones;
          pocket.stones = 0;
        }
      }

      // 勝敗判定
      const p1Score = board.find((p) => p.ownerPlayerId === 'player-1' && p.isStore)!.stones;
      const p2Score = board.find((p) => p.ownerPlayerId === 'player-2' && p.isStore)!.stones;
      const isDraw = p1Score === p2Score;
      const winnerPlayerId: PlayerId | null = isDraw
        ? null
        : p1Score > p2Score
        ? 'player-1'
        : 'player-2';

      return {
        ...state,
        board,
        status: 'finished',
        winnerPlayerId,
        isDraw,
      };
    }
  }

  // まだ終了していない場合はそのまま返す
  return { ...state, board };
}
