-- RowTrack Database Schema
-- Voer dit volledige script uit in de Supabase SQL Editor.

-- =============================================================================
-- 1. TABELLEN
-- =============================================================================

-- Profiles: gekoppeld aan Supabase Auth
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Workouts: voltooide roeiworkouts
create table public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles on delete cascade,
  started_at        timestamptz not null default now(),
  duration_seconds  integer not null default 0,
  distance_meters   integer not null default 0,
  avg_watts         smallint,
  avg_spm           smallint,
  avg_split_seconds real,
  calories          smallint,
  max_watts         smallint,
  best_split        real,
  avg_heart_rate    smallint,
  max_heart_rate    smallint,
  resistance_level  smallint,
  notes             text,
  goal_type         text check (goal_type in ('duration', 'distance', 'split', 'watts')),
  goal_target       real,
  goal_reached      boolean,
  splits            jsonb,
  created_at        timestamptz not null default now(),
  constraint workouts_goal_consistency check (
    (goal_type is null and goal_target is null and goal_reached is null)
    or
    (goal_type is not null and goal_target is not null and goal_reached is not null)
  )
);

-- Workout intervals: intervallen binnen een workout
create table public.workout_intervals (
  id                uuid primary key default gen_random_uuid(),
  workout_id        uuid not null references public.workouts on delete cascade,
  interval_number   smallint not null,
  duration_seconds  integer not null default 0,
  distance_meters   integer not null default 0,
  avg_watts         smallint,
  avg_spm           smallint,
  avg_split_seconds real,
  is_rest           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- 2. INDEXEN
-- =============================================================================

create index workouts_user_id_idx on public.workouts (user_id);
create index workouts_started_at_idx on public.workouts (started_at desc);
create index workout_intervals_workout_id_idx on public.workout_intervals (workout_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_intervals enable row level security;

-- Profiles: gebruiker ziet en bewerkt alleen eigen profiel
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Workouts: volledige CRUD op eigen workouts
create policy "Users can view own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- Workout intervals: toegang via workout ownership
create policy "Users can view own intervals"
  on public.workout_intervals for select
  using (
    exists (
      select 1 from public.workouts
      where workouts.id = workout_intervals.workout_id
        and workouts.user_id = auth.uid()
    )
  );

create policy "Users can insert own intervals"
  on public.workout_intervals for insert
  with check (
    exists (
      select 1 from public.workouts
      where workouts.id = workout_intervals.workout_id
        and workouts.user_id = auth.uid()
    )
  );

create policy "Users can delete own intervals"
  on public.workout_intervals for delete
  using (
    exists (
      select 1 from public.workouts
      where workouts.id = workout_intervals.workout_id
        and workouts.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. FUNCTIES & TRIGGERS
-- =============================================================================

-- Automatisch profiel aanmaken bij nieuwe gebruiker
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Automatisch updated_at bijwerken
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();
