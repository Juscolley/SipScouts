'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useGeolocation, distanceKm } from '@/hooks/useGeolocation'
import { useBookmarks } from '@/hooks/useBookmarks'
import NotificationBell from '@/components/NotificationBell'
import InstallAppButton from '@/components/InstallAppButton'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })

interface Venue {
  id: string
  name: string
  address: string
  type: 'cafe' | 'bar'
  lat: number
  lng: number
  tags: string[]
  phone?: string | null
  open_now?: boolean | null
  website?: string | null
  instagram_url?: string | null
  distanceKm?: number
}

const SEARCH_STORAGE_KEY = 'sipscouts_last_search_v1'

export default function DiscoverPage() {
  const [drink, setDrink] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [profilePromptVenue, setProfilePromptVenue] = useState<string | null>(null)

  const geo = useGeolocation()
  const { isBookmarked, toggle, isLoggedIn } = useBookmarks()

  const queryLabel = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'your perfect sip'
  const scoutingMessages = [
    `📍 Scouting nearby cafés, tea houses & bars for "${queryLabel}"…`,
    `📸 Checking local Instagram & TikTok posts for "${queryLabel}"…`,
    `⭐ Cross-checking Google Places & Yelp menus and reviews…`,
    `💬 Scanning neighborhood Reddit threads for hidden gems…`,
    `🗺️ Ranking discovered spots by distance from you…`,
  ]

  // Restore last search from sessionStorage when user returns from Profile / Saved / Magic Link
  useEffect(() => {
    try {
      const savedRaw = sessionStorage.getItem(SEARCH_STORAGE_KEY)
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (parsed && Array.isArray(parsed.venues) && parsed.searched) {
          setDrink(parsed.drink ?? '')
          setIngredient(parsed.ingredient ?? '')
          setLocationInput(parsed.locationInput ?? '')
          setSearchCenter(parsed.searchCenter ?? null)
          setVenues(parsed.venues)
          setSearched(true)
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      setStatusIndex(0)
      return
    }
    const interval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % scoutingMessages.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [loading, scoutingMessages.length])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (drink) params.set('drink', drink)
      if (ingredient) params.set('ingredient', ingredient)

      let activeLat = geo.latitude
      let activeLng = geo.longitude

      if (locationInput.trim()) {
        params.set('zip_code', locationInput.trim())
      } else {
        // If user clicked Search while GPS is still initializing, grab client IP coordinates immediately so it never defaults to NYC
        if (activeLat === null || activeLng === null) {
          try {
            const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json')
            if (ipRes.ok) {
              const ipData = await ipRes.json()
              const parsedLat = parseFloat(ipData.latitude)
              const parsedLng = parseFloat(ipData.longitude)
              if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
                activeLat = parsedLat
                activeLng = parsedLng
              }
            }
          } catch {
            // Backend will also check client IP headers as a second safety net
          }
        }
        if (activeLat !== null && activeLng !== null) {
          params.set('lat', String(activeLat))
          params.set('lng', String(activeLng))
        }
      }

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      let results: Venue[] = data.venues ?? []
      const refLat: number | null = data.center?.lat ?? activeLat
      const refLng: number | null = data.center?.lng ?? activeLng
      const newCenter = refLat && refLng ? { lat: refLat, lng: refLng } : null
      if (refLat && refLng) {
        setSearchCenter(newCenter)
        results = results
          .map(v => ({ ...v, distanceKm: distanceKm(refLat, refLng, v.lat, v.lng) }))
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      }
      setVenues(results)
      try {
        sessionStorage.setItem(
          SEARCH_STORAGE_KEY,
          JSON.stringify({
            drink,
            ingredient,
            locationInput,
            searchCenter: newCenter,
            venues: results,
            searched: true,
          })
        )
      } catch {
        // Ignore storage quota errors
      }
    } catch {
      setVenues([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      {/* Fixed hero background */}
      <div className="hero-bg" />
      <div className="hero-overlay" />

      {/* Header */}
      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">SipScouts</a>
          <nav className="nav-links">
            <span className="active">Discover</span>
            <a href="/bookmarks">Saved</a>
            <a href="/profile">Profile</a>
            <a href="/merchant">Dashboard</a>
            {isLoggedIn ? (
              <a href="/profile" className="nav-btn">My Profile ✓</a>
            ) : (
              <a href="/login" className="nav-btn">Join Free · Sign In</a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero + Search */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 1.75rem', textAlign: 'center' }}>
          <h1 className="hero-title">
            Find your next perfect sip
          </h1>
          <p className="hero-sub">
            Coffee, tea, or craft cocktails — search by drink or ingredient and we&apos;ll surface hidden gems sorted by distance.
          </p>
          {geo.source === 'gps' && (
            <p className="hero-note">📍 Currently using your exact GPS location</p>
          )}
          {geo.source === 'ip' && (
            <p className="hero-note">
              📍 Near {geo.cityLabel || 'your area'}{' '}
              <button
                type="button"
                onClick={geo.requestLocation}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '0.15rem 0.6rem',
                  fontSize: '0.75rem',
                  marginLeft: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                Use Exact GPS
              </button>
            </p>
          )}
          {!geo.latitude && !geo.loading && (
            <p className="hero-note">
              <button
                type="button"
                onClick={geo.requestLocation}
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                📍 Tap to Enable Location (or enter Zip / City below)
              </button>
            </p>
          )}
        </section>

        <form onSubmit={handleSearch} style={{ maxWidth: 820, margin: '0 auto', padding: '0 1.5rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 190px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Drink</label>
            <input className="warm-input" type="text" value={drink} onChange={e => setDrink(e.target.value)} placeholder="e.g. Oat Latte, Matcha, Negroni…" />
          </div>
          <div style={{ flex: '1 1 190px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Ingredient</label>
            <input className="warm-input" type="text" value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="e.g. Cardamom, Yuzu, Mezcal…" />
          </div>
          <div style={{ flex: '1 1 170px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Near (Zip or City)</label>
            <input
              className="warm-input"
              type="text"
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              placeholder="ZIP or CITY"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 140px' }}>
            <button type="submit" className="warm-btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? '🔍 Searching…' : '🔍 Search'}
            </button>
          </div>
        </form>

        {/* Prominent Mobile-First Action Row directly below Search */}
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 1.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <InstallAppButton />
          <NotificationBell />
        </div>

        {/* Instant-Use + Free Profile Perks Callout */}
        {!isLoggedIn && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1.5rem 2.25rem', textAlign: 'center' }}>
            <div
              className="glass"
              style={{
                padding: '0.75rem 1.15rem',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.88)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.84rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              ✨ <strong>Search instantly above!</strong> Want to save locations (🔖), view your{' '}
              <a href="/bookmarks" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
                Saved spots
              </a>
              , and store your <strong>Favorite Drinks &amp; Ingredients</strong>?{' '}
              <a
                href="/login"
                style={{
                  display: 'inline-block',
                  marginLeft: '0.25rem',
                  color: '#fff',
                  background: 'var(--primary)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 99,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textDecoration: 'none',
                }}
              >
                Create Free Profile →
              </a>
            </div>
          </div>
        )}

        {/* Results */}
        {searched && (
          <section style={{ maxWidth: 1024, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
            <div style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(74,46,32,0.1)' }}>
              <VenueMap venues={venues} userLat={(searchCenter?.lat ?? geo.latitude) ?? undefined} userLng={(searchCenter?.lng ?? geo.longitude) ?? undefined} />
            </div>

            {loading ? (
              <div className="glass" role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center', gap: '1rem' }}>
                <div className="spinner" />
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, transition: 'opacity 0.3s ease' }}>
                  {scoutingMessages[statusIndex]}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Deep-scouting menus &amp; social posts so no hidden local gem is skipped…
                </p>
              </div>
            ) : venues.length === 0 ? (
              <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No venues found yet. Try a different drink, ingredient, or city!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '1rem' }}>
                {venues.map(v => (
                  <div key={v.id} className="warm-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-main)' }}>{v.name}</h3>
                        {v.distanceKm !== undefined && (
                          <p className="distance">
                            {v.distanceKm < 1 ? `${Math.round(v.distanceKm * 1000)}m` : `${v.distanceKm.toFixed(1)} km`} · {(v.distanceKm * 0.621371).toFixed(1)} mi away
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{v.type}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLoggedIn) {
                              toggle({ name: v.name, address: v.address, type: v.type, lat: v.lat, lng: v.lng })
                            } else {
                              setProfilePromptVenue(v.name)
                            }
                          }}
                          style={{
                            background: isBookmarked(v.name) ? 'rgba(226,114,91,0.16)' : 'rgba(74,46,32,0.06)',
                            border: '1px solid var(--border)',
                            borderRadius: 99,
                            padding: '0.22rem 0.6rem',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            color: isBookmarked(v.name) ? 'var(--primary)' : 'var(--text-main)',
                            transition: 'all 0.2s',
                          }}
                          title={isBookmarked(v.name) ? 'Remove from Saved' : 'Save this location'}
                        >
                          {isBookmarked(v.name) ? '🔖 Saved' : '🔖 Save'}
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{v.address}</p>

                    {/* Compact Action Row: Open/Closed Badge + 1-Tap Call + Social / Website Links */}
                    {(v.open_now !== undefined && v.open_now !== null) || v.phone || v.instagram_url || v.website ? (
                      <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
                        {v.open_now === true && (
                          <span className="tag tag-green" style={{ fontSize: '0.74rem', padding: '0.18rem 0.6rem' }}>
                            🟢 Open Now
                          </span>
                        )}
                        {v.open_now === false && (
                          <span className="tag tag-ghost" style={{ fontSize: '0.74rem', padding: '0.18rem 0.6rem', color: '#a94442' }}>
                            🔴 Closed
                          </span>
                        )}
                        {v.phone && (
                          <a
                            href={`tel:${v.phone}`}
                            className="tag tag-ghost"
                            style={{ fontSize: '0.74rem', padding: '0.18rem 0.6rem', textDecoration: 'none', fontWeight: 600, color: 'var(--text-main)' }}
                            title={`Call ${v.phone}`}
                          >
                            📞 Call
                          </a>
                        )}
                        {v.instagram_url && (
                          <a
                            href={v.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tag tag-ghost"
                            style={{ fontSize: '0.74rem', padding: '0.18rem 0.6rem', textDecoration: 'none', fontWeight: 600, color: 'var(--primary)' }}
                          >
                            📸 Instagram
                          </a>
                        )}
                        {v.website && (
                          <a
                            href={v.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tag tag-ghost"
                            style={{ fontSize: '0.74rem', padding: '0.18rem 0.6rem', textDecoration: 'none', fontWeight: 600, color: 'var(--text-light)' }}
                          >
                            🌐 Menu / Site
                          </a>
                        )}
                      </div>
                    ) : null}

                    {v.tags.length > 0 && (
                      <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {v.tags.map(tag => <span key={tag} className="tag tag-ghost">{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal shown when a guest taps Save on a venue card */}
      {profilePromptVenue && (
        <div
          onClick={() => setProfilePromptVenue(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(40, 18, 8, 0.55)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass"
            style={{
              maxWidth: 400,
              width: '100%',
              padding: '1.75rem',
              background: '#fcf6f0',
              borderRadius: 24,
              color: 'var(--text-main)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🔖</p>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              Save &ldquo;{profilePromptVenue}&rdquo;
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              Create a free SipScouts Profile (just enter your email — no password needed!) to bookmark favorite spots, view your <strong>Saved</strong> map, and save up to 5 <strong>Favorite Drinks &amp; Ingredients</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <a
                href="/login"
                className="warm-btn"
                style={{ width: '100%', textDecoration: 'none', display: 'inline-block', padding: '0.75rem 1rem' }}
              >
                ✨ Join Free · Sign In
              </a>
              <button
                type="button"
                onClick={() => setProfilePromptVenue(null)}
                className="warm-btn-ghost"
                style={{ width: '100%', padding: '0.55rem 1rem', cursor: 'pointer' }}
              >
                Continue Scouting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
