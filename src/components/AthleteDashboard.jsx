import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { machineName } from '../lib/utils';
import Footer from './Footer';

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatTotalTime(totalSeconds) {
  if (totalSeconds <= 0) return '—';
  if (totalSeconds >= 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return formatDuration(totalSeconds);
}

function formatDistance(meters) {
  if (meters == null || meters === 0) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeOfDay(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-5 flex flex-col items-center gap-1">
      <span className="text-gray-400 text-sm uppercase tracking-widest font-semibold">
        {label}
      </span>
      <span className="text-white text-3xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function WorkoutCard({ workout, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const stats = workout.workout_stats?.[0];
  const label = machineName(workout.machine);
  const badgeStyle =
    workout.machine === 'ski_erg'
      ? 'bg-violet-900 text-violet-300'
      : 'bg-blue-900 text-blue-300';

  return (
    <>
      <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-3">
        {/* Machine + date + delete row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className={`text-lg font-bold px-3 py-1 rounded-lg ${badgeStyle}`}>
            {label}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-base">
              {formatDate(workout.started_at)} at {formatTimeOfDay(workout.started_at)}
            </span>
            <button
              onClick={() => setConfirming(true)}
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
              aria-label="Delete workout"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-lg">
          <Stat label="Duration" value={formatDuration(workout.duration_seconds)} />
          {stats?.distance_meters != null && (
            <Stat label="Distance" value={formatDistance(stats.distance_meters)} />
          )}
          {stats?.calories != null && (
            <Stat label="Calories" value={`${stats.calories} kcal`} />
          )}
          {stats?.avg_watts != null && (
            <Stat label="Avg power" value={`${stats.avg_watts} W`} />
          )}
          {stats?.max_watts != null && (
            <Stat label="Max power" value={`${stats.max_watts} W`} />
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 rounded-2xl p-8 flex flex-col gap-6 w-full max-w-sm">
            <p className="text-2xl font-bold text-white">Delete workout?</p>
            <p className="text-gray-400 text-lg">
              {label} — {formatDate(workout.started_at)}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-xl font-semibold py-5 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirming(false); onDelete(workout.id); }}
                className="flex-1 bg-red-700 hover:bg-red-600 active:scale-95 text-white text-xl font-semibold py-5 rounded-2xl transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }) {
  return (
    <span className="text-gray-300">
      <span className="text-gray-500 text-base mr-1">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AthleteDashboard({ athlete, onStartWorkout, onLogout }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkouts() {
      setLoading(true);
      const { data } = await supabase
        .from('workouts')
        .select('*, workout_stats(*)')
        .eq('athlete_id', athlete.id)
        .order('started_at', { ascending: false });
      setWorkouts(data ?? []);
      setLoading(false);
    }
    fetchWorkouts();
  }, [athlete.id]);

  async function handleDelete(id) {
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }

  // Aggregate summary stats
  const totalWorkouts = workouts.length;
  const totalDistance = workouts.reduce((sum, w) => {
    const d = w.workout_stats?.[0]?.distance_meters;
    return d != null ? sum + Number(d) : sum;
  }, 0);
  const totalSeconds = workouts.reduce((sum, w) => sum + (w.duration_seconds ?? 0), 0);
  const bestPower = workouts.reduce((best, w) => {
    const p = w.workout_stats?.[0]?.max_watts;
    return p != null && Number(p) > best ? Number(p) : best;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-8 gap-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-gray-500 text-lg tracking-wide">Gym Tracker</p>
          <h1 className="text-5xl font-bold tracking-tight mt-1">{athlete.name}</h1>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onStartWorkout}
            className="bg-green-700 hover:bg-green-600 active:scale-95 text-white text-2xl font-bold py-4 px-10 rounded-2xl transition-all shadow-xl"
          >
            Start Workout →
          </button>
          <button
            onClick={onLogout}
            className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-lg font-medium py-3 px-5 rounded-xl transition-all"
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-2xl text-gray-500">
          Loading…
        </div>
      ) : (
        <>
          {/* ── Summary stats ── */}
          {totalWorkouts > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Workouts" value={totalWorkouts} />
              <StatTile label="Distance" value={formatDistance(totalDistance)} />
              <StatTile label="Total Time" value={formatTotalTime(totalSeconds)} />
              <StatTile label="Best Power" value={bestPower > 0 ? `${bestPower} W` : '—'} />
            </div>
          )}

          {/* ── Workout history ── */}
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-gray-300">Workout History</h2>

            {workouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <p className="text-4xl font-bold text-gray-600">No workouts yet</p>
                <p className="text-xl text-gray-600">Hit Start Workout to get going!</p>
              </div>
            ) : (
              workouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
              ))
            )}
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
