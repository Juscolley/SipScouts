'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useBookmarks } from '@/hooks/useBookmarks'

interface Profile {
  name: string
  zip_code: string
  mobile: string
  favorite_drinks: string[]
  favorite_ingredients: string[]
}

const EMPTY: Profile = {
  name: '',
  zip_code: '',
  mobile: '',
  favorite_drinks: [],
  favorite_ingredients: [],
}

const MAX_FAVORITES = 5

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  maxItems = MAX_FAVORITES,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  maxItems?: number
}) {
  const [input, setInput] = useState('')
  const atLimit = values.length >= maxItems

  function add() {
    const t = input.trim()
    if (t && !values.includes(t) && values.length < maxItems) {
      onChange([...values, t])
      setInput('')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <label className="section-title" style={{ margin: 0 }}>{label}</label>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: atLimit ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
          {values.length} / {maxItems} saved
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {values.map(v => (
          <span key={v} className="tag">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter(x => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem', padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="warm-input"
          type="text"
          value={input}
          disabled={atLimit}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={atLimit ? `Maximum of ${maxItems} reached` : placeholder}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={add} disabled={atLimit} className="warm-btn-ghost">
          Add
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { bookmarks, toggle } = useBookmarks()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '')
        supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile({
                name: data.name ?? '',
                zip_code: data.zip_code ?? '',
                mobile: data.mobile ?? '',
                favorite_drinks: (data.favorite_drinks ?? []).slice(0, MAX_FAVORITES),
                favorite_ingredients: (data.favorite_ingredients ?? []).slice(0, MAX_FAVORITES),
              })
            }
          })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      name: profile.name,
      zip_code: profile.zip_code,
      mobile: profile.mobile,
      favorite_drinks: profile.favorite_drinks.slice(0, MAX_FAVORITES),
      favorite_ingredients: profile.favorite_ingredients.slice(0, MAX_FAVORITES),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fcf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">SipScouts</a>
          <nav className="nav-links">
            <a href="/discover">Discover</a>
            <a href="/bookmarks">Saved</a>
            <span className="active">Profile</span>
            <a href="/merchant">Dashboard</a>
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main" style={{ maxWidth: 740 }}>
          {/* Prominent Back to Search Results button */}
          <div style={{ marginBottom: '1.25rem' }}>
            <a
              href="/discover"
              className="warm-btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.92)',
                borderRadius: 99,
                padding: '0.5rem 1.1rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
                color: 'var(--text-main)',
                boxShadow: '0 4px 14px rgba(74, 46, 32, 0.12)',
              }}
            >
              ← Back to Your Search Results
            </a>
          </div>

          <h1 className="hero-title" style={{ marginBottom: '0.3rem' }}>Your Profile &amp; Saved Places</h1>
          {email && <p className="hero-note" style={{ marginBottom: '1.75rem' }}>✓ Signed in as {email}</p>}

          {!email ? (
            <div className="glass" style={{ padding: '3rem 2rem', textAlign: 'center', marginTop: '1.25rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</p>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', marginBottom: '0.6rem', color: 'var(--text-main)' }}>
                Create Your Free SipScouts Profile
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text-light)', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                Anyone can search SipScouts instantly! Creating a free profile with your email (no password needed) lets you:
              </p>
              <ul style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-main)', textAlign: 'left', maxWidth: 380, margin: '0 auto 1.75rem', lineHeight: 1.8, listStyle: 'none', padding: 0 }}>
                <li>🔖 <strong>Save &amp; Bookmark</strong> your favorite cafés, tea houses, and bars</li>
                <li>🗺️ <strong>View your Saved spots</strong> anytime on your personal map</li>
                <li>☕ <strong>Save up to 5 Favorite Drinks &amp; 5 Ingredients</strong></li>
              </ul>
              <a href="/login" className="warm-btn" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.9rem 1.75rem' }}>
                ✨ Join Free · Sign In
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Saved Places Summary right at the top after Magic Link sign-in */}
              <div className="glass" style={{ padding: '1.75rem', borderRadius: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>🔖 Your Saved Places ({bookmarks.length})</h2>
                  <a href="/bookmarks" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                    Open Full Saved Map →
                  </a>
                </div>
                {bookmarks.length === 0 ? (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', color: 'var(--text-light)' }}>
                    No saved places yet — head back to your search results and tap <strong>🔖 Save</strong> on any café, tea house, or bar!
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {bookmarks.map(b => (
                      <div key={b.id} className="warm-card" style={{ padding: '0.9rem 1.1rem', background: 'rgba(255,255,255,0.85)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <strong style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', color: 'var(--text-main)' }}>{b.venue_name}</strong>
                          <button
                            type="button"
                            onClick={() => toggle({ name: b.venue_name, address: b.venue_address, type: b.venue_type, lat: b.latitude, lng: b.longitude })}
                            title="Remove saved spot"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                          >
                            🔖
                          </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>{b.venue_address}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile Details Form */}
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass" style={{ padding: '1.75rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 className="section-title">Your Info</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>Full Name</label>
                      <input
                        className="warm-input"
                        type="text"
                        placeholder="Your name"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>Email (Verified)</label>
                      <input
                        className="warm-input"
                        type="email"
                        value={email}
                        readOnly
                        style={{ background: 'rgba(74, 46, 32, 0.06)', color: 'var(--text-light)', cursor: 'default' }}
                      />
                    </div>
                    <div>
                      <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>Home City or ZIP</label>
                      <input
                        className="warm-input"
                        type="text"
                        placeholder="e.g. Austin, TX or 10001"
                        value={profile.zip_code}
                        onChange={e => setProfile({ ...profile, zip_code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>Phone # (Optional)</label>
                      <input
                        className="warm-input"
                        type="tel"
                        placeholder="+1 555 000 0000"
                        value={profile.mobile}
                        onChange={e => setProfile({ ...profile, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Favorites (Capped at 5 each) */}
                <div className="glass" style={{ padding: '1.75rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h2 className="section-title">Your Favorites (Up to 5 Each)</h2>
                  <TagInput
                    label="Favorite Drinks (Up to 5)"
                    values={profile.favorite_drinks}
                    onChange={v => setProfile({ ...profile, favorite_drinks: v })}
                    placeholder="e.g. Oat Latte, Matcha, Mezcal Negroni…"
                    maxItems={5}
                  />
                  <TagInput
                    label="Favorite Ingredients (Up to 5)"
                    values={profile.favorite_ingredients}
                    onChange={v => setProfile({ ...profile, favorite_ingredients: v })}
                    placeholder="e.g. Cardamom, Yuzu, Pistachio, Lavender…"
                    maxItems={5}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button type="submit" className="warm-btn" style={{ flex: '2 1 220px', fontSize: '1.05rem', padding: '1rem' }} disabled={saving}>
                    {saving ? 'Saving…' : saved ? '✅ Profile Saved!' : 'Save Profile'}
                  </button>
                  <a
                    href="/discover"
                    className="warm-btn-ghost"
                    style={{
                      flex: '1 1 180px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.9)',
                      fontWeight: 600,
                      textDecoration: 'none',
                      padding: '1rem',
                      borderRadius: 12,
                    }}
                  >
                    ← Back to Search Results
                  </a>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
