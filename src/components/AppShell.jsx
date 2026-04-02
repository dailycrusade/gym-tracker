import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  {
    label: 'Home',
    to: '/',
    end: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Workout',
    to: '/workout',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" />
      </svg>
    ),
  },
  {
    label: 'Leaderboard',
    to: '/leaderboard',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1Z" />
        <path d="M13 5h-2a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
        <path d="M20 12h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1Z" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    to: '/profile',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

function getInitials(displayName, email) {
  if (displayName) return displayName.trim()[0].toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function AppShell({ children }) {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('avatar_url, display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url ?? null)
          setDisplayName(data.display_name ?? null)
        }
      })
  }, [user])

  return (
    <div className="flex flex-col min-h-screen bg-mg-black">
      {/* Top header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-mg-surface border-b border-mg-border">
        <span className="font-display text-lg font-bold">
          <span className="text-mg-purple">Miller's</span>
          <span className="text-mg-teal"> Garage</span>
        </span>

        <NavLink to="/profile" className="block h-8 w-8 rounded-full overflow-hidden shrink-0">
          {avatarUrl && !imgFailed ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-mg-purple/20 text-mg-purple text-sm font-semibold select-none">
              {getInitials(displayName, user?.email)}
            </div>
          )}
        </NavLink>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex bg-mg-surface border-t border-mg-border">
        {NAV_ITEMS.map(({ label, to, end, disabled, icon }) =>
          disabled ? (
            <div
              key={label}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-mg-cream/30 cursor-not-allowed"
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </div>
          ) : (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  isActive ? 'text-mg-purple' : 'text-mg-cream/50',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-mg-teal" />
                  )}
                  {icon}
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          )
        )}
      </nav>
    </div>
  )
}
