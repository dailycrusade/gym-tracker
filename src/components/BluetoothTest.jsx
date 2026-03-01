import { useState, useEffect, useRef } from 'react';
import { connectToMachine, connectToHRMonitor, MACHINE_TYPES } from '../lib/bluetooth';
import { supabase } from '../lib/supabase';
import { machineName } from '../lib/utils';
import Footer from './Footer';

const INITIAL_METRICS = {
  watts: null,
  cadence: null,    // Echo Bike: RPM
  strokeRate: null, // Ski Erg: strokes/min
  distance: null,   // metres
  calories: null,
};

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Returns a Tailwind text-color class for a BPM value.
function hrColor(bpm) {
  if (bpm == null) return 'text-gray-400';
  if (bpm < 120)  return 'text-green-400';
  if (bpm <= 150) return 'text-yellow-400';
  return 'text-red-500';
}

// Metric tile — text scales with viewport height so tiles always fit on screen.
// valueColor: optional Tailwind text-color class (defaults to text-white).
function MetricCard({ label, value, unit, accent = false, className = '', valueColor = 'text-white' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl ${
        accent ? 'bg-blue-950 ring-2 ring-blue-500' : 'bg-gray-800'
      } ${className}`}
      style={{ padding: 'clamp(0.4rem, 1.5vh, 1.25rem)' }}
    >
      <span
        className="text-gray-400 uppercase tracking-widest font-semibold"
        style={{ fontSize: 'clamp(0.6rem, 1.8vh, 1rem)' }}
      >
        {label}
      </span>
      <span
        className={`font-bold tabular-nums leading-none ${valueColor}`}
        style={{ fontSize: 'clamp(2rem, 10vh, 6rem)' }}
      >
        {value ?? '--'}
      </span>
      {unit && (
        <span
          className="text-gray-400 font-medium"
          style={{ fontSize: 'clamp(0.7rem, 2vh, 1.25rem)' }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

export default function BluetoothTest({ athlete, onLogout, onWorkoutDone }) {
  // ── Machine connection state ───────────────────────────────────────────────
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | reconnecting
  const [activeMachine, setActiveMachine] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState(null); // null | 'saving' | 'saved' | 'error'

  // ── HR monitor state ───────────────────────────────────────────────────────
  const [hrStatus, setHrStatus] = useState('disconnected'); // disconnected | connecting | connected | reconnecting
  const [hrBpm, setHrBpm] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const connRef = useRef(null);
  const timerRef = useRef(null);
  const resetElapsedRef = useRef(true);
  const wattsHistoryRef = useRef([]);
  const cadenceHistoryRef = useRef([]);
  const hrHistoryRef = useRef([]);
  const workoutStartRef = useRef(null);
  const workoutIdRef = useRef(null);
  const hrConnRef = useRef(null);

  // ── Elapsed-time timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'connected') {
      if (resetElapsedRef.current) {
        setElapsed(0);
        resetElapsedRef.current = false;
      }
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (status === 'reconnecting') {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      resetElapsedRef.current = true;
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // ── Disconnect everything on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
      hrConnRef.current?.disconnect();
      clearInterval(timerRef.current);
    };
  }, []);

  // ── Machine helpers ───────────────────────────────────────────────────────

  function resetState() {
    if (workoutIdRef.current) {
      supabase.from('workouts').update({ cancelled: true }).eq('id', workoutIdRef.current);
      workoutIdRef.current = null;
    }
    setStatus('disconnected');
    setMetrics(INITIAL_METRICS);
    setActiveMachine(null);
    setDeviceName('');
    connRef.current = null;
    wattsHistoryRef.current = [];
    cadenceHistoryRef.current = [];
    workoutStartRef.current = null;
    // HR monitor stays connected across machine resets; only clear the history
    // so the next machine session starts fresh.
    hrHistoryRef.current = [];
  }

  function handleLogout() {
    connRef.current?.disconnect();
    hrConnRef.current?.disconnect();
    if (workoutIdRef.current) {
      supabase.from('workouts').update({ cancelled: true }).eq('id', workoutIdRef.current);
      workoutIdRef.current = null;
    }
    resetState();
    onLogout();
  }

  async function handleConnect(machineType) {
    setError(null);
    setStatus('connecting');
    // Clear all history so this workout session starts clean.
    wattsHistoryRef.current = [];
    cadenceHistoryRef.current = [];
    hrHistoryRef.current = [];
    try {
      const conn = await connectToMachine(
        machineType,
        (newMetrics) => {
          setStatus((s) => (s === 'reconnecting' ? 'connected' : s));
          setMetrics((prev) => ({ ...prev, ...newMetrics }));
          if (newMetrics.watts != null) wattsHistoryRef.current.push(newMetrics.watts);
          const cad = newMetrics.cadence ?? newMetrics.strokeRate;
          if (cad != null) cadenceHistoryRef.current.push(cad);
        },
        resetState,
        () => setStatus('reconnecting'),
      );
      connRef.current = conn;
      setDeviceName(conn.deviceName);
      setActiveMachine(machineType);
      setStatus('connected');
      workoutStartRef.current = new Date().toISOString();

      const { data: newWorkout } = await supabase
        .from('workouts')
        .insert({ athlete_id: athlete.id, machine: machineType, started_at: workoutStartRef.current })
        .select('id')
        .single();
      workoutIdRef.current = newWorkout?.id ?? null;
    } catch (err) {
      setStatus('disconnected');
      if (err.name !== 'NotFoundError' && err.name !== 'AbortError') {
        setError(err.message ?? 'Connection failed');
      }
    }
  }

  // ── HR monitor helpers ────────────────────────────────────────────────────

  async function handleConnectHR() {
    setError(null);
    setHrStatus('connecting');
    try {
      const conn = await connectToHRMonitor(
        (bpm) => {
          setHrStatus((s) => (s === 'reconnecting' ? 'connected' : s));
          setHrBpm(bpm);
          hrHistoryRef.current.push(bpm);
        },
        () => {
          // Final disconnect after all retries failed
          setHrStatus('disconnected');
          setHrBpm(null);
          hrConnRef.current = null;
        },
        () => setHrStatus('reconnecting'),
      );
      hrConnRef.current = conn;
      setHrStatus('connected');
    } catch (err) {
      setHrStatus('disconnected');
      if (err.name !== 'NotFoundError' && err.name !== 'AbortError') {
        setError(err.message ?? 'HR monitor connection failed');
      }
    }
  }

  // ── End workout ───────────────────────────────────────────────────────────

  async function handleEndWorkout() {
    const endedAt = new Date();
    const machine = activeMachine;
    const totalSeconds = elapsed;
    const finalMetrics = { ...metrics };
    const wattsArr = [...wattsHistoryRef.current];
    const cadenceArr = [...cadenceHistoryRef.current];
    const hrArr = [...hrHistoryRef.current];

    const avgWatts = wattsArr.length
      ? Math.round(wattsArr.reduce((a, b) => a + b, 0) / wattsArr.length) : null;
    const maxWatts = wattsArr.length ? Math.max(...wattsArr) : null;
    const avgCadence = cadenceArr.length
      ? Math.round(cadenceArr.reduce((a, b) => a + b, 0) / cadenceArr.length) : null;
    const avgHr = hrArr.length
      ? Math.round(hrArr.reduce((a, b) => a + b, 0) / hrArr.length) : null;
    const maxHr = hrArr.length ? Math.max(...hrArr) : null;

    const workoutId = workoutIdRef.current;
    workoutIdRef.current = null;

    connRef.current?.disconnect();
    connRef.current = null;
    setSaveState('saving');

    try {
      let workout;
      if (workoutId) {
        const { data, error: workoutErr } = await supabase
          .from('workouts')
          .update({ ended_at: endedAt.toISOString(), duration_seconds: totalSeconds })
          .eq('id', workoutId)
          .select()
          .single();
        if (workoutErr) throw workoutErr;
        workout = data;
      } else {
        const { data, error: workoutErr } = await supabase
          .from('workouts')
          .insert({
            athlete_id: athlete.id,
            machine,
            started_at: workoutStartRef.current,
            ended_at: endedAt.toISOString(),
            duration_seconds: totalSeconds,
          })
          .select()
          .single();
        if (workoutErr) throw workoutErr;
        workout = data;
      }

      const { error: statsErr } = await supabase
        .from('workout_stats')
        .insert({
          workout_id: workout.id,
          distance_meters: finalMetrics.distance,
          avg_watts: avgWatts,
          max_watts: maxWatts,
          avg_cadence: avgCadence,
          calories: finalMetrics.calories,
          avg_hr: avgHr,
          max_hr: maxHr,
        });

      if (statsErr) throw statsErr;

      setSaveState('saved');
      setTimeout(() => { setSaveState(null); resetState(); onWorkoutDone(); }, 2000);
    } catch (err) {
      setError(err.message ?? 'Failed to save workout');
      setSaveState('error');
      setTimeout(() => { setSaveState(null); resetState(); onWorkoutDone(); }, 3000);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isConnected    = status === 'connected';
  const isConnecting   = status === 'connecting';
  const isReconnecting = status === 'reconnecting';
  const isEchoBike     = activeMachine === MACHINE_TYPES.ECHO_BIKE;
  const showHrTile     = hrStatus === 'connected' || hrStatus === 'reconnecting';

  const cadenceLabel = isEchoBike ? 'Cadence' : 'Stroke Rate';
  const cadenceValue = isEchoBike
    ? (metrics.cadence !== null ? Math.round(metrics.cadence) : null)
    : (metrics.strokeRate !== null ? Math.round(metrics.strokeRate) : null);
  const cadenceUnit = isEchoBike ? 'rpm' : 'spm';

  const hrBpmColor = hrColor(hrBpm);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden p-3 sm:p-4 gap-3">

      {/* ── Save overlay ── */}
      {saveState && (
        <div className="fixed inset-0 bg-gray-950/95 flex flex-col items-center justify-center z-50 gap-4">
          {saveState === 'saving' && (
            <p className="text-4xl font-bold text-white">Saving workout…</p>
          )}
          {saveState === 'saved' && (
            <p className="text-5xl font-bold text-green-400">Workout saved! ✓</p>
          )}
          {saveState === 'error' && (
            <>
              <p className="text-4xl font-bold text-red-400">Save failed</p>
              <p className="text-xl text-gray-400">{error}</p>
              <p className="text-lg text-gray-500">Returning to dashboard…</p>
            </>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1
            className="font-bold tracking-tight shrink-0"
            style={{ fontSize: 'clamp(1rem, 3vh, 1.75rem)' }}
          >
            Gym Tracker
          </h1>
          {/* Athlete badge */}
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-xl min-w-0">
            <span
              className="text-gray-200 font-medium truncate"
              style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}
            >
              {athlete.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 text-xs font-medium shrink-0 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Right side: HR badge + machine status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* HR badge — shown when HR is connected/reconnecting */}
          {showHrTile && (
            <div
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full bg-gray-800 font-semibold tabular-nums ${hrBpmColor}`}
              style={{ fontSize: 'clamp(0.65rem, 1.8vh, 0.9rem)' }}
            >
              ❤ {hrBpm != null ? hrBpm : '…'}
            </div>
          )}

          {/* Machine connection status badge */}
          <div
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full font-semibold ${
              isConnected
                ? 'bg-green-800 text-green-100'
                : isConnecting || isReconnecting
                  ? 'bg-yellow-800 text-yellow-100'
                  : 'bg-gray-800 text-gray-400'
            }`}
            style={{ fontSize: 'clamp(0.65rem, 1.8vh, 0.9rem)' }}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-green-400'
                  : isConnecting || isReconnecting
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-gray-500'
              }`}
            />
            {isConnected
              ? `${machineName(activeMachine)} — ${deviceName}`
              : isReconnecting
                ? 'Reconnecting…'
                : isConnecting
                  ? 'Connecting…'
                  : 'Not connected'}
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !saveState && (
        <div className="shrink-0 bg-red-950 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-base">
          ⚠ {error}
        </div>
      )}

      {/* ── Connect buttons (idle screen) ── */}
      {!isConnected && !isConnecting && !isReconnecting && (
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => handleConnect(MACHINE_TYPES.ECHO_BIKE)}
            className="w-full sm:w-auto bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-bold rounded-2xl transition-all shadow-xl px-8 py-5"
            style={{ fontSize: 'clamp(1.125rem, 3vh, 1.875rem)' }}
          >
            Connect Echo Bike
          </button>
          <button
            onClick={() => handleConnect(MACHINE_TYPES.SKI_ERG)}
            className="w-full sm:w-auto bg-violet-700 hover:bg-violet-600 active:scale-95 text-white font-bold rounded-2xl transition-all shadow-xl px-8 py-5"
            style={{ fontSize: 'clamp(1.125rem, 3vh, 1.875rem)' }}
          >
            Connect Ski Erg
          </button>
          <button
            onClick={handleConnectHR}
            disabled={hrStatus !== 'disconnected'}
            className={`w-full sm:w-auto font-bold rounded-2xl transition-all shadow-xl px-8 py-5 ${
              hrStatus === 'connected' || hrStatus === 'reconnecting'
                ? 'bg-gray-800 text-green-400 cursor-default'
                : hrStatus === 'connecting'
                  ? 'bg-gray-800 text-gray-500 cursor-default'
                  : 'bg-rose-800 hover:bg-rose-700 active:scale-95 text-white'
            }`}
            style={{ fontSize: 'clamp(1.125rem, 3vh, 1.875rem)' }}
          >
            {hrStatus === 'connecting'   ? 'Connecting HR…' :
             hrStatus !== 'disconnected' ? `❤ HR Connected` :
                                          'Connect HR Monitor'}
          </button>

          {/* Browser compatibility note */}
          {typeof navigator !== 'undefined' && !navigator.bluetooth && (
            <p className="absolute bottom-8 left-0 right-0 text-center text-gray-500 text-base px-4">
              Web Bluetooth requires Chrome or Edge.
            </p>
          )}
        </div>
      )}

      {/* ── Metrics grid — fills all remaining height when machine is active ── */}
      {(isConnected || isConnecting || isReconnecting) && (
        <div className={`flex-1 min-h-0 grid gap-3 ${
          showHrTile ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3'
        }`}>
          <MetricCard label="Power"        value={metrics.watts}   unit="watts" accent />
          <MetricCard label={cadenceLabel} value={cadenceValue}    unit={cadenceUnit} />
          <MetricCard label="Distance"     value={metrics.distance} unit="m" />
          <MetricCard label="Calories"     value={metrics.calories} unit="kcal" />
          <MetricCard
            label="Time"
            value={formatTime(elapsed)}
            unit=""
            className={showHrTile ? '' : 'col-span-2 md:col-span-1'}
          />
          {showHrTile && (
            <MetricCard
              label="Heart Rate"
              value={hrBpm}
              unit="bpm"
              valueColor={hrBpmColor}
            />
          )}
        </div>
      )}

      {/* ── Bottom controls ── */}
      {(isConnected || isReconnecting) && (
        <div className="shrink-0 flex flex-col gap-2">
          {/* Connect HR Monitor — subtle link when not yet connected during workout */}
          {hrStatus === 'disconnected' && (
            <button
              onClick={handleConnectHR}
              className="text-gray-600 hover:text-gray-400 text-sm font-medium transition-colors text-center py-1"
            >
              + Connect HR Monitor
            </button>
          )}
          {hrStatus === 'connecting' && (
            <p className="text-gray-600 text-sm text-center py-1">Connecting HR Monitor…</p>
          )}

          <button
            onClick={handleEndWorkout}
            className="w-full sm:w-auto sm:self-center bg-green-700 hover:bg-green-600 active:scale-95 text-white font-bold rounded-2xl transition-all shadow-xl px-8 py-4"
            style={{ fontSize: 'clamp(1rem, 2.5vh, 1.5rem)' }}
          >
            End Workout
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}
