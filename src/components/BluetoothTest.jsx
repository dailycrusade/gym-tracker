import { useState, useEffect, useRef } from 'react';
import { connectToMachine, MACHINE_TYPES } from '../lib/bluetooth';

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

export default function BluetoothTest() {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [activeMachine, setActiveMachine] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  const connRef = useRef(null);
  const timerRef = useRef(null);

  // Elapsed-time timer — runs while connected
  useEffect(() => {
    if (status === 'connected') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
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
  }

  function handleDisconnect() {
    connRef.current?.disconnect();
    resetState();
  }

  async function handleConnect(machineType) {
    setError(null);
    setStatus('connecting');
    try {
      const conn = await connectToMachine(
        machineType,
        (newMetrics) => setMetrics((prev) => ({ ...prev, ...newMetrics })),
        resetState, // called on unexpected device disconnect
      );
      connRef.current = conn;
      setDeviceName(conn.deviceName);
      setActiveMachine(machineType);
      setStatus('connected');
    } catch (err) {
      setStatus('disconnected');
      // NotFoundError / AbortError = user closed the picker — not an error worth showing
      if (err.name !== 'NotFoundError' && err.name !== 'AbortError') {
        setError(err.message ?? 'Connection failed');
      }
    }
  }

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isEchoBike = activeMachine === MACHINE_TYPES.ECHO_BIKE;
  const machineName = activeMachine === MACHINE_TYPES.SKI_ERG ? 'Ski Erg' : 'Echo Bike';

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
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Gym Tracker</h1>

        {/* Connection status badge */}
        <div
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-lg font-semibold ${
            isConnected
              ? 'bg-green-800 text-green-100'
              : isConnecting
                ? 'bg-yellow-800 text-yellow-100'
                : 'bg-gray-800 text-gray-400'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full ${
              isConnected
                ? 'bg-green-400'
                : isConnecting
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-gray-500'
            }`}
          />
          {isConnected
            ? `${machineName} — ${deviceName}`
            : isConnecting
              ? 'Connecting…'
              : 'Not connected'}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-950 border border-red-700 text-red-300 rounded-xl px-6 py-4 text-xl">
          ⚠ {error}
        </div>
      )}

      {/* ── Connect buttons (shown when idle) ── */}
      {!isConnected && !isConnecting && (
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

      {/* ── Metrics grid (shown when connecting/connected) ── */}
      {(isConnected || isConnecting) && (
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

      {/* ── Disconnect button ── */}
      {isConnected && (
        <div className="flex justify-center">
          <button
            onClick={handleDisconnect}
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 text-gray-200 text-xl font-semibold py-3 px-12 rounded-xl transition-all"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* ── Browser compatibility note ── */}
      {!isConnected && !isConnecting && typeof navigator !== 'undefined' && !navigator.bluetooth && (
        <p className="text-center text-gray-500 text-lg mt-8">
          Web Bluetooth requires Chrome or Edge. Safari and Firefox are not supported.
        </p>
      )}

      {/* ── Version indicator ── */}
      <span className="fixed bottom-2 right-3 text-xs text-gray-600 select-none">v0.1.0</span>
    </div>
  );
}
