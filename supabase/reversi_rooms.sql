-- リバーシのオンライン対戦ルーム
-- Supabase ダッシュボード → SQL Editor → New query で、全文をそのまま実行してください。
-- 既存SQLへ追記せず、新しい空のクエリとして実行します。

create table if not exists public.reversi_rooms (
  room_code text primary key,
  host_id text not null,
  guest_id text,
  host_name text not null,
  guest_name text,
  game_state jsonb not null,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reversi_rooms_code_format check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$')
);

create index if not exists reversi_rooms_created_at_idx
  on public.reversi_rooms (created_at);

create or replace function public.set_reversi_rooms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reversi_rooms_updated_at on public.reversi_rooms;
create trigger set_reversi_rooms_updated_at
  before update on public.reversi_rooms
  for each row execute function public.set_reversi_rooms_updated_at();

alter table public.reversi_rooms enable row level security;

drop policy if exists "reversi rooms select" on public.reversi_rooms;
create policy "reversi rooms select" on public.reversi_rooms
  for select to anon, authenticated using (true);

drop policy if exists "reversi rooms insert" on public.reversi_rooms;
create policy "reversi rooms insert" on public.reversi_rooms
  for insert to anon, authenticated with check (true);

drop policy if exists "reversi rooms update" on public.reversi_rooms;
create policy "reversi rooms update" on public.reversi_rooms
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "reversi rooms delete" on public.reversi_rooms;
create policy "reversi rooms delete" on public.reversi_rooms
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.reversi_rooms to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reversi_rooms'
  ) then
    alter publication supabase_realtime add table public.reversi_rooms;
  end if;
end $$;
