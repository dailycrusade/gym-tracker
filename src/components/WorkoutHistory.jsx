import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso));
}

function HistorySkeleton() {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
    >
      {[50, 70, 60, 80, 55].map((w, i) => (
        <div
          key={i}
          className="h-4 rounded animate-pulse"
          style={{ background: 'var(--color-mg-border)', width: `${w}%` }}
        />
      ))}
    </div>
  );
}

export default function WorkoutHistory({ athleteId }) {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!athleteId) { setLoading(false); return; }

    async function load() {
      const { data, error: dbErr } = await supabase
        .from('sugarwod_scores')
        .select('id, score, rx, notes, completed_at, sugarwod_wods(title)')
        .eq('sugarwod_athlete_id', athleteId)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (dbErr) {
        setError(dbErr.message);
      } else {
        setScores(data ?? []);
      }
      setLoading(false);
    }

    load();
  }, [athleteId]);

  if (loading) return <HistorySkeleton />;

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
    >
      <div className="px-5 py-4">
        <h2
          className="text-sm font-semibold tracking-wide uppercase"
          style={{ color: 'rgba(245,240,232,0.5)' }}
        >
          Workout History
        </h2>
      </div>

      {error ? (
        <div className="px-5 pb-5 text-sm" style={{ color: 'rgba(239,68,68,0.8)' }}>
          Could not load history: {error}
        </div>
      ) : !scores || scores.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-sm" style={{ color: 'var(--color-mg-teal)' }}>
            No workout history yet — time to get after it.
          </p>
        </div>
      ) : (
        <div
          className="divide-y"
          style={{ '--tw-divide-color': 'var(--color-mg-border)' }}
        >
          {scores.map((s) => (
            <div key={s.id} className="px-5 py-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--color-mg-cream)' }}
                  >
                    {s.sugarwod_wods?.title ?? 'Workout'}
                  </p>
                  {s.rx && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
                      style={{ background: 'var(--color-mg-teal)', color: 'var(--color-mg-black)' }}
                    >
                      RX
                    </span>
                  )}
                </div>
                {s.score && (
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(245,240,232,0.7)' }}>
                    {s.score}
                  </p>
                )}
                {s.notes && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(245,240,232,0.4)' }}>
                    {s.notes}
                  </p>
                )}
              </div>
              <p
                className="text-xs shrink-0 mt-0.5"
                style={{ color: 'rgba(245,240,232,0.4)' }}
              >
                {formatDate(s.completed_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
