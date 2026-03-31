export default function Landing() {
  return (
    <div className="bg-mg-black text-mg-cream font-body min-h-screen">

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="flex flex-col justify-center min-h-screen px-6 py-20 max-w-2xl mx-auto">

        {/* Wordmark */}
        <div className="mb-6">
          <h1 className="font-display text-5xl sm:text-7xl font-bold leading-tight">
            <span className="text-mg-purple">Miller's</span>
            <br />
            <span className="text-mg-teal">Garage</span>
          </h1>
          <p className="mt-3 text-mg-cream/50 text-base tracking-widest uppercase">
            Papillion, Nebraska
          </p>
        </div>

        {/* Divider */}
        <div className="w-12 h-px bg-mg-border mb-8" />

        {/* Faith statement */}
        <blockquote className="mb-8 border-l-2 border-mg-purple pl-4">
          <p className="text-mg-cream/80 text-base sm:text-lg italic leading-relaxed">
            "And let us consider how to stir up one another to love and good works,
            not neglecting to meet together."
          </p>
          <cite className="mt-2 block text-mg-cream/40 text-sm not-italic">
            Hebrews 10:24–25
          </cite>
        </blockquote>

        {/* Origin */}
        <div className="space-y-4 text-mg-cream/70 text-base sm:text-lg leading-relaxed">
          <p>
            Frank "Pop Pop" Miller ran a garage in the 1940s — a neighborhood
            place where people showed up, stayed a while, and looked out for
            each other. Steve worked there before the military.
          </p>
          <p>
            This is its reimagining. Built with his wife Andrea, Miller's Garage
            is a faith-integrated community wellness space. The name is a
            reminder of what a gathering place can be when it's built for people
            rather than profit.
          </p>
        </div>

        {/* Scroll cue */}
        <div className="mt-16 flex flex-col items-start gap-1">
          <span className="text-mg-cream/30 text-xs tracking-widest uppercase">The idea</span>
          <svg
            width="16" height="24" viewBox="0 0 16 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            className="text-mg-cream/30"
          >
            <path d="M8 4v16M2 14l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* ── STORY / MISSION ─────────────────────────────────────── */}
      <section className="bg-mg-surface border-t border-mg-border px-6 py-20">
        <div className="max-w-2xl mx-auto space-y-16">

          {/* Section label */}
          <div>
            <p className="text-mg-teal text-xs tracking-widest uppercase mb-4">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-mg-cream leading-snug">
              Two layers.<br />One purpose.
            </h2>
          </div>

          {/* Two-layer model */}
          <div className="grid sm:grid-cols-2 gap-8">

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mg-teal shrink-0" />
                <h3 className="text-mg-cream font-semibold text-base uppercase tracking-wide">
                  Mission layer
                </h3>
              </div>
              <p className="text-mg-cream/60 text-base leading-relaxed">
                Free. Open. Relational. The community never pays to gather.
                Workouts, connection, and belonging aren't products — they're
                the point.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mg-purple shrink-0" />
                <h3 className="text-mg-cream font-semibold text-base uppercase tracking-wide">
                  Business layer
                </h3>
              </div>
              <p className="text-mg-cream/60 text-base leading-relaxed">
                Coaching, training, programming, and merchandise fund the
                mission. Revenue exists to sustain generosity, not replace it.
              </p>
            </div>

          </div>

          {/* Divider */}
          <div className="h-px bg-mg-border" />

          {/* Core themes */}
          <div className="space-y-6">
            <p className="text-mg-cream/40 text-sm">What we hold onto</p>
            <ul className="space-y-5">
              {[
                ['Presence', 'over productivity'],
                ['Contribution', 'over consumption'],
                ['Community', 'over transaction'],
                ['Purpose', 'over profit'],
              ].map(([emphasis, rest]) => (
                <li key={emphasis} className="flex items-baseline gap-2">
                  <span className="w-1 h-1 rounded-full bg-mg-teal shrink-0 translate-y-[-3px]" />
                  <p className="text-mg-cream text-lg sm:text-xl font-semibold leading-snug">
                    {emphasis}{' '}
                    <span className="text-mg-cream/40 font-normal">{rest}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

    </div>
  )
}
