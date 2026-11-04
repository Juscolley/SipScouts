'use client'

import { useState } from 'react'
import { trackVenueAction } from '@/lib/analytics'

interface ShareClientProps {
  badge: string
  scout: string
  venue: string
  address: string
  drink: string
  city: string
}

export default function ShareClientView({
  badge,
  scout,
  venue,
  address,
  drink,
  city,
}: ShareClientProps) {
  const [copied, setCopied] = useState(false)

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
                {scout} scouted <span style={{ color: 'var(--primary)' }}>{drink}</span> at {venue}!
              </h1>
              {address && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: '1.25rem' }}>
                  📍 {address}
                </p>
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
            ✨ <strong>Instant Access (No App Store Download):</strong> Claim your own free <strong>SipScouts Badge</strong>, save your favorite drinks &amp; ingredients, and scout hidden-gem cafés, tea houses, and cocktail bars near you!
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              href="/login"
              className="warm-btn"
              style={{ display: 'block', textDecoration: 'none', width: '100%', fontSize: '1rem' }}
            >
              🏅 Claim My Free Scout Badge &amp; Profile →
            </a>

            <button
              type="button"
              onClick={handleForwardToFriend}
              className="warm-btn-ghost"
              style={{
                width: '100%',
                fontWeight: 600,
                padding: '0.8rem 1rem',
                borderRadius: 12,
                border: '1.5px solid var(--primary)',
                color: 'var(--primary)',
                background: 'rgba(255,255,255,0.92)',
              }}
            >
              {copied ? '✅ Share Link Copied! Paste in Text or Chat' : '📲 Forward This Badge / Invite a Friend ↗'}
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
