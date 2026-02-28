import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AthleteLogin from './components/AthleteLogin';
import AthleteDashboard from './components/AthleteDashboard';
import BluetoothTest from './components/BluetoothTest';
import Leaderboard from './components/Leaderboard';
import MachineDisplay from './components/MachineDisplay';

// The main athlete flow: login → dashboard → workout
function MainFlow() {
  const [athlete, setAthlete] = useState(null);
  const [screen, setScreen] = useState('login'); // 'login' | 'dashboard' | 'workout'

  function handleLogin(a) {
    setAthlete(a);
    setScreen('dashboard');
  }

  function handleLogout() {
    setAthlete(null);
    setScreen('login');
  }

  if (screen === 'login') {
    return <AthleteLogin onLogin={handleLogin} />;
  }

  if (screen === 'dashboard') {
    return (
      <AthleteDashboard
        athlete={athlete}
        onAthleteUpdate={setAthlete}
        onStartWorkout={() => setScreen('workout')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <BluetoothTest
      athlete={athlete}
      onLogout={handleLogout}
      onWorkoutDone={() => setScreen('dashboard')}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainFlow />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/display/:machine" element={<MachineDisplay />} />
    </Routes>
  );
}
