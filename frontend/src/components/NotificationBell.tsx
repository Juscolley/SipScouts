'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

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
          // Explicitly register if not yet registered
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported on this browser.')
      return
    }

    setStatus('loading')

    // Timeout safety net
    const safetyTimer = setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'idle' : prev))
    }, 7000)

    try {
      // 1. Request user permission
      const permission = await Notification.requestPermission()
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

      // 2. Ensure Service Worker is registered
      let reg: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      }

      // Wait for it to become ready if needed
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

      // 3. Subscribe with PushManager
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

      // 4. Save to Supabase
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

  if (status === 'subscribed') {
    return (
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
    )
  }

  if (status === 'denied') {
    return (
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'var(--text-muted)',
          background: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 99,
          padding: '0.65rem 1.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
        title="Notifications are blocked in your browser settings"
      >
        🔕 Alerts Blocked
      </span>
    )
  }

  if (status === 'error') {
    return (
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
    )
  }

  return (
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
  )
}
