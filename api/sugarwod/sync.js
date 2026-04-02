import { getWorkouts, getAthletes } from '../../src/lib/sugarwod.js';
import { createServiceClient } from '../../src/lib/supabaseServer.js';

async function upsertWods(supabase, wods) {
  if (!wods.length) return 0;

  const rows = wods.map((w) => {
    const attrs = w.attributes ?? {};
    return {
      id: w.id,
      scheduled_date_int: attrs.scheduled_date_int ?? null,
      scheduled_at: attrs.scheduled_at ?? null,
      title: attrs.title ?? null,
      description: attrs.description ?? null,
      workout_type: attrs.workout_type ?? null,
      raw_data: w,
      synced_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('sugarwod_wods')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw new Error(`wods upsert: ${error.message}`);
  return rows.length;
}

async function upsertAthletes(supabase, athletes) {
  if (!athletes.length) return 0;

  const rows = athletes.map((a) => {
    const attrs = a.attributes ?? {};
    return {
      id: a.id,
      profile_id: null,
      first_name: attrs.first_name ?? null,
      last_name: attrs.last_name ?? null,
      email: attrs.email ?? null,
      raw_data: a,
      synced_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('sugarwod_athletes')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw new Error(`athletes upsert: ${error.message}`);
  return rows.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const supabase = createServiceClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const summary = { wods: 0, athletes: 0, errors: [] };

  try {
    const wodData = await getWorkouts();
    const wods = wodData?.data ?? [];
    summary.wods = await upsertWods(supabase, wods);
  } catch (err) {
    console.error('[sugarwod/sync] wods failed:', err.message);
    summary.errors.push(`wods: ${err.message}`);
  }

  try {
    const athleteData = await getAthletes();
    const athletes = athleteData?.data ?? [];
    summary.athletes = await upsertAthletes(supabase, athletes);
  } catch (err) {
    console.error('[sugarwod/sync] athletes failed:', err.message);
    summary.errors.push(`athletes: ${err.message}`);
  }

  const status = summary.errors.length > 0 ? 207 : 200;
  res.status(status).json({ synced: summary });
}
