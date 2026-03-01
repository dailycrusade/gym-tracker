import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Footer from './Footer';

function PinDots({ filled }) {
  return (
    <div className="flex gap-4 justify-center">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            i < filled ? 'bg-white border-white' : 'bg-transparent border-gray-500'
          }`}
        />
      ))}
    </div>
  );
}

// Fills the height of its container — parent must have an explicit height.
function PinKeypad({ onDigit, onBackspace }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];
  return (
    <div
      className="grid grid-cols-3 gap-2 w-full h-full"
      style={{ gridAutoRows: '1fr' }}
    >
      {keys.map((key, i) =>
        key === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => (key === '⌫' ? onBackspace() : onDigit(key))}
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-bold rounded-2xl transition-all select-none w-full h-full"
            style={{ fontSize: 'clamp(1.25rem, 4vw, 1.875rem)' }}
          >
            {key}
          </button>
        ),
      )}
    </div>
  );
}

export default function AthleteLogin({ onLogin }) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('athletes'); // 'athletes' | 'pin' | 'newAthlete'
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [pin, setPin] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAthletes();
  }, []);

  async function fetchAthletes() {
    setLoading(true);
    const { data } = await supabase.from('athletes').select('*').order('name');
    setAthletes(data ?? []);
    setLoading(false);
  }

  // ── PIN entry for existing athlete ──────────────────────────────────────────

  function handleAthleteSelect(athlete) {
    setSelectedAthlete(athlete);
    setPin('');
    setError(null);
    setView('pin');
  }

  function handlePinDigit(digit) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => verifyPin(next), 120);
    }
  }

  function handlePinBackspace() {
    setPin((p) => p.slice(0, -1));
    setError(null);
  }

  function verifyPin(entered) {
    if (entered === selectedAthlete.pin) {
      onLogin(selectedAthlete);
    } else {
      setError('Wrong PIN — try again');
      setPin('');
    }
  }

  // ── New athlete form ─────────────────────────────────────────────────────────

  function handleNewPinDigit(digit) {
    if (newPin.length >= 4) return;
    setNewPin((p) => p + digit);
    setError(null);
  }

  function handleNewPinBackspace() {
    setNewPin((p) => p.slice(0, -1));
    setError(null);
  }

  async function handleCreateAthlete() {
    if (!newName.trim()) { setError('Please enter your name.'); return; }
    if (newPin.length !== 4) { setError('PIN must be 4 digits.'); return; }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('athletes')
      .insert({ name: newName.trim(), pin: newPin })
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onLogin(data);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 text-white flex items-center justify-center text-3xl font-semibold">
        Loading…
        <Footer />
      </div>
    );
  }

  // ── PIN view — fits in 100vh, no scroll ─────────────────────────────────────
  if (view === 'pin') {
    return (
      <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden p-4 sm:p-6">

        {/* Athlete name + prompts — fixed height at top */}
        <div className="shrink-0 flex flex-col items-center gap-2 py-4 sm:py-6">
          <h1
            className="font-bold text-center"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
          >
            {selectedAthlete.name}
          </h1>
          <p className="text-gray-400 text-lg">Enter your PIN</p>
          <PinDots filled={pin.length} />
          {error && (
            <p className="text-red-400 font-medium text-base">{error}</p>
          )}
        </div>

        {/* Keypad fills remaining space */}
        <div className="flex-1 min-h-0 w-full max-w-xs mx-auto py-1">
          <PinKeypad onDigit={handlePinDigit} onBackspace={handlePinBackspace} />
        </div>

        {/* Back button */}
        <div className="shrink-0 flex justify-center py-3">
          <button
            onClick={() => { setView('athletes'); setError(null); }}
            className="text-gray-500 hover:text-gray-300 text-lg transition-colors px-6 py-2"
          >
            ← Back
          </button>
        </div>

        <Footer />
      </div>
    );
  }

  // ── New athlete — allow scroll (keyboard opens, pushing content up) ──────────
  if (view === 'newAthlete') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-4 sm:p-6 gap-3">

        <h1
          className="font-bold pt-4 sm:pt-6"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}
        >
          New Athlete
        </h1>

        {error && (
          <p className="text-red-400 font-medium text-base">{error}</p>
        )}

        <input
          className="w-full max-w-xs bg-gray-800 text-white text-xl px-5 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          placeholder="Your name"
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setError(null); }}
          autoFocus
        />

        <p className="text-gray-400 text-base">Choose a 4-digit PIN</p>
        <PinDots filled={newPin.length} />

        {/* Keypad: fixed-height container so it doesn't push off screen */}
        <div className="w-full max-w-xs" style={{ height: 'min(42vh, 280px)' }}>
          <PinKeypad onDigit={handleNewPinDigit} onBackspace={handleNewPinBackspace} />
        </div>

        <button
          onClick={handleCreateAthlete}
          disabled={saving}
          className="w-full max-w-xs bg-blue-700 hover:bg-blue-600 active:scale-95 disabled:opacity-50 text-white text-xl font-bold py-4 rounded-2xl transition-all"
        >
          {saving ? 'Saving…' : 'Create & Log In'}
        </button>

        <button
          onClick={() => { setView('athletes'); setError(null); setNewName(''); setNewPin(''); }}
          className="text-gray-500 hover:text-gray-300 text-lg transition-colors py-2"
        >
          ← Back
        </button>

        <Footer />
      </div>
    );
  }

  // ── Athlete selection — fits in 100vh, no scroll ─────────────────────────────
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* Title */}
      <div className="shrink-0 px-4 sm:px-8 pt-5 sm:pt-8 pb-2 text-center">
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
        >
          Who are you?
        </h1>
      </div>

      {/* Athlete grid — fills remaining space */}
      <div className="flex-1 min-h-0 px-4 sm:px-8 py-2">
        {athletes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-xl text-center">
              No athletes yet — add yourself below!
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 h-full"
            style={{ gridAutoRows: '1fr' }}
          >
            {athletes.map((a) => (
              <button
                key={a.id}
                onClick={() => handleAthleteSelect(a)}
                className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-semibold px-3 rounded-2xl transition-all w-full h-full"
                style={{
                  borderLeft: `4px solid ${a.color ?? '#3b82f6'}`,
                  fontSize: 'clamp(0.9rem, 3.5vw, 1.5rem)',
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Athlete button */}
      <div className="shrink-0 px-4 sm:px-8 py-4 sm:py-6">
        <button
          onClick={() => { setView('newAthlete'); setError(null); }}
          className="w-full bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-bold rounded-2xl transition-all py-4"
          style={{ fontSize: 'clamp(1rem, 3vw, 1.375rem)' }}
        >
          + New Athlete
        </button>
      </div>

      <Footer />
    </div>
  );
}
