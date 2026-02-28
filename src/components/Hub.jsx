import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { machineName } from '../lib/utils';
import Footer from './Footer';

const TZ = 'America/Chicago';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart() {
  const now = new Date();
  const daysToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function fmtElapsed(startIso, now) {
  const diff = Math.max(0, Math.floor((now - new Date(startIso)) / 1000));
  const m = Math.floor(diff / 60).toString().padStart(2, '0');
  const s = (diff % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso)) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtDistance(meters) {
  if (!meters) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function aggregateDistance(rows) {
  const map = {};
  rows.forEach((w) => {
    const d = w.workout_stats?.[0]?.distance_meters;
    if (d == null) return;
    const id = w.athlete_id;
    if (!map[id]) map[id] = { athlete: w.athletes, total: 0 };
    map[id].total += Number(d);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function aggregatePower(rows) {
  const map = {};
  rows.forEach((w) => {
    const p = w.workout_stats?.[0]?.avg_watts;
    if (p == null) return;
    const id = w.athlete_id;
    if (!map[id] || Number(p) > map[id].watts) {
      map[id] = { athlete: w.athletes, watts: Number(p) };
    }
  });
  return Object.values(map).sort((a, b) => b.watts - a.watts);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RANK_STYLES = {
  1: 'bg-yellow-500 text-yellow-950',
  2: 'bg-gray-400 text-gray-900',
  3: 'bg-orange-700 text-orange-100',
};

function RankBadge({ n }) {
  const style = RANK_STYLES[n] ?? 'bg-gray-800 text-gray-500';
  return (
    <span className={`${style} w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0`}>
      {n}
    </span>
  );
}

function PanelHeader({ title }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Hub() {
  const [now, setNow]         = useState(new Date());
  const [active, setActive]   = useState([]);
  const [weekRows, setWeekRows] = useState([]);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  // 1-second clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data fetch — every 10 seconds
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const [activeRes, weekRes, recentRes] = await Promise.all([
        // Active sessions: no ended_at, started within last 2 hours
        supabase
          .from('workouts')
          .select('id, athlete_id, machine, started_at, athletes(name, color)')
          .is('ended_at', null)
          .gte('started_at', twoHoursAgo),

        // This week's completed workouts for leaderboard
        supabase
          .from('workouts')
          .select('athlete_id, machine, athletes(id, name, color), workout_stats(distance_meters, avg_watts)')
          .gte('started_at', getWeekStart())
          .not('ended_at', 'is', null),

        // Last 5 completed workouts
        supabase
          .from('workouts')
          .select('id, machine, ended_at, athletes(name, color), workout_stats(distance_meters, avg_watts)')
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(5),
      ]);

      if (!cancelled) {
        setActive(activeRes.data ?? []);
        setWeekRows(weekRes.data ?? []);
        setRecent(recentRes.data ?? []);
        setLoading(false);
      }
    }

    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const distanceTop3 = useMemo(() => aggregateDistance(weekRows).slice(0, 3), [weekRows]);
  const powerTop3    = useMemo(() => aggregatePower(weekRows).slice(0, 3),    [weekRows]);

  // Clock strings
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-5 grid grid-cols-3 items-center">
        <h1 className="text-3xl font-black tracking-tight">Miller's Garage</h1>
        <div className="flex flex-col items-center">
          <p className="text-5xl font-bold tabular-nums leading-none">{timeStr}</p>
          <p className="text-gray-400 text-lg mt-2">{dateStr}</p>
        </div>
        <div /> {/* right balance column */}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-2xl text-gray-500">
          Loading…
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-8 gap-6">

          {/* ── Active sessions + This Week ── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Active Sessions */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <PanelHeader title="Active Sessions" />
              {active.length === 0 ? (
                <p className="text-gray-600 text-xl py-2">No active sessions</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {active.map((w) => (
                    <div key={w.id} className="flex items-center gap-4">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: w.athletes?.color ?? '#3b82f6' }}
                      />
                      <span
                        className="text-2xl font-bold truncate"
                        style={{ color: w.athletes?.color ?? '#3b82f6' }}
                      >
                        {w.athletes?.name}
                      </span>
                      <span className="text-gray-400 text-lg shrink-0">
                        {machineName(w.machine)}
                      </span>
                      <span className="ml-auto text-2xl font-semibold tabular-nums shrink-0">
                        {fmtElapsed(w.started_at, now)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* This Week's Leaderboard */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <PanelHeader title="This Week" />
              <div className="grid grid-cols-2 gap-6">

                <div>
                  <p className="text-gray-600 text-xs uppercase tracking-widest mb-4">Distance</p>
                  {distanceTop3.length === 0 ? (
                    <p className="text-gray-700 text-lg">No data</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {distanceTop3.map((e, i) => (
                        <div key={e.athlete.id} className="flex items-center gap-2">
                          <RankBadge n={i + 1} />
                          <span className="text-lg font-bold truncate"
                            style={{ color: e.athlete.color ?? '#3b82f6' }}>
                            {e.athlete.name}
                          </span>
                          <span className="ml-auto text-lg font-semibold tabular-nums shrink-0">
                            {fmtDistance(e.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-gray-600 text-xs uppercase tracking-widest mb-4">Power</p>
                  {powerTop3.length === 0 ? (
                    <p className="text-gray-700 text-lg">No data</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {powerTop3.map((e, i) => (
                        <div key={e.athlete.id} className="flex items-center gap-2">
                          <RankBadge n={i + 1} />
                          <span className="text-lg font-bold truncate"
                            style={{ color: e.athlete.color ?? '#3b82f6' }}>
                            {e.athlete.name}
                          </span>
                          <span className="ml-auto text-lg font-semibold tabular-nums shrink-0">
                            {e.watts} W
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div className="bg-gray-900 rounded-2xl p-6">
            <PanelHeader title="Recent Activity" />
            {recent.length === 0 ? (
              <p className="text-gray-600 text-xl py-2">No workouts yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recent.map((w) => {
                  const stats = w.workout_stats?.[0];
                  const dist = fmtDistance(stats?.distance_meters);
                  return (
                    <div key={w.id} className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-bold shrink-0"
                        style={{ color: w.athletes?.color ?? '#3b82f6' }}>
                        {w.athletes?.name}
                      </span>
                      <span className="text-gray-500 text-lg shrink-0">
                        {machineName(w.machine)}
                      </span>
                      {dist && (
                        <span className="text-gray-400 text-lg shrink-0">{dist}</span>
                      )}
                      {stats?.avg_watts != null && (
                        <span className="text-gray-400 text-lg shrink-0">
                          {stats.avg_watts} W avg
                        </span>
                      )}
                      <span className="ml-auto text-gray-600 text-base shrink-0">
                        {timeAgo(w.ended_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Big nav buttons ── */}
          <div className="flex gap-6">
            <Link to="/athlete"
              className="flex-1 bg-blue-700 hover:bg-blue-600 active:scale-95 text-white text-3xl font-bold py-8 rounded-2xl transition-all text-center shadow-xl">
              Athlete Login
            </Link>
            <Link to="/leaderboard"
              className="flex-1 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white text-3xl font-bold py-8 rounded-2xl transition-all text-center">
              Leaderboard
            </Link>
          </div>

        </div>
      )}

      <Footer />
    </div>
  );
}
