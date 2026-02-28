const TZ = 'America/Chicago';

// Returns a YYYY-MM-DD string in America/Chicago for the given Date or ISO string.
function toLocalDateStr(dateOrIso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateOrIso));
}

// Returns the YYYY-MM-DD string for the day before the given YYYY-MM-DD string.
function prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Calculate the current streak for an athlete.
 *
 * A streak is consecutive calendar days (America/Chicago) with at least one
 * completed workout (has ended_at). If today has no workout, yesterday is
 * used as the anchor so a streak is not broken until midnight.
 *
 * @param {Array} workouts - workout objects with an ended_at field
 * @returns {number} current streak in days
 */
export function calculateCurrentStreak(workouts) {
  const completed = workouts.filter((w) => w.ended_at);
  if (completed.length === 0) return 0;

  const days = new Set(completed.map((w) => toLocalDateStr(w.ended_at)));

  const today = toLocalDateStr(new Date());
  // Allow one grace day: if no workout today yet, start from yesterday.
  let check = days.has(today) ? today : prevDateStr(today);

  if (!days.has(check)) return 0;

  let streak = 0;
  while (days.has(check)) {
    streak++;
    check = prevDateStr(check);
  }
  return streak;
}

/**
 * Calculate the all-time longest streak for an athlete.
 *
 * @param {Array} workouts - workout objects with an ended_at field
 * @returns {number} longest streak ever, in days
 */
export function calculateLongestStreak(workouts) {
  const completed = workouts.filter((w) => w.ended_at);
  if (completed.length === 0) return 0;

  const days = [...new Set(completed.map((w) => toLocalDateStr(w.ended_at)))].sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < days.length; i++) {
    // days[i] is consecutive to days[i-1] if its previous day equals days[i-1].
    if (prevDateStr(days[i]) === days[i - 1]) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}
