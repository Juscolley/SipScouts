'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        <div className="glass" style={{ width: '100%', maxWidth: 430, padding: '2.75rem 2.25rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
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
              marginBottom: '0.65rem',
            }}
          />
          <h1 className="serif" style={{ fontSize: '2.5rem', marginBottom: '0.35rem' }}>SipScouts</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
            Join Free or Sign In — save spots, favorite drinks &amp; ingredients ☕🍸🍵
          </p>

          {sent ? (
            <div style={{ padding: '1.5rem', background: 'rgba(226,114,91,0.08)', borderRadius: 14, border: '1px solid rgba(226,114,91,0.2)' }}>
              <p style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>✨</p>
              <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.4rem' }}>Magic Sign-In Link Sent!</p>
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Check your inbox at <strong>{email}</strong> and tap the link to open your Saved Places &amp; Profile.
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                💡 <em>Note: The verification email is delivered via our secure login partner (<strong>Supabase Auth</strong>). Check your Spam/Promotions folder if it doesn&apos;t appear within 30 seconds.</em>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Email address</label>
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
                {loading ? 'Sending…' : '✨ Send Free Magic Link'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                100% Free · No password needed — we&apos;ll email you a 1-tap link to access your Saved Places &amp; Profile.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
