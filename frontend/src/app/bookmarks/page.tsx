'use client'

import { useBookmarks } from '@/hooks/useBookmarks'
import dynamic from 'next/dynamic'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })

export default function BookmarksPage() {
  const { bookmarks, toggle, isLoggedIn } = useBookmarks()

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">SipScouts</a>
          <nav className="nav-links">
            <a href="/discover">Discover</a>
            <span className="active">Saved</span>
            <a href="/profile">Profile</a>
            <a href="/merchant">Dashboard</a>
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main">
          <h1 className="hero-title" style={{ marginBottom: '0.4rem' }}>Saved Spots</h1>
          <p className="hero-sub" style={{ marginBottom: '2rem' }}>Your bookmarked cafés and bars.</p>

          {!isLoggedIn ? (
            <div className="glass" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>☕</p>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>Sign in to save and view your favourite spots.</p>
              <a href="/login" className="warm-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>Sign In</a>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="glass" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No saved spots yet — tap the 🔖 on any venue to save it here!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ height: 240, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(74,46,32,0.08)' }}>
                <VenueMap venues={bookmarks.map(b => ({ id: b.id, name: b.venue_name, address: b.venue_address, type: b.venue_type as 'cafe' | 'bar', lat: b.latitude, lng: b.longitude, tags: [] }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                {bookmarks.map(b => (
                  <div key={b.id} className="warm-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-main)' }}>{b.venue_name}</h3>
                      <button onClick={() => toggle({ name: b.venue_name, address: b.venue_address, type: b.venue_type, lat: b.latitude, lng: b.longitude })}
                        title="Remove bookmark"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--primary)', transition: 'opacity 0.2s' }}>🔖</button>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>{b.venue_address}</p>
                    <span className="tag" style={{ textTransform: 'capitalize' }}>{b.venue_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
