-- 最弱王ババ抜き online rooms for Dragon Game Park.
-- Apply this in the Supabase SQL Editor, then enable Realtime for public.babanuki_rooms.

create table if not exists public.babanuki_rooms (
  room_code text primary key,
  player_count integer not null check (player_count between 3 and 6),
  host_id text not null,
  guest_id text,
  guest2_id text,
  guest3_id text,
  guest4_id text,
  guest5_id text,
  game_state jsonb not null,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint babanuki_rooms_room_code_length check (char_length(room_code) = 6)
);

create index if not exists babanuki_rooms_created_at_idx on public.babanuki_rooms (created_at);

create or replace function public.set_babanuki_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_babanuki_rooms_updated_at on public.babanuki_rooms;
create trigger set_babanuki_rooms_updated_at
before update on public.babanuki_rooms
for each row
execute function public.set_babanuki_rooms_updated_at();

alter table public.babanuki_rooms enable row level security;

drop policy if exists "babanuki rooms select" on public.babanuki_rooms;
create policy "babanuki rooms select"
on public.babanuki_rooms
for select
to anon, authenticated
using (true);

drop policy if exists "babanuki rooms insert" on public.babanuki_rooms;
create policy "babanuki rooms insert"
on public.babanuki_rooms
for insert
to anon, authenticated
with check (true);

drop policy if exists "babanuki rooms update" on public.babanuki_rooms;
create policy "babanuki rooms update"
on public.babanuki_rooms
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "babanuki rooms delete" on public.babanuki_rooms;
create policy "babanuki rooms delete"
on public.babanuki_rooms
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
      and tablename = 'babanuki_rooms'
  ) then
    alter publication supabase_realtime add table public.babanuki_rooms;
  end if;
end $$;
