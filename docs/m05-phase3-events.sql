-- ============================================================
-- M05 PHASE 3: events table
-- Supabase project: RogueStats (urhdjhwnzqkcswbquwpk)
-- Run in: https://supabase.com/dashboard/project/urhdjhwnzqkcswbquwpk/sql/new
-- ============================================================

CREATE TABLE public.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  event_type    text NOT NULL DEFAULT 'community'
                  CHECK (event_type IN ('community', 'workout', 'bible_study', 'game_night', 'other')),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  is_public     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_starts_at_idx ON public.events (starts_at);
CREATE INDEX events_is_public_idx ON public.events (is_public);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read public events
-- This is what the Landing page needs
CREATE POLICY "events_select_public"
  ON public.events FOR SELECT
  USING (is_public = true);

-- Authenticated members can read all events (including private)
CREATE POLICY "events_select_authenticated"
  ON public.events FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can create/update/delete events
CREATE POLICY "events_insert_admin"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "events_update_admin"
  ON public.events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "events_delete_admin"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed one test event so the Landing page calendar renders something real
INSERT INTO public.events (title, description, event_type, starts_at, ends_at, is_public)
VALUES (
  'Open Gym',
  'Come in, work hard, be present. All fitness levels welcome.',
  'workout',
  now() + interval '2 days',
  now() + interval '2 days' + interval '2 hours',
  true
);

-- ============================================================
-- Verify after running:
-- ============================================================
SELECT id, title, event_type, starts_at, is_public FROM public.events;

SELECT tablename, policyname, cmd
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events'
ORDER BY policyname;
-- Expected: 1 seed event row
-- Expected: 5 policies (2 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE)
