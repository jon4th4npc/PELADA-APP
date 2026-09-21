-- SISTEMA DA PELADA
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Pelada',
  event_date date not null,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null check (stage in ('group','final')),
  round_order integer not null,
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  minutes integer not null default 8,
  seconds integer not null default 30,
  updated_by text,
  created_at timestamptz not null default now(),
  unique (tournament_id, stage, round_order)
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists idx_teams_tournament on public.teams(tournament_id);
create index if not exists idx_players_tournament on public.players(tournament_id);
create index if not exists idx_players_team on public.players(team_id);
create index if not exists idx_matches_tournament on public.matches(tournament_id);
create index if not exists idx_stats_tournament on public.player_match_stats(tournament_id);
create index if not exists idx_stats_match on public.player_match_stats(match_id);

-- Só estes quatro e-mails internos são administradores.
create or replace function public.is_pelada_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email','') = any (
    array[
      'jonathan@pelada.local',
      'julio@pelada.local',
      'caue@pelada.local',
      'edson@pelada.local'
    ]::text[]
  );
$$;

alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.player_match_stats enable row level security;

-- Leitura pública
drop policy if exists "public read tournaments" on public.tournaments;
create policy "public read tournaments" on public.tournaments for select using (true);

drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams for select using (true);

drop policy if exists "public read players" on public.players;
create policy "public read players" on public.players for select using (true);

drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches for select using (true);

drop policy if exists "public read stats" on public.player_match_stats;
create policy "public read stats" on public.player_match_stats for select using (true);

-- Escrita somente para os quatro admins
drop policy if exists "admin write tournaments insert" on public.tournaments;
create policy "admin write tournaments insert" on public.tournaments
for insert to authenticated with check (public.is_pelada_admin());

drop policy if exists "admin write tournaments update" on public.tournaments;
create policy "admin write tournaments update" on public.tournaments
for update to authenticated using (public.is_pelada_admin()) with check (public.is_pelada_admin());

drop policy if exists "admin write tournaments delete" on public.tournaments;
create policy "admin write tournaments delete" on public.tournaments
for delete to authenticated using (public.is_pelada_admin());

drop policy if exists "admin write teams insert" on public.teams;
create policy "admin write teams insert" on public.teams
for insert to authenticated with check (public.is_pelada_admin());

drop policy if exists "admin write teams update" on public.teams;
create policy "admin write teams update" on public.teams
for update to authenticated using (public.is_pelada_admin()) with check (public.is_pelada_admin());

drop policy if exists "admin write teams delete" on public.teams;
create policy "admin write teams delete" on public.teams
for delete to authenticated using (public.is_pelada_admin());

drop policy if exists "admin write players insert" on public.players;
create policy "admin write players insert" on public.players
for insert to authenticated with check (public.is_pelada_admin());

drop policy if exists "admin write players update" on public.players;
create policy "admin write players update" on public.players
for update to authenticated using (public.is_pelada_admin()) with check (public.is_pelada_admin());

drop policy if exists "admin write players delete" on public.players;
create policy "admin write players delete" on public.players
for delete to authenticated using (public.is_pelada_admin());

drop policy if exists "admin write matches insert" on public.matches;
create policy "admin write matches insert" on public.matches
for insert to authenticated with check (public.is_pelada_admin());

drop policy if exists "admin write matches update" on public.matches;
create policy "admin write matches update" on public.matches
for update to authenticated using (public.is_pelada_admin()) with check (public.is_pelada_admin());

drop policy if exists "admin write matches delete" on public.matches;
create policy "admin write matches delete" on public.matches
for delete to authenticated using (public.is_pelada_admin());

drop policy if exists "admin write stats insert" on public.player_match_stats;
create policy "admin write stats insert" on public.player_match_stats
for insert to authenticated with check (public.is_pelada_admin());

drop policy if exists "admin write stats update" on public.player_match_stats;
create policy "admin write stats update" on public.player_match_stats
for update to authenticated using (public.is_pelada_admin()) with check (public.is_pelada_admin());

drop policy if exists "admin write stats delete" on public.player_match_stats;
create policy "admin write stats delete" on public.player_match_stats
for delete to authenticated using (public.is_pelada_admin());
