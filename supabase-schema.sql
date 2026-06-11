create table if not exists public.game_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_state enable row level security;

drop policy if exists "Public can read game state" on public.game_state;
create policy "Public can read game state"
on public.game_state
for select
to anon
using (id = 'main');

drop policy if exists "Public can insert game state" on public.game_state;
create policy "Public can insert game state"
on public.game_state
for insert
to anon
with check (id = 'main');

drop policy if exists "Public can update game state" on public.game_state;
create policy "Public can update game state"
on public.game_state
for update
to anon
using (id = 'main')
with check (id = 'main');
