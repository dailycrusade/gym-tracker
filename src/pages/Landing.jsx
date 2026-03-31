import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function usePublicEvents() {
  const [events, setEvents] = useState(null) // null = loading
  const [empty, setEmpty]   = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, event_date, description')
          .eq('is_public', true)
          .order('event_date', { ascending: true })
          .limit(10)

        if (error || !data || data.length === 0) {
          setEmpty(true)
        } else {
          setEvents(data)
        }
      } catch {
        setEmpty(true)
      }
    }
    fetch()
  }, [])

  return { events, empty }
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

const NAV_LINKS = [
  { label: 'Story',      href: '#story'      },
  { label: 'Membership', href: '#membership' },
  { label: 'Events',     href: '#events'     },
  { label: 'Contact',    href: '#contact'    },
]

export default function Landing() {
  const { events, empty } = usePublicEvents()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-mg-black text-mg-cream font-body min-h-screen">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-mg-black/90 backdrop-blur border-b border-mg-border">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

          {/* Wordmark */}
          <a href="#" className="font-display text-base font-bold shrink-0">
            <span className="text-mg-purple">Miller's</span>
            <span className="text-mg-teal"> Garage</span>
          </a>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-mg-cream/50 hover:text-mg-cream text-sm transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="sm:hidden flex flex-col gap-1.5 p-1 text-mg-cream/60 hover:text-mg-cream"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-px bg-current transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-px bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-px bg-current transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-mg-border bg-mg-surface px-5 py-4 flex flex-col gap-4">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="text-mg-cream/70 hover:text-mg-cream text-base transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="flex flex-col justify-center min-h-screen px-6 pt-28 pb-20 max-w-2xl mx-auto">

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

        <div className="w-12 h-px bg-mg-border mb-8" />

        <blockquote className="mb-8 border-l-2 border-mg-purple pl-4">
          <p className="text-mg-cream/80 text-base sm:text-lg italic leading-relaxed">
            "And let us consider how to stir up one another to love and good works,
            not neglecting to meet together."
          </p>
          <cite className="mt-2 block text-mg-cream/40 text-sm not-italic">
            Hebrews 10:24–25
          </cite>
        </blockquote>

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
      <section id="story" className="bg-mg-surface border-t border-mg-border px-6 py-20">
        <div className="max-w-2xl mx-auto space-y-16">

          <div>
            <p className="text-mg-teal text-xs tracking-widest uppercase mb-4">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-mg-cream leading-snug">
              Two layers.<br />One purpose.
            </h2>
          </div>

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

          <div className="h-px bg-mg-border" />

          <div className="space-y-6">
            <p className="text-mg-cream/40 text-sm">What we hold onto</p>
            <ul className="space-y-5">
              {[
                ['Presence',     'over productivity'],
                ['Contribution', 'over consumption'],
                ['Community',    'over transaction'],
                ['Purpose',      'over profit'],
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

      {/* ── MEMBERSHIP TIERS ────────────────────────────────────── */}
      <section id="membership" className="bg-mg-black border-t border-mg-border px-6 py-20">
        <div className="max-w-4xl mx-auto space-y-12">

          <div>
            <p className="text-mg-purple text-xs tracking-widest uppercase mb-4">Membership</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-mg-cream leading-snug">
              Support the mission.<br />Be part of something.
            </h2>
            <p className="mt-4 text-mg-cream/50 text-base leading-relaxed max-w-xl">
              Membership funds the free community layer. Tiers are still being
              finalized — ranges reflect where we're landing.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">

            {/* Founding / Community */}
            <div className="relative flex flex-col rounded-2xl border border-mg-border bg-mg-surface p-6 gap-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-mg-cream/50 text-xs uppercase tracking-widest mb-1">Founding</p>
                  <h3 className="text-mg-cream text-xl font-semibold">Community</h3>
                </div>
                <span className="shrink-0 rounded-full border border-mg-teal/40 text-mg-teal text-xs px-2.5 py-0.5 font-medium">
                  Limited
                </span>
              </div>
              <div>
                <p className="text-mg-cream text-2xl font-bold">$49–65<span className="text-mg-cream/40 text-base font-normal">/mo</span></p>
                <p className="text-mg-cream/40 text-sm mt-0.5">$490–650 / year</p>
              </div>
              <p className="text-mg-cream/60 text-sm leading-relaxed flex-1">
                Build the founding crew. Get in early and help shape what this becomes.
              </p>
              <a href="#contact" className="mt-auto block text-center rounded-xl border border-mg-border text-mg-cream/70 hover:text-mg-cream hover:border-mg-cream/30 transition-colors text-sm font-medium py-2.5">
                Get in touch
              </a>
            </div>

            {/* Core — most popular */}
            <div className="relative flex flex-col rounded-2xl border-2 border-mg-purple bg-mg-surface p-6 gap-5 shadow-[0_0_32px_-4px_rgba(123,104,238,0.25)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-mg-purple text-white text-xs px-3 py-1 font-semibold whitespace-nowrap">
                  Most popular
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-2">
                <div>
                  <p className="text-mg-purple text-xs uppercase tracking-widest mb-1">Core</p>
                  <h3 className="text-mg-cream text-xl font-semibold">Core ★</h3>
                </div>
              </div>
              <div>
                <p className="text-mg-cream text-2xl font-bold">$85–110<span className="text-mg-cream/40 text-base font-normal">/mo</span></p>
                <p className="text-mg-cream/40 text-sm mt-0.5">$850–1,100 / year</p>
              </div>
              <p className="text-mg-cream/60 text-sm leading-relaxed flex-1">
                Primary membership. Full access, full community.
              </p>
              <a href="#contact" className="mt-auto block text-center rounded-xl bg-mg-purple hover:opacity-90 active:scale-95 transition text-white text-sm font-semibold py-2.5">
                Get in touch
              </a>
            </div>

            {/* Legacy / VIP */}
            <div className="relative flex flex-col rounded-2xl border border-mg-border bg-mg-surface p-6 gap-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-mg-cream/50 text-xs uppercase tracking-widest mb-1">Legacy</p>
                  <h3 className="text-mg-cream text-xl font-semibold">VIP</h3>
                </div>
                <span className="shrink-0 rounded-full border border-mg-purple/40 text-mg-purple text-xs px-2.5 py-0.5 font-medium">
                  Anchor
                </span>
              </div>
              <div>
                <p className="text-mg-cream text-2xl font-bold">$150–200<span className="text-mg-cream/40 text-base font-normal">/mo</span></p>
                <p className="text-mg-cream/40 text-sm mt-0.5">$1,500–2,000 / year</p>
              </div>
              <p className="text-mg-cream/60 text-sm leading-relaxed flex-1">
                For those who want to go all in. Anchor the mission at its foundation.
              </p>
              <a href="#contact" className="mt-auto block text-center rounded-xl border border-mg-border text-mg-cream/70 hover:text-mg-cream hover:border-mg-cream/30 transition-colors text-sm font-medium py-2.5">
                Get in touch
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── EVENTS ──────────────────────────────────────────────── */}
      <section id="events" className="bg-mg-black border-t border-mg-border px-6 py-20">
        <div className="max-w-2xl mx-auto space-y-10">

          <div>
            <p className="text-mg-teal text-xs tracking-widest uppercase mb-4">What's coming</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-mg-cream leading-snug">
              Open events
            </h2>
          </div>

          {events === null && !empty && (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-2xl border border-mg-border bg-mg-surface p-5 animate-pulse space-y-3">
                  <div className="h-3 w-1/3 rounded bg-mg-border" />
                  <div className="h-5 w-2/3 rounded bg-mg-border" />
                  <div className="h-3 w-full rounded bg-mg-border" />
                </div>
              ))}
            </div>
          )}

          {empty && (
            <div className="rounded-2xl border border-mg-border bg-mg-surface px-6 py-10 text-center space-y-2">
              <p className="text-mg-cream/70 text-base">Events coming soon.</p>
              <p className="text-mg-cream/40 text-sm">
                Check back or{' '}
                <a href="#contact" className="text-mg-teal underline underline-offset-2 hover:opacity-80">
                  get in touch
                </a>
                .
              </p>
            </div>
          )}

          {events && (
            <div className="space-y-4">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-2xl border border-mg-border bg-mg-surface p-5 space-y-1.5">
                  <p className="text-mg-teal text-xs uppercase tracking-widest">
                    {fmtDate(ev.event_date)}
                  </p>
                  <h3 className="text-mg-cream text-lg font-semibold">{ev.name}</h3>
                  {ev.description && (
                    <p className="text-mg-cream/50 text-sm leading-relaxed">{ev.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ── CONTACT ─────────────────────────────────────────────── */}
      <section id="contact" className="bg-mg-surface border-t border-mg-border px-6 py-20">
        <div className="max-w-2xl mx-auto space-y-8">

          <div>
            <p className="text-mg-purple text-xs tracking-widest uppercase mb-4">Get in touch</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-mg-cream leading-snug">
              Come as you are.
            </h2>
          </div>

          <div className="space-y-4 text-mg-cream/70 text-base sm:text-lg leading-relaxed">
            <p>
              This is a community, not a transaction. Whether you're interested
              in membership, curious about what we're building, or just want to
              show up — reach out. There's no pitch waiting on the other side.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="mailto:hello@millersgarage.com"
              className="flex items-center gap-3 text-mg-teal hover:opacity-80 transition-opacity text-base font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 7 10-7" />
              </svg>
              hello@millersgarage.com
            </a>

            <div className="flex items-center gap-3 text-mg-cream/40 text-base">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Papillion, Nebraska
            </div>
          </div>

        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-mg-black border-t border-mg-border px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-mg-cream/30 text-xs">
          <p>© 2026 Certago LLC · Miller's Garage · Papillion, Nebraska</p>
          <p className="font-display">
            <span className="text-mg-purple/50">Miller's</span>
            <span className="text-mg-teal/50"> Garage</span>
          </p>
        </div>
      </footer>

    </div>
  )
}
