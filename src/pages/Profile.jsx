import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import WorkoutHistory from '../components/WorkoutHistory'
import { useSugarWodIdentity } from '../hooks/useSugarWodIdentity'

// ─── helpers ────────────────────────────────────────────────────────────────

function getInitials(displayName, email) {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

const TIER_TAGLINES = {
  community: 'Part of the founding crew',
  founding: 'Part of the founding crew',
  core: 'The heartbeat of the garage',
  legacy: 'A pillar of this community',
}

function tierTagline(tier) {
  if (!tier) return 'Member of Miller\'s Garage'
  return TIER_TAGLINES[tier.toLowerCase()] ?? 'Member of Miller\'s Garage'
}

function tierLabel(tier) {
  if (!tier) return 'Member'
  return tier.charAt(0).toUpperCase() + tier.slice(1) + ' Member'
}

const DEFAULT_PREFS = {
  units: 'imperial',
  show_on_leaderboard: true,
  primary_device: 'both',
}

const DEFAULT_NOTIFS = {
  gym_announcements: true,
  event_reminders: true,
  workout_summaries: true,
  community_updates: true,
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed bottom-24 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
      <div
        className="rounded-xl px-5 py-3 text-sm font-medium text-mg-black shadow-lg"
        style={{ background: 'var(--color-mg-teal)' }}
      >
        {message}
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard({ lines = 2 }) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-pulse"
          style={{ background: 'var(--color-mg-border)', width: i === 0 ? '40%' : '70%' }}
        />
      ))}
    </div>
  )
}

// ─── Toggle switch ───────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? 'var(--color-mg-teal)' : 'var(--color-mg-border)' }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full shadow transform transition duration-200"
        style={{
          background: 'white',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

// ─── NotificationRow ─────────────────────────────────────────────────────────

function NotificationRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--color-mg-cream)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sugarwodAthleteId, loading: identityLoading, matched } = useSugarWodIdentity()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Display name editing
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Prefs & notifs (local state, debounced to DB)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS)

  const [toast, setToast] = useState(null)

  // Avatar upload
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  const [avatarImgFailed, setAvatarImgFailed] = useState(false)
  const fileInputRef = useRef(null)

  // Debounce refs
  const prefsTimer = useRef(null)
  const notifsTimer = useRef(null)

  // ── Fetch profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, membership_tier, avatar_url, preferences, notification_settings')
        .eq('id', user.id)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setProfile(data)
        setAvatarUrl(data.avatar_url ?? null)
        setPrefs({ ...DEFAULT_PREFS, ...(data.preferences ?? {}) })
        setNotifs({ ...DEFAULT_NOTIFS, ...(data.notification_settings ?? {}) })
      }
      setLoading(false)
    }
    load()
  }, [user])

  // ── Debounced preference save ──────────────────────────────────────────────
  const savePrefs = useCallback((next) => {
    clearTimeout(prefsTimer.current)
    prefsTimer.current = setTimeout(async () => {
      await supabase
        .from('profiles')
        .update({ preferences: next })
        .eq('id', user.id)
    }, 500)
  }, [user])

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  // ── Debounced notification save ────────────────────────────────────────────
  const saveNotifs = useCallback((next) => {
    clearTimeout(notifsTimer.current)
    notifsTimer.current = setTimeout(async () => {
      await supabase
        .from('profiles')
        .update({ notification_settings: next })
        .eq('id', user.id)
    }, 500)
  }, [user])

  function updateNotif(key, value) {
    const next = { ...notifs, [key]: value }
    setNotifs(next)
    saveNotifs(next)
  }

  // ── Save display name ──────────────────────────────────────────────────────
  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setNameSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
    setNameSaving(false)
    if (!error) {
      setProfile(p => ({ ...p, display_name: trimmed }))
      setEditing(false)
      setToast('Profile updated')
    }
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected after an error
    e.target.value = ''

    setAvatarError(null)

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be 2 MB or smaller.')
      return
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    setAvatarUploading(true)
    setAvatarImgFailed(false)

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setAvatarError(uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    setAvatarUrl(publicUrl)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    setAvatarUploading(false)
    setToast('Avatar updated')
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400">
          Could not load profile: {error}
        </div>
      </div>
    )
  }

  const displayName = profile?.display_name
  const initials = getInitials(displayName, user?.email)
  const role = profile?.role ?? 'member'
  const tier = profile?.membership_tier

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-8">

      {/* ── 1. Header Card ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-6 flex flex-col items-center gap-4 text-center"
        style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
      >
        {/* Avatar */}
        <div className="relative">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />

          {/* Circle — image or initials */}
          <button
            type="button"
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none group"
            aria-label="Change avatar"
          >
            {avatarUrl && !avatarImgFailed ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarImgFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold select-none"
                style={{ background: 'var(--color-mg-purple)', color: 'white' }}
              >
                {initials}
              </div>
            )}

            {/* Upload spinner overlay */}
            {avatarUploading ? (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.6)' }}
              >
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              /* Camera overlay on hover */
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </button>

          {/* Inline validation error */}
          {avatarError && (
            <p className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-red-400">
              {avatarError}
            </p>
          )}
        </div>

        {/* Display name (tappable to edit) */}
        {editing ? (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full rounded-xl border px-4 py-2 text-center text-base font-semibold outline-none focus:ring-1"
              style={{
                background: 'var(--color-mg-black)',
                borderColor: 'var(--color-mg-purple)',
                color: 'var(--color-mg-cream)',
                '--tw-ring-color': 'var(--color-mg-purple)',
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={saveName}
                disabled={nameSaving}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-mg-purple)' }}
              >
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold"
                style={{ color: 'rgba(245,240,232,0.5)', background: 'var(--color-mg-border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(displayName ?? ''); setEditing(true) }}
            className="group flex items-center gap-1.5"
          >
            <span
              className="text-xl font-bold leading-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-mg-cream)' }}
            >
              {displayName ?? user?.email ?? 'Unknown'}
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="opacity-40 group-hover:opacity-80 transition-opacity shrink-0"
              style={{ color: 'var(--color-mg-cream)' }}
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
            </svg>
          </button>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className="rounded-full px-3 py-0.5 text-xs font-semibold"
            style={
              role === 'admin'
                ? { background: 'var(--color-mg-purple)', color: 'white' }
                : { background: 'var(--color-mg-border)', color: 'rgba(245,240,232,0.7)' }
            }
          >
            {role === 'admin' ? 'Admin' : 'Member'}
          </span>
          {tier && (
            <span
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{ background: 'var(--color-mg-border)', color: 'rgba(245,240,232,0.7)' }}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Preferences Card ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border divide-y"
        style={{
          background: 'var(--color-mg-surface)',
          borderColor: 'var(--color-mg-border)',
          '--tw-divide-color': 'var(--color-mg-border)',
        }}
      >
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'rgba(245,240,232,0.5)' }}>
            Preferences
          </h2>
        </div>

        {/* Units toggle */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-mg-cream)' }}>Units</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>Distance, speed, and weight</p>
          </div>
          <div
            className="flex rounded-lg overflow-hidden border text-xs font-semibold"
            style={{ borderColor: 'var(--color-mg-border)' }}
          >
            {['imperial', 'metric'].map(u => (
              <button
                key={u}
                onClick={() => updatePref('units', u)}
                className="px-3 py-1.5 transition-colors capitalize"
                style={
                  prefs.units === u
                    ? { background: 'var(--color-mg-teal)', color: 'var(--color-mg-black)' }
                    : { background: 'transparent', color: 'rgba(245,240,232,0.5)' }
                }
              >
                {u === 'imperial' ? 'Imperial' : 'Metric'}
              </button>
            ))}
          </div>
        </div>

        {/* Show on leaderboard */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-mg-cream)' }}>Show on Leaderboard</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>Appear in public rankings</p>
          </div>
          <ToggleSwitch
            checked={prefs.show_on_leaderboard}
            onChange={v => updatePref('show_on_leaderboard', v)}
          />
        </div>

        {/* Primary device */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-mg-cream)' }}>Primary Device</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>Default machine for workouts</p>
          </div>
          <select
            value={prefs.primary_device}
            onChange={e => updatePref('primary_device', e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none"
            style={{
              background: 'var(--color-mg-black)',
              borderColor: 'var(--color-mg-border)',
              color: 'var(--color-mg-cream)',
            }}
          >
            <option value="echo_bike">Echo Bike</option>
            <option value="ski_erg">Ski Erg</option>
            <option value="both">Both</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* ── 3. Notifications Card ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl border divide-y"
        style={{
          background: 'var(--color-mg-surface)',
          borderColor: 'var(--color-mg-border)',
          '--tw-divide-color': 'var(--color-mg-border)',
        }}
      >
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'rgba(245,240,232,0.5)' }}>
            Notifications
          </h2>
        </div>

        <div className="px-5 divide-y" style={{ '--tw-divide-color': 'var(--color-mg-border)' }}>
          <NotificationRow
            label="Gym Announcements"
            description="Big news from Miller's Garage"
            checked={notifs.gym_announcements}
            onChange={v => updateNotif('gym_announcements', v)}
          />
          <NotificationRow
            label="Event Reminders"
            description="Bible study, game nights, and community events"
            checked={notifs.event_reminders}
            onChange={v => updateNotif('event_reminders', v)}
          />
          <NotificationRow
            label="Workout Summaries"
            description="Weekly recap of your sessions"
            checked={notifs.workout_summaries}
            onChange={v => updateNotif('workout_summaries', v)}
          />
          <NotificationRow
            label="Community Updates"
            description="What your crew is up to"
            checked={notifs.community_updates}
            onChange={v => updateNotif('community_updates', v)}
          />
        </div>
      </div>

      {/* ── 4. Membership Card ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
      >
        <h2 className="text-sm font-semibold tracking-wide uppercase mb-4" style={{ color: 'rgba(245,240,232,0.5)' }}>
          Your Membership
        </h2>
        <p
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-mg-cream)' }}
        >
          {tierLabel(tier)}
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-mg-teal)' }}>
          {tierTagline(tier)}
        </p>
        <p className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>
          To change your membership tier, reach out to Steve or Andrea.
        </p>
      </div>

      {/* ── 5. Workout History ────────────────────────────────────────────── */}
      {identityLoading ? (
        <SkeletonCard lines={4} />
      ) : matched === false ? (
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-mg-surface)', borderColor: 'var(--color-mg-border)' }}
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase mb-3" style={{ color: 'rgba(245,240,232,0.5)' }}>
            Workout History
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-mg-teal)' }}>
            Your workout history links automatically when your SugarWOD email matches your Miller's Garage email.
          </p>
          <p className="text-sm mt-2" style={{ color: 'rgba(245,240,232,0.4)' }}>
            Need help? Reach out to{' '}
            <a href="mailto:hello@millersgarage.com" style={{ color: 'var(--color-mg-teal)' }}>
              hello@millersgarage.com
            </a>
          </p>
        </div>
      ) : (
        <WorkoutHistory athleteId={sugarwodAthleteId} />
      )}

      {/* ── 6. Sign Out ───────────────────────────────────────────────────── */}
      <button
        onClick={handleSignOut}
        className="w-full rounded-2xl border py-3.5 text-sm font-semibold transition-colors hover:bg-red-500/10 active:scale-[0.98]"
        style={{ borderColor: 'rgba(239,68,68,0.5)', color: 'rgb(239,68,68)' }}
      >
        Sign Out
      </button>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
