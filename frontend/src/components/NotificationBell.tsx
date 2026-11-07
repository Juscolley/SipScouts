'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

function checkIsIOS() {
  if (typeof window === 'undefined') return false
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function checkIsStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function NotificationBell() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showIosModal, setShowIosModal] = useState<boolean>(false)

  useEffect(() => {
    async function checkSubscription() {
      if (typeof window === 'undefined') return

      // Fast check local storage first so UI never flashes or unsets
      try {
        if (localStorage.getItem('sipscouts_push_subscribed_v1') === '1') {
          setStatus('subscribed')
        }
      } catch {
        // Ignore
      }

      if (!('Notification' in window)) return
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      try {
        let reg = await navigator.serviceWorker.getRegistration()
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        }

        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            setStatus('subscribed')
            try {
              localStorage.setItem('sipscouts_push_subscribed_v1', '1')
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.warn('Initial push check notice:', err)
      }
    }
    checkSubscription()
  }, [])

  async function subscribe() {
    // 1. iOS Safari regular browser tab check
    const isIOS = checkIsIOS()
    const isStandalone = checkIsStandalone()

    if (isIOS && !isStandalone) {
      // Apple requires adding to Home Screen to enable PushManager on iOS
      setShowIosModal(true)
      return
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (isIOS) {
        setShowIosModal(true)
        return
      }
      alert('Push notifications are not supported on this browser.')
      return
    }

    setStatus('loading')

    // Timeout safety net
    const safetyTimer = setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'idle' : prev))
    }, 7000)

    try {
      // 2. Request user permission (with Safari promise & callback fallback)
      let permission = Notification.permission
      if (permission === 'default') {
        try {
          const req = Notification.requestPermission()
          if (req && typeof req.then === 'function') {
            permission = await req
          } else {
            permission = await new Promise(resolve => Notification.requestPermission(resolve))
          }
        } catch {
          permission = Notification.permission
        }
      }

      if (permission === 'denied') {
        clearTimeout(safetyTimer)
        setStatus('denied')
        return
      }
      if (permission !== 'granted') {
        clearTimeout(safetyTimer)
        setStatus('idle')
        return
      }

      // 3. Ensure Service Worker is registered & ready
      let reg: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      }

      if (!reg.active) {
        try {
          reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<ServiceWorkerRegistration>((_, reject) =>
              setTimeout(() => reject(new Error('SW activation timeout')), 3500)
            ),
          ])
        } catch {
          // Fall back to current registration instance
        }
      }

      if (!reg) {
        throw new Error('Service Worker unavailable')
      }

      // 4. Subscribe with PushManager
      const vapidKey = (
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        'BK6bdNzMN01bNQzyLFurcxJq7JNgrByK4-tkQhD55W5jDktVwpDkxjHYHl4475ubWSsPw7VRt0huoK1ATXMw1Zk'
      ).trim()

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
      }

      const key = sub.getKey('p256dh')
      const auth = sub.getKey('auth')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Local storage backup
      try {
        localStorage.setItem('sipscouts_push_subscribed_v1', '1')
      } catch {
        // Ignore
      }

      // 5. Save to Supabase
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: user?.id ?? null,
            endpoint: sub.endpoint,
            p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
            auth_key: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
          },
          { onConflict: 'endpoint' }
        )
      } catch (err) {
        console.warn('Supabase push record failed, but browser push is active:', err)
      }

      clearTimeout(safetyTimer)
      setStatus('subscribed')
    } catch (e: any) {
      clearTimeout(safetyTimer)
      console.error('Subscription error:', e)
      const msg = e?.message || String(e)

      if (Notification.permission === 'denied' || msg.includes('denied') || msg.includes('NotAllowedError')) {
        setStatus('denied')
      } else {
        setErrorMessage(msg.slice(0, 32))
        setStatus('error')
        setTimeout(() => {
          setStatus('idle')
          setErrorMessage('')
        }, 4000)
      }
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setStatus('loading')

    const safetyTimer = setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'idle' : prev))
    }, 4000)

    try {
      try {
        localStorage.removeItem('sipscouts_push_subscribed_v1')
      } catch {
        // Ignore
      }

      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const endpoint = sub.endpoint
          await sub.unsubscribe()
          try {
            const supabase = createClient()
            await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
          } catch {
            // Ignore
          }
        }
      }
    } catch (e) {
      console.warn('Unsubscribe error:', e)
    } finally {
      clearTimeout(safetyTimer)
      setStatus('idle')
    }
  }

  return (
    <>
      {status === 'subscribed' ? (
        <button
          onClick={unsubscribe}
          className="warm-btn-ghost"
          title="Click to turn off push notifications"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#1a7a42',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1.5px solid #2ea043',
            borderRadius: 99,
            padding: '0.65rem 1.25rem',
            boxShadow: '0 4px 14px rgba(74, 46, 32, 0.15)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1rem' }}>🔔</span>
          <span>Alerts ON</span>
          <span style={{ fontSize: '0.72rem', color: '#1a7a42', opacity: 0.75, marginLeft: '0.15rem' }}>
            (Tap to Mute)
          </span>
        </button>
      ) : status === 'denied' ? (
        <button
          onClick={() =>
            alert(
              'Notifications are currently blocked. To enable, open your device Settings > Notifications > SipScouts (or Safari) and switch Allow Notifications to ON.'
            )
          }
          className="warm-btn-ghost"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 99,
            padding: '0.65rem 1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
          title="Click for instructions to unblock in Settings"
        >
          <span>🔕</span>
          <span>Alerts Blocked</span>
        </button>
      ) : status === 'error' ? (
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#c0392b',
            background: 'rgba(255, 235, 235, 0.95)',
            border: '1.5px solid #e74c3c',
            borderRadius: 99,
            padding: '0.65rem 1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          ⚠️ {errorMessage || 'Failed — retry'}
        </span>
      ) : (
        <button
          onClick={subscribe}
          disabled={status === 'loading'}
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
        >
          {status === 'loading' ? '⏳ Updating…' : '🔔 Notify Me'}
        </button>
      )}

      {/* iOS Home Screen Installation Helper Modal */}
      {showIosModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIosModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(28, 25, 23, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFDF9',
              borderRadius: '1.25rem',
              maxWidth: '380px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 114, 91, 0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: 'rgba(226, 114, 91, 0.12)',
                color: '#E2725B',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                marginBottom: '1rem',
              }}
            >
              📲
            </div>

            <h3
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.35rem',
                fontWeight: 700,
                color: '#2C1810',
                marginBottom: '0.5rem',
              }}
            >
              Enable Alerts on iPhone
            </h3>

            <p
              style={{
                fontSize: '0.88rem',
                color: '#6E6259',
                lineHeight: 1.45,
                marginBottom: '1.25rem',
              }}
            >
              Apple requires adding SipScouts to your <strong>Home Screen</strong> to receive push alerts for new spots and secret happy hours.
            </p>

            <div
              style={{
                textAlign: 'left',
                backgroundColor: '#F5EFEB',
                borderRadius: '0.85rem',
                padding: '1rem',
                marginBottom: '1.35rem',
                fontSize: '0.86rem',
                color: '#2C1810',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    backgroundColor: '#E2725B',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> button (<strong>⬆️</strong>) in Safari’s bottom toolbar.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    backgroundColor: '#E2725B',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                <span>
                  Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong> (➕).
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    backgroundColor: '#E2725B',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                <span>
                  Open SipScouts from your Home Screen & tap <strong>Notify Me</strong>!
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#E2725B',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 99,
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(226, 114, 91, 0.3)',
              }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  )
}
