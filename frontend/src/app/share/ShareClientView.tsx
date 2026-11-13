'use client'

import { useState, useMemo } from 'react'
import { trackVenueAction } from '@/lib/analytics'
import { useGeolocation, distanceKm } from '@/hooks/useGeolocation'

interface ShareClientProps {
  badge: string
  scout: string
  venue: string
  address: string
  drink: string
  city: string
  venueLat?: number
  venueLng?: number
  ig?: string
  website?: string
  phone?: string
}

function toSafeHttpUrl(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

export default function ShareClientView({
  badge,
  scout,
  venue,
  address,
  drink,
  city,
  venueLat,
  venueLng,
  ig,
  website,
  phone,
}: ShareClientProps) {
  const [copied, setCopied] = useState(false)
  const geo = useGeolocation()

  const liveDistanceMiles = useMemo(() => {
    if (
      geo.latitude === null ||
      geo.longitude === null ||
      venueLat === undefined ||
      venueLng === undefined
    ) {
      return null
    }
    const km = distanceKm(geo.latitude, geo.longitude, venueLat, venueLng)
    if (Number.isNaN(km)) return null
    return (km * 0.621371).toFixed(1)
  }, [geo.latitude, geo.longitude, venueLat, venueLng])

  const mapsUrl = venue
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue} ${address || city}`)}`
    : ''
  const verifiedIgUrl = toSafeHttpUrl(ig)
  const igUrl = venue
    ? verifiedIgUrl ||
      `https://www.google.com/search?q=${encodeURIComponent(`${venue}${address ? ` ${address}` : city ? ` ${city}` : ''} instagram`)}`
    : ''
  const websiteUrl = toSafeHttpUrl(website)
  const cleanPhone = phone ? phone.replace(/[^\d+().\-\sx]/g, '').trim() : ''

  const venueActionBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    minBlockSize: 38,
    padding: '0.45rem 0.85rem',
    fontSize: '0.84rem',
    fontWeight: 700,
    borderRadius: 12,
    border: '1.5px solid rgba(74, 46, 32, 0.28)',
    color: 'var(--text-main)',
    background: '#ffffff',
    textDecoration: 'none',
    boxShadow: '0 2px 0 rgba(74, 46, 32, 0.14), 0 4px 10px rgba(74, 46, 32, 0.08)',
  }

  async function handleForwardToFriend() {
    const shareUrl = window.location.href
    const shareTitle = venue
      ? `Meet me for ${drink} at ${venue} on SipScouts!`
      : `Check out this "${badge}" badge on SipScouts!`

    trackVenueAction({
      venue_name: venue || '__BADGE_SHARE__',
      venue_address: address,
      action_type: venue ? 'share_venue' : 'share_badge',
      searched_drink: drink,
      city,
    })

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareTitle,
          url: shareUrl,
        })
        return
      } catch {
        // User cancelled or fallback
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Ignore
    }
  }

  const discoverUrl = venue || drink
    ? `/discover?drink=${encodeURIComponent(drink)}&zip=${encodeURIComponent(city)}`
    : '/discover'

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <div className="page-center">
        <div
          className="glass"
          style={{
            width: '100%',
            maxWidth: 500,
            padding: '2.5rem 2rem',
            textAlign: 'center',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            <img
              src="/sipscouts-logo.png"
              alt="SipScouts"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: 'cover',
                border: '2px solid var(--primary)',
                boxShadow: '0 6px 18px rgba(74, 46, 32, 0.22)',
              }}
            />
            <img
              src="/sipscouts-mascot.jpg"
              alt="SipScouts Aardvark Mascot"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: 'cover',
                border: '2px solid rgba(226, 114, 91, 0.45)',
                boxShadow: '0 6px 18px rgba(74, 46, 32, 0.22)',
              }}
            />
          </div>

          <span
            className="tag"
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.35rem 0.95rem',
              marginBottom: '0.85rem',
            }}
          >
            🏅 {badge}
          </span>

          {venue ? (
            <>
              <h1 className="serif" style={{ fontSize: '1.85rem', lineHeight: 1.25, marginBottom: '0.6rem', color: 'var(--text-main)' }}>
                {scout} wants to meet for <span style={{ color: 'var(--primary)' }}>{drink}</span> at {venue}!
              </h1>
              {address && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', color: 'var(--text-light)', marginBottom: '0.85rem' }}>
                  📍 {address}
                  {liveDistanceMiles !== null && (
                    <strong style={{ color: 'var(--primary)', marginLeft: '0.45rem' }}>
                      ({liveDistanceMiles} mi from you)
                    </strong>
                  )}
                </p>
              )}
              {venue && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  {igUrl && (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackVenueAction({
                          venue_name: venue,
                          venue_address: address,
                          action_type: 'instagram',
                          searched_drink: drink,
                          city,
                        })
                      }
                      style={{
                        ...venueActionBtnStyle,
                        border: verifiedIgUrl ? '1.5px solid var(--primary)' : venueActionBtnStyle.border,
                        color: verifiedIgUrl ? 'var(--primary)' : venueActionBtnStyle.color,
                      }}
                    >
                      📸 {verifiedIgUrl ? 'Instagram ↗' : 'Find IG ↗'}
                    </a>
                  )}

                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackVenueAction({
                          venue_name: venue,
                          venue_address: address,
                          action_type: 'website',
                          searched_drink: drink,
                          city,
                        })
                      }
                      style={venueActionBtnStyle}
                    >
                      🌐 Menu / Site ↗
                    </a>
                  )}

                  {cleanPhone && (
                    <a
                      href={`tel:${cleanPhone}`}
                      onClick={() =>
                        trackVenueAction({
                          venue_name: venue,
                          venue_address: address,
                          action_type: 'call',
                          searched_drink: drink,
                          city,
                        })
                      }
                      style={venueActionBtnStyle}
                    >
                      📞 Call ↗
                    </a>
                  )}

                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="warm-btn-ghost"
                      style={{
                        ...venueActionBtnStyle,
                        border: '1.5px solid var(--primary)',
                        color: 'var(--primary)',
                        boxShadow: '0 2px 0 rgba(226, 114, 91, 0.2), 0 4px 10px rgba(74, 46, 32, 0.08)',
                      }}
                    >
                      🗺️ Map &amp; Directions ↗
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="serif" style={{ fontSize: '1.9rem', lineHeight: 1.25, marginBottom: '0.6rem', color: 'var(--text-main)' }}>
                {scout} unlocked the <span style={{ color: 'var(--primary)' }}>&ldquo;{badge}&rdquo;</span> Badge!
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', color: 'var(--text-light)', marginBottom: '1.25rem' }}>
                <strong>Craving DNA:</strong> {drink}
                {city ? ` · 📍 ${city}` : ''}
              </p>
            </>
          )}

          <div
            style={{
              background: 'rgba(226, 114, 91, 0.08)',
              border: '1px solid rgba(226, 114, 91, 0.24)',
              borderRadius: 16,
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.86rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
            }}
          >
            ✨ <strong>Instant Access (No App Store Download):</strong> Claim your own free <strong>SipScouts Badge</strong>, save your favorite drinks &amp; ingredients, and scout hidden-gem cafés, tea houses, cocktail bars, and zero-proof spots near you!
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              href="/login"
              className="warm-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                textDecoration: 'none',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                lineHeight: 1.35,
                padding: '0.9rem 1.15rem',
                fontSize: '0.98rem',
              }}
            >
              🏅 Claim My Free Scout Badge &amp; Profile →
            </a>

            <button
              type="button"
              onClick={handleForwardToFriend}
              className="warm-btn-ghost"
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                textAlign: 'center',
                lineHeight: 1.35,
                fontWeight: 600,
                padding: '0.8rem 1rem',
                borderRadius: 12,
                border: '1.5px solid var(--primary)',
                color: 'var(--primary)',
                background: 'rgba(255,255,255,0.92)',
              }}
            >
              {copied ? '✅ Link Copied! Paste in Text or Chat' : '📲 Invite a Friend ↗'}
            </button>

            <a
              href={discoverUrl}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-light)',
                textDecoration: 'underline',
                marginTop: '0.35rem',
              }}
            >
              🔍 Or jump straight to live drink search →
            </a>

            <a
              href="https://www.instagram.com/sipscoutsapp/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--primary)',
                textDecoration: 'none',
                marginTop: '0.2rem',
              }}
            >
              📸 Follow @SipScoutsApp on Instagram →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
