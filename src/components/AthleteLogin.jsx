import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function PinDots({ filled }) {
  return (
    <div className="flex gap-5 justify-center my-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`w-6 h-6 rounded-full border-2 transition-all ${
            i < filled ? 'bg-white border-white' : 'bg-transparent border-gray-500'
          }`}
        />
      ))}
    </div>
  );
}

function PinKeypad({ onDigit, onBackspace }) {
  // Layout: 1-9 then ⌫ / 0 / blank
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((key, i) =>
        key === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => (key === '⌫' ? onBackspace() : onDigit(key))}
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-3xl font-bold py-6 rounded-2xl transition-all select-none"
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
      setTimeout(() => verifyPin(next), 120); // let last dot render first
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
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-3xl font-semibold">
        Loading…
      </div>
    );
  }

  if (view === 'pin') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 gap-5">
        <h1 className="text-5xl font-bold">{selectedAthlete.name}</h1>
        <p className="text-gray-400 text-2xl">Enter your PIN</p>
        <PinDots filled={pin.length} />
        {error && (
          <p className="text-red-400 text-xl font-medium">{error}</p>
        )}
        <PinKeypad onDigit={handlePinDigit} onBackspace={handlePinBackspace} />
        <button
          onClick={() => { setView('athletes'); setError(null); }}
          className="text-gray-500 hover:text-gray-300 text-xl mt-2 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (view === 'newAthlete') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 gap-5 w-full">
        <h1 className="text-5xl font-bold">New Athlete</h1>
        {error && (
          <p className="text-red-400 text-xl font-medium">{error}</p>
        )}
        <input
          className="w-full max-w-xs bg-gray-800 text-white text-2xl px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          placeholder="Your name"
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setError(null); }}
          autoFocus
        />
        <p className="text-gray-400 text-xl">Choose a 4-digit PIN</p>
        <PinDots filled={newPin.length} />
        <PinKeypad onDigit={handleNewPinDigit} onBackspace={handleNewPinBackspace} />
        <button
          onClick={handleCreateAthlete}
          disabled={saving}
          className="w-full max-w-xs bg-blue-700 hover:bg-blue-600 active:scale-95 disabled:opacity-50 text-white text-2xl font-bold py-5 rounded-2xl transition-all"
        >
          {saving ? 'Saving…' : 'Create & Log In'}
        </button>
        <button
          onClick={() => { setView('athletes'); setError(null); setNewName(''); setNewPin(''); }}
          className="text-gray-500 hover:text-gray-300 text-xl transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Athlete selection grid
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-8 gap-6">
      <h1 className="text-5xl font-bold tracking-tight text-center">Who are you?</h1>

      {athletes.length === 0 ? (
        <p className="text-gray-400 text-2xl text-center mt-8">
          No athletes yet — add yourself below!
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          {athletes.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAthleteSelect(a)}
              className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-white text-2xl font-semibold py-10 px-4 rounded-2xl transition-all"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <button
          onClick={() => { setView('newAthlete'); setError(null); }}
          className="bg-blue-700 hover:bg-blue-600 active:scale-95 text-white text-2xl font-bold py-5 px-12 rounded-2xl transition-all"
        >
          + New Athlete
        </button>
      </div>
    </div>
  );
}
