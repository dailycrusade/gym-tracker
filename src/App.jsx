import { useState } from 'react';
import AthleteLogin from './components/AthleteLogin';
import AthleteDashboard from './components/AthleteDashboard';
import BluetoothTest from './components/BluetoothTest';

export default function App() {
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
