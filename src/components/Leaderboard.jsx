import Footer from './Footer';

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col p-8 gap-6">
      <h1 className="text-4xl font-bold tracking-tight">Leaderboard</h1>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-5xl font-bold text-gray-600">Coming soon</p>
        <p className="text-xl text-gray-600">Check back after more workouts are logged.</p>
      </div>

      <Footer />
    </div>
  );
}
