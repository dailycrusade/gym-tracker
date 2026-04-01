const SUGARWOD_BASE = 'https://api.sugarwod.com/v2';

function getApiKey() {
  const key = process.env.SUGARWOD_API_KEY;
  if (!key) throw new Error('SUGARWOD_API_KEY is not set');
  return key;
}

export async function sugarwodFetch(path) {
  const url = `${SUGARWOD_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getApiKey(),
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SugarWOD ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

export function getBox() {
  return sugarwodFetch('/box');
}

export function getAthletes() {
  return sugarwodFetch('/athletes');
}

export function getAthleteByEmail(email) {
  return sugarwodFetch(`/athletes/find?email=${encodeURIComponent(email)}`);
}

export function getWorkouts(dateInt) {
  const date = dateInt ?? todayDateInt();
  return sugarwodFetch(`/workouts?dates=${date}`);
}

export function getWorkoutScores(workoutId) {
  return sugarwodFetch(`/workouts/${workoutId}/scores`);
}

export function getAthleteScores(athleteId) {
  return sugarwodFetch(`/athletes/${athleteId}/scores`);
}

function todayDateInt() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
