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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
        <div className="glass" style={{ width: '100%', maxWidth: 420, padding: '3rem 2.5rem', textAlign: 'center', position: 'relative', zIndex: 10, animation: 'floatIn 0.7s ease-out forwards', opacity: 0 }}>
          <style>{`@keyframes floatIn { to { opacity: 1; transform: translateY(0); } } div[class="glass"] { transform: translateY(18px); }`}</style>

          <h1 className="serif" style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>SipScouts</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '1rem', marginBottom: '2rem' }}>
            Discover your next favorite sip ☕
          </p>

          {sent ? (
            <div style={{ padding: '1.5rem', background: 'rgba(226,114,91,0.08)', borderRadius: 14, border: '1px solid rgba(226,114,91,0.2)' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨</p>
              <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.4rem' }}>Magic link sent!</p>
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Check your inbox at <strong>{email}</strong></p>
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
                {loading ? 'Sending…' : '✨ Send Magic Link'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No password needed — we'll email you a secure sign-in link.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
