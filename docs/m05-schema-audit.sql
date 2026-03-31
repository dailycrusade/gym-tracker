-- M05 Schema Audit — Miller's Garage / RogueStats
-- Project ID: urhdjhwnzqkcswbquwpk
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/urhdjhwnzqkcswbquwpk/sql/new
-- All queries are read-only (SELECT only).

-- ── Query 1 — All tables in public schema ──────────────────────────────────
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ── Query 2 — All columns for every table ──────────────────────────────────
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ── Query 3 — All primary keys and foreign keys ────────────────────────────
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name  AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- ── Query 4 — All indexes ──────────────────────────────────────────────────
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ── Query 5 — RLS status per table ────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ── Query 6 — All RLS policies ────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ── Query 7 — All triggers ────────────────────────────────────────────────
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ── Query 8 — Row counts for all public tables ────────────────────────────
SELECT
  relname             AS table_name,
  n_live_tup          AS estimated_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
