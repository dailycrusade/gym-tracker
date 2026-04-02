import { useState, useEffect } from 'react';

function formatScheduledDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(d);
}

function WodSkeleton() {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
    >
      {[40, 60, 90].map((w, i) => (
        <div
          key={i}
          className="h-4 rounded animate-pulse"
          style={{ background: 'var(--color-mg-border)', width: `${w}%` }}
        />
      ))}
    </div>
  );
}

export default function TodaysWod() {
  const [wod, setWod] = useState(null);   // first WOD object, or false for "none"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    async function fetchWod() {
      try {
        const res = await fetch('/api/sugarwod/workouts');
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        const items = json?.data ?? [];
        setWod(items.length > 0 ? items[0] : false);
        setSource(json?._source ?? null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchWod();
  }, []);

  if (loading) return <WodSkeleton />;

  if (error) {
    return (
      <div
        className="rounded-2xl border p-5 text-sm"
        style={{
          background: 'var(--color-mg-surface)',
          borderColor: 'rgba(239,68,68,0.3)',
          color: 'rgba(239,68,68,0.8)',
        }}
      >
        Could not load today's workout: {error}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-sm font-semibold tracking-wide uppercase"
          style={{ color: 'rgba(245,240,232,0.5)' }}
        >
          Today's Workout
        </h2>

        {import.meta.env.DEV && source && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{ borderColor: 'var(--color-mg-border)', color: 'rgba(245,240,232,0.3)' }}
          >
            {source}
          </span>
        )}
      </div>

      {wod === false ? (
        <p className="text-sm" style={{ color: 'var(--color-mg-teal)' }}>
          No workout programmed for today — check back soon.
        </p>
        <p className="text-xs mt-2" style={{ color: 'rgba(245,240,232,0.35)' }}>
          Workouts are programmed via SugarWOD. Make sure your account is linked.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Title + type badge */}
          <div className="flex items-start gap-3 flex-wrap">
            <p
              className="text-lg font-bold leading-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-mg-cream)' }}
            >
              {wod.attributes?.title ?? 'Workout'}
            </p>
            {wod.attributes?.workout_type && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 mt-0.5"
                style={{ background: 'var(--color-mg-purple)', color: 'white' }}
              >
                {wod.attributes.workout_type}
              </span>
            )}
          </div>

          {/* Description */}
          {wod.attributes?.description && (
            <p
              className="text-sm whitespace-pre-line leading-relaxed"
              style={{ color: 'rgba(245,240,232,0.75)' }}
            >
              {wod.attributes.description}
            </p>
          )}

          {/* Scheduled date */}
          {wod.attributes?.scheduled_at && (
            <p className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>
              {formatScheduledDate(wod.attributes.scheduled_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
