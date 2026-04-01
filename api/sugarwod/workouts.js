import { getWorkouts } from '../../src/lib/sugarwod.js';
import { createServiceClient } from '../../src/lib/supabaseServer.js';

const CACHE_TTL_MINUTES = 30;

function todayDateInt() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return Number(`${y}${m}${day}`);
}

function parseDateInt(dateStr) {
  const n = Number(dateStr);
  return isNaN(n) ? null : n;
}

function wodsFromCache(rows) {
  // Re-wrap cached rows to match the JSONAPI envelope callers expect
  return { data: rows.map((r) => r.raw_data) };
}

async function upsertWods(supabase, wods) {
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

  if (error) throw new Error(`Cache upsert failed: ${error.message}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dateInt = parseDateInt(req.query.date) ?? todayDateInt();
  const supabase = createServiceClient();

  // ── Check cache ──────────────────────────────────────────────────────────
  try {
    const staleAfter = new Date(Date.now() - CACHE_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: cached, error } = await supabase
      .from('sugarwod_wods')
      .select('raw_data, synced_at')
      .eq('scheduled_date_int', dateInt)
      .gt('synced_at', staleAfter);

    if (!error && cached && cached.length > 0) {
      return res.status(200).json({ ...wodsFromCache(cached), _source: 'cache' });
    }
  } catch (cacheErr) {
    // Cache check failure is non-fatal — fall through to live fetch
    console.warn('[sugarwod/workouts] cache check failed:', cacheErr.message);
  }

  // ── Live fetch ───────────────────────────────────────────────────────────
  try {
    const data = await getWorkouts(String(dateInt));

    // Fire-and-forget upsert so the response isn't delayed by a write failure
    const wods = data?.data ?? [];
    if (wods.length > 0) {
      upsertWods(supabase, wods).catch((err) =>
        console.error('[sugarwod/workouts] cache write failed:', err.message),
      );
    }

    res.status(200).json({ ...data, _source: 'sugarwod' });
  } catch (err) {
    console.error('[sugarwod/workouts]', err.message);
    res.status(502).json({ error: err.message });
  }
}
