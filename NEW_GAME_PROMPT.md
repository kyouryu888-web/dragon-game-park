# 新規ゲーム追加 引き継ぎプロンプト

このファイルの内容を新しいClaude Codeセッションに貼り付けると、
「ドラゴンゲームパーク」への新しいゲーム追加をすぐに開始できます。

---

## ここから下をコピーして新規セッションに貼り付ける

---

# ドラゴンゲームパーク：新しいゲームを追加したい

## あなたへのお願い

私はゲーム開発の初心者です。専門用語を使いすぎず、1つずつ丁寧に教えてください。
コードを書くときは、私が確認できるようにスクリーンショットを求めてください。

## プロジェクト概要

「ドラゴンゲームパーク」という Web ゲーム集を開発・公開しています。
最初のゲームとして「マンカラ（カラハ式）」を実装・公開済みです。
今回は **新しいゲームを追加** したいと思っています。

## 環境情報

- **作業フォルダ**: `C:\Users\ray-0\Dragon-game-park`
- **GitHub**: https://github.com/kyouryu888-web/dragon-game-park
- **公開URL（Vercel）**: https://dragon-game-park.vercel.app
- **OS**: Windows 11
- **シェル**: PowerShell

## 技術構成

- React 19 + TypeScript（strict モード）
- Vite（ビルドツール）
- Vitest（テスト）
- Supabase（オンライン対戦のバックエンド：PostgreSQL + Realtime）
- CSS カスタムプロパティ（レスポンシブ対応）
- ルーティングライブラリなし（App.tsx の useState で画面切り替え）

## プロジェクトのファイル構成

```
src/
├── App.tsx                        ← 画面ルーター（新しいゲームはここに追加）
├── main.tsx
├── App.css / index.css
├── lib/
│   └── supabase.ts                ← Supabase クライアント（オンライン対戦で使用）
├── components/
│   ├── Button.tsx                 ← 共通ボタン（variant: primary/secondary/ghost）
│   ├── Card.tsx                   ← 共通カード
│   └── Layout.tsx                 ← 共通レイアウト（max-width, padding）
├── data/
│   └── games.ts                   ← ゲーム一覧（新しいゲームはここに登録）
├── pages/
│   └── HomePage.tsx               ← ゲーム選択画面（games.ts から自動表示）
├── features/
│   └── mancala/                   ← マンカラゲームの実装（参考にする）
│       ├── mancalaTypes.ts        ← 型定義
│       ├── mancalaRules.ts        ← ゲームロジック（純粋関数）
│       ├── mancalaRules.test.ts   ← テスト
│       ├── mancalaCpu.ts          ← CPU AI + getCpuDisplayName()
│       ├── mancalaCpu.test.ts     ← テスト
│       ├── createInitialMancalaState.ts
│       ├── MancalaSetupPage.tsx   ← オフライン設定画面（人数・CPU強さ・名前）
│       ├── MancalaRoomPage.tsx    ← オンライン設定画面（ルーム作成・参加）
│       ├── MancalaGamePage.tsx    ← オフライン対局画面
│       ├── MancalaOnlineGamePage.tsx ← オンライン対局画面
│       ├── MancalaBoard.tsx       ← ボード表示・アニメーション
│       └── MancalaPit.tsx         ← 穴・ストア・PlayerPlank 表示
└── styles/
    └── global.css                 ← CSS変数・レスポンシブ・アニメーション定義
```

---

## 新しいゲームを追加するときの手順

### Step 1：games.ts にゲームを登録する

`src/data/games.ts` の `games` 配列に追加する。

```typescript
{
  id: 'ゲームID（英字）',
  title: 'ゲーム名（日本語）',
  description: 'ゲームの説明文',
  status: 'available',        // 'coming-soon' にするとボタンが「近日公開」になる
  themeLabel: 'ボードゲーム', // カードに表示するジャンル
}
```

### Step 2：HomePage.tsx にアイコンとカラーを追加する

`src/pages/HomePage.tsx` の `GAME_ICONS` と `GAME_ACCENT` に追加する。

```typescript
const GAME_ICONS: Record<string, string> = {
  mancala: '🎯',
  新しいゲームID: '絵文字',
};

const GAME_ACCENT: Record<string, string> = {
  mancala: '#c87038',
  新しいゲームID: '#カラーコード',
};
```

### Step 3：App.tsx に画面状態を追加する

`src/App.tsx` の `AppScreen` 型と画面分岐に追加する。

```typescript
type AppScreen =
  | 'home'
  | 'mancala-setup' | 'mancala-game'
  | 'mancala-room'  | 'mancala-online-game'
  | '新ゲームID-setup' | '新ゲームID-game'       // ← オフライン
  | '新ゲームID-room'  | '新ゲームID-online-game'; // ← オンライン（任意）

// onSelectGame の分岐に追加
if (gameId === '新ゲームID') setScreen('新ゲームID-setup');

// 各画面のレンダリング分岐を追加
if (screen === '新ゲームID-setup')       { return <新ゲームSetupPage ... /> }
if (screen === '新ゲームID-game')        { return <新ゲームGamePage  ... /> }
if (screen === '新ゲームID-room')        { return <新ゲームRoomPage  ... /> }
if (screen === '新ゲームID-online-game') { return <新ゲームOnlineGamePage ... /> }
```

### Step 4：feature フォルダを作る

`src/features/新ゲームID/` フォルダを作り、以下のファイルを実装する。

```
src/features/新ゲームID/
├── 新ゲームTypes.ts              ← 型定義（GameState, Player, PlayerId など）
├── 新ゲームRules.ts              ← ゲームロジック（純粋関数）
├── 新ゲームRules.test.ts         ← ロジックのテスト
├── 新ゲームCpu.ts                ← CPU AI + getCpuDisplayName()
├── 新ゲームCpu.test.ts           ← CPU AI のテスト
├── createInitial新ゲーム.ts      ← 初期状態を作る関数
├── 新ゲームSetupPage.tsx         ← オフライン設定画面
├── 新ゲームRoomPage.tsx          ← オンライン設定画面（任意）
├── 新ゲームGamePage.tsx          ← オフライン対局画面
├── 新ゲームOnlineGamePage.tsx    ← オンライン対局画面（任意）
└── 新ゲームBoard.tsx             ← ボード表示（必要なら）
```

---

## 再利用できる実装パターン集

マンカラで実装・検証済みのパターンです。新しいゲームにそのままコピー・応用できます。

---

### パターン 1：プレイヤー名の設定と localStorage 永続化

プレイヤーが名前を入力でき、次回起動時も記憶される仕組みです。

#### localStorage のキー設計

```typescript
// オンライン対戦のプレイヤー識別（ゲームをまたいで共通化できる）
const ONLINE_PLAYER_ID_KEY   = 'dgp-online-player-id';
const ONLINE_PLAYER_NAME_KEY = 'dgp-online-player-name';

function getOnlinePlayerId(): string {
  let id = localStorage.getItem(ONLINE_PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ONLINE_PLAYER_ID_KEY, id);
  }
  return id;
}

function getOnlinePlayerName(): string {
  return localStorage.getItem(ONLINE_PLAYER_NAME_KEY) ?? '';
}
function saveOnlinePlayerName(name: string) {
  localStorage.setItem(ONLINE_PLAYER_NAME_KEY, name);
}
```

#### 設定画面での名前入力

```tsx
// MancalaRoomPage.tsx / MancalaSetupPage.tsx のパターン
const [myName, setMyName] = useState<string>(getOnlinePlayerName);

<input
  type="text"
  value={myName}
  onChange={e => { setMyName(e.target.value); saveOnlinePlayerName(e.target.value); }}
  placeholder="名前を入力（省略可）"
  maxLength={12}
/>
```

#### 対局中のリアルタイム名前変更

```tsx
// MancalaOnlineGamePage.tsx のパターン
const [editingName, setEditingName] = useState(false);
const [nameInput,   setNameInput]   = useState('');

async function handleSaveName() {
  const newName = nameInput.trim();
  setEditingName(false);
  if (!gameState || !newName || newName === myPlayer?.name) return;
  localStorage.setItem('dgp-online-player-name', newName);
  // ローカルとSupabaseを同時に更新
  const updatedGs = { ...gameState, players: gameState.players.map(p =>
    p.id === myPlayerId ? { ...p, name: newName } : p
  )};
  setGameState(updatedGs);
  await supabase.from('テーブル名').update({ game_state: updatedGs }).eq('room_code', roomCode);
}

// JSX（ヘッダー内）
{editingName ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <input autoFocus value={nameInput} maxLength={12}
      onChange={e => setNameInput(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
      style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6,
        border: '1.5px solid var(--orange)', outline: 'none', width: 80 }}
    />
    <button onClick={handleSaveName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a7a2a' }}>✓</button>
    <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b' }}>✗</button>
  </span>
) : (
  <span>
    あなた: <strong>{myPlayer?.name}</strong>
    <button onClick={() => { setNameInput(myPlayer?.name ?? ''); setEditingName(true); }}
      style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
  </span>
)}
```

---

### パターン 2：CPU 強さの 5 段階設定（ドラゴンテーマ）

#### 型定義

```typescript
// xxxxxTypes.ts
export type CpuLevel = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';
```

#### 表示名（getCpuDisplayName）

```typescript
// xxxxxCpu.ts
export function getCpuDisplayName(level: CpuLevel): string {
  const names: Record<CpuLevel, string> = {
    'very-easy': 'ベビードラゴン',
    'easy':      'ドラゴン',
    'normal':    'スーパードラゴン',
    'hard':      'ドラゴンキング',
    'very-hard': 'ゴッドドラゴン',
  };
  return names[level];
}
```

#### 設定画面の UI 定数

```typescript
// SetupPage / RoomPage 共通
const CPU_LEVELS: { level: CpuLevel; label: string; emoji: string }[] = [
  { level: 'very-easy', label: 'ベビードラゴン',   emoji: '🥚' },
  { level: 'easy',      label: 'ドラゴン',        emoji: '🐲' },
  { level: 'normal',    label: 'スーパードラゴン', emoji: '🐉' },
  { level: 'hard',      label: 'ドラゴンキング',  emoji: '👑' },
  { level: 'very-hard', label: 'ゴッドドラゴン',  emoji: '⚡' },
];
```

#### 強さ選択ボタン群（JSX）

```tsx
<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
  {CPU_LEVELS.map(({ level, label, emoji }) => {
    const isSelected = config.cpuLevel === level;
    return (
      <button key={level} onClick={() => onChange({ cpuLevel: level })} style={{
        padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 'bold',
        border: `1.5px solid ${isSelected ? '#4e8a4e' : 'var(--border)'}`,
        background: isSelected ? '#d0ecd0' : 'transparent',
        color: isSelected ? '#1a5a1a' : 'var(--text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
      }}>
        {emoji} {label}
      </button>
    );
  })}
</div>
```

#### CPU AI の実装構造（chooseCpuMove）

```typescript
// xxxxxCpu.ts — 難易度別の優先戦略
export function chooseCpuMove(
  state: GameState,
  cpuPlayerId: PlayerId,
  level: CpuLevel = 'normal'
): string | null {
  if (state.status !== 'playing') return null;
  if (state.currentPlayerId !== cpuPlayerId) return null;

  switch (level) {
    case 'very-easy': return chooseRandomMove(state);
    case 'easy':      return findBestSimpleMove(state) ?? chooseRandomMove(state);
    case 'normal':    return findBestMove(state, cpuPlayerId) ?? chooseRandomMove(state);
    case 'hard':      return findHardMove(state, cpuPlayerId) ?? chooseRandomMove(state);
    case 'very-hard': return findMinimaxMove(state, cpuPlayerId, 5); // 深さ5
  }
}

// evaluateState のゼロ除算ガード（重要）
function evaluateState(state: GameState, cpuPlayerId: PlayerId): number {
  if (state.status === 'finished') {
    if (state.isDraw) return 0;
    return state.winnerPlayerId === cpuPlayerId ? 1000 : -1000;
  }
  const myStore  = state.board.find(p => p.ownerPlayerId === cpuPlayerId && p.isStore)!;
  const oppStores = state.board.filter(p => p.ownerPlayerId !== cpuPlayerId && p.isStore);
  if (oppStores.length === 0) return myStore.stones; // ← 必須：ゼロ除算防止
  const avgOppScore = oppStores.reduce((s, p) => s + p.stones, 0) / oppStores.length;
  return myStore.stones - avgOppScore;
}
```

---

### パターン 3：オンライン対戦（Supabase によるルームコード方式）

#### Supabase テーブル設計

```sql
CREATE TABLE ゲーム名_rooms (
  room_code    TEXT PRIMARY KEY,     -- 6文字のランダムコード（例: "ABC123"）
  game_state   JSONB NOT NULL,       -- GameState オブジェクト全体
  player_count INT  NOT NULL DEFAULT 2,
  host_id      TEXT,                 -- localStorage UUID
  guest_id     TEXT,                 -- player-2 の UUID（'cpu-player-2' = CPU）
  guest2_id    TEXT,                 -- player-3（3人以上の場合）
  guest3_id    TEXT,                 -- player-4（4人の場合）
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

CPU スロットには `'cpu-player-2'` などを事前に入れておくことで、
人間の参加を待たずにゲームを開始できる。

#### Supabase クライアント（既存の `src/lib/supabase.ts` を使い回す）

```typescript
import { supabase } from '../../lib/supabase';
// 既にプロジェクトに設定済み。追加設定不要。
```

#### ルームコード生成

```typescript
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

#### ルーム作成フロー（handleCreate）

```typescript
async function handleCreate() {
  const code   = generateRoomCode();
  const hostId = getOnlinePlayerId();

  // CPU スロットを事前埋め
  const cpuPreFill: Record<string, string> = {};
  if (playerCount >= 2 && cpuSlots[0]) cpuPreFill['guest_id']  = 'cpu-player-2';
  if (playerCount >= 3 && cpuSlots[1]) cpuPreFill['guest2_id'] = 'cpu-player-3';
  if (playerCount >= 4 && cpuSlots[2]) cpuPreFill['guest3_id'] = 'cpu-player-4';

  const gs = createInitialGameState(config);

  await supabase.from('ゲーム名_rooms').insert({
    room_code: code, game_state: gs, player_count: playerCount,
    host_id: hostId, ...cpuPreFill,
  });

  setRoomCode(code);
  setMyWaitingPlayerId('player-1');
  setJoinedCount(1 + Object.keys(cpuPreFill).length); // ← CPU数も含めた正しいカウント
  setWaitingPlayerCount(playerCount);
  setPageState('waiting');
}
```

#### ルーム参加フロー（handleJoin）

```typescript
async function handleJoin() {
  const code     = inputCode.trim().toUpperCase();
  const playerId = getOnlinePlayerId();
  const { data } = await supabase.from('ゲーム名_rooms').select('*').eq('room_code', code).single();
  const row = data as RoomRow;

  // ① 再参加チェック（UUID が一致するスロットを探す）
  for (const { field, pid } of [
    { field: row.host_id,   pid: 'player-1' as PlayerId },
    { field: row.guest_id,  pid: 'player-2' as PlayerId },
    { field: row.guest2_id, pid: 'player-3' as PlayerId },
    { field: row.guest3_id, pid: 'player-4' as PlayerId },
  ]) {
    if (field === playerId) {
      // 既存スロットで再参加
      if (isRoomReady(row)) onGameStart({ roomCode: code, myPlayerId: pid });
      else setPageState('waiting');
      return;
    }
  }

  // ② 空きスロットを探して参加
  let myPlayerId: PlayerId;
  let slotField: string;
  if      (!row.guest_id)                          { myPlayerId = 'player-2'; slotField = 'guest_id';  }
  else if (!row.guest2_id && row.player_count >= 3){ myPlayerId = 'player-3'; slotField = 'guest2_id'; }
  else if (!row.guest3_id && row.player_count >= 4){ myPlayerId = 'player-4'; slotField = 'guest3_id'; }
  else { /* 満員 */ return; }

  // 名前をゲーム状態にも反映して一括 UPDATE
  const playerIdx = ['player-1','player-2','player-3','player-4'].indexOf(myPlayerId);
  const updatedGs = { ...row.game_state, players: row.game_state.players.map((p, i) =>
    i === playerIdx ? { ...p, name: myName.trim() || PLAYER_NAMES[playerIdx] } : p
  )};
  await supabase.from('ゲーム名_rooms').update({ [slotField]: playerId, game_state: updatedGs }).eq('room_code', code);

  if (isRoomReady(updatedRow)) onGameStart({ roomCode: code, myPlayerId });
  else setPageState('waiting');
}
```

#### 全員参加の監視（Realtime + 初回チェック）

```typescript
useEffect(() => {
  if (pageState !== 'waiting' || !roomCode) return;

  // 初回チェック（再参加で既に揃っているケース）
  supabase.from('ゲーム名_rooms').select('*').eq('room_code', roomCode).single()
    .then(({ data }) => {
      if (!data) return;
      setJoinedCount(countJoined(data));
      if (isRoomReady(data)) onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
    });

  // Realtime 監視
  const channel = supabase.channel(`room-wait-${roomCode}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ゲーム名_rooms', filter: `room_code=eq.${roomCode}` },
      (payload) => {
        const row = payload.new as RoomRow;
        setJoinedCount(countJoined(row));
        if (isRoomReady(row)) onGameStart({ roomCode, myPlayerId: myWaitingPlayerId });
      }
    ).subscribe();

  return () => { void supabase.removeChannel(channel); };
}, [pageState, roomCode, myWaitingPlayerId, onGameStart]);
```

#### オンライン対局画面のゲーム状態同期

```typescript
// MancalaOnlineGamePage.tsx のパターン
useEffect(() => {
  let cancelled = false;

  // 5 秒ポーリング（Realtime が届かなかった場合の保険）
  const syncLatest = async () => {
    const { data } = await supabase.from('ゲーム名_rooms').select('game_state').eq('room_code', roomCode).single();
    if (cancelled || !data?.game_state) return;
    if (isAnimatingRef.current || isTransitioningRef.current) return; // アニメーション中は無視
    const gs = data.game_state as GameState;
    setGameState(prev => (!prev || gs.turnCount > prev.turnCount) ? gs : prev);
  };

  // 初回ロード
  supabase.from('ゲーム名_rooms').select('game_state').eq('room_code', roomCode).single()
    .then(({ data }) => { if (!cancelled && data?.game_state) setGameState(data.game_state as GameState); setLoading(false); });

  // Realtime
  const channel = supabase.channel(`online-game-${roomCode}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ゲーム名_rooms', filter: `room_code=eq.${roomCode}` },
      (payload) => {
        if (cancelled || isAnimatingRef.current || isTransitioningRef.current) return;
        const gs = (payload.new as { game_state: GameState }).game_state;
        setGameState(prev => (!prev || gs.turnCount >= prev.turnCount) ? gs : prev);
      }
    )
    .subscribe(async (status) => { if (status === 'SUBSCRIBED') await syncLatest(); });

  const poll = setInterval(syncLatest, 5000);
  return () => { cancelled = true; clearInterval(poll); void supabase.removeChannel(channel); };
}, [roomCode]);
```

#### 手番移動（クリック時に即座に Supabase へ書き込む — 重要）

```typescript
// アニメーション終了後ではなく、クリック時点で書き込む設計にする。
// これにより通信遅延があってもターンがデスクに残らない。
const startMove = useCallback((state: GameState, pitId: string) => {
  const finalState = applyMove(state, pitId);
  if (finalState === state) return; // canSelectPit が false の場合は同一参照が返る

  // ① 即座に Supabase へ書き込む
  supabase.from('ゲーム名_rooms').update({ game_state: finalState }).eq('room_code', roomCode)
    .then(({ error }) => { if (error) console.error('[online] write failed:', error); });

  // ② アニメーションを開始（見た目の更新はアニメーション完了後）
  const steps = computeStoneSteps(state, pitId);
  if (steps.length === 0) { setGameState(finalState); return; }

  pendingFinalStateRef.current = finalState;
  setAnimSteps(steps);
  setAnimIdx(0);
}, [roomCode]);

// アニメーション完了時に gameState を更新（Supabase 書き込みはしない）
// → setGameState(pendingFinalStateRef.current)
```

#### CPU 自動手番（ホスト＝player-1 のみ実行）

```typescript
useEffect(() => {
  if (!gameState || isAnimating || capturePhase !== null) return;
  if (isTransitioningRef.current) return;        // 脱落アニメーション中はスキップ
  if (gameState.status !== 'playing') return;
  if (myPlayerId !== 'player-1') return;         // ホストのみ CPU を動かす

  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  if (!currentPlayer?.isCpu) return;

  const cpuId    = gameState.currentPlayerId as PlayerId;
  const cpuLevel = currentPlayer.cpuLevel;

  const id = setTimeout(() => {
    const state = gameStateRef.current;
    if (!state || state.status !== 'playing' || isTransitioningRef.current) return;
    const cp = state.players.find(p => p.id === state.currentPlayerId);
    if (!cp?.isCpu || state.currentPlayerId !== cpuId) return;
    const pitId = chooseCpuMove(state, cpuId, cpuLevel);
    if (pitId) startMove(state, pitId);
  }, 700);

  return () => clearTimeout(id);

  // ★重要: boardFading を deps に含めること。
  // 脱落アニメーション中は isTransitioningRef でブロックされるが、
  // deps に boardFading がないとアニメーション終了後に effect が再発火せず CPU が止まる。
}, [gameState?.currentPlayerId, gameState?.turnCount, isAnimating, capturePhase, myPlayerId, startMove, boardFading]);
```

---

### パターン 4：プレイヤー視点の回転（オンライン対戦）

オンライン対戦では「自分が常に手前に表示される」設定が必要です。

```typescript
// 自分（myPlayerId）が activePlayerIds の先頭に来るよう循環シフト
function rotateForDisplay(ids: PlayerId[], myId: PlayerId): PlayerId[] {
  const myIdx = ids.indexOf(myId);
  if (myIdx <= 0) return [...ids] as PlayerId[];
  return [...ids.slice(myIdx), ...ids.slice(0, myIdx)] as PlayerId[];
}

// displayActiveIds を state で管理し、脱落アニメーションと連動させる
const [displayActiveIds, setDisplayActiveIds] = useState<PlayerId[]>([]);

// boardDisplayState はアニメーション中と通常時で切り替える
const boardDisplayState = isAnimating
  ? animSteps[Math.min(animIdx, animSteps.length - 1)]
  : gameState;

// displayGameState は displayActiveIds を使う（回転済み）
const displayGameState = useMemo(() => {
  if (!boardDisplayState || displayActiveIds.length === 0) return null;
  return { ...boardDisplayState, activePlayerIds: displayActiveIds };
}, [boardDisplayState, displayActiveIds]);
```

---

### パターン 5：脱落アニメーション（3-4 人ゲーム）

プレイヤーが脱落するとき、ボードのプランクが滑らかに移動するアニメーション。

```typescript
// MancalaBoard.tsx の PLANK_POSITIONS（プランクの配置座標）と
// PlankSlideEntry 型を import する
import { MancalaBoard, PLANK_POSITIONS } from '../mancala/MancalaBoard';
import type { PlankSlideEntry } from '../mancala/MancalaBoard';

// 定数
const ELIM_ANIM_MS  = 480; // 脱落プランクのフェードアウト
const SLIDE_ANIM_MS = 580; // スライド全体の待機

// 必要な state
const [boardFading,   setBoardFading]   = useState<'none' | 'out' | 'sliding'>('none');
const [eliminatingId, setEliminatingId] = useState<string | null>(null);
const [slidingPlanks, setSlidingPlanks] = useState<PlankSlideEntry[] | null>(null);
const [slideAtTarget, setSlideAtTarget] = useState(false);
const prevDisplayIdsRef  = useRef<PlayerId[]>([]);
const isTransitioningRef = useRef(false);

// 脱落検出 effect（activePlayerIds.length の変化で発火）
useEffect(() => {
  if (!gameState) return;
  const currRotated = rotateForDisplay(gameState.activePlayerIds, myPlayerId);
  const prevRotated = prevDisplayIdsRef.current;

  if (prevRotated.length === 0) {           // 初回: 初期化のみ
    setDisplayActiveIds(currRotated);
    prevDisplayIdsRef.current = currRotated;
    return;
  }
  if (currRotated.length >= prevRotated.length) { // 脱落なし
    setDisplayActiveIds(currRotated);
    prevDisplayIdsRef.current = currRotated;
    return;
  }

  // 脱落発生
  const eliminatedId = prevRotated.find(id => !currRotated.includes(id));
  isTransitioningRef.current = true;
  setBoardFading('out');
  if (prevRotated.length === 4) setEliminatingId(eliminatedId ?? null); // 4P→3P のみ

  let t2: ReturnType<typeof setTimeout> | undefined;
  const t1 = setTimeout(() => {
    setEliminatingId(null);
    setBoardFading('sliding');

    const allIds = gameState.players.map(p => p.id);
    const slides: PlankSlideEntry[] = currRotated.map((playerId, newSlot) => {
      const oldSlot = prevRotated.indexOf(playerId);
      const src = PLANK_POSITIONS[String(prevRotated.length)][oldSlot] ?? PLANK_POSITIONS[String(prevRotated.length)][0];
      const tgt = PLANK_POSITIONS[String(currRotated.length)][newSlot] ?? PLANK_POSITIONS[String(currRotated.length)][0];
      const player = gameState.players.find(p => p.id === playerId)!;
      const pits   = gameState.board.filter(p => p.ownerPlayerId === playerId && !p.isStore);
      const store  = gameState.board.find(p => p.ownerPlayerId === playerId && p.isStore)!;
      return {
        playerId, pits, store, playerName: player.name,
        colorAccent: PLAYER_ACCENT_COLORS[allIds.indexOf(playerId)],
        isCurrentTurn: gameState.currentPlayerId === playerId,
        sourceLeft: src.left, sourceTop: src.top, sourceRot: src.rot,
        targetLeft: tgt.left, targetTop: tgt.top, targetRot: tgt.rot,
      };
    });
    setSlidingPlanks(slides);

    t2 = setTimeout(() => {
      setSlidingPlanks(null);
      setDisplayActiveIds(currRotated);
      prevDisplayIdsRef.current = currRotated;
      setBoardFading('none');
      isTransitioningRef.current = false;
    }, SLIDE_ANIM_MS);
  }, ELIM_ANIM_MS);

  return () => { clearTimeout(t1); if (t2 !== undefined) clearTimeout(t2); };
}, [gameState?.activePlayerIds.length, gameState?.gameId, myPlayerId]);

// double-RAF: CSS transition を発火させるための 2 フレーム待ち
useEffect(() => {
  if (!slidingPlanks) { setSlideAtTarget(false); return; }
  let r2: number | undefined;
  const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setSlideAtTarget(true)); });
  return () => { cancelAnimationFrame(r1); if (r2 !== undefined) cancelAnimationFrame(r2); };
}, [slidingPlanks]);

// MancalaBoard に渡す props
<MancalaBoard
  gameState={displayGameState}
  eliminatingId={eliminatingId}
  transitionSlides={slidingPlanks}
  slideAtTarget={slideAtTarget}
  // ...
/>
```

---

### パターン 6：スマホ対応（タップ遅延解消・フィードバック）

#### global.css に追加する CSS

```css
/* 全ボタンの 300ms タップ遅延を除去 */
button {
  font-family: inherit;
  touch-action: manipulation;
}

/* ゲームの選択可能ピットをタップしたときの即時フィードバック */
.pit-btn.is-selectable:not(:disabled):active {
  transform: scale(0.92) !important;
  filter: brightness(1.25) !important;
  transition: transform 0.06s, filter 0.06s !important;
}

/* 通常ボタンのタップフィードバック（既存） */
.btn:not(:disabled):active {
  transform: scale(0.96) translateY(1px) !important;
}
```

---

### パターン 7：石アニメーションのアーキテクチャ

```typescript
// アニメーションのステップ管理
const [animSteps,     setAnimSteps]     = useState<GameState[]>([]);
const [animActiveIds, setAnimActiveIds] = useState<string[]>([]);
const [animIdx,       setAnimIdx]       = useState(0);
const isAnimating = animSteps.length > 0;

// アニメーション中は「最終状態」を ref に保持（クリック時に事前計算）
const pendingFinalStateRef = useRef<GameState | null>(null);

// タイマーで1ステップずつ進める
useEffect(() => {
  if (!isAnimating) return;
  if (animIdx >= animSteps.length) {
    if (pendingFinalStateRef.current) {
      setGameState(pendingFinalStateRef.current);
      pendingFinalStateRef.current = null;
    }
    setAnimSteps([]); setAnimActiveIds([]); setAnimIdx(0);
    return;
  }
  const id = setTimeout(() => setAnimIdx(p => p + 1), STONE_ANIM_MS);
  return () => clearTimeout(id);
}, [animIdx, animSteps.length, isAnimating]);

// アニメーション中に表示するボード状態
const boardDisplayState = isAnimating
  ? animSteps[Math.min(animIdx, animSteps.length - 1)]
  : gameState;
```

---

## 既存コードのパターン（共通）

### CSS 変数（global.css で定義済み）

```css
--bg, --card, --text, --text-mid, --text-muted
--brown, --orange, --green, --gold
--border, --border-light
--shadow-sm, --shadow-md, --shadow-lg
--r-sm(10px), --r-md(16px), --r-lg(24px)
/* レスポンシブ */
--hero-pt, --hero-pb, --setup-pt, --game-page-pt, --game-page-pb
```

### CSS クラス（global.css で定義済み）

```css
.app-layout           /* 最大幅・余白（Layout.tsx が使用）*/
.game-grid            /* ゲームカード一覧のグリッド */
.btn, .btn-primary, .btn-secondary, .btn-ghost  /* ボタン */
.pit-btn              /* 選択可能なゲームマス */
.dragon-float         /* ドラゴンふわふわ */
.cpu-thinking-pulse   /* CPU 思考中の点滅 */
.result-appear        /* 結果カードのスケールイン */
.turn-slide           /* 手番バナーのスライドイン */
.extra-turn-banner    /* 追加ターンバナー（ボード内 position: absolute） */
.capture-banner       /* 捕獲バナー（ボード内 position: absolute） */
.confetti-dot         /* 紙吹雪（優勝演出） */
/* 4Pプランクレイアウト */
.plank-board-outer, .player-plank, .plank-pits, .plank-pit-cell, .plank-store-cell
/* 2Pフェイスツーフェイス */
.board-container, .board-2p-face, .plank-2p, .plank-2p-pit-cell, .plank-2p-store-cell
```

### ゲームロジックの実装パターン

- ロジックは **純粋関数** で書く（副作用なし）
- `applyMove(state, action) => newState` の形式
- `canSelectPit(state, pitId) => boolean` でガード
- **重要**: `canSelectPit` が false のとき `applyMove` は同一参照（`state` そのもの）を返す。
  これによりオンラインの書き込みガード（`if (finalState === state) return`）が機能する。
- テストは Vitest で書く（`*.test.ts`）
- CPU AI は priority 順で手を選ぶ（易しい順に → ランダムにフォールバック）

---

## 品質基準（完成の条件）

```bash
npx tsc --noEmit    # TypeScript エラーなし
npx vitest run      # 全テスト通過
npm run build       # ビルド成功
```

- `console.log` が残っていない
- `dist/`・`node_modules/` を git に含めない
- スマホ・タブレット・PC で大きく崩れない
- 人間 vs 人間・人間 vs CPU・オンライン対戦、それぞれ最後まで遊べる
- 勝敗・引き分けが正しく表示される
- 画面遷移（設定画面へ戻る・ゲーム選択画面へ戻る）が動く

## GitHub・Vercel へのデプロイ手順

完成したら以下で自動公開される：

```bash
git add .
git commit -m "Add [ゲーム名] game"
git push
```

`git push` するだけで Vercel が自動的に再デプロイします。
公開URL: https://dragon-game-park.vercel.app

---

## 今回追加したいゲーム

（ここに作りたいゲームの名前とルールを書いてください）

例：
- ゲーム名：リバーシ（オセロ）
- ルール：相手の石を挟んでひっくり返す。盤面の石が多い方が勝ち。
- 対戦モード：人間 vs 人間、人間 vs CPU、オンライン対戦
- CPU 強さ：5 段階（ベビードラゴン〜ゴッドドラゴン）
- 特記事項：なし

---

上記の情報をもとに、新しいゲームを追加するための計画を立てて、
Step 1 から順番に進めてください。
