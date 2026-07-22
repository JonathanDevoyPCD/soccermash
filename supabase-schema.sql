-- SuperRuck 2027 schema
-- Replaces the single-blob game_state table (SoccerSmash 2026) with normalized tables so that
-- concurrent edits from different players never overwrite each other: every player's prediction
-- on every match is its own row.

-- ---------------------------------------------------------------------------
-- Legacy table from SoccerSmash 2026. Left in place (not dropped) so the old data is recoverable;
-- safe to drop once SuperRuck 2027 is confirmed working.
-- ---------------------------------------------------------------------------
-- create table if not exists public.game_state ( ... )  -- see git history for full definition

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id bigint generated always as identity primary key,
  name text not null unique,
  email text unique,
  auth_uid uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;

-- Policies apply to both 'anon' and 'authenticated' roles: once a player signs in, supabase-js
-- sends requests as 'authenticated', so an anon-only policy would stop matching post-login.
drop policy if exists "Players are publicly readable" on public.players;
create policy "Players are publicly readable"
on public.players for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can add a player" on public.players;
create policy "Anyone can add a player"
on public.players for insert
to anon, authenticated
with check (true);

drop policy if exists "Anyone can edit a player" on public.players;
create policy "Anyone can edit a player"
on public.players for update
to anon, authenticated
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id bigint generated always as identity primary key,
  round text not null,             -- grouping used for both UI sections and the Grand Slam bonus:
                                    -- 'Pool Stage - Week 1/2/3', 'Round of 16', 'Quarter-Final',
                                    -- 'Semi-Final', 'Bronze Final', 'Final'
  pool text,                       -- 'A'..'F' for pool matches, null for knockout matches
  stage text not null,             -- 'pool' | 'knockout'
  home_team text not null,         -- placeholder text ('Winner Pool A') until knockout slots are known
  away_team text not null,
  venue text,
  kickoff_at timestamptz not null,
  home_score int,
  away_score int,
  status text not null default 'upcoming', -- 'upcoming' | 'live' | 'final'
  sort_order int not null unique
);

alter table public.matches enable row level security;

drop policy if exists "Matches are publicly readable" on public.matches;
create policy "Matches are publicly readable"
on public.matches for select
to anon, authenticated
using (true);

drop policy if exists "Admin can manage matches" on public.matches;
create policy "Admin can manage matches"
on public.matches for all
to anon, authenticated
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- predictions
-- ---------------------------------------------------------------------------
create table if not exists public.predictions (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  predicted_home_score int not null,
  predicted_away_score int not null,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table public.predictions enable row level security;

-- A player's own predictions are always visible to them. Other players' predictions on a match
-- only become visible once that match has kicked off (no copying picks pre-lock).
drop policy if exists "Predictions visible to owner or after kickoff" on public.predictions;
create policy "Predictions visible to owner or after kickoff"
on public.predictions for select
to anon, authenticated
using (
  exists (
    select 1 from public.players p
    where p.id = predictions.player_id and p.auth_uid = auth.uid()
  )
  or exists (
    select 1 from public.matches m
    where m.id = predictions.match_id and m.kickoff_at <= now()
  )
);

-- Insert/update only allowed for the authenticated owner of the player row, and only before kickoff.
drop policy if exists "Players can save their own predictions before kickoff" on public.predictions;
create policy "Players can save their own predictions before kickoff"
on public.predictions for insert
to authenticated
with check (
  exists (
    select 1 from public.players p
    where p.id = predictions.player_id and p.auth_uid = auth.uid()
  )
  and exists (
    select 1 from public.matches m
    where m.id = predictions.match_id and m.kickoff_at > now()
  )
);

drop policy if exists "Players can update their own predictions before kickoff" on public.predictions;
create policy "Players can update their own predictions before kickoff"
on public.predictions for update
to authenticated
using (
  exists (
    select 1 from public.players p
    where p.id = predictions.player_id and p.auth_uid = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.players p
    where p.id = predictions.player_id and p.auth_uid = auth.uid()
  )
  and exists (
    select 1 from public.matches m
    where m.id = predictions.match_id and m.kickoff_at > now()
  )
);

-- ---------------------------------------------------------------------------
-- Seed roster (existing SoccerSmash 2026 players, carried over)
-- ---------------------------------------------------------------------------
insert into public.players (name) values
  ('Jonathan'), ('Liam'), ('Mia'), ('Mags'), ('Kofi'), ('Ryan'), ('Indi'), ('Peter-David'),
  ('Coenraad'), ('Kelsey'), ('Calli'), ('Kim'), ('Christopher'), ('Karel'), ('Hannes'), ('Juliet'),
  ('Brit'), ('Dewald'), ('Nick'), ('Damian'), ('Simon'), ('Paul'), ('Gershwin'), ('Maddison'),
  ('Janus'), ('Jason'), ('Kyle')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Seed fixtures: Rugby World Cup 2027 (Australia, 1 Oct - 13 Nov 2027)
-- Pool stage teams/dates/venues/kickoff times are the published draw + schedule.
-- Round of 16 / Quarter-Final / Semi-Final / Bronze Final / Final entries use placeholder team
-- names until the real teams are known; admin fills these in via the match management UI as the
-- pool stage and knockout rounds conclude. Bronze Final / Final kickoff times are estimates
-- pending official confirmation.
-- ---------------------------------------------------------------------------
insert into public.matches (round, pool, stage, home_team, away_team, venue, kickoff_at, sort_order) values
  -- Pool stage, week 1
  ('Pool Stage - Week 1', 'A', 'pool', 'Australia', 'Hong Kong China', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-01 18:45'), 1),
  ('Pool Stage - Week 1', 'F', 'pool', 'Wales', 'Zimbabwe', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-02 12:15'), 2),
  ('Pool Stage - Week 1', 'A', 'pool', 'New Zealand', 'Chile', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-02 13:15'), 3),
  ('Pool Stage - Week 1', 'E', 'pool', 'France', 'USA', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-02 17:45'), 4),
  ('Pool Stage - Week 1', 'F', 'pool', 'England', 'Tonga', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-02 20:15'), 5),
  ('Pool Stage - Week 1', 'E', 'pool', 'Japan', 'Samoa', 'Newcastle Stadium, Newcastle', timezone('Australia/Sydney', '2027-10-03 12:15'), 6),
  ('Pool Stage - Week 1', 'B', 'pool', 'South Africa', 'Italy', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-03 14:15'), 7),
  ('Pool Stage - Week 1', 'D', 'pool', 'Scotland', 'Uruguay', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-03 17:15'), 8),
  ('Pool Stage - Week 1', 'B', 'pool', 'Georgia', 'Romania', 'North Queensland Stadium, Townsville', timezone('Australia/Brisbane', '2027-10-03 20:15'), 9),
  ('Pool Stage - Week 1', 'C', 'pool', 'Fiji', 'Spain', 'Newcastle Stadium, Newcastle', timezone('Australia/Sydney', '2027-10-04 14:15'), 10),
  ('Pool Stage - Week 1', 'D', 'pool', 'Ireland', 'Portugal', 'Sydney Football Stadium, Sydney', timezone('Australia/Sydney', '2027-10-04 17:15'), 11),
  ('Pool Stage - Week 1', 'C', 'pool', 'Argentina', 'Canada', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-04 18:45'), 12),

  -- Pool stage, week 2
  ('Pool Stage - Week 2', 'F', 'pool', 'Wales', 'Tonga', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-08 18:15'), 13),
  ('Pool Stage - Week 2', 'F', 'pool', 'England', 'Zimbabwe', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-08 20:15'), 14),
  ('Pool Stage - Week 2', 'E', 'pool', 'USA', 'Samoa', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-09 12:15'), 15),
  ('Pool Stage - Week 2', 'A', 'pool', 'New Zealand', 'Australia', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-10-09 17:10'), 16),
  ('Pool Stage - Week 2', 'E', 'pool', 'France', 'Japan', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-09 18:45'), 17),
  ('Pool Stage - Week 2', 'A', 'pool', 'Chile', 'Hong Kong China', 'North Queensland Stadium, Townsville', timezone('Australia/Brisbane', '2027-10-09 20:15'), 18),
  ('Pool Stage - Week 2', 'C', 'pool', 'Fiji', 'Canada', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-10 12:15'), 19),
  ('Pool Stage - Week 2', 'C', 'pool', 'Argentina', 'Spain', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-10 15:15'), 20),
  ('Pool Stage - Week 2', 'B', 'pool', 'South Africa', 'Georgia', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-10 16:45'), 21),
  ('Pool Stage - Week 2', 'D', 'pool', 'Ireland', 'Scotland', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-10 17:45'), 22),
  ('Pool Stage - Week 2', 'D', 'pool', 'Uruguay', 'Portugal', 'Newcastle Stadium, Newcastle', timezone('Australia/Sydney', '2027-10-11 17:15'), 23),
  ('Pool Stage - Week 2', 'B', 'pool', 'Italy', 'Romania', 'Sydney Football Stadium, Sydney', timezone('Australia/Sydney', '2027-10-11 19:45'), 24),

  -- Pool stage, week 3
  ('Pool Stage - Week 3', 'A', 'pool', 'New Zealand', 'Hong Kong China', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-15 17:15'), 25),
  ('Pool Stage - Week 3', 'E', 'pool', 'Japan', 'USA', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-15 20:00'), 26),
  ('Pool Stage - Week 3', 'F', 'pool', 'Tonga', 'Zimbabwe', 'North Queensland Stadium, Townsville', timezone('Australia/Brisbane', '2027-10-15 20:15'), 27),
  ('Pool Stage - Week 3', 'C', 'pool', 'Argentina', 'Fiji', 'Adelaide Oval, Adelaide', timezone('Australia/Adelaide', '2027-10-16 13:15'), 28),
  ('Pool Stage - Week 3', 'A', 'pool', 'Australia', 'Chile', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-16 15:10'), 29),
  ('Pool Stage - Week 3', 'F', 'pool', 'England', 'Wales', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-10-16 19:45'), 30),
  ('Pool Stage - Week 3', 'C', 'pool', 'Spain', 'Canada', 'North Queensland Stadium, Townsville', timezone('Australia/Brisbane', '2027-10-16 20:15'), 31),
  ('Pool Stage - Week 3', 'B', 'pool', 'Italy', 'Georgia', 'Newcastle Stadium, Newcastle', timezone('Australia/Sydney', '2027-10-17 12:15'), 32),
  ('Pool Stage - Week 3', 'D', 'pool', 'Ireland', 'Uruguay', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-17 14:45'), 33),
  ('Pool Stage - Week 3', 'D', 'pool', 'Scotland', 'Portugal', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-17 16:15'), 34),
  ('Pool Stage - Week 3', 'B', 'pool', 'South Africa', 'Romania', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-17 19:15'), 35),
  ('Pool Stage - Week 3', 'E', 'pool', 'France', 'Samoa', 'Sydney Football Stadium, Sydney', timezone('Australia/Sydney', '2027-10-17 19:45'), 36),

  -- Round of 16 (teams TBC until pool stage concludes)
  ('Round of 16', null, 'knockout', 'Runner-up Pool C', 'Runner-up Pool F', 'Sydney Football Stadium, Sydney', timezone('Australia/Sydney', '2027-10-23 14:15'), 37),
  ('Round of 16', null, 'knockout', 'Winner Pool A', 'Best 3rd-placed (Pools C/E/F)', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-23 15:45'), 38),
  ('Round of 16', null, 'knockout', 'Winner Pool E', 'Runner-up Pool D', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-23 19:15'), 39),
  ('Round of 16', null, 'knockout', 'Winner Pool B', 'Best 3rd-placed (Pools D/E/F)', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-23 18:45'), 40),
  ('Round of 16', null, 'knockout', 'Winner Pool C', 'Best 3rd-placed (Pools A/E/F)', 'Sydney Football Stadium, Sydney', timezone('Australia/Sydney', '2027-10-24 14:15'), 41),
  ('Round of 16', null, 'knockout', 'Winner Pool D', 'Best 3rd-placed (Pools B/E/F)', 'Docklands Stadium, Melbourne', timezone('Australia/Melbourne', '2027-10-24 16:45'), 42),
  ('Round of 16', null, 'knockout', 'Runner-up Pool A', 'Runner-up Pool E', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-24 18:15'), 43),
  ('Round of 16', null, 'knockout', 'Winner Pool F', 'Runner-up Pool B', 'Perth Stadium, Perth', timezone('Australia/Perth', '2027-10-24 18:45'), 44),

  -- Quarter-Finals
  ('Quarter-Final', null, 'knockout', 'Winner R16 Match 2', 'Winner R16 Match 4', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-10-30 16:45'), 45),
  ('Quarter-Final', null, 'knockout', 'Winner R16 Match 1', 'Winner R16 Match 3', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-30 18:45'), 46),
  ('Quarter-Final', null, 'knockout', 'Winner R16 Match 5', 'Winner R16 Match 6', 'Brisbane Stadium, Brisbane', timezone('Australia/Brisbane', '2027-10-31 16:00'), 47),
  ('Quarter-Final', null, 'knockout', 'Winner R16 Match 7', 'Winner R16 Match 8', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-10-31 20:00'), 48),

  -- Semi-Finals
  ('Semi-Final', null, 'knockout', 'Winner QF1', 'Winner QF2', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-11-05 20:00'), 49),
  ('Semi-Final', null, 'knockout', 'Winner QF3', 'Winner QF4', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-11-06 20:00'), 50),

  -- Bronze Final & Final (kickoff times are estimates pending official confirmation)
  ('Bronze Final', null, 'knockout', 'Loser Semi-Final 1', 'Loser Semi-Final 2', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-11-12 20:00'), 51),
  ('Final', null, 'knockout', 'Winner Semi-Final 1', 'Winner Semi-Final 2', 'Stadium Australia, Sydney', timezone('Australia/Sydney', '2027-11-13 20:00'), 52)
on conflict (sort_order) do nothing;
