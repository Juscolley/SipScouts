'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'join'>('signin')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
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
            <div style={{ padding: '1.5rem', background: 'rgba(226,114,91,0.08)', borderRadius: 14, border: '1px solid rgba(226,114,91,0.2)' }}>
              <p style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>✨</p>
              <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.4rem' }}>
                {mode === 'signin' ? '1-Tap Sign-In Link Sent!' : 'Magic Setup Link Sent!'}
              </p>
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Check your inbox at <strong>{email}</strong> and tap the link to{' '}
                {mode === 'signin'
                  ? 'open your existing Member Hub, Saved Places & Favorites.'
                  : 'set up your Profile & Saved Places.'}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                💡 <em>Check your Spam/Promotions folder if the email doesn&apos;t appear within 30 seconds.</em>
              </p>
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
