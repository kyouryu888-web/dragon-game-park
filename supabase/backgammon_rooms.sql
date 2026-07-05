-- バックギャモンのオンライン対戦ルーム
-- Supabase ダッシュボード → SQL Editor で全文をそのまま実行してください（既存の内容は消さず、新規クエリとして実行）

create table if not exists public.backgammon_rooms (
  room_code text primary key,
  player_count integer not null default 2 check (player_count = 2),
  host_id text not null,
  guest_id text,
  game_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint backgammon_rooms_code_length check (char_length(room_code) = 6)
);

create index if not exists backgammon_rooms_created_at_idx on public.backgammon_rooms (created_at);

create or replace function public.set_backgammon_rooms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_backgammon_rooms_updated_at on public.backgammon_rooms;
create trigger set_backgammon_rooms_updated_at
  before update on public.backgammon_rooms
  for each row execute function public.set_backgammon_rooms_updated_at();

alter table public.backgammon_rooms enable row level security;

drop policy if exists "backgammon rooms select" on public.backgammon_rooms;
create policy "backgammon rooms select" on public.backgammon_rooms
  for select to anon, authenticated using (true);

drop policy if exists "backgammon rooms insert" on public.backgammon_rooms;
create policy "backgammon rooms insert" on public.backgammon_rooms
  for insert to anon, authenticated with check (true);

drop policy if exists "backgammon rooms update" on public.backgammon_rooms;
create policy "backgammon rooms update" on public.backgammon_rooms
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "backgammon rooms delete" on public.backgammon_rooms;
create policy "backgammon rooms delete" on public.backgammon_rooms
  for delete to anon, authenticated using (true);

-- Realtime を有効化（既に追加済みの場合はエラーになるが無視してよい）
alter publication supabase_realtime add table public.backgammon_rooms;
