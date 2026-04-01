-- SugarWOD cache tables
-- Synced server-side via service_role; authenticated users can SELECT.

-- ─── sugarwod_wods ─────────────────────────────────────────────────────────
create table if not exists sugarwod_wods (
  id                 text        primary key,
  scheduled_date_int integer,
  scheduled_at       timestamptz,
  title              text,
  description        text,
  workout_type       text,
  raw_data           jsonb,
  synced_at          timestamptz default now()
);

alter table sugarwod_wods enable row level security;

create policy "authenticated users can read wods"
  on sugarwod_wods for select
  to authenticated
  using (true);

-- ─── sugarwod_athletes ─────────────────────────────────────────────────────
create table if not exists sugarwod_athletes (
  id         text        primary key,
  profile_id uuid        references profiles(id) on delete set null,
  first_name text,
  last_name  text,
  email      text,
  raw_data   jsonb,
  synced_at  timestamptz default now()
);

alter table sugarwod_athletes enable row level security;

create policy "authenticated users can read sugarwod athletes"
  on sugarwod_athletes for select
  to authenticated
  using (true);

-- ─── sugarwod_scores ───────────────────────────────────────────────────────
create table if not exists sugarwod_scores (
  id                   text        primary key,
  wod_id               text        references sugarwod_wods(id) on delete cascade,
  sugarwod_athlete_id  text,
  profile_id           uuid        references profiles(id) on delete set null,
  score                text,
  rx                   boolean,
  notes                text,
  completed_at         timestamptz,
  raw_data             jsonb,
  synced_at            timestamptz default now()
);

alter table sugarwod_scores enable row level security;

create policy "authenticated users can read scores"
  on sugarwod_scores for select
  to authenticated
  using (true);
