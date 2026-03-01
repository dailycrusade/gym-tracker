import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Hub from './components/Hub';
import AthleteLogin from './components/AthleteLogin';
import AthleteDashboard from './components/AthleteDashboard';
import BluetoothTest from './components/BluetoothTest';
import Leaderboard from './components/Leaderboard';
import MachineDisplay from './components/MachineDisplay';
import { supabase } from './lib/supabase';
import { SESSION_ATHLETE_KEY, SESSION_WORKOUT_KEY } from './lib/session';

// The main athlete flow: login → dashboard → workout
function MainFlow() {
  const [athlete, setAthlete] = useState(null);
  const [screen, setScreen] = useState('loading'); // 'loading' | 'login' | 'dashboard' | 'workout'
  const [restoredWorkout, setRestoredWorkout] = useState(null);

  // On mount: restore athlete and/or active workout from sessionStorage.
  useEffect(() => {
    async function restoreSession() {
      const rawAthlete = sessionStorage.getItem(SESSION_ATHLETE_KEY);
      if (!rawAthlete) { setScreen('login'); return; }

      let savedAthlete;
      try { savedAthlete = JSON.parse(rawAthlete); } catch { setScreen('login'); return; }
      setAthlete(savedAthlete);

      const rawWorkout = sessionStorage.getItem(SESSION_WORKOUT_KEY);
      if (!rawWorkout) { setScreen('dashboard'); return; }

      let saved;
      try { saved = JSON.parse(rawWorkout); } catch {
        sessionStorage.removeItem(SESSION_WORKOUT_KEY);
        setScreen('dashboard');
        return;
      }

      // Verify the workout row still exists and hasn't been ended.
      const { data } = await supabase
        .from('workouts')
        .select('id, started_at, machine')
        .eq('id', saved.workoutId)
        .is('ended_at', null)
        .single();

      if (data) {
        setRestoredWorkout({
          workoutId: data.id,
          machine: data.machine,
          athleteId: savedAthlete.id,
          startedAt: data.started_at,
        });
        setScreen('workout');
      } else {
        sessionStorage.removeItem(SESSION_WORKOUT_KEY);
        setScreen('dashboard');
      }
    }

    restoreSession();
  }, []);

  function handleLogin(a) {
    sessionStorage.setItem(SESSION_ATHLETE_KEY, JSON.stringify(a));
    setAthlete(a);
    setScreen('dashboard');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_ATHLETE_KEY);
    sessionStorage.removeItem(SESSION_WORKOUT_KEY);
    setAthlete(null);
    setRestoredWorkout(null);
    setScreen('login');
  }

  function handleAthleteUpdate(a) {
    sessionStorage.setItem(SESSION_ATHLETE_KEY, JSON.stringify(a));
    setAthlete(a);
  }

  if (screen === 'loading') {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading…</div>
      </div>
    );
  }

  if (screen === 'login') {
    return <AthleteLogin onLogin={handleLogin} />;
  }

  if (screen === 'dashboard') {
    return (
      <AthleteDashboard
        athlete={athlete}
        onAthleteUpdate={handleAthleteUpdate}
        onStartWorkout={() => setScreen('workout')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <BluetoothTest
      athlete={athlete}
      restoredWorkout={restoredWorkout}
      onLogout={handleLogout}
      onWorkoutDone={() => { setRestoredWorkout(null); setScreen('dashboard'); }}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/athlete" element={<MainFlow />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/display/:machine" element={<MachineDisplay />} />
    </Routes>
  );
}
