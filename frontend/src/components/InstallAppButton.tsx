'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    const ua = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(ua))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true)
      setDeferredPrompt(null)
      setShowModal(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone) return null

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      setShowModal(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="warm-btn-ghost"
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          padding: '0.65rem 1.25rem',
          borderRadius: 99,
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1.5px solid var(--primary)',
          color: 'var(--text-main)',
          boxShadow: '0 4px 14px rgba(74, 46, 32, 0.15)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
        }}
        title="Install SipScouts on your phone"
      >
        📲 Get the App
      </button>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
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
              textAlign: 'left',
            }}
          >
            <h3
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.35rem',
                marginBottom: '0.6rem',
              }}
            >
              📲 Install SipScouts on Your Phone
            </h3>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.9rem',
                color: 'var(--text-light)',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}
            >
              Add SipScouts directly to your home screen for instant 1-tap access — no app store download needed:
            </p>

            {isIOS ? (
              <ol
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  paddingLeft: '1.25rem',
                  marginBottom: '1.25rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  Tap the <strong>Share</strong> button <strong>[↑]</strong> at the bottom of Safari.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen ➕</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> in the top-right corner!
                </li>
              </ol>
            ) : (
              <ol
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  paddingLeft: '1.25rem',
                  marginBottom: '1.25rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>On iPhone (Safari):</strong> Tap the <strong>Share [↑]</strong> button → <strong>Add to Home Screen ➕</strong>.
                </li>
                <li>
                  <strong>On Android (Chrome):</strong> Tap the <strong>⋮ menu</strong> (top right) → <strong>Add to Home screen / Install app</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="warm-btn"
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: 12, cursor: 'pointer' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
