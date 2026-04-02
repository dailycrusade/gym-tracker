-- Security fix: scope sugarwod_athletes and sugarwod_scores RLS policies
-- Fixes R-4 (HIGH) and R-5 (MEDIUM) from security audit.
--
-- Replaces the permissive "authenticated users can read *" policies with
-- member-scoped (own row only) + admin read-all policies on both tables.
--
-- ⚠️  Forward-looking requirement for score sync (future milestone):
-- Each sugarwod_scores row MUST have profile_id populated via the join:
--   sugarwod_scores.sugarwod_athlete_id
--     → sugarwod_athletes.id
--     → sugarwod_athletes.profile_id
-- Without profile_id set, the member-scoped policy returns 0 rows
-- (NULL = auth.uid() is FALSE in PostgreSQL).

-- ─── Drop permissive policies ─────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can read sugarwod athletes"
  ON public.sugarwod_athletes;

DROP POLICY IF EXISTS "authenticated users can read scores"
  ON public.sugarwod_scores;

-- ─── sugarwod_athletes ────────────────────────────────────────────────────

CREATE POLICY "sugarwod_athletes_select_own"
  ON public.sugarwod_athletes FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "sugarwod_athletes_select_admin"
  ON public.sugarwod_athletes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── sugarwod_scores ──────────────────────────────────────────────────────

CREATE POLICY "sugarwod_scores_select_own"
  ON public.sugarwod_scores FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "sugarwod_scores_select_admin"
  ON public.sugarwod_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
