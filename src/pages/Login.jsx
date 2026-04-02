import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  useEffect(() => { document.title = "Sign In — Miller's Garage"; }, [])

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const isSignUp = mode === 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    } else if (isSignUp) {
      setMessage('Check your email for a confirmation link.')
    }

    setLoading(false)
  }

  async function handleGoogle() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#7B68EE' }}>
            Miller's
          </span>
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#6DD5D5' }}>
            {' '}Garage
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h1 className="mb-6 text-center text-xl font-semibold text-white">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h1>

          {/* Google SSO */}
          <button
            onClick={handleGoogle}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#7B68EE] focus:ring-1 focus:ring-[#7B68EE]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#7B68EE] focus:ring-1 focus:ring-[#7B68EE]"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: '#6DD5D520', color: '#6DD5D5' }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7B68EE, #6DD5D5)' }}
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="mt-5 text-center text-xs text-white/40">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); setMessage(null) }}
              className="font-medium transition hover:opacity-80"
              style={{ color: '#7B68EE' }}
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.583 9 3.583Z" fill="#EA4335"/>
    </svg>
  )
}
