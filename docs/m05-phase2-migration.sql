-- ============================================================
-- M05 PHASE 2: Drop legacy tables, rebuild linked to auth.users
-- Supabase project: RogueStats (urhdjhwnzqkcswbquwpk)
-- Run in: https://supabase.com/dashboard/project/urhdjhwnzqkcswbquwpk/sql/new
-- ⚠️  This drops all existing data in athletes/workouts/workout_stats
-- ============================================================

-- Drop in FK-safe order
DROP TABLE IF EXISTS public.workout_stats CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.athletes CASCADE;

-- profiles: one row per Supabase Auth user
-- This is the primary identity table for the app
CREATE TABLE public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  membership_tier text CHECK (membership_tier IN ('founding', 'core', 'legacy')),
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- workouts: linked to auth.users via profiles
CREATE TABLE public.workouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine          text NOT NULL CHECK (machine IN ('echo_bike', 'ski_erg', 'rower')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer,
  cancelled        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workouts_athlete_id_idx ON public.workouts (athlete_id);
CREATE INDEX workouts_started_at_idx ON public.workouts (started_at);
CREATE INDEX workouts_ended_at_idx   ON public.workouts (ended_at);

-- workout_stats: summary stats per workout
CREATE TABLE public.workout_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id      uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  distance_meters numeric,
  avg_watts       numeric,
  max_watts       numeric,
  avg_cadence     numeric,
  calories        numeric,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workout_stats_workout_id_idx ON public.workout_stats (workout_id);

-- ============================================================
-- RLS — strict auth.uid() ownership
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- workouts
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts_select_own"
  ON public.workouts FOR SELECT
  USING (athlete_id = auth.uid());

CREATE POLICY "workouts_insert_own"
  ON public.workouts FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "workouts_update_own"
  ON public.workouts FOR UPDATE
  USING (athlete_id = auth.uid());

CREATE POLICY "workouts_select_admin"
  ON public.workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- workout_stats
ALTER TABLE public.workout_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_stats_select_own"
  ON public.workout_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE id = workout_stats.workout_id AND athlete_id = auth.uid()
    )
  );

CREATE POLICY "workout_stats_insert_own"
  ON public.workout_stats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE id = workout_stats.workout_id AND athlete_id = auth.uid()
    )
  );

CREATE POLICY "workout_stats_select_admin"
  ON public.workout_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Verify after running:
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
