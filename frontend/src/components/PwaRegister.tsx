'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Register service worker on initial app load
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service worker registered with scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration error:', err)
      })
  }, [])

  return null
}
