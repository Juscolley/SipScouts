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
  distanceKm?: number
}

export default function DiscoverPage() {
  const [drink, setDrink] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)

  const geo = useGeolocation()
  const { isBookmarked, toggle, isLoggedIn } = useBookmarks()

  const queryLabel = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'your perfect sip'
  const scoutingMessages = [
    `📍 Scouting nearby cafés & bars for "${queryLabel}"…`,
    `📸 Checking local Instagram & TikTok posts for "${queryLabel}"…`,
    `⭐ Cross-checking Google Places & Yelp menus and reviews…`,
    `💬 Scanning neighborhood Reddit threads for hidden gems…`,
    `🗺️ Ranking discovered spots by distance from you…`,
  ]

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
      if (geo.latitude) params.set('lat', String(geo.latitude))
      if (geo.longitude) params.set('lng', String(geo.longitude))

      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      let results: Venue[] = data.venues ?? []
      if (geo.latitude && geo.longitude) {
        results = results
          .map(v => ({ ...v, distanceKm: distanceKm(geo.latitude!, geo.longitude!, v.lat, v.lng) }))
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      }
      setVenues(results)
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
            <InstallAppButton />
            <NotificationBell />
            <a href="/login" className="nav-btn">Sign In</a>
          </nav>
        </div>
      </header>

      {/* Hero + Search */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem 2rem', textAlign: 'center' }}>
          <h1 className="hero-title">
            Find your next perfect sip
          </h1>
          <p className="hero-sub">
            Search by drink or ingredient — we'll surface hidden gems
            {geo.latitude ? ' sorted by distance from you.' : ' near you.'}
          </p>
          {geo.latitude && <p className="hero-note">📍 Using your location</p>}
          {geo.error && <p className="hero-note">📍 Location unavailable — results won't be sorted by distance.</p>}
        </section>

        <form onSubmit={handleSearch} style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.5rem 3rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Drink</label>
            <input className="warm-input" type="text" value={drink} onChange={e => setDrink(e.target.value)} placeholder="e.g. Oat Latte, Negroni…" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Ingredient</label>
            <input className="warm-input" type="text" value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="e.g. Cardamom, Mezcal…" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="warm-btn" disabled={loading}>
              {loading ? '🔍 Searching…' : '🔍 Search'}
            </button>
          </div>
        </form>

        {/* Results */}
        {searched && (
          <section style={{ maxWidth: 1024, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
            <div style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(74,46,32,0.1)' }}>
              <VenueMap venues={venues} userLat={geo.latitude ?? undefined} userLng={geo.longitude ?? undefined} />
            </div>

            {loading ? (
              <div className="glass" role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center', gap: '1rem' }}>
                <div className="spinner" />
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, transition: 'opacity 0.3s ease' }}>
                  {scoutingMessages[statusIndex]}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Deep-scouting menus & social posts so no hidden local gem is skipped…
                </p>
              </div>
            ) : venues.length === 0 ? (
              <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No venues found yet. Try a different drink or ingredient!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {venues.map(v => (
                  <div key={v.id} className="warm-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-main)' }}>{v.name}</h3>
                        {v.distanceKm !== undefined && (
                          <p className="distance">{v.distanceKm < 1 ? `${Math.round(v.distanceKm * 1000)}m away` : `${v.distanceKm.toFixed(1)}km away`}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{v.type}</span>
                        {isLoggedIn && (
                          <button onClick={() => toggle({ name: v.name, address: v.address, type: v.type, lat: v.lat, lng: v.lng })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: isBookmarked(v.name) ? 1 : 0.35, transition: 'opacity 0.2s' }}
                            title={isBookmarked(v.name) ? 'Remove bookmark' : 'Save spot'}>🔖</button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{v.address}</p>
                    {v.tags.length > 0 && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
    </div>
  )
}
