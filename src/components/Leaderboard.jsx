import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { machineName } from '../lib/utils';
import { calculateCurrentStreak, calculateLongestStreak } from '../lib/streaks';
import Footer from './Footer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStartDate(period) {
  const now = new Date();
  if (period === 'week') {
    const daysToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null; // all time
}

function fmtDistance(meters) {
  if (!meters) return '0.00 km';
  return `${(meters / 1000).toFixed(2)} km`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function fmtTime(totalSeconds) {
  if (!totalSeconds) return '—';
  if (totalSeconds >= 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RANK_STYLES = {
  1: 'bg-yellow-500 text-yellow-950',
  2: 'bg-gray-400 text-gray-900',
  3: 'bg-orange-700 text-orange-100',
};

function Rank({ n }) {
  const style = RANK_STYLES[n];
  if (style) {
    return (
      <span className={`${style} w-9 h-9 rounded-full flex items-center justify-center text-base font-black shrink-0`}>
        {n}
      </span>
    );
  }
  return (
    <span className="text-gray-600 w-9 text-center text-xl font-bold tabular-nums shrink-0">
      {n}
    </span>
  );
}

function AthleteName({ athlete }) {
  return (
    <span
      className="text-2xl font-bold truncate"
      style={{ color: athlete?.color ?? '#3b82f6' }}
    >
      {athlete?.name ?? '—'}
    </span>
  );
}

function SectionDivider({ title }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 shrink-0">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

function EmptyRows() {
  return (
    <p className="text-gray-700 text-xl py-6 text-center">No data yet</p>
  );
}

function TabBar({ options, value, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 px-3 rounded-lg text-base font-semibold transition-all ${
            value === opt.value
              ? 'bg-gray-700 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Leaderboard rows ──────────────────────────────────────────────────────────

function RowShell({ children }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-800/60 last:border-0">
      {children}
    </div>
  );
}

function DistanceRow({ entry, rank }) {
  return (
    <RowShell>
      <Rank n={rank} />
      <AthleteName athlete={entry.athlete} />
      <span className="ml-auto text-2xl font-semibold tabular-nums text-white shrink-0">
        {fmtDistance(entry.total)}
      </span>
    </RowShell>
  );
}

function PowerRow({ entry, rank, showMachine }) {
  return (
    <RowShell>
      <Rank n={rank} />
      <AthleteName athlete={entry.athlete} />
      {showMachine && (
        <span className="text-gray-600 text-base shrink-0">
          {machineName(entry.machine)}
        </span>
      )}
      <span className="ml-auto text-2xl font-semibold tabular-nums text-white shrink-0">
        {entry.watts} W
      </span>
    </RowShell>
  );
}

function StreakRow({ entry, rank }) {
  return (
    <RowShell>
      <Rank n={rank} />
      <AthleteName athlete={entry.athlete} />
      <div className="ml-auto flex flex-col items-end shrink-0">
        <span className="text-2xl font-semibold tabular-nums text-white">
          {entry.current} days
        </span>
        <span className="text-gray-500 text-sm tabular-nums">
          Best: {entry.longest}
        </span>
      </div>
    </RowShell>
  );
}

function PeakPowerRow({ entry, rank, showMachine }) {
  return (
    <RowShell>
      <Rank n={rank} />
      <AthleteName athlete={entry.athlete} />
      <div className="ml-auto flex flex-col items-end shrink-0">
        <span className="text-2xl font-semibold tabular-nums text-white">
          {entry.watts} W
        </span>
        <span className="text-gray-500 text-sm">
          {showMachine ? `${machineName(entry.machine)} · ` : ''}{fmtDate(entry.date)}
        </span>
      </div>
    </RowShell>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PERIOD_TABS = [
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time' },
];

const MACHINE_TABS = [
  { value: 'all',       label: 'All' },
  { value: 'echo_bike', label: 'Echo Bike' },
  { value: 'ski_erg',   label: 'Ski Erg' },
];

export default function Leaderboard() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('week');
  const [machine, setMachine] = useState('all');

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      let query = supabase
        .from('workouts')
        .select(
          'id, athlete_id, machine, duration_seconds, ended_at, started_at, ' +
          'athletes(id, name, color), ' +
          'workout_stats(distance_meters, avg_watts, max_watts)'
        );

      const start = getStartDate(period);
      if (start) query = query.gte('started_at', start);
      if (machine !== 'all') query = query.eq('machine', machine);

      const { data } = await query;
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    }

    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [period, machine]);

  // ── Aggregations ──────────────────────────────────────────────────────────

  const distanceRanking = useMemo(() => {
    const map = {};
    rows.forEach((w) => {
      const d = w.workout_stats?.[0]?.distance_meters;
      if (d == null) return;
      const id = w.athlete_id;
      if (!map[id]) map[id] = { athlete: w.athletes, total: 0 };
      map[id].total += Number(d);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rows]);

  const powerRanking = useMemo(() => {
    const map = {};
    rows.forEach((w) => {
      const p = w.workout_stats?.[0]?.avg_watts;
      if (p == null) return;
      const id = w.athlete_id;
      if (!map[id] || Number(p) > map[id].watts) {
        map[id] = { athlete: w.athletes, watts: Number(p), machine: w.machine };
      }
    });
    return Object.values(map).sort((a, b) => b.watts - a.watts).slice(0, 10);
  }, [rows]);

  const streakRanking = useMemo(() => {
    const byAthlete = {};
    rows.forEach((w) => {
      const id = w.athlete_id;
      if (!byAthlete[id]) byAthlete[id] = { athlete: w.athletes, workouts: [] };
      byAthlete[id].workouts.push(w);
    });
    return Object.values(byAthlete)
      .map(({ athlete, workouts }) => ({
        athlete,
        current: calculateCurrentStreak(workouts),
        longest: calculateLongestStreak(workouts),
      }))
      .filter((e) => e.current > 0)
      .sort((a, b) => b.current - a.current || b.longest - a.longest)
      .slice(0, 10);
  }, [rows]);

  const peakPowerRanking = useMemo(() => {
    const map = {};
    rows.forEach((w) => {
      const p = w.workout_stats?.[0]?.max_watts;
      if (p == null) return;
      const id = w.athlete_id;
      if (!map[id] || Number(p) > map[id].watts) {
        map[id] = { athlete: w.athletes, watts: Number(p), machine: w.machine, date: w.started_at };
      }
    });
    return Object.values(map).sort((a, b) => b.watts - a.watts).slice(0, 10);
  }, [rows]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-8 gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Leaderboard</h1>
        <Link
          to="/"
          className="text-gray-500 hover:text-gray-300 text-lg font-medium transition-colors"
        >
          ← Home
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-col gap-3">
        <TabBar options={PERIOD_TABS} value={period} onChange={setPeriod} />
        <TabBar options={MACHINE_TABS} value={machine} onChange={setMachine} />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-2xl text-gray-500">
          Loading…
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-4">

          {/* Most Distance */}
          <div className="flex flex-col gap-2">
            <SectionDivider title="Most Distance" />
            {distanceRanking.length === 0 ? <EmptyRows /> : (
              distanceRanking.map((entry, i) => (
                <DistanceRow key={entry.athlete.id} entry={entry} rank={i + 1} />
              ))
            )}
          </div>

          {/* Avg Power */}
          <div className="flex flex-col gap-2">
            <SectionDivider title="Avg Power" />
            {powerRanking.length === 0 ? <EmptyRows /> : (
              powerRanking.map((entry, i) => (
                <PowerRow
                  key={entry.athlete.id}
                  entry={entry}
                  rank={i + 1}
                  showMachine={machine === 'all'}
                />
              ))
            )}
          </div>

          {/* Peak Power */}
          <div className="flex flex-col gap-2">
            <SectionDivider title="Peak Power" />
            {peakPowerRanking.length === 0 ? <EmptyRows /> : (
              peakPowerRanking.map((entry, i) => (
                <PeakPowerRow
                  key={entry.athlete.id}
                  entry={entry}
                  rank={i + 1}
                  showMachine={machine === 'all'}
                />
              ))
            )}
          </div>

          {/* Longest Active Streak */}
          <div className="flex flex-col gap-2">
            <SectionDivider title="Longest Active Streak" />
            {streakRanking.length === 0 ? <EmptyRows /> : (
              streakRanking.map((entry, i) => (
                <StreakRow key={entry.athlete.id} entry={entry} rank={i + 1} />
              ))
            )}
          </div>

        </div>
      )}

      <p className="text-gray-700 text-sm text-center mt-auto">
        Updates every 30 seconds
      </p>
      <Footer />
    </div>
  );
}
