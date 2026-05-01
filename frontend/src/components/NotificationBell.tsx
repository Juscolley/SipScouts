'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function NotificationBell() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'loading'>('idle')

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') setStatus('subscribed')
      else if (Notification.permission === 'denied') setStatus('denied')
    }
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
      const key = sub.getKey('p256dh')
      const auth = sub.getKey('auth')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('push_subscriptions').upsert({
        user_id: user?.id ?? null,
        endpoint: sub.endpoint,
        p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
        auth_key: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
      }, { onConflict: 'endpoint' })
      setStatus('subscribed')
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'subscribed') return (
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#2ea043', background: 'rgba(46,160,67,0.1)', borderRadius: 99, padding: '0.25rem 0.75rem' }}>🔔 Notified</span>
  )
  if (status === 'denied') return (
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', borderRadius: 99, padding: '0.25rem 0.75rem' }}>🔕 Blocked</span>
  )
  return (
    <button onClick={subscribe} disabled={status === 'loading'} className="warm-btn-ghost"
      style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: 99 }}>
      {status === 'loading' ? '⏳ Enabling…' : '🔔 Notify Me'}
    </button>
  )
}
