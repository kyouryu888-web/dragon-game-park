import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import sql from '../../../supabase/bakuretsu_reversi_rooms.sql?raw';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { applyMove } from './bakuretsu/engine.ts';
import { initGame, legalMoves, makeRng } from './bakuretsu/rules.ts';
import type { GameState, Move, Side, TurnResult } from './bakuretsu/types.ts';
import { redact } from './bakuretsu/view.ts';
import { chooseBakuretsuAutoMove } from './bakuretsuUi.ts';

type StoredRoom = {
  game_state: GameState;
  last_turn_result: TurnResult | null;
  version: number | bigint;
  playback_ready_at: string | null;
  turn_started_at: string | null;
  turn_deadline: string | null;
  time_banks: Record<Side, number>;
  auto_move_counts: Record<Side, number>;
};

type PublicPayload = {
  game_state: GameState;
  last_turn_result: TurnResult | null;
  version: number | bigint;
  turn_started_at: string | null;
  turn_deadline: string | null;
};

const HOST_ID = 'host-player-identity-0001';
const GUEST_ID = 'guest-player-identity-001';

function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function payload(
  db: PGlite,
  functionCall: string,
  params: unknown[],
): Promise<PublicPayload | null> {
  const result = await db.query<{ payload: PublicPayload | null }>(`select ${functionCall} as payload`, params);
  return result.rows[0]?.payload ?? null;
}

async function storedRoom(db: PGlite, roomCode: string): Promise<StoredRoom> {
  const result = await db.query<StoredRoom>(
    `select game_state,last_turn_result,version,playback_ready_at,turn_started_at,turn_deadline,time_banks,auto_move_counts
     from public.bakuretsu_reversi_rooms where room_code=$1`,
    [roomCode],
  );
  return result.rows[0];
}

async function createReadyRoom(db: PGlite, roomCode: string): Promise<StoredRoom> {
  await payload(db, 'public.create_bakuretsu_reversi_room($1,$2,$3)', [roomCode, HOST_ID, '主']);
  await payload(db, 'public.join_bakuretsu_reversi_room($1,$2,$3)', [roomCode, GUEST_ID, '客']);
  await db.query(
    'update public.bakuretsu_reversi_rooms set game_state=$2::jsonb where room_code=$1',
    [roomCode, JSON.stringify(initGame(DEFAULT_CONFIG, makeRng(17)))],
  );
  return storedRoom(db, roomCode);
}

async function fetchView(db: PGlite, roomCode: string, playerId: string): Promise<PublicPayload> {
  const view = await payload(db, 'public.fetch_bakuretsu_reversi_room($1,$2)', [roomCode, playerId]);
  if (!view) throw new Error('participant view was not returned');
  return view;
}

async function makePlaybackReady(db: PGlite, roomCode: string): Promise<void> {
  await db.query(
    `update public.bakuretsu_reversi_rooms
     set playback_ready_at=pg_catalog.clock_timestamp()-interval '1 millisecond'
     where room_code=$1`,
    [roomCode],
  );
}

async function installSql(db: PGlite): Promise<void> {
  await db.exec('create role anon; create role authenticated;');
  await db.exec(sql);
}

describe('Bakuretsu Reversi executable PostgreSQL contract', () => {
  it('executes the DDL and keeps a full server game identical to the TypeScript engine', async () => {
    const db = new PGlite();
    try {
      await installSql(db);
      const roomCode = 'PGT234';
      let stored = await createReadyRoom(db, roomCode);
      let state = wire(stored.game_state);
      let specialMoves = 0;
      let redactionChecks = 0;

      while (state.status === 'PLAYING') {
        const candidates = legalMoves(state, DEFAULT_CONFIG);
        const move = candidates.find((candidate) => candidate.kind === 'SPECIAL') ?? candidates[0];
        if (!move) throw new Error(`no legal move at ply ${state.moveNo}`);
        if (move.kind === 'SPECIAL') specialMoves += 1;
        const movingSide = state.currentTurn;
        const expected = applyMove(state, move, DEFAULT_CONFIG);
        const playerId = movingSide === 'BLACK' ? HOST_ID : GUEST_ID;
        const saved = await payload(
          db,
          'public.submit_bakuretsu_reversi_move($1,$2,$3::jsonb,$4,$5)',
          [roomCode, playerId, JSON.stringify(move), false, Number(stored.version)],
        );
        expect(saved, `server rejected ply ${state.moveNo}`).not.toBeNull();

        stored = await storedRoom(db, roomCode);
        expect(stored.game_state, `state mismatch after ply ${state.moveNo}`).toEqual(wire(expected.state));
        expect(stored.last_turn_result, `event mismatch after ply ${state.moveNo}`).toEqual(wire(expected));

        const hostView = await fetchView(db, roomCode, HOST_ID);
        const guestView = await fetchView(db, roomCode, GUEST_ID);
        expect(hostView.game_state).toEqual(wire(redact(stored.game_state, 'BLACK')));
        expect(guestView.game_state).toEqual(wire(redact(stored.game_state, 'WHITE')));
        expect(hostView.last_turn_result?.state).toEqual(wire(redact(stored.last_turn_result!.state, 'BLACK')));
        expect(guestView.last_turn_result?.state).toEqual(wire(redact(stored.last_turn_result!.state, 'WHITE')));
        redactionChecks += 4;

        state = wire(stored.game_state);
        if (state.status === 'PLAYING') {
          expect(stored.turn_started_at).toBeNull();
          expect(stored.playback_ready_at).not.toBeNull();

          const nextMove = legalMoves(state, DEFAULT_CONFIG)[0] as Move;
          const nextPlayer = state.currentTurn === 'BLACK' ? HOST_ID : GUEST_ID;
          const earlyMove = await payload(
            db,
            'public.submit_bakuretsu_reversi_move($1,$2,$3::jsonb,$4,$5)',
            [roomCode, nextPlayer, JSON.stringify(nextMove), false, Number(stored.version)],
          );
          expect(earlyMove).toBeNull();
          const earlyAck = await payload(
            db,
            'public.ack_bakuretsu_reversi_playback($1,$2,$3)',
            [roomCode, nextPlayer, Number(stored.version)],
          );
          expect(earlyAck).toBeNull();

          await makePlaybackReady(db, roomCode);
          const acknowledged = await payload(
            db,
            'public.ack_bakuretsu_reversi_playback($1,$2,$3)',
            [roomCode, nextPlayer, Number(stored.version)],
          );
          expect(acknowledged?.turn_started_at).not.toBeNull();
          stored = await storedRoom(db, roomCode);
        }
      }

      expect(state.moveNo).toBeGreaterThan(20);
      expect(specialMoves).toBeGreaterThan(0);
      expect(redactionChecks).toBe(state.moveNo * 4);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('uses the server clock for automatic moves and preserves event order on the fifth timeout', async () => {
    const db = new PGlite();
    try {
      await installSql(db);
      const roomCode = 'PGT567';
      let stored = await createReadyRoom(db, roomCode);

      for (let timeoutNo = 1; timeoutNo <= 9; timeoutNo += 1) {
        const before = wire(stored.game_state);
        const automaticMove = chooseBakuretsuAutoMove(before);
        if (!automaticMove) throw new Error(`no automatic move at timeout ${timeoutNo}`);
        const expected = applyMove(before, automaticMove, DEFAULT_CONFIG);
        const playerId = before.currentTurn === 'BLACK' ? HOST_ID : GUEST_ID;
        await db.query(
          `update public.bakuretsu_reversi_rooms
           set turn_started_at=pg_catalog.clock_timestamp()-interval '21 minutes',
               turn_deadline=pg_catalog.clock_timestamp()-interval '1 minute',playback_ready_at=null
           where room_code=$1`,
          [roomCode],
        );
        const saved = await payload(
          db,
          'public.submit_bakuretsu_reversi_move($1,$2,$3::jsonb,$4,$5)',
          [roomCode, playerId, null, true, Number(stored.version)],
        );
        expect(saved, `timeout ${timeoutNo} was rejected`).not.toBeNull();
        stored = await storedRoom(db, roomCode);

        const reachedFive = stored.auto_move_counts[before.currentTurn] >= 5;
        if (reachedFive) {
          expect(stored.game_state.status).toBe('FINISHED');
          const actualEvents = stored.last_turn_result!.events;
          expect(actualEvents.slice(0, -1)).toEqual(wire(expected.events.filter((event) => event.t !== 'END')));
          expect(actualEvents.at(-1)).toMatchObject({ t: 'END', reason: 'ABANDON' });
          expect(timeoutNo).toBeGreaterThanOrEqual(9);
          return;
        }

        expect(stored.game_state).toEqual(wire(expected.state));
        await db.query(
          `update public.bakuretsu_reversi_rooms
           set time_banks=pg_catalog.jsonb_set(time_banks,array[$2],pg_catalog.to_jsonb(1200000),false)
           where room_code=$1`,
          [roomCode, stored.game_state.currentTurn],
        );
        await makePlaybackReady(db, roomCode);
        const nextPlayer = stored.game_state.currentTurn === 'BLACK' ? HOST_ID : GUEST_ID;
        const acknowledged = await payload(
          db,
          'public.ack_bakuretsu_reversi_playback($1,$2,$3)',
          [roomCode, nextPlayer, Number(stored.version)],
        );
        expect(acknowledged).not.toBeNull();
        stored = await storedRoom(db, roomCode);
      }
      throw new Error('fifth consecutive automatic move did not end the game');
    } finally {
      await db.close();
    }
  }, 60_000);

  it('turns a late playback ACK into a server timeout without restoring the clock', async () => {
    const db = new PGlite();
    try {
      await installSql(db);
      const roomCode = 'PGT789';
      let stored = await createReadyRoom(db, roomCode);
      const move = legalMoves(stored.game_state, DEFAULT_CONFIG)[0];
      const saved = await payload(
        db,
        'public.submit_bakuretsu_reversi_move($1,$2,$3::jsonb,$4,$5)',
        [roomCode, HOST_ID, JSON.stringify(move), false, Number(stored.version)],
      );
      expect(saved).not.toBeNull();
      stored = await storedRoom(db, roomCode);
      expect(stored.turn_started_at).toBeNull();

      await db.query(
        `update public.bakuretsu_reversi_rooms
         set time_banks=pg_catalog.jsonb_set(time_banks,array['WHITE'],'0'::jsonb,false)
         where room_code=$1`,
        [roomCode],
      );
      const zeroBeforeDeadline = await payload(
        db,
        'public.submit_bakuretsu_reversi_move($1,$2,$3::jsonb,$4,$5)',
        [roomCode, GUEST_ID, null, true, Number(stored.version)],
      );
      expect(zeroBeforeDeadline).toBeNull();

      await db.query(
        `update public.bakuretsu_reversi_rooms
         set playback_ready_at=pg_catalog.clock_timestamp()-interval '20 minutes',
             turn_deadline=pg_catalog.clock_timestamp()-interval '1 second'
         where room_code=$1`,
        [roomCode],
      );
      const lateAck = await payload(
        db,
        'public.ack_bakuretsu_reversi_playback($1,$2,$3)',
        [roomCode, GUEST_ID, Number(stored.version)],
      );
      expect(lateAck).not.toBeNull();
      expect(Number(lateAck!.version)).toBe(Number(stored.version) + 1);
      expect(lateAck!.game_state.moveNo).toBe(stored.game_state.moveNo + 1);
      const after = await storedRoom(db, roomCode);
      expect(after.auto_move_counts.WHITE).toBe(1);
      expect(after.time_banks.WHITE).toBe(0);
    } finally {
      await db.close();
    }
  }, 60_000);
});
