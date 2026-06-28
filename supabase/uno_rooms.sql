-- UNO online rooms for Dragon Game Park.
-- Apply this in the Supabase SQL Editor, then enable Realtime for public.uno_rooms.

create table if not exists public.uno_rooms (
  room_code text primary key,
  variant text not null check (variant in ('standard', 'hard')),
  player_count integer not null check (player_count between 2 and 10),
  host_id text not null,
  guest_id text,
  guest2_id text,
  guest3_id text,
  guest4_id text,
  guest5_id text,
  guest6_id text,
  guest7_id text,
  guest8_id text,
  guest9_id text,
  game_state jsonb not null,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uno_rooms_room_code_length check (char_length(room_code) = 6)
);

create index if not exists uno_rooms_created_at_idx on public.uno_rooms (created_at);

create or replace function public.set_uno_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_uno_rooms_updated_at on public.uno_rooms;
create trigger set_uno_rooms_updated_at
before update on public.uno_rooms
for each row
execute function public.set_uno_rooms_updated_at();

alter table public.uno_rooms enable row level security;

drop policy if exists "uno rooms select" on public.uno_rooms;
create policy "uno rooms select"
on public.uno_rooms
for select
to anon, authenticated
using (true);

drop policy if exists "uno rooms insert" on public.uno_rooms;
create policy "uno rooms insert"
on public.uno_rooms
for insert
to anon, authenticated
with check (true);

drop policy if exists "uno rooms update" on public.uno_rooms;
create policy "uno rooms update"
on public.uno_rooms
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "uno rooms delete" on public.uno_rooms;
create policy "uno rooms delete"
on public.uno_rooms
for delete
to anon, authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'uno_rooms'
  ) then
    alter publication supabase_realtime add table public.uno_rooms;
  end if;
end $$;
