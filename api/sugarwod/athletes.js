import { getAthletes } from '../../src/lib/sugarwod.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await getAthletes();
    res.status(200).json(data);
  } catch (err) {
    console.error('[sugarwod/athletes]', err.message);
    res.status(502).json({ error: err.message });
  }
}
