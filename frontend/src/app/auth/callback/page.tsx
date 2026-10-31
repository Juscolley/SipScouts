'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const [statusText, setStatusText] = useState('Signing you in and opening your Profile…')

  useEffect(() => {
    let redirected = false
    const supabase = createClient()

    const go = (dest: string) => {
      if (!redirected) {
        redirected = true
        window.location.replace(dest)
      }
    }

    async function completeAuth() {
      const url = new URL(window.location.href)
      const next = url.searchParams.get('next') || '/profile'

      // 1. Check URL hash (#access_token=...&refresh_token=...) from Implicit Magic Link flow
      if (window.location.hash && window.location.hash.includes('access_token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) {
            go(next)
            return
          }
        }
      }

      // 2. Check ?token_hash=...&type=...
      const token_hash = url.searchParams.get('token_hash')
      const type = (url.searchParams.get('type') as EmailOtpType | null) || 'magiclink'
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!error) {
          go(next)
          return
        }
      }

      // 3. Check ?code=... from PKCE flow (now running in the browser where localStorage/cookies live!)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          go(next)
          return
        }
      }

      // 4. Check if detectSessionInUrl already established the session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        go(next)
        return
      }

      // Listen briefly in case detectSessionInUrl finishes asynchronously
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sessionNow) => {
        if (sessionNow) {
          subscription.unsubscribe()
          go(next)
        }
      })

      setTimeout(async () => {
        const { data: { session: retrySession } } = await supabase.auth.getSession()
        subscription.unsubscribe()
        if (retrySession) {
          go(next)
        } else {
          setStatusText('Link expired or already used — redirecting to Sign In…')
          go('/login?reason=expired_or_cross_browser')
        }
      }, 2200)
    }

    completeAuth()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem', textAlign: 'center' }}>
      <div className="spinner" />
      <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.95rem' }}>
        {statusText}
      </p>
    </div>
  )
}
