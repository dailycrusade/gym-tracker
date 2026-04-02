import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Hub from './components/Hub';
import Leaderboard from './components/Leaderboard';
import MachineDisplay from './components/MachineDisplay';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import WorkoutPlaceholder from './pages/WorkoutPlaceholder';
import { useAuth } from './context/AuthContext';

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function ShellLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/display/:machine" element={<ProtectedRoute><MachineDisplay /></ProtectedRoute>} />
      <Route element={<ShellLayout />}>
        <Route path="/hub" element={<Hub />} />
        <Route path="/workout" element={<WorkoutPlaceholder />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
