export default function WorkoutPlaceholder() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
      >
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-mg-cream)' }}
        >
          Workout
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-mg-teal)' }}>
          FTMS device tracking is coming soon. Connect your Echo Bike or Ski Erg to start
          recording sessions.
        </p>
      </div>
    </div>
  )
}
