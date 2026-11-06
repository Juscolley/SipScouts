'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'join'>('signin')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    if (hash.includes('access_token=') || search.includes('code=') || search.includes('token_hash=')) {
      window.location.replace(`/auth/callback${search}${hash}`)
      return
    }

    const params = new URLSearchParams(search)
    const requestedMode = params.get('mode')
    if (requestedMode === 'join') {
      setMode('join')
    } else if (requestedMode === 'signin') {
      setMode('signin')
    } else {
      // If browser has a previously saved profile backup or has signed in before, default to 'signin'
      try {
        const hasLocalProfile = localStorage.getItem('sipscouts_profile_v1') || localStorage.getItem('sipscouts_has_account')
        setMode(hasLocalProfile ? 'signin' : 'join')
      } catch {
        setMode('signin')
      }
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace('/profile')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.replace('/profile')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const cleanToken = otpCode.trim()
    if (!cleanToken) return
    setVerifying(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: cleanToken,
      type: 'email',
    })
    if (error) {
      setError(error.message)
      setVerifying(false)
    } else if (data?.session) {
      window.location.replace('/profile')
    } else {
      window.location.replace('/profile')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <div className="page-center">
        <div className="glass" style={{ width: '100%', maxWidth: 450, padding: '2.5rem 2.15rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <a href="/discover" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to Search Results
            </a>
          </div>

          <img
            src="/sipscouts-logo.png"
            alt="SipScouts"
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              objectFit: 'cover',
              border: '1.5px solid rgba(226, 114, 91, 0.45)',
              boxShadow: '0 6px 18px rgba(74, 46, 32, 0.22)',
              marginBottom: '0.6rem',
            }}
          />

          {/* Mode Toggle: Sign In (Returning Member) vs. Join Free (New Member) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.35rem',
              background: 'rgba(74, 46, 32, 0.08)',
              padding: '0.3rem',
              borderRadius: 99,
              marginBottom: '1.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => { setMode('signin'); setSent(false); setError('') }}
              style={{
                border: 'none',
                borderRadius: 99,
                padding: '0.5rem 0.75rem',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mode === 'signin' ? 'var(--primary)' : 'transparent',
                color: mode === 'signin' ? '#fff' : 'var(--text-main)',
                boxShadow: mode === 'signin' ? '0 3px 10px rgba(226, 114, 91, 0.35)' : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              🔑 Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('join'); setSent(false); setError('') }}
              style={{
                border: 'none',
                borderRadius: 99,
                padding: '0.5rem 0.75rem',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mode === 'join' ? 'var(--primary)' : 'transparent',
                color: mode === 'join' ? '#fff' : 'var(--text-main)',
                boxShadow: mode === 'join' ? '0 3px 10px rgba(226, 114, 91, 0.35)' : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              ✨ Join Free
            </button>
          </div>

          <h1 className="serif" style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>
            {mode === 'signin' ? 'Welcome Back, Scout' : 'Create Free Profile'}
          </h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {mode === 'signin'
              ? 'Enter the email on your existing SipScouts profile to open your Member Hub, Saved Places & 1-Tap Favorites ☕🍸🍵'
              : 'Join 100% free — save spots (🔖), set your Home ZIP & store up to 5 Favorite Drinks and Ingredients ☕🍸🍵'}
          </p>

          {sent ? (
            <div style={{ padding: '1.5rem', background: 'rgba(226,114,91,0.08)', borderRadius: 14, border: '1px solid rgba(226,114,91,0.2)', textAlign: 'left' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '1.8rem' }}>✨</span>
                <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1.05rem', marginTop: '0.2rem' }}>
                  {mode === 'signin' ? 'Sign-In Link & Code Sent!' : 'Magic Link & Code Sent!'}
                </p>
                <p style={{ color: 'var(--text-light)', fontSize: '0.86rem', marginTop: '0.2rem', lineHeight: 1.45 }}>
                  Sent to <strong>{email}</strong>
                </p>
              </div>

              {/* Direct 6-Digit OTP Form for PWA & Safari */}
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(226,114,91,0.3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem', fontFamily: 'Inter, sans-serif' }}>
                    📱 Enter 6-Digit Code from Email
                  </label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.35 }}>
                    Best for iPhone &amp; App users — enter the 6-digit code without leaving this screen!
                  </p>
                  <input
                    className="warm-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    placeholder="e.g. 123456"
                    style={{ fontSize: '1.25rem', letterSpacing: '0.25rem', textAlign: 'center', fontWeight: 700 }}
                    required
                  />
                </div>

                {error && <p style={{ color: '#c0392b', fontSize: '0.82rem', margin: 0 }}>{error}</p>}

                <button
                  type="submit"
                  className="warm-btn"
                  style={{ width: '100%', padding: '0.75rem' }}
                  disabled={verifying || !otpCode.trim()}
                >
                  {verifying ? 'Verifying Code…' : '✓ Verify Code & Open Profile'}
                </button>
              </form>

              <div style={{ marginTop: '1.2rem', paddingTop: '0.9rem', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45, margin: 0 }}>
                  Or tap the direct link in your email if viewing from your desktop browser.
                </p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setError(''); setOtpCode('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.6rem' }}
                >
                  ← Re-enter email or try another address
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>
                  {mode === 'signin' ? 'Your Profile Email Address' : 'Your Email Address'}
                </label>
                <input
                  className="warm-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              {error && <p style={{ color: '#c0392b', fontSize: '0.875rem' }}>{error}</p>}
              <button type="submit" className="warm-btn" style={{ width: '100%' }} disabled={loading}>
                {loading
                  ? 'Sending…'
                  : mode === 'signin'
                  ? '🔑 Send 1-Tap Sign-In Link'
                  : '✨ Send Free Magic Link'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                {mode === 'signin'
                  ? 'No password to remember — tap the link in your email and we will load your saved Profile, Home ZIP, Favorites & Bookmarks automatically.'
                  : '100% Free · No password needed — we\'ll email you a 1-tap link to set up your Profile & return to your search.'}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
