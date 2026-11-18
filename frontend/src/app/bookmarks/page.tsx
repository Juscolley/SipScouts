'use client'

import { useBookmarks } from '@/hooks/useBookmarks'
import dynamic from 'next/dynamic'
import { Bookmark, Navigation, ArrowLeft, Settings, Sparkles } from 'lucide-react'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })

export default function BookmarksPage() {
  const { bookmarks, toggle, isLoggedIn, isAdmin } = useBookmarks()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="warm-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">
            <img src="/sipscouts-logo.png" alt="SipScouts" className="logo-mark" />
            <span>SipScouts</span>
          </a>
          <nav className="nav-links">
            <a href="/discover">Discover</a>
            <span className="active">Saved</span>
            <a href="/profile">Profile</a>
            {isAdmin && <a href="/merchant">B2B Dashboard</a>}
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <a
              href="/discover"
              className="warm-btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#fff',
                borderRadius: 99,
                minHeight: 44,
                padding: '0.5rem 1.1rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
                color: 'var(--text-main)',
              }}
            >
              <ArrowLeft size={15} /> Back to Search
            </a>
            {isLoggedIn && (
              <a
                href="/profile"
                className="warm-btn-ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#fff',
                  borderRadius: 99,
                  minHeight: 44,
                  padding: '0.5rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  color: 'var(--primary)',
                }}
              >
                <Settings size={15} /> Edit Profile &amp; Favorites
              </a>
            )}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            Saved Spots
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text-light)', marginBottom: '1.75rem' }}>
            Your bookmarked cafés, tea houses, and bars.
          </p>

          {!isLoggedIn ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', background: '#fff', borderRadius: 20, border: '1px solid var(--border)' }}>
              <Bookmark size={32} color="var(--primary)" style={{ margin: '0 auto 0.75rem' }} />
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Save Your Favorite Spots
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-light)', maxWidth: 440, margin: '0 auto 1.5rem', lineHeight: 1.55 }}>
                Create a free Profile or Sign In with your email to bookmark cafés &amp; bars, view your saved spots on a map, and save your favorite drinks &amp; ingredients.
              </p>
              <a href="/login" className="warm-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none', minHeight: 44 }}>
                <Sparkles size={16} /> Create Free Profile / Sign In
              </a>
            </div>
          ) : bookmarks.length === 0 ? (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: '#fff', borderRadius: 20, border: '1px solid var(--border)' }}>
              No saved spots yet — tap Save on any venue to bookmark it here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ height: 240, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(74,46,32,0.08)' }}>
                <VenueMap venues={bookmarks.map(b => ({ id: b.id, name: b.venue_name, address: b.venue_address, type: b.venue_type, lat: b.latitude, lng: b.longitude, tags: [] }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(275px, 1fr))', gap: '1rem' }}>
                {bookmarks.map(b => {
                  const dest = b.venue_address && b.venue_address !== 'Nearby'
                    ? `${b.venue_name}, ${b.venue_address}`
                    : `${b.latitude},${b.longitude}`
                  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
                  return (
                    <div key={b.id} className="warm-card" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-main)' }}>{b.venue_name}</h3>
                        <button
                          onClick={() => toggle({ name: b.venue_name, address: b.venue_address, type: b.venue_type, lat: b.latitude, lng: b.longitude })}
                          title="Remove bookmark"
                          aria-label={`Remove ${b.venue_name} from saved`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Bookmark size={18} fill="currentColor" />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{b.venue_address}</p>
                      <div>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{b.venue_type.replace('_', ' ')}</span>
                      </div>
                      <a
                        href={dirUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          marginTop: 'auto',
                          minHeight: 44,
                          padding: '0.5rem 0.9rem',
                          borderRadius: 12,
                          background: 'var(--primary)',
                          color: '#fff',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Navigation size={15} /> Directions
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
