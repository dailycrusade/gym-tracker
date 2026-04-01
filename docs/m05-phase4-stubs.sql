-- ============================================================
-- M05 PHASE 4: scenes, device_sessions, device_streams, device_claims
-- Supabase project: RogueStats (urhdjhwnzqkcswbquwpk)
-- Run in: https://supabase.com/dashboard/project/urhdjhwnzqkcswbquwpk/sql/new
-- Forward-laying stubs for M08, M09, M13 — no app code reads these yet
-- ============================================================

-- ── scenes (M13 — Lighting Scene Control) ──────────────────

CREATE TABLE public.scenes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  label         text NOT NULL,
  description   text,
  config        jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.scenes (name, label, description, config) VALUES
  ('workout',    'Workout',    'High energy, full brightness',        '{"zone1": "bright", "zone2": "energize", "zone3": "off"}'),
  ('movie',      'Movie',      'Dim ambient, bias lighting only',     '{"zone1": "dim", "zone2": "off", "zone3": "bias"}'),
  ('game_night', 'Game Night', 'Warm mid-level, all zones on',        '{"zone1": "warm", "zone2": "party", "zone3": "warm"}'),
  ('ftms',       'FTMS',       'Performance mode — data wall active', '{"zone1": "bright", "zone2": "ftms", "zone3": "off"}');

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenes_select_authenticated"
  ON public.scenes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "scenes_insert_admin"
  ON public.scenes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "scenes_update_admin"
  ON public.scenes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "scenes_delete_admin"
  ON public.scenes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── device_sessions (M08 — Persist FTMS Sessions) ──────────

CREATE TABLE public.device_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine     text NOT NULL CHECK (machine IN ('echo_bike', 'ski_erg', 'rower')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  claimed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_sessions_machine_idx    ON public.device_sessions (machine);
CREATE INDEX device_sessions_is_active_idx  ON public.device_sessions (is_active);
CREATE INDEX device_sessions_claimed_by_idx ON public.device_sessions (claimed_by);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sessions_select_authenticated"
  ON public.device_sessions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "device_sessions_insert_service"
  ON public.device_sessions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "device_sessions_update_service"
  ON public.device_sessions FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "device_sessions_update_admin"
  ON public.device_sessions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── device_streams (M08/M15 — Metric Rows) ─────────────────

CREATE TABLE public.device_streams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.device_sessions(id) ON DELETE CASCADE,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  watts           numeric,
  cadence         numeric,
  stroke_rate     numeric,
  distance_meters numeric,
  calories        numeric,
  elapsed_seconds integer
);

CREATE INDEX device_streams_session_id_idx  ON public.device_streams (session_id);
CREATE INDEX device_streams_recorded_at_idx ON public.device_streams (recorded_at);

ALTER TABLE public.device_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_streams_select_own"
  ON public.device_streams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.device_sessions
      WHERE id = device_streams.session_id AND claimed_by = auth.uid()
    )
  );

CREATE POLICY "device_streams_select_admin"
  ON public.device_streams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "device_streams_insert_service"
  ON public.device_streams FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── device_claims (M09 — Athlete Claims Session) ───────────

CREATE TABLE public.device_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.device_sessions(id) ON DELETE CASCADE,
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  UNIQUE (session_id, athlete_id)
);

CREATE INDEX device_claims_session_id_idx ON public.device_claims (session_id);
CREATE INDEX device_claims_athlete_id_idx ON public.device_claims (athlete_id);

ALTER TABLE public.device_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_claims_select_own"
  ON public.device_claims FOR SELECT
  USING (athlete_id = auth.uid());

CREATE POLICY "device_claims_insert_own"
  ON public.device_claims FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "device_claims_update_own"
  ON public.device_claims FOR UPDATE
  USING (athlete_id = auth.uid());

CREATE POLICY "device_claims_select_admin"
  ON public.device_claims FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Verify final state
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;

SELECT tablename, count(*) AS policy_count
FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename ORDER BY tablename;
