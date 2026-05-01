'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Profile {
  name: string; sex: string; dob: string; zip_code: string; mobile: string;
  favorite_drinks: string[]; favorite_ingredients: string[]; favorite_locations: string[];
}
const EMPTY: Profile = { name: '', sex: '', dob: '', zip_code: '', mobile: '', favorite_drinks: [], favorite_ingredients: [], favorite_locations: [] }

function TagInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setInput('')
  }
  return (
    <div>
      <label className="section-title" style={{ display: 'block' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {values.map(v => (
          <span key={v} className="tag">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem', padding: 0 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input className="warm-input" type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={placeholder} style={{ flex: 1 }} />
        <button type="button" onClick={add} className="warm-btn-ghost">Add</button>
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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '')
        supabase.from('users').select('*').eq('id', user.id).single()
          .then(({ data }) => { if (data) setProfile(data as Profile) })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('users').upsert({ id: user.id, email: user.email, ...profile, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  const fields = [
    { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
    { key: 'zip_code', label: 'ZIP Code', type: 'text', placeholder: '10001' },
    { key: 'mobile', label: 'Mobile', type: 'tel', placeholder: '+1 555 000 0000' },
    { key: 'dob', label: 'Date of Birth', type: 'date', placeholder: '' },
  ]

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
        <main className="warm-main" style={{ maxWidth: 720 }}>
          <h1 className="hero-title" style={{ marginBottom: '0.3rem' }}>Your Profile</h1>
          {email && <p className="hero-note" style={{ marginBottom: '2rem' }}>Signed in as {email}</p>}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Basic Info */}
            <div className="glass" style={{ padding: '1.75rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">Basic Info</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {fields.map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>{label}</label>
                    <input className="warm-input" type={type} placeholder={placeholder}
                      value={(profile as unknown as Record<string, string>)[key] ?? ''}
                      onChange={e => setProfile({ ...profile, [key]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <label className="section-title" style={{ display: 'block', marginBottom: '0.3rem' }}>Sex</label>
                  <select className="warm-input" value={profile.sex} onChange={e => setProfile({ ...profile, sex: e.target.value })}
                    style={{ cursor: 'pointer' }}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Favorites */}
            <div className="glass" style={{ padding: '1.75rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 className="section-title">Your Favorites</h2>
              <TagInput label="Favorite Drinks" values={profile.favorite_drinks} onChange={v => setProfile({ ...profile, favorite_drinks: v })} placeholder="e.g. Oat Latte, Negroni…" />
              <TagInput label="Favorite Ingredients" values={profile.favorite_ingredients} onChange={v => setProfile({ ...profile, favorite_ingredients: v })} placeholder="e.g. Cardamom, Mezcal…" />
              <TagInput label="Favorite Locations" values={profile.favorite_locations} onChange={v => setProfile({ ...profile, favorite_locations: v })} placeholder="e.g. Brooklyn, Lower East Side…" />
            </div>

            <button type="submit" className="warm-btn" style={{ width: '100%', fontSize: '1.05rem', padding: '1rem' }} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✅ Saved!' : 'Save Profile'}
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}
