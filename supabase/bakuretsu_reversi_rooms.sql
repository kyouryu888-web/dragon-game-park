-- 爆裂リバーシのオンライン対戦ルーム（サーバー権威版）
-- Supabase ダッシュボード → SQL Editor → New query で、全文をそのまま実行してください。
-- 既存SQLへ追記せず、新しい空のクエリとして実行します。
-- クライアントは着手だけを送り、初期化・合法手検証・着手・連鎖・時計はRPC内で処理します。
-- 完全状態はDB内だけに保持し、全RPC応答は bakuretsu_reversi_redact() を通します。

create table if not exists public.bakuretsu_reversi_rooms (
  room_code text primary key,
  host_id text not null,
  guest_id text,
  host_name text not null,
  guest_name text,
  game_state jsonb not null,
  last_turn_result jsonb,
  time_banks jsonb not null default '{"BLACK":1200000,"WHITE":1200000}'::jsonb,
  auto_move_counts jsonb not null default '{"BLACK":0,"WHITE":0}'::jsonb,
  match_no bigint not null default 0 check (match_no >= 0),
  version bigint not null default 0 check (version >= 0),
  playback_ready_at timestamptz,
  turn_started_at timestamptz,
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bakuretsu_reversi_rooms_code_format check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  constraint bakuretsu_reversi_rooms_time_banks_object check (jsonb_typeof(time_banks) = 'object'),
  constraint bakuretsu_reversi_rooms_auto_moves_object check (jsonb_typeof(auto_move_counts) = 'object')
);

alter table public.bakuretsu_reversi_rooms add column if not exists turn_started_at timestamptz;
alter table public.bakuretsu_reversi_rooms add column if not exists turn_deadline timestamptz;
alter table public.bakuretsu_reversi_rooms add column if not exists playback_ready_at timestamptz;

create index if not exists bakuretsu_reversi_rooms_created_at_idx
  on public.bakuretsu_reversi_rooms (created_at);

create or replace function public.set_bakuretsu_reversi_rooms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_bakuretsu_reversi_rooms_updated_at on public.bakuretsu_reversi_rooms;
create trigger set_bakuretsu_reversi_rooms_updated_at
  before update on public.bakuretsu_reversi_rooms
  for each row execute function public.set_bakuretsu_reversi_rooms_updated_at();

alter table public.bakuretsu_reversi_rooms enable row level security;
drop policy if exists "bakuretsu reversi rooms select" on public.bakuretsu_reversi_rooms;
drop policy if exists "bakuretsu reversi rooms insert" on public.bakuretsu_reversi_rooms;
drop policy if exists "bakuretsu reversi rooms update" on public.bakuretsu_reversi_rooms;
drop policy if exists "bakuretsu reversi rooms delete" on public.bakuretsu_reversi_rooms;
revoke all on public.bakuretsu_reversi_rooms from anon, authenticated;

-- 旧クライアント権威RPCを消し、PostgRESTに旧overloadを残さない。
drop function if exists public.create_bakuretsu_reversi_room(text, text, text, jsonb, jsonb, jsonb);
drop function if exists public.push_bakuretsu_reversi_snapshot(text, text, jsonb, jsonb, jsonb, jsonb, bigint, bigint);
drop function if exists public.ack_bakuretsu_reversi_playback(text, text, bigint);

-- ---- 固定ルールの基本ヘルパー -------------------------------------------------

create or replace function public.bakuretsu_reversi_empty_cell()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"state":"EMPTY","owner":"NONE","specialType":"NONE","durability":0,"isQueued":false,"activated":false}'::jsonb;
$$;

create or replace function public.bakuretsu_reversi_opponent(p_side text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_side = 'BLACK' then 'WHITE' else 'BLACK' end;
$$;

create or replace function public.bakuretsu_reversi_initial_state()
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_board jsonb := '[]'::jsonb;
  v_black text[];
  v_white text[];
  v_cell jsonb;
  v_i integer;
begin
  for v_i in 0..63 loop
    v_board := v_board || pg_catalog.jsonb_build_array(public.bakuretsu_reversi_empty_cell());
  end loop;
  v_cell := public.bakuretsu_reversi_empty_cell() || '{"state":"FACEUP","owner":"WHITE"}'::jsonb;
  v_board := pg_catalog.jsonb_set(v_board, array['27'], v_cell, false);
  v_board := pg_catalog.jsonb_set(v_board, array['36'], v_cell, false);
  v_cell := public.bakuretsu_reversi_empty_cell() || '{"state":"FACEUP","owner":"BLACK"}'::jsonb;
  v_board := pg_catalog.jsonb_set(v_board, array['35'], v_cell, false);
  v_board := pg_catalog.jsonb_set(v_board, array['28'], v_cell, false);

  select pg_catalog.array_agg(piece order by piece) into v_black
  from (select piece from pg_catalog.unnest(array['BOMB','INFECT','SHIELD','NEUTRAL']::text[]) as dealt_piece(piece) order by pg_catalog.random() limit 3) dealt;
  select pg_catalog.array_agg(piece order by piece) into v_white
  from (select piece from pg_catalog.unnest(array['BOMB','INFECT','SHIELD','NEUTRAL']::text[]) as dealt_piece(piece) order by pg_catalog.random() limit 3) dealt;

  return pg_catalog.jsonb_build_object(
    'board', v_board,
    'currentTurn', 'BLACK',
    'hands', pg_catalog.jsonb_build_object(
      'BLACK', pg_catalog.jsonb_build_object('playerId','BLACK','initialSpecials',pg_catalog.to_jsonb(v_black),'specialPieces',pg_catalog.to_jsonb(v_black),'dummyCount',0),
      'WHITE', pg_catalog.jsonb_build_object('playerId','WHITE','initialSpecials',pg_catalog.to_jsonb(v_white),'specialPieces',pg_catalog.to_jsonb(v_white),'dummyCount',0)
    ),
    'activeQuestionCount', 0,
    'status', 'PLAYING',
    'passStreak', 0,
    'moveNo', 0
  );
end;
$$;

-- view.ts の redact() と同じ変換。完全状態はこの関数より外へ直接返さない。
create or replace function public.bakuretsu_reversi_redact(p_state jsonb, p_viewer_side text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_state jsonb := p_state;
  v_board jsonb := p_state -> 'board';
  v_cell jsonb;
  v_foe text := public.bakuretsu_reversi_opponent(p_viewer_side);
  v_i integer;
begin
  if p_viewer_side not in ('BLACK', 'WHITE') then raise exception 'invalid viewer side' using errcode = '22023'; end if;
  for v_i in 0..63 loop
    v_cell := v_board -> v_i;
    if v_cell ->> 'state' = 'FACEDOWN' and v_cell ->> 'owner' <> p_viewer_side then
      v_cell := pg_catalog.jsonb_set(v_cell, array['specialType'], '"NONE"'::jsonb, false);
      v_cell := pg_catalog.jsonb_set(v_cell, array['durability'], '0'::jsonb, false);
      v_board := pg_catalog.jsonb_set(v_board, array[v_i::text], v_cell, false);
    end if;
  end loop;
  v_state := pg_catalog.jsonb_set(v_state, array['board'], v_board, false);
  v_state := pg_catalog.jsonb_set(v_state, array['hands',v_foe,'specialPieces'], v_state #> array['hands',v_foe,'initialSpecials'], false);
  v_state := pg_catalog.jsonb_set(v_state, array['hands',v_foe,'dummyCount'], '-1'::jsonb, false);
  return v_state;
end;
$$;

create or replace function public.bakuretsu_reversi_captures_by_dir(p_board jsonb, p_x integer, p_y integer, p_mover text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_dx integer[] := array[-1,0,1,-1,1,-1,0,1];
  v_dy integer[] := array[-1,-1,-1,0,0,1,1,1];
  v_out jsonb := '[]'::jsonb;
  v_acc integer[];
  v_cell jsonb;
  v_d integer;
  v_cx integer;
  v_cy integer;
  v_index integer;
  v_opp_count integer;
  v_valid boolean;
begin
  if p_x < 0 or p_x > 7 or p_y < 0 or p_y > 7 or (p_board -> (p_y * 8 + p_x)) ->> 'state' <> 'EMPTY' then
    return '[[],[],[],[],[],[],[],[]]'::jsonb;
  end if;
  for v_d in 1..8 loop
    v_acc := array[]::integer[];
    v_opp_count := 0;
    v_valid := false;
    v_cx := p_x + v_dx[v_d];
    v_cy := p_y + v_dy[v_d];
    while v_cx >= 0 and v_cx < 8 and v_cy >= 0 and v_cy < 8 loop
      v_index := v_cy * 8 + v_cx;
      v_cell := p_board -> v_index;
      if v_cell ->> 'state' = 'EMPTY' then exit; end if;
      if v_cell ->> 'owner' = p_mover then
        if coalesce(pg_catalog.array_length(v_acc,1),0) > 0 and v_opp_count > 0 then v_valid := true; end if;
        exit;
      end if;
      v_acc := pg_catalog.array_append(v_acc, v_index);
      if v_cell ->> 'owner' <> 'NONE' then v_opp_count := v_opp_count + 1; end if;
      v_cx := v_cx + v_dx[v_d];
      v_cy := v_cy + v_dy[v_d];
    end loop;
    v_out := v_out || pg_catalog.jsonb_build_array(case when v_valid then pg_catalog.to_jsonb(v_acc) else '[]'::jsonb end);
  end loop;
  return v_out;
end;
$$;

create or replace function public.bakuretsu_reversi_legal_squares(p_state jsonb, p_side text)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out integer[] := array[]::integer[];
  v_dirs jsonb;
  v_total integer;
  v_i integer;
begin
  for v_i in 0..63 loop
    if (p_state -> 'board' -> v_i) ->> 'state' <> 'EMPTY' then continue; end if;
    v_dirs := public.bakuretsu_reversi_captures_by_dir(p_state -> 'board', v_i % 8, v_i / 8, p_side);
    select coalesce(pg_catalog.sum(pg_catalog.jsonb_array_length(value)),0)::integer into v_total
    from pg_catalog.jsonb_array_elements(v_dirs);
    if v_total > 0 then v_out := pg_catalog.array_append(v_out, v_i); end if;
  end loop;
  return v_out;
end;
$$;

create or replace function public.bakuretsu_reversi_legal_moves(p_state jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_side text := p_state ->> 'currentTurn';
  v_squares integer[] := public.bakuretsu_reversi_legal_squares(p_state, p_state ->> 'currentTurn');
  v_specials jsonb := p_state #> array['hands',v_side,'specialPieces'];
  v_out jsonb := '[]'::jsonb;
  v_seen text[];
  v_i integer;
  v_special text;
begin
  foreach v_i in array v_squares loop
    v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('x',v_i % 8,'y',v_i / 8,'kind','NORMAL'));
    v_seen := array[]::text[];
    for v_special in select value from pg_catalog.jsonb_array_elements_text(v_specials) loop
      if v_special = 'NEUTRAL' or v_special = any(v_seen) then continue; end if;
      v_seen := pg_catalog.array_append(v_seen,v_special);
      v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('x',v_i % 8,'y',v_i / 8,'kind','SPECIAL','special',v_special));
    end loop;
  end loop;
  if v_specials ? 'NEUTRAL' then
    foreach v_i in array v_squares loop
      v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('x',v_i % 8,'y',v_i / 8,'kind','SPECIAL','special','NEUTRAL'));
    end loop;
  end if;
  return v_out;
end;
$$;

create or replace function public.bakuretsu_reversi_counts(p_board jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_black integer := 0;
  v_white integer := 0;
  v_neutral integer := 0;
  v_empty integer := 0;
  v_cell jsonb;
  v_i integer;
begin
  for v_i in 0..63 loop
    v_cell := p_board -> v_i;
    if v_cell ->> 'state' = 'EMPTY' then v_empty := v_empty + 1;
    elsif v_cell ->> 'specialType' = 'NEUTRAL' then v_neutral := v_neutral + 1;
    elsif v_cell ->> 'owner' = 'BLACK' then v_black := v_black + 1;
    elsif v_cell ->> 'owner' = 'WHITE' then v_white := v_white + 1;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('black',v_black,'white',v_white,'neutral',v_neutral,'empty',v_empty);
end;
$$;

create or replace function public.bakuretsu_reversi_winner(p_board jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_counts jsonb := public.bakuretsu_reversi_counts(p_board);
  v_black integer := (v_counts ->> 'black')::integer;
  v_white integer := (v_counts ->> 'white')::integer;
  v_black_corners integer := 0;
  v_white_corners integer := 0;
  v_i integer;
  v_cell jsonb;
begin
  if v_black <> v_white then return case when v_black > v_white then 'BLACK' else 'WHITE' end; end if;
  foreach v_i in array array[0,7,56,63] loop
    v_cell := p_board -> v_i;
    if v_cell ->> 'state' <> 'EMPTY' and v_cell ->> 'owner' = 'BLACK' then v_black_corners := v_black_corners + 1; end if;
    if v_cell ->> 'state' <> 'EMPTY' and v_cell ->> 'owner' = 'WHITE' then v_white_corners := v_white_corners + 1; end if;
  end loop;
  if v_black_corners <> v_white_corners then return case when v_black_corners > v_white_corners then 'BLACK' else 'WHITE' end; end if;
  return 'NONE';
end;
$$;

create or replace function public.bakuretsu_reversi_finish(p_state jsonb, p_events jsonb, p_reason text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_state jsonb := p_state;
  v_events jsonb := p_events;
  v_counts jsonb := public.bakuretsu_reversi_counts(p_state -> 'board');
  v_winner text := public.bakuretsu_reversi_winner(p_state -> 'board');
begin
  v_state := pg_catalog.jsonb_set(v_state,array['status'],'"FINISHED"'::jsonb,false);
  v_state := pg_catalog.jsonb_set(v_state,array['endReason'],pg_catalog.to_jsonb(p_reason),true);
  v_state := pg_catalog.jsonb_set(v_state,array['winner'],pg_catalog.to_jsonb(v_winner),true);
  v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    't','END','reason',p_reason,'winner',v_winner,'black',(v_counts ->> 'black')::integer,'white',(v_counts ->> 'white')::integer
  ));
  return pg_catalog.jsonb_build_object('state',v_state,'events',v_events);
end;
$$;

create or replace function public.bakuretsu_reversi_rescue(p_state jsonb, p_events jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_state jsonb := p_state;
  v_events jsonb := p_events;
  v_board jsonb := p_state -> 'board';
  v_counts jsonb := public.bakuretsu_reversi_counts(v_board);
  v_dead text[] := array[]::text[];
  v_side text;
  v_pool integer[];
  v_i integer;
  v_placed integer;
  v_phase integer;
begin
  if (v_counts ->> 'black')::integer = 0 then v_dead := pg_catalog.array_append(v_dead,'BLACK'); end if;
  if (v_counts ->> 'white')::integer = 0 then v_dead := pg_catalog.array_append(v_dead,'WHITE'); end if;
  if coalesce(pg_catalog.array_length(v_dead,1),0) = 0 then return pg_catalog.jsonb_build_object('state',v_state,'events',v_events); end if;
  if pg_catalog.array_length(v_dead,1) = 2 then return public.bakuretsu_reversi_finish(v_state,v_events,'MUTUAL_EXTINCTION'); end if;
  foreach v_side in array v_dead loop
    v_placed := -1;
    for v_phase in 1..3 loop
      if v_phase = 1 then
        v_pool := array[18,19,20,21,26,27,28,29,34,35,36,37,42,43,44,45];
      elsif v_phase = 2 then
        v_pool := array[9,10,11,12,13,14,17,18,19,20,21,22,25,26,27,28,29,30,33,34,35,36,37,38,41,42,43,44,45,46,49,50,51,52,53,54];
      else
        v_pool := array[1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,57,58,59,60,61,62];
      end if;
      foreach v_i in array v_pool loop
        if (v_board -> v_i) ->> 'state' = 'EMPTY' then v_placed := v_i; exit; end if;
      end loop;
      if v_placed >= 0 then exit; end if;
    end loop;
    if v_placed >= 0 then
      v_board := pg_catalog.jsonb_set(v_board,array[v_placed::text],public.bakuretsu_reversi_empty_cell() || pg_catalog.jsonb_build_object('state','FACEUP','owner',v_side),false);
      v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','RESCUE','idx',v_placed,'player',v_side));
    end if;
  end loop;
  v_state := pg_catalog.jsonb_set(v_state,array['board'],v_board,false);
  return pg_catalog.jsonb_build_object('state',v_state,'events',v_events);
end;
$$;

create or replace function public.bakuretsu_reversi_settle_turn(p_state jsonb, p_events jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_state jsonb := p_state;
  v_events jsonb := p_events;
  v_side text;
  v_pass integer;
  v_guard integer;
begin
  for v_guard in 0..2 loop
    if (public.bakuretsu_reversi_counts(v_state -> 'board') ->> 'empty')::integer = 0 then return public.bakuretsu_reversi_finish(v_state,v_events,'BOARD_FULL'); end if;
    v_side := v_state ->> 'currentTurn';
    if coalesce(pg_catalog.array_length(public.bakuretsu_reversi_legal_squares(v_state,v_side),1),0) > 0 then
      return pg_catalog.jsonb_build_object('state',v_state,'events',v_events);
    end if;
    v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','PASS','player',v_side));
    v_pass := (v_state ->> 'passStreak')::integer + 1;
    v_state := pg_catalog.jsonb_set(v_state,array['passStreak'],pg_catalog.to_jsonb(v_pass),false);
    if v_pass >= 2 then return public.bakuretsu_reversi_finish(v_state,v_events,'BOTH_PASS'); end if;
    v_state := pg_catalog.jsonb_set(v_state,array['currentTurn'],pg_catalog.to_jsonb(public.bakuretsu_reversi_opponent(v_side)),false);
  end loop;
  return public.bakuretsu_reversi_finish(v_state,v_events,'BOTH_PASS');
end;
$$;

-- ---- engine.ts の固定DEFAULT_CONFIG移植 --------------------------------------

create or replace function public.bakuretsu_reversi_apply_move(p_prev jsonb, p_move jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_state jsonb := p_prev;
  v_board jsonb := p_prev -> 'board';
  v_events jsonb := '[]'::jsonb;
  v_mover text := p_prev ->> 'currentTurn';
  v_kind text := p_move ->> 'kind';
  v_special text := p_move ->> 'special';
  v_x integer;
  v_y integer;
  v_here integer;
  v_is_neutral boolean;
  v_by_dir jsonb;
  v_caps integer[] := array[]::integer[];
  v_queued integer[] := array[]::integer[];
  v_queued_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_line_out jsonb;
  v_specials jsonb;
  v_special_index integer;
  v_cell jsonb;
  v_snap jsonb;
  v_n integer := 0;
  v_blast text;
  v_cur jsonb := '[]'::jsonb;
  v_next jsonb;
  v_act jsonb;
  v_act_i integer;
  v_activated integer[] := array[]::integer[];
  v_early integer[] := array[]::integer[];
  v_ripple integer[];
  v_flip_lines jsonb := '[]'::jsonb;
  v_depth integer := 0;
  v_dest integer[];
  v_abs integer[];
  v_chained integer[];
  v_owners text[];
  v_range integer[];
  v_j integer;
  v_own text;
  v_foe text;
  v_stolen integer[];
  v_self_flipped boolean;
  v_dx integer[] := array[0,-1,1,0];
  v_dy integer[] := array[-1,0,0,1];
  v_nx integer;
  v_ny integer;
  v_d integer;
  v_pair jsonb;
begin
  if p_prev ->> 'status' <> 'PLAYING' then raise exception 'game finished'; end if;
  if pg_catalog.jsonb_typeof(p_move) <> 'object' then raise exception 'invalid move'; end if;
  begin
    v_x := (p_move ->> 'x')::integer;
    v_y := (p_move ->> 'y')::integer;
  exception when others then raise exception 'invalid coordinate'; end;
  if v_x < 0 or v_x > 7 or v_y < 0 or v_y > 7 then raise exception 'invalid coordinate'; end if;
  if v_kind not in ('NORMAL','SPECIAL') then raise exception 'invalid kind'; end if;
  if v_kind = 'SPECIAL' and v_special not in ('BOMB','INFECT','SHIELD','NEUTRAL') then raise exception 'invalid special'; end if;
  if v_kind = 'NORMAL' and p_move ? 'special' then raise exception 'unexpected special'; end if;

  v_here := v_y * 8 + v_x;
  if (v_board -> v_here) ->> 'state' <> 'EMPTY' then raise exception 'occupied'; end if;
  v_is_neutral := v_kind = 'SPECIAL' and v_special = 'NEUTRAL';
  v_by_dir := public.bakuretsu_reversi_captures_by_dir(v_board,v_x,v_y,v_mover);
  for v_line in select value from pg_catalog.jsonb_array_elements(v_by_dir) loop
    for v_j in select value::integer from pg_catalog.jsonb_array_elements_text(v_line) loop
      v_caps := pg_catalog.array_append(v_caps,v_j);
    end loop;
    if pg_catalog.jsonb_array_length(v_line) > 0 then v_queued_lines := v_queued_lines || pg_catalog.jsonb_build_array(v_line); end if;
  end loop;
  if coalesce(pg_catalog.array_length(v_caps,1),0) = 0 then raise exception 'illegal square'; end if;

  if v_kind = 'SPECIAL' then
    v_specials := v_state #> array['hands',v_mover,'specialPieces'];
    select ordinality::integer - 1 into v_special_index
    from pg_catalog.jsonb_array_elements_text(v_specials) with ordinality where value = v_special limit 1;
    if v_special_index is null then raise exception 'no such special'; end if;
    v_specials := v_specials - v_special_index;
    v_state := pg_catalog.jsonb_set(v_state,array['hands',v_mover,'specialPieces'],v_specials,false);
  end if;

  v_cell := public.bakuretsu_reversi_empty_cell();
  if v_is_neutral then
    v_cell := v_cell || '{"state":"FACEUP","owner":"NONE","specialType":"NEUTRAL"}'::jsonb;
  elsif v_kind = 'SPECIAL' then
    v_cell := v_cell || pg_catalog.jsonb_build_object('state','FACEUP','owner',v_mover,'specialType',v_special,'durability',case when v_special = 'SHIELD' then 1 else 0 end);
  else
    v_cell := v_cell || pg_catalog.jsonb_build_object('state','FACEUP','owner',v_mover);
  end if;
  v_board := pg_catalog.jsonb_set(v_board,array[v_here::text],v_cell,false);
  for v_j in 0..63 loop if (v_board -> v_j) ->> 'state' <> 'EMPTY' then v_n := v_n + 1; end if; end loop;
  v_blast := case when v_n < 24 then 'CROSS' else 'EIGHT' end;
  v_events := v_events || pg_catalog.jsonb_build_array(case when v_kind = 'SPECIAL'
    then pg_catalog.jsonb_build_object('t','PLACE','idx',v_here,'by',v_mover,'kind',v_kind,'special',v_special,'n',v_n,'blast',v_blast)
    else pg_catalog.jsonb_build_object('t','PLACE','idx',v_here,'by',v_mover,'kind',v_kind,'n',v_n,'blast',v_blast) end);

  if not v_is_neutral then
    select coalesce(pg_catalog.array_agg(i order by i),array[]::integer[]) into v_queued
    from (select distinct pg_catalog.unnest(v_caps) as i) unique_caps;
  end if;
  foreach v_j in array v_queued loop
    v_cell := pg_catalog.jsonb_set(v_board -> v_j,array['isQueued'],'true'::jsonb,false);
    v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
  end loop;
  if coalesce(pg_catalog.array_length(v_queued,1),0) > 0 then
    v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','QUEUE','idxs',pg_catalog.to_jsonb(v_queued)));
  end if;
  foreach v_j in array v_queued loop
    v_snap := v_board -> v_j;
    if v_snap ->> 'specialType' in ('BOMB','INFECT') then
      v_cur := v_cur || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('i',v_j,'snap',v_snap,'src',v_here));
    end if;
  end loop;

  -- flipBeforeBlast=true: 裏返しを爆発より先に確定する。
  foreach v_j in array v_queued loop
    v_cell := v_board -> v_j;
    if v_cell ->> 'specialType' = 'SHIELD' and (v_cell ->> 'durability')::integer > 0 then
      v_cell := pg_catalog.jsonb_set(v_cell,array['durability'],pg_catalog.to_jsonb((v_cell ->> 'durability')::integer - 1),false);
      v_cell := pg_catalog.jsonb_set(v_cell,array['specialType'],'"NONE"'::jsonb,false);
      v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
      v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','SHIELD_ABSORB','idx',v_j,'cause','FLIP'));
      continue;
    end if;
    v_cell := pg_catalog.jsonb_set(v_cell,array['specialType'],'"NONE"'::jsonb,false);
    v_cell := pg_catalog.jsonb_set(v_cell,array['owner'],pg_catalog.to_jsonb(v_mover),false);
    v_cell := pg_catalog.jsonb_set(v_cell,array['state'],'"FACEUP"'::jsonb,false);
    v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
    v_early := pg_catalog.array_append(v_early,v_j);
  end loop;
  if coalesce(pg_catalog.array_length(v_early,1),0) > 0 then
    select pg_catalog.array_agg(i order by greatest(abs((i%8)-(v_here%8)),abs((i/8)-(v_here/8))),i/8,i%8) into v_ripple
    from pg_catalog.unnest(v_early) as i;
    for v_line in select value from pg_catalog.jsonb_array_elements(v_queued_lines) loop
      v_line_out := '[]'::jsonb;
      for v_j in select value::integer from pg_catalog.jsonb_array_elements_text(v_line) loop
        if v_j = any(v_early) then v_line_out := v_line_out || pg_catalog.to_jsonb(v_j); end if;
      end loop;
      if pg_catalog.jsonb_array_length(v_line_out) > 0 then v_flip_lines := v_flip_lines || pg_catalog.jsonb_build_array(v_line_out); end if;
    end loop;
    v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','FLIP','idxs',pg_catalog.to_jsonb(v_ripple),'to',v_mover,'from',v_here,'lines',v_flip_lines));
  end if;

  while pg_catalog.jsonb_array_length(v_cur) > 0 loop
    v_depth := v_depth + 1;
    v_next := '[]'::jsonb;
    for v_act in
      select value from pg_catalog.jsonb_array_elements(v_cur)
      order by greatest(abs(((value->>'i')::integer%8)-((value->>'src')::integer%8)),abs(((value->>'i')::integer/8)-((value->>'src')::integer/8))),
        (value->>'i')::integer/8,(value->>'i')::integer%8
    loop
      v_act_i := (v_act ->> 'i')::integer;
      v_snap := v_act -> 'snap';
      if v_act_i = any(v_activated) then continue; end if;
      v_activated := pg_catalog.array_append(v_activated,v_act_i);
      if (v_board -> v_act_i) ->> 'state' <> 'EMPTY' then
        v_cell := pg_catalog.jsonb_set(v_board -> v_act_i,array['activated'],'true'::jsonb,false);
        v_board := pg_catalog.jsonb_set(v_board,array[v_act_i::text],v_cell,false);
      end if;

      if v_snap ->> 'specialType' = 'BOMB' then
        if (v_board -> v_act_i) ->> 'state' <> 'EMPTY' then v_board := pg_catalog.jsonb_set(v_board,array[v_act_i::text],public.bakuretsu_reversi_empty_cell(),false); end if;
        v_dest := array[]::integer[]; v_abs := array[]::integer[]; v_chained := array[]::integer[]; v_owners := array[]::text[];
        if v_blast = 'CROSS' then v_range := array[v_act_i,v_act_i-8,v_act_i-1,v_act_i+1,v_act_i+8];
        else v_range := array[v_act_i,v_act_i-9,v_act_i-8,v_act_i-7,v_act_i-1,v_act_i+1,v_act_i+7,v_act_i+8,v_act_i+9]; end if;
        foreach v_j in array v_range loop
          if v_j = v_act_i or v_j < 0 or v_j > 63 then continue; end if;
          if greatest(abs((v_j%8)-(v_act_i%8)),abs((v_j/8)-(v_act_i/8))) > 1 then continue; end if;
          v_cell := v_board -> v_j;
          if v_cell ->> 'state' = 'EMPTY' or v_cell ->> 'owner' = v_snap ->> 'owner' then continue; end if;
          if v_cell ->> 'specialType' = 'SHIELD' and (v_cell ->> 'durability')::integer > 0 then
            v_cell := pg_catalog.jsonb_set(v_cell,array['durability'],pg_catalog.to_jsonb((v_cell ->> 'durability')::integer - 1),false);
            v_cell := pg_catalog.jsonb_set(v_cell,array['specialType'],'"NONE"'::jsonb,false);
            v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
            v_abs := pg_catalog.array_append(v_abs,v_j);
            v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','SHIELD_ABSORB','idx',v_j,'cause','BLAST'));
            continue;
          end if;
          v_cell := v_board -> v_j;
          v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],public.bakuretsu_reversi_empty_cell(),false);
          if v_cell ->> 'specialType' = 'BOMB' and not (v_j = any(v_activated)) then
            v_next := v_next || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('i',v_j,'snap',v_cell,'src',v_act_i));
            v_chained := pg_catalog.array_append(v_chained,v_j);
            continue;
          end if;
          v_dest := pg_catalog.array_append(v_dest,v_j);
          v_owners := pg_catalog.array_append(v_owners,v_cell ->> 'owner');
          if v_cell ->> 'specialType' = 'INFECT' and coalesce((v_cell ->> 'isQueued')::boolean,false) and not (v_j = any(v_activated)) then
            v_next := v_next || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('i',v_j,'snap',v_cell,'src',v_act_i));
            continue;
          end if;
          if not (v_j = any(v_activated)) and v_cell ->> 'specialType' in ('BOMB','INFECT','SHIELD') then
            v_specials := v_state #> array['hands',v_cell ->> 'owner','specialPieces'];
            v_specials := v_specials || pg_catalog.to_jsonb(v_cell ->> 'specialType');
            v_state := pg_catalog.jsonb_set(v_state,array['hands',v_cell ->> 'owner','specialPieces'],v_specials,false);
            v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','RETURN_TO_HAND','idx',v_j,'owner',v_cell ->> 'owner','special',v_cell ->> 'specialType'));
          end if;
        end loop;
        v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          't','BOMB','depth',v_depth,'idx',v_act_i,'range',v_blast,'destroyed',pg_catalog.to_jsonb(v_dest),'absorbed',pg_catalog.to_jsonb(v_abs),
          'chained',pg_catalog.to_jsonb(v_chained),'owners',pg_catalog.to_jsonb(v_owners),'planter',v_snap ->> 'owner'
        ));
      elsif v_snap ->> 'specialType' = 'INFECT' then
        v_own := v_snap ->> 'owner'; v_foe := public.bakuretsu_reversi_opponent(v_own); v_stolen := array[]::integer[];
        for v_d in 1..4 loop
          v_nx := (v_act_i%8)+v_dx[v_d]; v_ny := (v_act_i/8)+v_dy[v_d];
          if v_nx < 0 or v_nx > 7 or v_ny < 0 or v_ny > 7 then continue; end if;
          v_j := v_ny*8+v_nx; v_cell := v_board -> v_j;
          if v_cell ->> 'state' <> 'FACEUP' or v_cell ->> 'specialType' <> 'NONE' or v_cell ->> 'owner' <> v_foe then continue; end if;
          v_cell := pg_catalog.jsonb_set(v_cell,array['owner'],pg_catalog.to_jsonb(v_own),false);
          v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
          v_stolen := pg_catalog.array_append(v_stolen,v_j);
        end loop;
        v_self_flipped := false;
        if (v_board -> v_act_i) ->> 'state' <> 'EMPTY' then
          v_cell := v_board -> v_act_i;
          v_cell := pg_catalog.jsonb_set(v_cell,array['owner'],pg_catalog.to_jsonb(v_foe),false);
          v_cell := pg_catalog.jsonb_set(v_cell,array['specialType'],'"NONE"'::jsonb,false);
          v_cell := pg_catalog.jsonb_set(v_cell,array['state'],'"FACEUP"'::jsonb,false);
          v_board := pg_catalog.jsonb_set(v_board,array[v_act_i::text],v_cell,false);
          v_self_flipped := true;
        end if;
        v_events := v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('t','INFECT','depth',v_depth,'idx',v_act_i,'stolen',pg_catalog.to_jsonb(v_stolen),'selfFlipped',v_self_flipped));
      end if;
    end loop;
    v_cur := v_next;
  end loop;

  for v_j in 0..63 loop
    v_cell := v_board -> v_j;
    v_cell := pg_catalog.jsonb_set(v_cell,array['isQueued'],'false'::jsonb,false);
    v_cell := pg_catalog.jsonb_set(v_cell,array['activated'],'false'::jsonb,false);
    v_board := pg_catalog.jsonb_set(v_board,array[v_j::text],v_cell,false);
  end loop;
  v_state := pg_catalog.jsonb_set(v_state,array['board'],v_board,false);
  v_state := pg_catalog.jsonb_set(v_state,array['moveNo'],pg_catalog.to_jsonb((v_state ->> 'moveNo')::integer + 1),false);
  v_pair := public.bakuretsu_reversi_rescue(v_state,v_events);
  v_state := v_pair -> 'state'; v_events := v_pair -> 'events';
  if v_state ->> 'status' = 'PLAYING' then
    v_state := pg_catalog.jsonb_set(v_state,array['currentTurn'],pg_catalog.to_jsonb(public.bakuretsu_reversi_opponent(v_mover)),false);
    v_state := pg_catalog.jsonb_set(v_state,array['passStreak'],'0'::jsonb,false);
    v_pair := public.bakuretsu_reversi_settle_turn(v_state,v_events);
    v_state := v_pair -> 'state'; v_events := v_pair -> 'events';
  end if;
  return pg_catalog.jsonb_build_object('state',v_state,'events',v_events,'maxDepth',v_depth);
end;
$$;

create or replace function public.bakuretsu_reversi_choose_auto_move(p_state jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_side text := p_state ->> 'currentTurn';
  v_best integer;
begin
  select square into v_best
  from (
    select square, (select coalesce(pg_catalog.sum(pg_catalog.jsonb_array_length(value)),0)
      from pg_catalog.jsonb_array_elements(public.bakuretsu_reversi_captures_by_dir(p_state -> 'board',square%8,square/8,v_side))) as flips
    from pg_catalog.unnest(public.bakuretsu_reversi_legal_squares(p_state,v_side)) as square
  ) candidates order by flips,square/8,square%8 limit 1;
  if v_best is null then return null; end if;
  return pg_catalog.jsonb_build_object('x',v_best%8,'y',v_best/8,'kind','NORMAL');
end;
$$;

create or replace function public.bakuretsu_reversi_playback_ms(p_result jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ms integer := 266;
  v_event jsonb;
  v_count integer;
begin
  for v_event in select value from pg_catalog.jsonb_array_elements(p_result -> 'events') loop
    if v_event ->> 't' = 'FLIP' then v_ms := v_ms + 90 * pg_catalog.jsonb_array_length(v_event -> 'idxs');
    elsif v_event ->> 't' = 'SHIELD_ABSORB' and v_event ->> 'cause' = 'FLIP' then v_ms := v_ms + 1100;
    elsif v_event ->> 't' = 'RESCUE' then v_ms := v_ms + 400;
    end if;
  end loop;
  for v_count in
    select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_result -> 'events')
    where value ->> 't' in ('BOMB','INFECT') group by (value ->> 'depth')::integer
  loop
    v_ms := v_ms + greatest(240,700/v_count)*v_count + 400;
  end loop;
  return v_ms * 2;
end;
$$;

-- ---- RPC応答。完全状態を必ずredactしてから返す -------------------------------

create or replace function public.bakuretsu_reversi_room_payload(p_room public.bakuretsu_reversi_rooms, p_viewer_side text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_state jsonb := public.bakuretsu_reversi_redact(p_room.game_state,p_viewer_side);
  v_result jsonb := p_room.last_turn_result;
  v_banks jsonb := p_room.time_banks;
  v_side text := p_room.game_state ->> 'currentTurn';
  v_elapsed double precision;
  v_remaining double precision;
  v_moves jsonb := '[]'::jsonb;
begin
  if p_room.game_state ->> 'status' = 'PLAYING' and p_room.guest_id is not null and p_room.turn_started_at is not null then
    v_elapsed := greatest(0,pg_catalog.date_part('epoch',pg_catalog.clock_timestamp()-p_room.turn_started_at)*1000);
    v_remaining := greatest(0,coalesce((v_banks ->> v_side)::double precision,0)-v_elapsed);
    v_banks := pg_catalog.jsonb_set(v_banks,array[v_side],pg_catalog.to_jsonb(v_remaining),false);
  end if;
  if v_result is not null then
    v_result := pg_catalog.jsonb_set(v_result,array['state'],public.bakuretsu_reversi_redact(v_result -> 'state',p_viewer_side),false);
  end if;
  if p_room.guest_id is not null and p_room.game_state ->> 'status' = 'PLAYING'
    and p_room.turn_started_at is not null and v_side = p_viewer_side then
    v_moves := public.bakuretsu_reversi_legal_moves(p_room.game_state);
  end if;
  return pg_catalog.jsonb_build_object(
    'room_code',p_room.room_code,'host_name',p_room.host_name,'guest_name',p_room.guest_name,
    'game_state',v_state,'last_turn_result',v_result,'legal_moves',v_moves,
    'time_banks',v_banks,'auto_move_counts',p_room.auto_move_counts,
    'match_no',p_room.match_no,'version',p_room.version,'viewer_side',p_viewer_side,
    'playback_ready_at',p_room.playback_ready_at,
    'turn_started_at',p_room.turn_started_at,'turn_deadline',p_room.turn_deadline
  );
end;
$$;

-- ---- 既存方式と同じSupabase RPC ---------------------------------------------

create or replace function public.create_bakuretsu_reversi_room(p_room_code text, p_player_id text, p_host_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_room public.bakuretsu_reversi_rooms%rowtype;
begin
  if p_room_code !~ '^[A-HJ-NP-Z2-9]{6}$' or pg_catalog.length(p_player_id) < 16 then
    raise exception 'invalid bakuretsu room payload' using errcode = '22023';
  end if;
  insert into public.bakuretsu_reversi_rooms(
    room_code,host_id,host_name,game_state,last_turn_result,time_banks,auto_move_counts,match_no,version,
    playback_ready_at,turn_started_at,turn_deadline
  ) values (
    p_room_code,p_player_id,pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_host_name),''),'ルームの主'),12),
    public.bakuretsu_reversi_initial_state(),null,'{"BLACK":1200000,"WHITE":1200000}'::jsonb,'{"BLACK":0,"WHITE":0}'::jsonb,
    0,0,null,null,null
  ) returning * into v_room;
  return public.bakuretsu_reversi_room_payload(v_room,'BLACK');
end;
$$;

create or replace function public.join_bakuretsu_reversi_room(p_room_code text, p_player_id text, p_guest_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.bakuretsu_reversi_rooms%rowtype;
  v_side text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_clock_ms double precision;
begin
  if pg_catalog.length(p_player_id) < 16 then return null; end if;
  select * into v_room from public.bakuretsu_reversi_rooms
  where room_code = pg_catalog.upper(pg_catalog.btrim(p_room_code)) for update;
  if not found then return null; end if;
  if v_room.host_id = p_player_id then v_side := 'BLACK';
  elsif v_room.guest_id = p_player_id then v_side := 'WHITE';
  elsif v_room.guest_id is null then
    v_clock_ms := coalesce((v_room.time_banks ->> 'BLACK')::double precision,1200000);
    update public.bakuretsu_reversi_rooms set
      guest_id=p_player_id,
      guest_name=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_guest_name),''),'挑戦者'),12),
      version=version+1,playback_ready_at=null,
      turn_started_at=v_now,turn_deadline=v_now+v_clock_ms*interval '1 millisecond'
    where room_code=v_room.room_code returning * into v_room;
    v_side := 'WHITE';
  else return null;
  end if;
  return public.bakuretsu_reversi_room_payload(v_room,v_side);
end;
$$;

create or replace function public.fetch_bakuretsu_reversi_room(p_room_code text, p_player_id text)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare v_room public.bakuretsu_reversi_rooms%rowtype; v_side text;
begin
  select * into v_room from public.bakuretsu_reversi_rooms
  where room_code=pg_catalog.upper(pg_catalog.btrim(p_room_code)) and (host_id=p_player_id or guest_id=p_player_id);
  if not found then return null; end if;
  v_side := case when v_room.host_id=p_player_id then 'BLACK' else 'WHITE' end;
  return public.bakuretsu_reversi_room_payload(v_room,v_side);
end;
$$;

-- 次手番本人の演出完了後にだけサーバー時計を開始する。
-- playback_ready_at より早い通知は受理せず、RPC直呼びで演出を飛ばしても先行着手できない。
-- poll/通信遅延用のACK猶予は最大10秒。それを超えた遅延はfallback期限から持ち時間を差し引く。
create or replace function public.ack_bakuretsu_reversi_playback(
  p_room_code text,p_player_id text,p_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.bakuretsu_reversi_rooms%rowtype;
  v_side text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_remaining double precision;
  v_banks jsonb;
begin
  select * into v_room from public.bakuretsu_reversi_rooms
  where room_code=pg_catalog.upper(pg_catalog.btrim(p_room_code)) and version=p_version for update;
  if not found or v_room.guest_id is null or v_room.game_state ->> 'status' <> 'PLAYING' then return null; end if;
  if v_room.host_id=p_player_id then v_side:='BLACK';
  elsif v_room.guest_id=p_player_id then v_side:='WHITE';
  else return null;
  end if;
  if v_side<>v_room.game_state ->> 'currentTurn' or v_room.turn_started_at is not null then return null; end if;
  if v_room.playback_ready_at is null or v_now<v_room.playback_ready_at then return null; end if;
  if v_room.turn_deadline is null then return null; end if;
  if v_now>=v_room.turn_deadline then
    return public.submit_bakuretsu_reversi_move(p_room_code,p_player_id,null,true,p_version);
  end if;
  v_remaining:=greatest(0,coalesce((v_room.time_banks ->> v_side)::double precision,0));
  if v_now>v_room.playback_ready_at+interval '10 seconds' then
    v_remaining:=greatest(0,pg_catalog.date_part('epoch',v_room.turn_deadline-v_now)*1000);
  end if;
  if v_remaining<=0 then return null; end if;
  v_banks:=pg_catalog.jsonb_set(v_room.time_banks,array[v_side],pg_catalog.to_jsonb(v_remaining),false);
  update public.bakuretsu_reversi_rooms set
    version=v_room.version+1,time_banks=v_banks,playback_ready_at=null,
    turn_started_at=v_now,turn_deadline=v_now+v_remaining*interval '1 millisecond'
  where room_code=v_room.room_code returning * into v_room;
  return public.bakuretsu_reversi_room_payload(v_room,v_side);
end;
$$;

create or replace function public.submit_bakuretsu_reversi_move(
  p_room_code text,p_player_id text,p_move jsonb,p_timeout boolean,p_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.bakuretsu_reversi_rooms%rowtype;
  v_player_side text;
  v_turn_side text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_elapsed double precision := 0;
  v_remaining double precision;
  v_banks jsonb;
  v_auto jsonb;
  v_auto_count integer;
  v_expired boolean;
  v_automatic boolean := false;
  v_move jsonb;
  v_result jsonb;
  v_state jsonb;
  v_events jsonb;
  v_counts jsonb;
  v_winner text;
  v_playback_ms integer;
  v_next_side text;
  v_next_ms double precision;
  v_ready timestamptz;
begin
  select * into v_room from public.bakuretsu_reversi_rooms
  where room_code=pg_catalog.upper(pg_catalog.btrim(p_room_code)) and version=p_version for update;
  if not found or v_room.guest_id is null or v_room.game_state ->> 'status' <> 'PLAYING' then return null; end if;
  if v_room.host_id=p_player_id then v_player_side:='BLACK';
  elsif v_room.guest_id=p_player_id then v_player_side:='WHITE';
  else return null;
  end if;
  v_turn_side:=v_room.game_state ->> 'currentTurn';
  v_banks:=v_room.time_banks; v_auto:=v_room.auto_move_counts;
  if v_room.turn_started_at is not null then
    v_elapsed:=greatest(0,pg_catalog.date_part('epoch',v_now-v_room.turn_started_at)*1000);
  end if;
  v_remaining:=greatest(0,coalesce((v_banks ->> v_turn_side)::double precision,0)-v_elapsed);
  if v_room.turn_started_at is null then
    v_expired:=v_room.turn_deadline is not null and v_now>=v_room.turn_deadline;
  else
    v_expired:=v_remaining<=0 or (v_room.turn_deadline is not null and v_now>=v_room.turn_deadline);
  end if;
  if v_room.turn_started_at is null and v_expired then v_remaining:=0; end if;
  v_banks:=pg_catalog.jsonb_set(v_banks,array[v_turn_side],pg_catalog.to_jsonb(v_remaining),false);
  if p_timeout then
    if not v_expired then return null; end if;
    if v_player_side<>v_turn_side and (v_room.turn_deadline is null or v_now<v_room.turn_deadline+interval '30 seconds') then return null; end if;
    v_move:=public.bakuretsu_reversi_choose_auto_move(v_room.game_state); v_automatic:=true;
  else
    if v_player_side<>v_turn_side then return null; end if;
    if v_room.turn_started_at is null or v_now<v_room.turn_started_at then return null; end if;
    if v_expired then v_move:=public.bakuretsu_reversi_choose_auto_move(v_room.game_state); v_automatic:=true;
    else v_move:=p_move;
    end if;
  end if;
  if v_move is null then return null; end if;
  if v_automatic then v_auto_count:=coalesce((v_auto ->> v_turn_side)::integer,0)+1; else v_auto_count:=0; end if;
  v_auto:=pg_catalog.jsonb_set(v_auto,array[v_turn_side],pg_catalog.to_jsonb(v_auto_count),false);
  begin v_result:=public.bakuretsu_reversi_apply_move(v_room.game_state,v_move); exception when others then return null; end;
  v_state:=v_result -> 'state'; v_events:=v_result -> 'events';
  if v_automatic and v_auto_count>=5 then
    v_winner:=public.bakuretsu_reversi_opponent(v_turn_side); v_counts:=public.bakuretsu_reversi_counts(v_state -> 'board');
    select coalesce(pg_catalog.jsonb_agg(value order by ordinal),'[]'::jsonb) into v_events
    from pg_catalog.jsonb_array_elements(v_events) with ordinality as event(value,ordinal)
    where value ->> 't' <> 'END';
    v_events:=v_events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      't','END','reason','ABANDON','winner',v_winner,'black',(v_counts ->> 'black')::integer,'white',(v_counts ->> 'white')::integer));
    v_state:=pg_catalog.jsonb_set(v_state,array['status'],'"FINISHED"'::jsonb,false);
    v_state:=pg_catalog.jsonb_set(v_state,array['endReason'],'"ABANDON"'::jsonb,true);
    v_state:=pg_catalog.jsonb_set(v_state,array['winner'],pg_catalog.to_jsonb(v_winner),true);
    v_result:=pg_catalog.jsonb_set(v_result,array['state'],v_state,false);
    v_result:=pg_catalog.jsonb_set(v_result,array['events'],v_events,false);
  end if;
  if v_state ->> 'status'='PLAYING' then
    v_next_side:=v_state ->> 'currentTurn';
    v_next_ms:=greatest(0,coalesce((v_banks ->> v_next_side)::double precision,0));
    v_playback_ms:=public.bakuretsu_reversi_playback_ms(v_result);
    v_ready:=v_now+v_playback_ms*interval '1 millisecond';
  else v_ready:=null; v_next_ms:=0;
  end if;
  update public.bakuretsu_reversi_rooms set
    game_state=v_state,last_turn_result=v_result,time_banks=v_banks,auto_move_counts=v_auto,version=v_room.version+1,
    playback_ready_at=v_ready,turn_started_at=null,
    turn_deadline=case when v_ready is null then null else v_ready+interval '10 seconds'+v_next_ms*interval '1 millisecond' end
  where room_code=v_room.room_code returning * into v_room;
  return public.bakuretsu_reversi_room_payload(v_room,v_player_side);
end;
$$;

create or replace function public.rematch_bakuretsu_reversi_room(p_room_code text,p_player_id text,p_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_room public.bakuretsu_reversi_rooms%rowtype; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  select * into v_room from public.bakuretsu_reversi_rooms
  where room_code=pg_catalog.upper(pg_catalog.btrim(p_room_code)) and host_id=p_player_id and version=p_version
    and game_state ->> 'status'='FINISHED' for update;
  if not found then return null; end if;
  update public.bakuretsu_reversi_rooms set
    game_state=public.bakuretsu_reversi_initial_state(),last_turn_result=null,
    time_banks='{"BLACK":1200000,"WHITE":1200000}'::jsonb,auto_move_counts='{"BLACK":0,"WHITE":0}'::jsonb,
    match_no=v_room.match_no+1,version=v_room.version+1,playback_ready_at=null,
    turn_started_at=v_now,turn_deadline=v_now+interval '20 minutes'
  where room_code=v_room.room_code returning * into v_room;
  return public.bakuretsu_reversi_room_payload(v_room,'BLACK');
end;
$$;

create or replace function public.delete_bakuretsu_reversi_room(p_room_code text,p_player_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bakuretsu_reversi_rooms
  where room_code=pg_catalog.upper(pg_catalog.btrim(p_room_code)) and host_id=p_player_id;
  return found;
end;
$$;

-- 内部関数はAPI利用者へ公開しない。
revoke all on function public.set_bakuretsu_reversi_rooms_updated_at() from public;
revoke all on function public.bakuretsu_reversi_empty_cell() from public;
revoke all on function public.bakuretsu_reversi_opponent(text) from public;
revoke all on function public.bakuretsu_reversi_initial_state() from public;
revoke all on function public.bakuretsu_reversi_redact(jsonb,text) from public;
revoke all on function public.bakuretsu_reversi_captures_by_dir(jsonb,integer,integer,text) from public;
revoke all on function public.bakuretsu_reversi_legal_squares(jsonb,text) from public;
revoke all on function public.bakuretsu_reversi_legal_moves(jsonb) from public;
revoke all on function public.bakuretsu_reversi_counts(jsonb) from public;
revoke all on function public.bakuretsu_reversi_winner(jsonb) from public;
revoke all on function public.bakuretsu_reversi_finish(jsonb,jsonb,text) from public;
revoke all on function public.bakuretsu_reversi_rescue(jsonb,jsonb) from public;
revoke all on function public.bakuretsu_reversi_settle_turn(jsonb,jsonb) from public;
revoke all on function public.bakuretsu_reversi_apply_move(jsonb,jsonb) from public;
revoke all on function public.bakuretsu_reversi_choose_auto_move(jsonb) from public;
revoke all on function public.bakuretsu_reversi_playback_ms(jsonb) from public;
revoke all on function public.bakuretsu_reversi_room_payload(public.bakuretsu_reversi_rooms,text) from public;

revoke all on function public.create_bakuretsu_reversi_room(text,text,text) from public;
revoke all on function public.join_bakuretsu_reversi_room(text,text,text) from public;
revoke all on function public.fetch_bakuretsu_reversi_room(text,text) from public;
revoke all on function public.ack_bakuretsu_reversi_playback(text,text,bigint) from public;
revoke all on function public.submit_bakuretsu_reversi_move(text,text,jsonb,boolean,bigint) from public;
revoke all on function public.rematch_bakuretsu_reversi_room(text,text,bigint) from public;
revoke all on function public.delete_bakuretsu_reversi_room(text,text) from public;

grant execute on function public.create_bakuretsu_reversi_room(text,text,text) to anon, authenticated;
grant execute on function public.join_bakuretsu_reversi_room(text,text,text) to anon, authenticated;
grant execute on function public.fetch_bakuretsu_reversi_room(text,text) to anon, authenticated;
grant execute on function public.ack_bakuretsu_reversi_playback(text,text,bigint) to anon, authenticated;
grant execute on function public.submit_bakuretsu_reversi_move(text,text,jsonb,boolean,bigint) to anon, authenticated;
grant execute on function public.rematch_bakuretsu_reversi_room(text,text,bigint) to anon, authenticated;
grant execute on function public.delete_bakuretsu_reversi_room(text,text) to anon, authenticated;

notify pgrst, 'reload schema';
