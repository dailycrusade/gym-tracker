import { useState, useEffect, useRef } from 'react';
import { connectToMachine, MACHINE_TYPES } from '../lib/bluetooth';
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

// One big metric tile — designed to be readable from across a gym
function MetricCard({ label, value, unit, accent = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl p-6 gap-2 ${
        accent ? 'bg-blue-950 ring-2 ring-blue-500' : 'bg-gray-800'
      }`}
    >
      <span className="text-gray-400 text-xl uppercase tracking-widest font-semibold">
        {label}
      </span>
      <span className="text-white font-bold tabular-nums leading-none text-8xl">
        {value ?? '--'}
      </span>
      {unit && (
        <span className="text-gray-400 text-2xl font-medium">{unit}</span>
      )}
    </div>
  );
}

export default function BluetoothTest({ athlete, onLogout, onWorkoutDone }) {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | reconnecting
  const [activeMachine, setActiveMachine] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState(null); // null | 'saving' | 'saved' | 'error'

  const connRef = useRef(null);
  const timerRef = useRef(null);
  // True until the first 'connected' after a full disconnect, so elapsed
  // resets for a new session but NOT when reconnecting mid-session.
  const resetElapsedRef = useRef(true);

  // Accumulated per-workout metric samples for avg/max calculation
  const wattsHistoryRef = useRef([]);
  const cadenceHistoryRef = useRef([]);
  const workoutStartRef = useRef(null);

  // Elapsed-time timer — keeps running through 'reconnecting' so the session
  // clock doesn't stutter when BlueZ briefly drops the GATT link.
  useEffect(() => {
    if (status === 'connected') {
      if (resetElapsedRef.current) {
        setElapsed(0);
        resetElapsedRef.current = false;
      }
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (status === 'reconnecting') {
      // Restart the interval (cleanup stopped it) without resetting elapsed.
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      // 'disconnected' or 'connecting' — stop timer, arm reset for next session.
      clearInterval(timerRef.current);
      resetElapsedRef.current = true;
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
      clearInterval(timerRef.current);
    };
  }, []);

  function resetState() {
    setStatus('disconnected');
    setMetrics(INITIAL_METRICS);
    setActiveMachine(null);
    setDeviceName('');
    connRef.current = null;
    wattsHistoryRef.current = [];
    cadenceHistoryRef.current = [];
    workoutStartRef.current = null;
  }

  function handleLogout() {
    connRef.current?.disconnect();
    resetState();
    onLogout();
  }

  async function handleConnect(machineType) {
    setError(null);
    setStatus('connecting');
    try {
      const conn = await connectToMachine(
        machineType,
        (newMetrics) => {
          // If we were reconnecting, the arrival of new data means we're back.
          setStatus((s) => (s === 'reconnecting' ? 'connected' : s));
          setMetrics((prev) => ({ ...prev, ...newMetrics }));
          // Accumulate samples for end-of-workout stats
          if (newMetrics.watts != null) wattsHistoryRef.current.push(newMetrics.watts);
          const cad = newMetrics.cadence ?? newMetrics.strokeRate;
          if (cad != null) cadenceHistoryRef.current.push(cad);
        },
        resetState,                          // called only after all reconnect attempts fail
        () => setStatus('reconnecting'),     // called when a disconnect is detected
      );
      connRef.current = conn;
      setDeviceName(conn.deviceName);
      setActiveMachine(machineType);
      setStatus('connected');
      workoutStartRef.current = new Date().toISOString();
      wattsHistoryRef.current = [];
      cadenceHistoryRef.current = [];
    } catch (err) {
      setStatus('disconnected');
      // NotFoundError / AbortError = user closed the picker — not an error worth showing
      if (err.name !== 'NotFoundError' && err.name !== 'AbortError') {
        setError(err.message ?? 'Connection failed');
      }
    }
  }

  async function handleEndWorkout() {
    const endedAt = new Date();

    // Capture all values before any state changes
    const machine = activeMachine;
    const totalSeconds = elapsed;
    const finalMetrics = { ...metrics };
    const wattsArr = [...wattsHistoryRef.current];
    const cadenceArr = [...cadenceHistoryRef.current];

    const avgWatts = wattsArr.length
      ? Math.round(wattsArr.reduce((a, b) => a + b, 0) / wattsArr.length)
      : null;
    const maxWatts = wattsArr.length ? Math.max(...wattsArr) : null;
    const avgCadence = cadenceArr.length
      ? Math.round(cadenceArr.reduce((a, b) => a + b, 0) / cadenceArr.length)
      : null;

    // Disconnect BLE — show overlay while saving so the user sees feedback
    connRef.current?.disconnect();
    connRef.current = null;
    setSaveState('saving');

    try {
      const { data: workout, error: workoutErr } = await supabase
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

      const { error: statsErr } = await supabase
        .from('workout_stats')
        .insert({
          workout_id: workout.id,
          distance_meters: finalMetrics.distance,
          avg_watts: avgWatts,
          max_watts: maxWatts,
          avg_cadence: avgCadence,
          calories: finalMetrics.calories,
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

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isReconnecting = status === 'reconnecting';
  const isEchoBike = activeMachine === MACHINE_TYPES.ECHO_BIKE;

  // Cadence field differs by machine
  const cadenceLabel = isEchoBike ? 'Cadence' : 'Stroke Rate';
  const cadenceValue =
    isEchoBike
      ? metrics.cadence !== null
        ? Math.round(metrics.cadence)
        : null
      : metrics.strokeRate !== null
        ? Math.round(metrics.strokeRate)
        : null;
  const cadenceUnit = isEchoBike ? 'rpm' : 'spm';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-8 gap-6">
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-4xl font-bold tracking-tight shrink-0">Gym Tracker</h1>
          {/* Athlete badge */}
          <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-xl min-w-0">
            <span className="text-gray-200 text-lg font-medium truncate">{athlete.name}</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 text-sm font-medium shrink-0 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Connection status badge */}
        <div
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-lg font-semibold shrink-0 ${
            isConnected
              ? 'bg-green-800 text-green-100'
              : isConnecting || isReconnecting
                ? 'bg-yellow-800 text-yellow-100'
                : 'bg-gray-800 text-gray-400'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
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

      {/* ── Error banner ── */}
      {error && !saveState && (
        <div className="bg-red-950 border border-red-700 text-red-300 rounded-xl px-6 py-4 text-xl">
          ⚠ {error}
        </div>
      )}

      {/* ── Connect buttons (shown when idle) ── */}
      {!isConnected && !isConnecting && !isReconnecting && (
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-16">
          <button
            onClick={() => handleConnect(MACHINE_TYPES.ECHO_BIKE)}
            className="bg-blue-700 hover:bg-blue-600 active:scale-95 text-white text-3xl font-bold py-8 px-16 rounded-2xl transition-all shadow-xl"
          >
            Connect Echo Bike
          </button>
          <button
            onClick={() => handleConnect(MACHINE_TYPES.SKI_ERG)}
            className="bg-violet-700 hover:bg-violet-600 active:scale-95 text-white text-3xl font-bold py-8 px-16 rounded-2xl transition-all shadow-xl"
          >
            Connect Ski Erg
          </button>
        </div>
      )}

      {/* ── Metrics grid (shown when connecting/connected/reconnecting) ── */}
      {(isConnected || isConnecting || isReconnecting) && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 flex-1">
          <MetricCard
            label="Power"
            value={metrics.watts}
            unit="watts"
            accent
          />
          <MetricCard
            label={cadenceLabel}
            value={cadenceValue}
            unit={cadenceUnit}
          />
          <MetricCard
            label="Distance"
            value={metrics.distance}
            unit="m"
          />
          <MetricCard
            label="Calories"
            value={metrics.calories}
            unit="kcal"
          />
          <MetricCard
            label="Time"
            value={formatTime(elapsed)}
            unit=""
          />
        </div>
      )}

      {/* ── End Workout button ── */}
      {(isConnected || isReconnecting) && (
        <div className="flex justify-center">
          <button
            onClick={handleEndWorkout}
            className="bg-green-700 hover:bg-green-600 active:scale-95 text-white text-2xl font-bold py-5 px-16 rounded-2xl transition-all shadow-xl"
          >
            End Workout
          </button>
        </div>
      )}

      {/* ── Browser compatibility note ── */}
      {!isConnected && !isConnecting && !isReconnecting && typeof navigator !== 'undefined' && !navigator.bluetooth && (
        <p className="text-center text-gray-500 text-lg mt-8">
          Web Bluetooth requires Chrome or Edge. Safari and Firefox are not supported.
        </p>
      )}

      {/* ── Version indicator ── */}
      <Footer />
    </div>
  );
}
