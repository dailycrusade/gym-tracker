import { createClient } from '@supabase/supabase-js';

// Expected Supabase schema:
//
// athletes:     id (uuid pk), name (text), pin (text), created_at (timestamptz)
// workouts:     id (uuid pk), athlete_id (uuid → athletes.id), machine (text),
//               started_at (timestamptz), ended_at (timestamptz), duration_seconds (int)
// workout_stats: id (uuid pk), workout_id (uuid → workouts.id), distance_meters (numeric),
//               avg_watts (numeric), max_watts (numeric), avg_cadence (numeric), calories (numeric)
//
// Note: PINs are stored as plain text — suitable for a local gym kiosk where the
// anon key is already embedded in the client bundle. Add RLS or hashing if needed.

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
