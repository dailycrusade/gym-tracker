import { getWorkouts } from '../../src/lib/sugarwod.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date } = req.query;

  try {
    const data = await getWorkouts(date ?? null);
    res.status(200).json(data);
  } catch (err) {
    console.error('[sugarwod/workouts]', err.message);
    res.status(502).json({ error: err.message });
  }
}
