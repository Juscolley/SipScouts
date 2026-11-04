'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useBookmarks } from '@/hooks/useBookmarks'
import { trackVenueAction } from '@/lib/analytics'

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

function isProfilePopulated(p: Profile): boolean {
  return Boolean(
    p.name.trim() ||
    p.zip_code.trim() ||
    p.favorite_drinks.length > 0 ||
    p.favorite_ingredients.length > 0
  )
}

function mergeTags(existing: string[], rawInput: string, maxItems = MAX_FAVORITES): string[] {
  if (!rawInput.trim()) return existing.slice(0, maxItems)
  const parts = rawInput
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const next = [...existing]
  for (const part of parts) {
    if (!next.some(x => x.toLowerCase() === part.toLowerCase()) && next.length < maxItems) {
      next.push(part)
    }
  }
  return next.slice(0, maxItems)
}

function TagInput({
  label,
  values,
  onChange,
  pendingInput,
  onPendingInputChange,
  placeholder,
  maxItems = MAX_FAVORITES,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  pendingInput: string
  onPendingInputChange: (val: string) => void
  placeholder: string
  maxItems?: number
}) {
  const atLimit = values.length >= maxItems

  function commitPending() {
    if (!pendingInput.trim()) return
    const updated = mergeTags(values, pendingInput, maxItems)
    onChange(updated)
    onPendingInputChange('')
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
          value={pendingInput}
          disabled={atLimit}
          onChange={e => onPendingInputChange(e.target.value)}
          onBlur={commitPending}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), commitPending())}
          placeholder={atLimit ? `Maximum of ${maxItems} reached` : placeholder}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={commitPending} disabled={atLimit} className="warm-btn-ghost">
          Add
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [pendingDrinkInput, setPendingDrinkInput] = useState('')
  const [pendingIngredientInput, setPendingIngredientInput] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [badgeCopied, setBadgeCopied] = useState(false)
  const { bookmarks, toggle, userId, isAdmin } = useBookmarks()

  const earnedBadgeName =
    bookmarks.length >= 3
      ? 'Neighborhood Tastemaker'
      : profile.favorite_drinks.some(d => /matcha|tea|chai|hojicha/i.test(d))
      ? 'Matcha & Tea Maven'
      : profile.favorite_drinks.some(d => /martini|negroni|mezcal|spritz|margarita|cocktail/i.test(d))
      ? 'Speakeasy Scout'
      : 'Founding Sip Scout'

  const sipDnaSummary =
    [...profile.favorite_drinks.slice(0, 3), ...profile.favorite_ingredients.slice(0, 2)].join(' · ') ||
    'Specialty Coffee · Ceremonial Matcha · Craft Cocktails'

  async function handleShareBadge() {
    const scoutName = profile.name.trim() || (email ? email.split('@')[0] : 'A Fellow Scout')
    trackVenueAction({
      venue_name: '__BADGE_SHARE__',
      action_type: 'share_badge',
      searched_drink: profile.favorite_drinks[0] || '',
      searched_ingredient: profile.favorite_ingredients[0] || '',
      city: profile.zip_code.trim(),
      zip_code: profile.zip_code.trim(),
      user_id: userId,
    })

    const shareParams = new URLSearchParams()
    shareParams.set('badge', earnedBadgeName)
    shareParams.set('scout', scoutName)
    shareParams.set('drink', sipDnaSummary)
    if (profile.zip_code.trim()) shareParams.set('city', profile.zip_code.trim())

    const shareUrl = `${window.location.origin}/share?${shareParams.toString()}`
    const shareText = `🏅 I unlocked the "${earnedBadgeName}" badge on SipScouts! My Sip DNA: ${sipDnaSummary}. Tap to see my badge & claim yours:`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${scoutName}'s SipScouts Badge`,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
      setBadgeCopied(true)
      setTimeout(() => setBadgeCopied(false), 3000)
    } catch {
      // Ignore
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    try {
      localStorage.removeItem('sipscouts_profile_v1')
      localStorage.setItem('sipscouts_has_account', '1')
    } catch {
      // Ignore
    }
    window.location.href = '/discover'
  }

  function buildQuickSearchHref(opts: { drink?: string; ingredient?: string }) {
    const params = new URLSearchParams()
    if (opts.drink) params.set('drink', opts.drink)
    if (opts.ingredient) params.set('ingredient', opts.ingredient)
    if (profile.zip_code.trim()) params.set('zip', profile.zip_code.trim())
    params.set('autosearch', '1')
    return `/discover?${params.toString()}`
  }

  useEffect(() => {
    let localCandidate: Profile | null = null
    // Load local backup immediately if present
    try {
      const localRaw = localStorage.getItem('sipscouts_profile_v1')
      if (localRaw) {
        const parsed = JSON.parse(localRaw)
        const candidate: Profile = {
          name: parsed.name ?? '',
          zip_code: parsed.zip_code ?? '',
          mobile: parsed.mobile ?? '',
          favorite_drinks: (parsed.favorite_drinks ?? []).slice(0, MAX_FAVORITES),
          favorite_ingredients: (parsed.favorite_ingredients ?? []).slice(0, MAX_FAVORITES),
        }
        if (isProfilePopulated(candidate)) {
          localCandidate = candidate
          setProfile(candidate)
          setHasExistingProfile(true)
          setIsEditing(false)
        }
      }
    } catch {
      // Ignore storage errors
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      setEmail(user.email ?? '')
      try {
        localStorage.setItem('sipscouts_has_account', '1')
      } catch {
        // Ignore
      }

      supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(async ({ data }) => {
          if (data) {
            const loaded: Profile = {
              name: data.name ?? '',
              zip_code: data.zip_code ?? '',
              mobile: data.mobile ?? '',
              favorite_drinks: (data.favorite_drinks ?? []).slice(0, MAX_FAVORITES),
              favorite_ingredients: (data.favorite_ingredients ?? []).slice(0, MAX_FAVORITES),
            }
            const dbPopulated = isProfilePopulated(loaded)
            if (dbPopulated) {
              setProfile(loaded)
              setHasExistingProfile(true)
              setIsEditing(false)
              try {
                localStorage.setItem('sipscouts_profile_v1', JSON.stringify(loaded))
              } catch {
                // Ignore
              }
            } else if (localCandidate && isProfilePopulated(localCandidate)) {
              // Keep local backup and sync it to Supabase so a blank stub row never wipes local profile
              setProfile(localCandidate)
              setHasExistingProfile(true)
              setIsEditing(false)
              await supabase.from('users').upsert({
                id: user.id,
                email: user.email,
                ...localCandidate,
                updated_at: new Date().toISOString(),
              })
            } else {
              setHasExistingProfile(false)
              setIsEditing(true)
            }
          } else if (localCandidate && isProfilePopulated(localCandidate)) {
            setProfile(localCandidate)
            setHasExistingProfile(true)
            setIsEditing(false)
          } else {
            setHasExistingProfile(false)
            setIsEditing(true)
          }
          setLoading(false)
        })
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // Automatically merge any un-added text still sitting in the Drink or Ingredient input boxes!
    const finalDrinks = mergeTags(profile.favorite_drinks, pendingDrinkInput, MAX_FAVORITES)
    const finalIngredients = mergeTags(profile.favorite_ingredients, pendingIngredientInput, MAX_FAVORITES)
    setPendingDrinkInput('')
    setPendingIngredientInput('')

    const cleanProfile: Profile = {
      name: profile.name.trim(),
      zip_code: profile.zip_code.trim(),
      mobile: profile.mobile.trim(),
      favorite_drinks: finalDrinks,
      favorite_ingredients: finalIngredients,
    }
    setProfile(cleanProfile)

    try {
      localStorage.setItem('sipscouts_profile_v1', JSON.stringify(cleanProfile))
      localStorage.setItem('sipscouts_has_account', '1')
    } catch {
      // Ignore storage quota errors
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        ...cleanProfile,
        updated_at: new Date().toISOString(),
      })
    }

    setSaving(false)
    setSaved(true)
    setHasExistingProfile(isProfilePopulated(cleanProfile))
    // Automatically take the user back to their Search Results (or Search page) after saving!
    setTimeout(() => {
      window.location.href = '/discover'
    }, 650)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fcf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  const displayName = profile.name.trim() || (email ? email.split('@')[0] : 'Scout')

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">
            <img src="/sipscouts-logo.png" alt="SipScouts" className="logo-mark" />
            <span>SipScouts</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="/discover">Discover</a>
            <a href="/bookmarks">Saved</a>
            <span className="active">Profile</span>
            <a
              href="https://www.instagram.com/sipscoutsapp/"
              target="_blank"
              rel="noopener noreferrer"
            >
              📸 @SipScoutsApp
            </a>
            {isAdmin && <a href="/merchant">🔒 B2B Dashboard</a>}
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main" style={{ maxWidth: 760 }}>
          {/* Top Navigation & Sign-Out Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
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

            {email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {hasExistingProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(prev => !prev)}
                    className="warm-btn-ghost"
                    style={{
                      background: 'rgba(255, 255, 255, 0.92)',
                      borderRadius: 99,
                      padding: '0.45rem 0.95rem',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {isEditing ? '✓ View Member Hub' : '✏️ Edit Profile'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="warm-btn-ghost"
                  style={{
                    background: 'rgba(255, 255, 255, 0.88)',
                    borderRadius: 99,
                    padding: '0.45rem 0.95rem',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    color: '#a93226',
                    cursor: 'pointer',
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>

          <h1 className="hero-title" style={{ marginBottom: '0.3rem' }}>
            {email
              ? hasExistingProfile && !isEditing
                ? `Welcome back, ${displayName}! 👋`
                : hasExistingProfile
                ? 'Edit Your Profile & Favorites'
                : 'Set Up Your Free SipScouts Profile'
              : 'Your Profile & Saved Places'}
          </h1>
          {email && (
            <p className="hero-note" style={{ marginBottom: '1.75rem' }}>
              ✓ Signed in as <strong>{email}</strong>
              {profile.zip_code.trim() ? ` · 📍 Home Base: ${profile.zip_code.trim()}` : ''}
            </p>
          )}

          {!email ? (
            <div className="glass" style={{ padding: '3rem 2rem', textAlign: 'center', marginTop: '1.25rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</p>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.55rem', marginBottom: '0.6rem', color: 'var(--text-main)' }}>
                Sign In to Your Profile or Join Free
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text-light)', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                Anyone can search SipScouts instantly! Sign in to your existing profile or create a free one with your email (no password needed) to:
              </p>
              <ul style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-main)', textAlign: 'left', maxWidth: 380, margin: '0 auto 1.75rem', lineHeight: 1.8, listStyle: 'none', padding: 0 }}>
                <li>🔖 <strong>Save &amp; Bookmark</strong> your favorite cafés, tea houses, and bars</li>
                <li>🗺️ <strong>View your Saved spots</strong> anytime on your personal map</li>
                <li>⚡ <strong>1-Tap Search</strong> your saved Favorite Drinks &amp; Ingredients</li>
              </ul>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href="/login?mode=signin" className="warm-btn" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.85rem 1.65rem' }}>
                  🔑 Sign In (Existing Profile)
                </a>
                <a href="/login?mode=join" className="warm-btn-ghost" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.85rem 1.65rem', background: 'rgba(255,255,255,0.9)' }}>
                  ✨ Join Free (New Profile)
                </a>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Shareable Scout Badge & Sip DNA Card */}
              <div
                className="glass"
                style={{
                  padding: '1.5rem 1.75rem',
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, rgba(74, 46, 32, 0.94) 0%, rgba(42, 24, 16, 0.96) 100%)',
                  color: '#FAF3E8',
                  border: '1.5px solid rgba(226, 114, 91, 0.55)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <img
                      src="/sipscouts-mascot.jpg"
                      alt="Scout Mascot"
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 14,
                        objectFit: 'cover',
                        border: '2px solid #FFCBA4',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          background: 'rgba(226, 114, 91, 0.28)',
                          border: '1px solid #E2725B',
                          color: '#FFCBA4',
                          borderRadius: 99,
                          padding: '0.18rem 0.65rem',
                          fontSize: '0.74rem',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 700,
                          marginBottom: '0.3rem',
                        }}
                      >
                        🏅 {earnedBadgeName}
                      </span>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', color: '#FAF3E8', margin: 0 }}>
                        Your Shareable Scout Badge &amp; Sip DNA
                      </h3>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#E8D5C4', marginTop: '0.2rem' }}>
                        <strong>Sip DNA:</strong> {sipDnaSummary}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleShareBadge}
                    className="warm-btn"
                    style={{
                      padding: '0.7rem 1.2rem',
                      fontSize: '0.88rem',
                      borderRadius: 99,
                    }}
                  >
                    {badgeCopied ? '✅ Badge Link Copied!' : '📲 Share Badge Card'}
                  </button>
                </div>
              </div>

              {/* RETURNING MEMBER HUB VIEW (Shown automatically when profile is already set up and not actively editing) */}
              {hasExistingProfile && !isEditing && (
                <>
                  {/* 1-Tap Quick Scout Card for Saved Favorites */}
                  <div className="glass" style={{ padding: '1.75rem', borderRadius: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <h2 className="section-title" style={{ margin: 0 }}>
                          ⚡ 1-Tap Quick Scout — Your Saved Favorites
                        </h2>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                          Tap any of your saved drinks or ingredients below to immediately scout nearby spots
                          {profile.zip_code.trim() ? ` around ${profile.zip_code.trim()}` : ''}:
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="warm-btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: 99 }}
                      >
                        + Add / Edit Favorites
                      </button>
                    </div>

                    {profile.favorite_drinks.length === 0 && profile.favorite_ingredients.length === 0 ? (
                      <div style={{ padding: '1rem', background: 'rgba(226, 114, 91, 0.08)', borderRadius: 12 }}>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.86rem', color: 'var(--text-main)', margin: 0 }}>
                          You haven&apos;t added your Favorite Drinks or Ingredients yet.{' '}
                          <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            Add up to 5 of each →
                          </button>
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                        {profile.favorite_drinks.length > 0 && (
                          <div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                              ☕🍸 Favorite Drinks (Tap to Search)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {profile.favorite_drinks.map(d => (
                                <a
                                  key={d}
                                  href={buildQuickSearchHref({ drink: d })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: 'var(--primary)',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    padding: '0.48rem 0.95rem',
                                    borderRadius: 99,
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.84rem',
                                    fontWeight: 600,
                                    boxShadow: '0 3px 10px rgba(226, 114, 91, 0.28)',
                                  }}
                                >
                                  🔍 Scout &ldquo;{d}&rdquo; →
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {profile.favorite_ingredients.length > 0 && (
                          <div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                              ✨ Favorite Ingredients (Tap to Search)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {profile.favorite_ingredients.map(ing => (
                                <a
                                  key={ing}
                                  href={buildQuickSearchHref({ ingredient: ing })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: 'rgba(74, 46, 32, 0.9)',
                                    color: '#FAF3E8',
                                    textDecoration: 'none',
                                    padding: '0.48rem 0.95rem',
                                    borderRadius: 99,
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.84rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  ✨ Scout &ldquo;{ing}&rdquo; →
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Member Profile Summary Card */}
                  <div className="glass" style={{ padding: '1.5rem 1.75rem', borderRadius: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      <h2 className="section-title" style={{ margin: 0 }}>👤 Your Member Profile</h2>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="warm-btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', borderRadius: 99 }}
                      >
                        ✏️ Edit Profile Details
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Name</div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '0.15rem' }}>{profile.name.trim() || 'Not set'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Verified Email</div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '0.15rem' }}>{email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Home City / ZIP</div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '0.15rem' }}>{profile.zip_code.trim() || 'Using live GPS'}</div>
                      </div>
                      {profile.mobile.trim() && (
                        <div>
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Phone</div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '0.15rem' }}>{profile.mobile}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Saved Places Summary */}
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

              {/* Editable Profile Form (Shown automatically for brand-new users OR when an existing user clicks "Edit Profile") */}
              {(!hasExistingProfile || isEditing) && (
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass" style={{ padding: '1.75rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h2 className="section-title" style={{ margin: 0 }}>
                        {hasExistingProfile ? '✏️ Update Your Profile Info' : '✨ Complete Your Free Profile'}
                      </h2>
                      {hasExistingProfile && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel Editing
                        </button>
                      )}
                    </div>
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
                          placeholder="e.g. Norfolk, VA or 23510"
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
                      pendingInput={pendingDrinkInput}
                      onPendingInputChange={setPendingDrinkInput}
                      placeholder="e.g. Oat Latte, Matcha, Saffron Martini…"
                      maxItems={5}
                    />
                    <TagInput
                      label="Favorite Ingredients (Up to 5)"
                      values={profile.favorite_ingredients}
                      onChange={v => setProfile({ ...profile, favorite_ingredients: v })}
                      pendingInput={pendingIngredientInput}
                      onPendingInputChange={setPendingIngredientInput}
                      placeholder="e.g. Cardamom, Yuzu, Pistachio, Lavender…"
                      maxItems={5}
                    />
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <button type="submit" className="warm-btn" style={{ flex: '2 1 220px', fontSize: '1.05rem', padding: '1rem' }} disabled={saving}>
                      {saving ? 'Saving Profile…' : saved ? '✅ Profile Saved! Taking you to Search…' : 'Save Profile & Return to Search →'}
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
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
