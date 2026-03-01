import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { machineName } from '../lib/utils';
import { calculateCurrentStreak, calculateLongestStreak } from '../lib/streaks';
import Footer from './Footer';

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
];

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
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTimeOfDay(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-6 h-6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
        a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
        A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
        l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
        A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
        l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
        a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
        l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
        a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

// ── PIN helpers (used in the edit modal) ──────────────────────────────────────

function PinDots({ filled }) {
  return (
    <div className="flex gap-5 justify-center my-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`w-6 h-6 rounded-full border-2 transition-all ${
          i < filled ? 'bg-white border-white' : 'bg-transparent border-gray-500'
        }`} />
      ))}
    </div>
  );
}

function PinKeypad({ onDigit, onBackspace }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((key, i) =>
        key === '' ? <div key={i} /> : (
          <button key={i}
            onClick={() => key === '⌫' ? onBackspace() : onDigit(key)}
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-3xl font-bold py-5 rounded-2xl transition-all select-none"
          >
            {key}
          </button>
        )
      )}
    </div>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({ athlete, onDone, onCancel, onLogout }) {
  const [name, setName] = useState(athlete.name);
  const [color, setColor] = useState(athlete.color ?? '#3b82f6');
  const [deleteStep, setDeleteStep] = useState('idle'); // 'idle' | 'confirmPin'
  const [deletePin, setDeletePin] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name cannot be empty.'); return; }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('athletes')
      .update({ name: trimmed, color })
      .eq('id', athlete.id)
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onDone(data);
  }

  function handleDeletePinDigit(digit) {
    if (deletePin.length >= 4) return;
    const next = deletePin + digit;
    setDeletePin(next);
    if (next.length === 4) setTimeout(() => confirmDelete(next), 120);
  }

  async function confirmDelete(entered) {
    if (entered !== athlete.pin) {
      setError('Wrong PIN — try again');
      setDeletePin('');
      return;
    }
    setSaving(true);
    await supabase.from('athletes').delete().eq('id', athlete.id);
    onLogout();
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-start justify-center sm:p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md flex flex-col gap-5 sm:gap-6 p-6 sm:p-8 sm:my-8">

        {/* Title + close */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
          <button onClick={onCancel}
            className="text-gray-500 hover:text-white text-xl leading-none transition-colors p-1">
            ✕
          </button>
        </div>

        {error && <p className="text-red-400 text-lg font-medium">{error}</p>}

        {/* Name */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-400 text-sm uppercase tracking-widest font-semibold">
            Name
          </label>
          <input
            className="bg-gray-800 text-white text-2xl px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
          />
        </div>

        {/* Color palette */}
        <div className="flex flex-col gap-3">
          <label className="text-gray-400 text-sm uppercase tracking-widest font-semibold">
            Color
          </label>
          <div className="grid grid-cols-6 gap-3">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className="w-12 h-12 rounded-xl active:scale-90 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c
                    ? `0 0 0 3px #111827, 0 0 0 5px ${c}`
                    : 'none',
                }}
                aria-label={c}
              >
                {color === c && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-700 hover:bg-blue-600 active:scale-95 disabled:opacity-50 text-white text-xl font-bold py-5 rounded-2xl transition-all">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Danger zone */}
        <div className="border-t border-gray-700 pt-6 flex flex-col gap-4">
          <p className="text-red-500 text-sm uppercase tracking-widest font-bold">
            Danger Zone
          </p>

          {deleteStep === 'idle' ? (
            <button
              onClick={() => { setDeleteStep('confirmPin'); setDeletePin(''); setError(null); }}
              className="border border-red-900 hover:bg-red-950 active:scale-95 text-red-400 text-xl font-semibold py-5 rounded-2xl transition-all"
            >
              Delete Account
            </button>
          ) : (
            <div className="flex flex-col gap-4 items-center">
              <p className="text-gray-300 text-lg text-center">
                Enter your PIN to confirm. This cannot be undone.
              </p>
              <PinDots filled={deletePin.length} />
              <PinKeypad
                onDigit={handleDeletePinDigit}
                onBackspace={() => { setDeletePin((p) => p.slice(0, -1)); setError(null); }}
              />
              <button
                onClick={() => { setDeleteStep('idle'); setDeletePin(''); setError(null); }}
                className="text-gray-500 hover:text-gray-300 text-lg transition-colors mt-1"
              >
                ← Cancel delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-5 flex flex-col items-center gap-1 overflow-hidden relative">
      {/* Colored top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: color }} />
      <span className="text-gray-400 text-sm uppercase tracking-widest font-semibold mt-1">
        {label}
      </span>
      <span className="text-white text-3xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-gray-500 text-sm">{sub}</span>}
    </div>
  );
}

function WorkoutCard({ workout, color, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const stats = workout.workout_stats?.[0];
  const label = machineName(workout.machine);
  const badgeStyle =
    workout.machine === 'ski_erg'
      ? 'bg-violet-900 text-violet-300'
      : 'bg-blue-900 text-blue-300';

  return (
    <>
      <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-3"
        style={{ borderLeft: `4px solid ${color}` }}>
        {/* Machine + date + delete row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className={`text-lg font-bold px-3 py-1 rounded-lg ${badgeStyle}`}>
            {label}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-base">
              {formatDate(workout.started_at)} at {formatTimeOfDay(workout.started_at)}
            </span>
            <button onClick={() => setConfirming(true)}
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
              aria-label="Delete workout">
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
          {stats?.avg_hr != null && (
            <Stat label="❤ Avg HR" value={`${stats.avg_hr} bpm`} />
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
              <button onClick={() => setConfirming(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-xl font-semibold py-5 rounded-2xl transition-all">
                Cancel
              </button>
              <button onClick={() => { setConfirming(false); onDelete(workout.id); }}
                className="flex-1 bg-red-700 hover:bg-red-600 active:scale-95 text-white text-xl font-semibold py-5 rounded-2xl transition-all">
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

export default function AthleteDashboard({ athlete, onAthleteUpdate, onStartWorkout, onLogout }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const color = athlete.color ?? '#3b82f6';

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
  const currentStreak = useMemo(() => calculateCurrentStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => calculateLongestStreak(workouts), [workouts]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-4 sm:p-6 lg:p-8 gap-4 sm:gap-6">

      {/* ── Edit Profile Modal ── */}
      {showEdit && (
        <EditProfileModal
          athlete={athlete}
          onDone={(updated) => { onAthleteUpdate(updated); setShowEdit(false); }}
          onCancel={() => setShowEdit(false)}
          onLogout={onLogout}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-gray-500 text-base sm:text-lg tracking-wide">Gym Tracker</p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight" style={{ color }}>
              {athlete.name}
            </h1>
            <button
              onClick={() => setShowEdit(true)}
              className="text-gray-600 hover:text-gray-400 active:scale-95 transition-all p-1"
              aria-label="Edit profile"
            >
              <GearIcon />
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-0 sm:pt-1">
          <button
            onClick={onStartWorkout}
            className="w-full sm:w-auto bg-green-700 hover:bg-green-600 active:scale-95 text-white text-xl sm:text-2xl font-bold py-4 px-6 sm:px-10 rounded-2xl transition-all shadow-xl min-h-[44px]"
          >
            Start Workout →
          </button>
          <div className="flex gap-3 justify-center sm:justify-start">
            <Link
              to="/leaderboard"
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-base sm:text-lg font-medium py-3 px-4 sm:px-5 rounded-xl transition-all min-h-[44px] flex items-center"
            >
              Leaderboard
            </Link>
            <button
              onClick={onLogout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-base sm:text-lg font-medium py-3 px-4 sm:px-5 rounded-xl transition-all min-h-[44px]"
            >
              Logout
            </button>
          </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <StatTile label="Workouts" value={totalWorkouts} color={color} />
              <StatTile label="Distance" value={formatDistance(totalDistance)} color={color} />
              <StatTile label="Total Time" value={formatTotalTime(totalSeconds)} color={color} />
              <StatTile label="Best Power" value={bestPower > 0 ? `${bestPower} W` : '—'} color={color} />
              <StatTile
                label="Current Streak"
                value={currentStreak === 0 ? 'Start today!' : `🔥 ${currentStreak}`}
                sub={currentStreak > 0 ? 'days' : undefined}
                color={color}
              />
              <StatTile
                label="Best Streak"
                value={longestStreak === 0 ? '—' : `⭐ ${longestStreak}`}
                sub={longestStreak > 0 ? 'days' : undefined}
                color={color}
              />
            </div>
          )}

          {/* ── Workout history ── */}
          <div className="flex flex-col gap-3 max-w-4xl w-full lg:mx-auto">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-300">Workout History</h2>

            {workouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-3">
                <p className="text-2xl sm:text-4xl font-bold text-gray-600">No workouts yet</p>
                <p className="text-lg sm:text-xl text-gray-600">Hit Start Workout to get going!</p>
              </div>
            ) : (
              workouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} color={color} onDelete={handleDelete} />
              ))
            )}
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
