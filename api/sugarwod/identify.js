import { createServiceClient } from '../../src/lib/supabaseServer.js';
import { getAthleteByEmail } from '../../src/lib/sugarwod.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const email = user.email;
  if (!email) {
    return res.status(400).json({ error: 'User has no email' });
  }

  // Return early if already mapped
  const { data: profile } = await supabase
    .from('profiles')
    .select('sugarwod_athlete_id')
    .eq('id', user.id)
    .single();

  if (profile?.sugarwod_athlete_id) {
    return res.status(200).json({ matched: true, sugarwod_athlete_id: profile.sugarwod_athlete_id });
  }

  // Look up athlete in SugarWOD by email
  let athleteId;
  try {
    const data = await getAthleteByEmail(email);
    const raw = data?.data;
    athleteId = Array.isArray(raw) ? raw[0]?.id : raw?.id;
  } catch (err) {
    console.error('[sugarwod/identify] athlete lookup failed:', err.message);
    return res.status(200).json({ matched: false });
  }

  if (!athleteId) {
    return res.status(200).json({ matched: false });
  }

  await supabase
    .from('profiles')
    .update({ sugarwod_athlete_id: athleteId })
    .eq('id', user.id);

  return res.status(200).json({ matched: true, sugarwod_athlete_id: athleteId });
}
