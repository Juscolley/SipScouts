'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useGeolocation, distanceKm } from '@/hooks/useGeolocation'
import { useBookmarks } from '@/hooks/useBookmarks'
import { createClient } from '@/lib/supabase'
import { trackVenueAction } from '@/lib/analytics'
import NotificationBell from '@/components/NotificationBell'
import InstallAppButton from '@/components/InstallAppButton'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })

interface Venue {
  id: string
  name: string
  address: string
  type: 'cafe' | 'bar'
  lat: number
  lng: number
  tags: string[]
  phone?: string | null
  open_now?: boolean | null
  website?: string | null
  instagram_url?: string | null
  match_tier?: 'exact' | 'potential'
  distanceKm?: number
}

interface MemberProfileSummary {
  name: string
  zip_code: string
  favorite_drinks: string[]
  favorite_ingredients: string[]
}

const SEARCH_STORAGE_KEY = 'sipscouts_last_search_v1'

const TRENDING_CRAVINGS: Array<{ label: string; drink: string; ingredient: string }> = [
  { label: '🍵 Pistachio Matcha', drink: 'Matcha Latte', ingredient: 'Pistachio' },
  { label: '🍸 Espresso Martini', drink: 'Espresso Martini', ingredient: '' },
  { label: '☕ Cardamom Latte', drink: 'Latte', ingredient: 'Cardamom' },
  { label: '🍋 Yuzu Spritz', drink: 'Spritz', ingredient: 'Yuzu' },
  { label: '🥃 Mezcal Negroni', drink: 'Negroni', ingredient: 'Mezcal' },
  { label: '🫖 Hojicha Latte', drink: 'Hojicha Latte', ingredient: '' },
]

function extractIgHandle(url?: string | null): string {
  if (!url) return ''
  try {
    const cleaned = url.replace(/\/+$/, '')
    const parts = cleaned.split('/')
    const last = parts[parts.length - 1] || ''
    if (!last || last.startsWith('?') || last.includes('instagram.com')) return ''
    return last.replace(/^@/, '')
  } catch {
    return ''
  }
}

export default function DiscoverPage() {
  const [drink, setDrink] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [profilePromptVenue, setProfilePromptVenue] = useState<string | null>(null)
  const [memberProfile, setMemberProfile] = useState<MemberProfileSummary | null>(null)
  const [copiedVenueId, setCopiedVenueId] = useState<string | null>(null)
  const [deepLinkCopied, setDeepLinkCopied] = useState(false)
  const [storyModalVenue, setStoryModalVenue] = useState<Venue | null>(null)
  const [storyCaptionCopied, setStoryCaptionCopied] = useState(false)

  const geo = useGeolocation()
  const { isBookmarked, toggle, isLoggedIn, userId, isAdmin } = useBookmarks()

  const queryLabel = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'your perfect sip'
  const scoutingMessages = [
    `📍 Scouting nearby cafés, tea houses & bars for "${queryLabel}"…`,
    `📸 Checking local Instagram & TikTok posts for "${queryLabel}"…`,
    `⭐ Cross-checking Google Places & Yelp menus and reviews…`,
    `💬 Scanning neighborhood Reddit threads for hidden gems…`,
    `🗺️ Ranking discovered spots by distance from you…`,
  ]

  async function executeSearch(opts: {
    drinkVal: string
    ingredientVal: string
    locationVal: string
  }) {
    setDrink(opts.drinkVal)
    setIngredient(opts.ingredientVal)
    setLocationInput(opts.locationVal)
    setLoading(true)
    setSearched(true)

    try {
      const params = new URLSearchParams()
      if (opts.drinkVal.trim()) params.set('drink', opts.drinkVal.trim())
      if (opts.ingredientVal.trim()) params.set('ingredient', opts.ingredientVal.trim())
      if (userId) params.set('user_id', userId)
      if (geo.cityLabel) params.set('city', geo.cityLabel)

      let activeLat = geo.latitude
      let activeLng = geo.longitude

      if (opts.locationVal.trim()) {
        params.set('zip_code', opts.locationVal.trim())
      } else {
        if (activeLat === null || activeLng === null) {
          try {
            const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json')
            if (ipRes.ok) {
              const ipData = await ipRes.json()
              const parsedLat = parseFloat(ipData.latitude)
              const parsedLng = parseFloat(ipData.longitude)
              if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
                activeLat = parsedLat
                activeLng = parsedLng
              }
            }
          } catch {
            // Backend will also check client IP headers as a second safety net
          }
        }
        if (activeLat !== null && activeLng !== null) {
          params.set('lat', String(activeLat))
          params.set('lng', String(activeLng))
        }
      }

      let data: { venues?: Venue[]; center?: { lat?: number; lng?: number } } = {}
      let attempt = 0
      while (attempt < 3) {
        try {
          const res = await fetch(`/api/search?${params.toString()}`)
          if (res.ok) {
            data = await res.json()
            break
          }
        } catch {
          // If Render backend was waking from sleep, wait briefly and retry automatically
        }
        attempt += 1
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      let results: Venue[] = data.venues ?? []
      const refLat: number | null = data.center?.lat ?? activeLat
      const refLng: number | null = data.center?.lng ?? activeLng
      const newCenter = refLat && refLng ? { lat: refLat, lng: refLng } : null
      if (refLat && refLng) {
        setSearchCenter(newCenter)
        results = results
          .map(v => ({ ...v, distanceKm: distanceKm(refLat, refLng, v.lat, v.lng) }))
          .filter(v => (v.distanceKm ?? 0) <= 88.6)
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      }
      setVenues(results)
      try {
        sessionStorage.setItem(
          SEARCH_STORAGE_KEY,
          JSON.stringify({
            drink: opts.drinkVal,
            ingredient: opts.ingredientVal,
            locationInput: opts.locationVal,
            searchCenter: newCenter,
            venues: results,
            searched: true,
          })
        )
      } catch {
        // Ignore storage quota errors
      }
    } catch {
      setVenues([])
    } finally {
      setLoading(false)
    }
  }

  // Pre-warm the Render backend the instant the page opens (and keep it warm while the tab is open)
  useEffect(() => {
    const warmBackend = () => {
      fetch('/api/ping', { cache: 'no-store' }).catch(() => {})
    }
    warmBackend()
    const keepWarmInterval = setInterval(warmBackend, 9 * 60 * 1000)
    return () => clearInterval(keepWarmInterval)
  }, [])

  // Restore last search from sessionStorage OR execute 1-Tap Quick Scout from /profile URL params
  useEffect(() => {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    if (hash.includes('access_token=') || search.includes('code=') || search.includes('token_hash=')) {
      window.location.replace(`/auth/callback${search}${hash}`)
      return
    }

    const urlParams = new URLSearchParams(search)
    const urlDrink = urlParams.get('drink') || ''
    const urlIngredient = urlParams.get('ingredient') || ''
    const urlZip = urlParams.get('zip') || ''
    const autoSearch = urlParams.get('autosearch') === '1'

    if (autoSearch && (urlDrink || urlIngredient)) {
      // Clean URL query params while preserving browser back button
      window.history.replaceState({}, '', '/discover')
      let fallbackZip = urlZip
      if (!fallbackZip.trim()) {
        try {
          const localRaw = localStorage.getItem('sipscouts_profile_v1')
          if (localRaw) {
            const parsed = JSON.parse(localRaw)
            fallbackZip = parsed.zip_code ?? ''
          }
        } catch {
          // Ignore
        }
      }
      executeSearch({
        drinkVal: urlDrink,
        ingredientVal: urlIngredient,
        locationVal: fallbackZip,
      })
      return
    }

    try {
      const savedRaw = sessionStorage.getItem(SEARCH_STORAGE_KEY)
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (parsed && Array.isArray(parsed.venues) && parsed.searched) {
          setDrink(parsed.drink ?? '')
          setIngredient(parsed.ingredient ?? '')
          setLocationInput(parsed.locationInput ?? '')
          setSearchCenter(parsed.searchCenter ?? null)
          setVenues(parsed.venues)
          setSearched(true)
        }
      }
    } catch {
      // Ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load Returning Member's Profile (Name, Home ZIP, and Favorite Drinks/Ingredients)
  useEffect(() => {
    try {
      const localRaw = localStorage.getItem('sipscouts_profile_v1')
      if (localRaw) {
        const parsed = JSON.parse(localRaw)
        const summary: MemberProfileSummary = {
          name: parsed.name ?? '',
          zip_code: parsed.zip_code ?? '',
          favorite_drinks: Array.isArray(parsed.favorite_drinks) ? parsed.favorite_drinks : [],
          favorite_ingredients: Array.isArray(parsed.favorite_ingredients) ? parsed.favorite_ingredients : [],
        }
        setMemberProfile(summary)
        setLocationInput(prev => (prev.trim() ? prev : summary.zip_code))
      }
    } catch {
      // Ignore
    }

    if (!isLoggedIn || !userId) return

    const supabase = createClient()
    supabase
      .from('users')
      .select('name, zip_code, mobile, favorite_drinks, favorite_ingredients')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          const summary: MemberProfileSummary = {
            name: data.name ?? '',
            zip_code: data.zip_code ?? '',
            favorite_drinks: Array.isArray(data.favorite_drinks) ? data.favorite_drinks : [],
            favorite_ingredients: Array.isArray(data.favorite_ingredients) ? data.favorite_ingredients : [],
          }
          const hasData = Boolean(
            summary.name.trim() ||
            summary.zip_code.trim() ||
            summary.favorite_drinks.length > 0 ||
            summary.favorite_ingredients.length > 0
          )
          if (hasData) {
            setMemberProfile(summary)
            setLocationInput(prev => (prev.trim() ? prev : summary.zip_code))
            try {
              localStorage.setItem(
                'sipscouts_profile_v1',
                JSON.stringify({
                  ...summary,
                  mobile: data.mobile ?? '',
                })
              )
              localStorage.setItem('sipscouts_has_account', '1')
            } catch {
              // Ignore
            }
          }
        }
      })
  }, [isLoggedIn, userId])

  useEffect(() => {
    if (!loading) {
      setStatusIndex(0)
      return
    }
    const interval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % scoutingMessages.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [loading, scoutingMessages.length])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    await executeSearch({
      drinkVal: drink,
      ingredientVal: ingredient,
      locationVal: locationInput,
    })
  }

  async function handleInviteFriendToVenue(v: Venue) {
    const activeCraving = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'a great sip'
    const scoutName = memberProfile?.name?.trim() || 'Your Friend'
    const cityVal = locationInput.trim() || geo.cityLabel || ''

    trackVenueAction({
      venue_name: v.name,
      venue_address: v.address,
      venue_type: v.type,
      action_type: 'share_venue',
      searched_drink: drink.trim(),
      searched_ingredient: ingredient.trim(),
      city: cityVal,
      zip_code: locationInput.trim(),
      latitude: v.lat,
      longitude: v.lng,
      user_id: userId,
    })

    const shareParams = new URLSearchParams()
    shareParams.set('venue', v.name)
    shareParams.set('address', v.address)
    shareParams.set('drink', activeCraving)
    shareParams.set('scout', scoutName)
    if (cityVal) shareParams.set('city', cityVal)

    const shareUrl = `${window.location.origin}/share?${shareParams.toString()}`
    const distLabel = v.distanceKm !== undefined ? ` (${(v.distanceKm * 0.621371).toFixed(1)} mi away)` : ''
    const shareText = `🥂 Meet me for ${activeCraving} at ${v.name}${distLabel}! Scouted on SipScouts:`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Meet me at ${v.name} · SipScouts`,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
      setCopiedVenueId(v.id)
      setTimeout(() => setCopiedVenueId(null), 3000)
    } catch {
      // Ignore
    }
  }

  async function handleShareDeepLink() {
    const params = new URLSearchParams()
    if (drink.trim()) params.set('drink', drink.trim())
    if (ingredient.trim()) params.set('ingredient', ingredient.trim())
    const loc = locationInput.trim() || geo.cityLabel || ''
    if (loc) params.set('zip', loc)
    params.set('autosearch', '1')
    const url = `${window.location.origin}/discover?${params.toString()}`
    const text = `🗺️ Live SipScouts map for "${queryLabel}"${loc ? ` near ${loc}` : ''}:`

    if (navigator.share) {
      try {
        await navigator.share({ title: `SipScouts Map: ${queryLabel}`, text, url })
        return
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setDeepLinkCopied(true)
      setTimeout(() => setDeepLinkCopied(false), 3000)
    } catch {
      // Ignore
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      {/* Fixed hero background */}
      <div className="hero-bg" />
      <div className="hero-overlay" />

      {/* Header */}
      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">
            <img src="/sipscouts-logo.png" alt="SipScouts" className="logo-mark" />
            <span>SipScouts</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            <span className="active">Discover</span>
            <a href="/bookmarks">Saved</a>
            <a href="/profile">Profile</a>
            <a
              href="https://www.instagram.com/sipscoutsapp/"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow @SipScoutsApp on Instagram"
            >
              📸 @SipScoutsApp
            </a>
            {isAdmin && <a href="/merchant">🔒 B2B Dashboard</a>}
            {isLoggedIn ? (
              <a href="/profile" className="nav-btn">My Profile ✓</a>
            ) : (
              <>
                <a href="/login?mode=signin">Sign In</a>
                <a href="/login?mode=join" className="nav-btn">Join Free</a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero + Search */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '2.25rem 1.5rem 1.5rem', textAlign: 'center' }}>
          <img
            src="/sipscouts-logo.png"
            alt="SipScouts emblem"
            className="hero-logo-badge"
          />
          <h1 className="hero-title">
            Find your next perfect sip
          </h1>
          <p className="hero-sub">
            Coffee, tea, or craft cocktails — search by drink or ingredient and we&apos;ll surface hidden gems sorted by distance.
          </p>
          {geo.source === 'gps' && (
            <p className="hero-note">📍 Currently using your exact GPS location</p>
          )}
          {geo.source === 'ip' && (
            <p className="hero-note">
              📍 Near {geo.cityLabel || 'your area'}{' '}
              <button
                type="button"
                onClick={geo.requestLocation}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '0.15rem 0.6rem',
                  fontSize: '0.75rem',
                  marginLeft: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                Use Exact GPS
              </button>
            </p>
          )}
          {!geo.latitude && !geo.loading && (
            <p className="hero-note">
              <button
                type="button"
                onClick={geo.requestLocation}
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                📍 Tap to Enable Location (or enter Zip / City below)
              </button>
            </p>
          )}
        </section>

        <form onSubmit={handleSearch} style={{ maxWidth: 820, margin: '0 auto', padding: '0 1.5rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 190px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Drink</label>
            <input className="warm-input" type="text" value={drink} onChange={e => setDrink(e.target.value)} placeholder="e.g. Oat Latte, Matcha, Negroni…" />
          </div>
          <div style={{ flex: '1 1 190px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Ingredient</label>
            <input className="warm-input" type="text" value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="e.g. Cardamom, Yuzu, Mezcal…" />
          </div>
          <div style={{ flex: '1 1 170px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Near (Zip or City)</label>
            <input
              className="warm-input"
              type="text"
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              placeholder="ZIP or CITY"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 140px' }}>
            <button type="submit" className="warm-btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? '🔍 Searching…' : '🔍 Search'}
            </button>
          </div>
        </form>

        {/* Prominent Mobile-First Action Row directly below Search */}
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 1.5rem 0.85rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <InstallAppButton />
          <NotificationBell />
        </div>

        {/* 1-Tap Trending Cravings Bar (Converts IG Bio Traffic into Immediate Logged Searches) */}
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 1.5rem 1.15rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(255, 240, 228, 0.92)',
                textShadow: '0 1px 4px rgba(0,0,0,0.45)',
                marginRight: '0.2rem',
              }}
            >
              🔥 1-Tap Trending:
            </span>
            {TRENDING_CRAVINGS.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  executeSearch({
                    drinkVal: item.drink,
                    ingredientVal: item.ingredient,
                    locationVal: locationInput.trim() || memberProfile?.zip_code?.trim() || '',
                  })
                }
                style={{
                  minBlockSize: 34,
                  padding: '0.32rem 0.8rem',
                  borderRadius: 99,
                  border: '1px solid rgba(255, 203, 164, 0.55)',
                  background: 'rgba(42, 24, 16, 0.72)',
                  backdropFilter: 'blur(6px)',
                  color: '#FAF3E8',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Returning Signed-In Member 1-Tap Favorites Bar */}
        {isLoggedIn && memberProfile && (memberProfile.favorite_drinks.length > 0 || memberProfile.favorite_ingredients.length > 0) && (
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 1.5rem 1.75rem' }}>
            <div
              className="glass"
              style={{
                padding: '0.85rem 1.2rem',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.92)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                  👋 Welcome back{memberProfile.name.trim() ? `, ${memberProfile.name.trim()}` : ''}! <strong>1-Tap Scout your saved favorites:</strong>
                </span>
                <a href="/profile" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none' }}>
                  Edit Favorites →
                </a>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {memberProfile.favorite_drinks.map(favDrink => (
                  <button
                    key={`drink-${favDrink}`}
                    type="button"
                    onClick={() =>
                      executeSearch({
                        drinkVal: favDrink,
                        ingredientVal: '',
                        locationVal: locationInput.trim() || memberProfile.zip_code.trim(),
                      })
                    }
                    style={{
                      border: 'none',
                      borderRadius: 99,
                      padding: '0.35rem 0.85rem',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ☕ {favDrink}
                  </button>
                ))}
                {memberProfile.favorite_ingredients.map(favIng => (
                  <button
                    key={`ing-${favIng}`}
                    type="button"
                    onClick={() =>
                      executeSearch({
                        drinkVal: '',
                        ingredientVal: favIng,
                        locationVal: locationInput.trim() || memberProfile.zip_code.trim(),
                      })
                    }
                    style={{
                      border: 'none',
                      borderRadius: 99,
                      padding: '0.35rem 0.85rem',
                      background: 'rgba(74, 46, 32, 0.9)',
                      color: '#FAF3E8',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✨ {favIng}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Instant-Use + Free Profile / Sign-In Callout */}
        {!isLoggedIn && (
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 2.25rem', textAlign: 'center' }}>
            <div
              className="glass"
              style={{
                padding: '0.8rem 1.2rem',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.88)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.84rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              ✨ <strong>Search instantly above!</strong> Want to save locations (🔖), view your{' '}
              <a href="/bookmarks" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
                Saved spots
              </a>
              , and 1-tap search your <strong>Favorite Drinks &amp; Ingredients</strong>?{' '}
              <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: '0.25rem', verticalAlign: 'middle' }}>
                <a
                  href="/login?mode=signin"
                  style={{
                    display: 'inline-block',
                    color: 'var(--text-main)',
                    background: 'rgba(74, 46, 32, 0.1)',
                    border: '1px solid rgba(74, 46, 32, 0.25)',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 99,
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    textDecoration: 'none',
                  }}
                >
                  🔑 Sign In
                </a>
                <a
                  href="/login?mode=join"
                  style={{
                    display: 'inline-block',
                    color: '#fff',
                    background: 'var(--primary)',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 99,
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    textDecoration: 'none',
                  }}
                >
                  ✨ Create Free Profile →
                </a>
              </span>
            </div>
          </div>
        )}

        {/* Results */}
        {searched && (
          <section style={{ maxWidth: 1024, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
            <div style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(74,46,32,0.1)' }}>
              <VenueMap venues={venues} userLat={(searchCenter?.lat ?? geo.latitude) ?? undefined} userLng={(searchCenter?.lng ?? geo.longitude) ?? undefined} />
            </div>

            {loading ? (
              <div className="glass" role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center', gap: '1rem' }}>
                <div className="spinner" />
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, transition: 'opacity 0.3s ease' }}>
                  {scoutingMessages[statusIndex]}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Deep-scouting menus &amp; social posts so no hidden local gem is skipped…
                </p>
              </div>
            ) : venues.length === 0 ? (
              <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No venues found within 55 miles yet. Try a different drink, ingredient, or city!
              </div>
            ) : (
              (() => {
                const exactMatches = venues.filter(v => v.match_tier !== 'potential' && !v.tags.includes('Potential Match'))
                const potentialMatches = venues.filter(v => v.match_tier === 'potential' || v.tags.includes('Potential Match'))

                const renderVenueCard = (v: Venue, isPotential: boolean) => (
                  <div key={v.id} className="warm-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-main)' }}>{v.name}</h3>
                        {v.distanceKm !== undefined && (
                          <p className="distance">
                            {v.distanceKm < 1 ? `${Math.round(v.distanceKm * 1000)}m` : `${v.distanceKm.toFixed(1)} km`} · {(v.distanceKm * 0.621371).toFixed(1)} mi away
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLoggedIn) {
                              toggle({ name: v.name, address: v.address, type: v.type, lat: v.lat, lng: v.lng })
                            } else {
                              setProfilePromptVenue(v.name)
                            }
                          }}
                          style={{
                            minBlockSize: 34,
                            background: isBookmarked(v.name) ? 'var(--primary)' : '#ffffff',
                            border: '1.5px solid var(--primary)',
                            borderRadius: 10,
                            padding: '0.3rem 0.72rem',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 700,
                            color: isBookmarked(v.name) ? '#ffffff' : 'var(--primary)',
                            boxShadow: '0 2px 6px rgba(226, 114, 91, 0.18)',
                            transition: 'all 0.2s',
                          }}
                          title={isBookmarked(v.name) ? 'Remove from Saved' : 'Save this location'}
                        >
                          {isBookmarked(v.name) ? '🔖 Saved ✓' : '🔖 Save'}
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{v.address}</p>

                    {/* Static Status Badges Row (Flat, Non-Clickable Info Labels) */}
                    <div
                      style={{
                        marginTop: '0.6rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.69rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '0.16rem 0.5rem',
                          borderRadius: 5,
                          background: 'rgba(74, 46, 32, 0.07)',
                          color: 'var(--text-light)',
                          fontFamily: 'Inter, sans-serif',
                          cursor: 'default',
                        }}
                      >
                        {v.type === 'bar' ? '🍸 Bar' : '☕ Cafe'}
                      </span>

                      {isPotential ? (
                        <span
                          style={{
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.16rem 0.5rem',
                            borderRadius: 5,
                            background: 'rgba(74, 46, 32, 0.07)',
                            color: 'var(--text-light)',
                            fontFamily: 'Inter, sans-serif',
                            cursor: 'default',
                          }}
                        >
                          ✨ Potential Match
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.16rem 0.5rem',
                            borderRadius: 5,
                            background: 'rgba(226, 114, 91, 0.14)',
                            color: 'var(--primary)',
                            fontFamily: 'Inter, sans-serif',
                            cursor: 'default',
                          }}
                        >
                          🎯 Exact Match
                        </span>
                      )}

                      {v.open_now === true && (
                        <span
                          style={{
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.16rem 0.5rem',
                            borderRadius: 5,
                            background: 'rgba(46, 125, 50, 0.12)',
                            color: '#2e7d32',
                            fontFamily: 'Inter, sans-serif',
                            cursor: 'default',
                          }}
                        >
                          ● Open Now
                        </span>
                      )}
                      {v.open_now === false && (
                        <span
                          style={{
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.16rem 0.5rem',
                            borderRadius: 5,
                            background: 'rgba(169, 68, 66, 0.1)',
                            color: '#a94442',
                            fontFamily: 'Inter, sans-serif',
                            cursor: 'default',
                          }}
                        >
                          ● Closed
                        </span>
                      )}
                    </div>

                    {/* Tactile Clickable Venue Action Buttons Row (Call, Instagram, Menu/Site) */}
                    {(v.phone || v.instagram_url || v.website) && (
                      <div
                        style={{
                          marginTop: '0.6rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        {v.phone && (
                          <a
                            href={`tel:${v.phone}`}
                            onClick={() =>
                              trackVenueAction({
                                venue_name: v.name,
                                venue_address: v.address,
                                venue_type: v.type,
                                action_type: 'call',
                                searched_drink: drink.trim(),
                                searched_ingredient: ingredient.trim(),
                                city: geo.cityLabel || locationInput.trim(),
                                zip_code: locationInput.trim(),
                                latitude: v.lat,
                                longitude: v.lng,
                                user_id: userId,
                              })
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              minBlockSize: 34,
                              padding: '0.3rem 0.7rem',
                              borderRadius: 10,
                              background: '#ffffff',
                              border: '1.5px solid rgba(74, 46, 32, 0.25)',
                              boxShadow: '0 2px 5px rgba(74, 46, 32, 0.08)',
                              fontSize: '0.76rem',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title={`Call ${v.phone}`}
                          >
                            📞 Call ↗
                          </a>
                        )}
                        {v.instagram_url && (
                          <a
                            href={v.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              trackVenueAction({
                                venue_name: v.name,
                                venue_address: v.address,
                                venue_type: v.type,
                                action_type: 'instagram',
                                searched_drink: drink.trim(),
                                searched_ingredient: ingredient.trim(),
                                city: geo.cityLabel || locationInput.trim(),
                                zip_code: locationInput.trim(),
                                latitude: v.lat,
                                longitude: v.lng,
                                user_id: userId,
                              })
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              minBlockSize: 34,
                              padding: '0.3rem 0.7rem',
                              borderRadius: 10,
                              background: '#ffffff',
                              border: '1.5px solid rgba(226, 114, 91, 0.48)',
                              boxShadow: '0 2px 5px rgba(226, 114, 91, 0.12)',
                              fontSize: '0.76rem',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 700,
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            📸 Instagram ↗
                          </a>
                        )}
                        {v.website && (
                          <a
                            href={v.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              trackVenueAction({
                                venue_name: v.name,
                                venue_address: v.address,
                                venue_type: v.type,
                                action_type: 'website',
                                searched_drink: drink.trim(),
                                searched_ingredient: ingredient.trim(),
                                city: geo.cityLabel || locationInput.trim(),
                                zip_code: locationInput.trim(),
                                latitude: v.lat,
                                longitude: v.lng,
                                user_id: userId,
                              })
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              minBlockSize: 34,
                              padding: '0.3rem 0.7rem',
                              borderRadius: 10,
                              background: '#ffffff',
                              border: '1.5px solid rgba(74, 46, 32, 0.25)',
                              boxShadow: '0 2px 5px rgba(74, 46, 32, 0.08)',
                              fontSize: '0.76rem',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            🌐 Menu / Site ↗
                          </a>
                        )}
                      </div>
                    )}

                    {v.tags.filter(t => t !== 'Exact Match' && t !== 'Potential Match').length > 0 && (
                      <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {v.tags
                          .filter(t => t !== 'Exact Match' && t !== 'Potential Match')
                          .map(tag => (
                            <span key={tag} className="tag tag-ghost">{tag}</span>
                          ))}
                      </div>
                    )}

                    {/* Spacious, Uncrowded 2-Button Action Footer (40px+ Touch Targets) */}
                    <div
                      style={{
                        marginTop: '0.85rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(74, 46, 32, 0.12)',
                        display: 'flex',
                        gap: '0.55rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleInviteFriendToVenue(v)}
                        aria-label={`Invite Friend to ${v.name}`}
                        style={{
                          flex: 1,
                          minBlockSize: 40,
                          padding: '0.48rem 0.7rem',
                          borderRadius: 12,
                          border: '1.5px solid rgba(226, 114, 91, 0.45)',
                          background: copiedVenueId === v.id ? 'var(--primary)' : 'rgba(226, 114, 91, 0.12)',
                          color: copiedVenueId === v.id ? '#fff' : 'var(--primary)',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        {copiedVenueId === v.id ? '✅ Invite Link Copied!' : '🥂 Invite Friend'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          trackVenueAction({
                            venue_name: v.name,
                            venue_address: v.address,
                            venue_type: v.type,
                            action_type: 'share_venue',
                            searched_drink: drink.trim(),
                            searched_ingredient: ingredient.trim(),
                            city: geo.cityLabel || locationInput.trim(),
                            zip_code: locationInput.trim(),
                            latitude: v.lat,
                            longitude: v.lng,
                            user_id: userId,
                          })
                          setStoryCaptionCopied(false)
                          setStoryModalVenue(v)
                        }}
                        aria-label={`IG Story Card for ${v.name}`}
                        style={{
                          flex: 1,
                          minBlockSize: 40,
                          padding: '0.48rem 0.7rem',
                          borderRadius: 12,
                          border: '1px solid rgba(74, 46, 32, 0.22)',
                          background: 'rgba(74, 46, 32, 0.08)',
                          color: 'var(--text-main)',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        📸 IG Story Card
                      </button>
                    </div>
                  </div>
                )

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Share Live Search Map Bar */}
                    <div
                      className="glass"
                      style={{
                        padding: '0.75rem 1.15rem',
                        borderRadius: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.6rem',
                        background: 'rgba(255, 255, 255, 0.92)',
                      }}
                    >
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.84rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        🗺️ Found <strong>{venues.length} local spots</strong> for <strong>&ldquo;{queryLabel}&rdquo;</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleShareDeepLink}
                        style={{
                          minBlockSize: 36,
                          padding: '0.4rem 0.95rem',
                          borderRadius: 99,
                          border: '1.5px solid var(--primary)',
                          background: deepLinkCopied ? 'var(--primary)' : 'rgba(226, 114, 91, 0.12)',
                          color: deepLinkCopied ? '#fff' : 'var(--primary)',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {deepLinkCopied ? '✅ Map Link Copied!' : '🔗 Share This Search Map'}
                      </button>
                    </div>

                    {exactMatches.length > 0 && (
                      <div>
                        <div className="glass" style={{ padding: '0.9rem 1.25rem', borderRadius: 16, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>
                              🎯 Closest Exact Matches ({exactMatches.length})
                            </h2>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                              Local spots within 55 miles whose menus, reviews, or social posts directly match your requested drink or ingredient.
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '1rem' }}>
                          {exactMatches.map(v => renderVenueCard(v, false))}
                        </div>
                      </div>
                    )}

                    {potentialMatches.length > 0 && (
                      <div>
                        <div className="glass" style={{ padding: '0.9rem 1.25rem', borderRadius: 16, marginBottom: '1rem' }}>
                          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', color: 'var(--text-main)', margin: 0 }}>
                            ✨ Potential Local Matches ({potentialMatches.length})
                          </h2>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                            {exactMatches.length === 0
                              ? `We didn't find an exact menu listing for "${queryLabel}" within 55 miles, but these nearby specialty spots craft similar drinks and may carry your requested ingredients:`
                              : 'Additional nearby specialty spots in this drink category that may also carry your requested ingredients or craft a custom version:'}
                          </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '1rem' }}>
                          {potentialMatches.map(v => renderVenueCard(v, true))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </section>
        )}
      </div>

      {/* Modal shown when a guest taps Save on a venue card */}
      {profilePromptVenue && (
        <div
          onClick={() => setProfilePromptVenue(null)}
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
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🔖</p>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              Save &ldquo;{profilePromptVenue}&rdquo;
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              Sign in to your existing SipScouts profile or create a free one (no password needed!) to bookmark favorite spots, view your <strong>Saved</strong> map, and save up to 5 <strong>Favorite Drinks &amp; Ingredients</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <a
                href="/login?mode=signin"
                className="warm-btn"
                style={{ width: '100%', textDecoration: 'none', display: 'inline-block', padding: '0.75rem 1rem' }}
              >
                🔑 Sign In (Existing Profile)
              </a>
              <a
                href="/login?mode=join"
                className="warm-btn-ghost"
                style={{ width: '100%', textDecoration: 'none', display: 'inline-block', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.9)' }}
              >
                ✨ Join Free (New Profile)
              </a>
              <button
                type="button"
                onClick={() => setProfilePromptVenue(null)}
                className="warm-btn-ghost"
                style={{ width: '100%', padding: '0.55rem 1rem', cursor: 'pointer', border: 'none' }}
              >
                Continue Scouting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal shown when a user taps "📸 IG Story Card" on any venue card */}
      {storyModalVenue && (() => {
        const activeCraving = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'Specialty Coffee, Matcha & Cocktails'
        const cityVal = locationInput.trim() || geo.cityLabel || 'Local Gem'
        const venueIgHandle = extractIgHandle(storyModalVenue.instagram_url)
        const distVal = storyModalVenue.distanceKm !== undefined ? `${(storyModalVenue.distanceKm * 0.621371).toFixed(1)} mi away` : ''
        const scoutName = memberProfile?.name?.trim() || 'SipScouts'

        const storyParams = new URLSearchParams({
          mode: 'venue',
          format: 'story',
          venue: storyModalVenue.name,
          drink: activeCraving,
          city: cityVal,
          scout: scoutName,
          ...(venueIgHandle ? { handle: venueIgHandle } : {}),
          ...(distVal ? { dist: distVal } : {}),
        })
        const storyImageUrl = `/og/instagram?${storyParams.toString()}`
        const captionText = `🎯 Just scouted ${activeCraving} at ${storyModalVenue.name}${venueIgHandle ? ` (@${venueIgHandle})` : ''} on @SipScoutsApp! ☕🍸 Search any drink or ingredient near you at sipscouts.com #SipScouts`

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ig-story-modal-title"
            onClick={() => setStoryModalVenue(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(28, 12, 6, 0.72)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              overflowY: 'auto',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="glass"
              style={{
                maxWidth: 420,
                width: '100%',
                padding: '1.35rem',
                background: '#fcf6f0',
                borderRadius: 24,
                color: 'var(--text-main)',
                textAlign: 'center',
              }}
            >
              <h3 id="ig-story-modal-title" style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', margin: '0 0 0.35rem' }}>
                📸 Ready-to-Post IG Story Card
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-light)', margin: '0 0 0.85rem', lineHeight: 1.45 }}>
                Tag <strong>{venueIgHandle ? `@${venueIgHandle} + ` : ''}@SipScoutsApp</strong> in your Story so the venue can repost you!
              </p>

              <div
                style={{
                  width: '100%',
                  maxWidth: 230,
                  margin: '0 auto 0.9rem',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 8px 24px rgba(74, 46, 32, 0.2)',
                  background: '#24130C',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={storyImageUrl}
                  alt={`Instagram Story card for ${storyModalVenue.name}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>

              <div
                style={{
                  background: 'rgba(74, 46, 32, 0.06)',
                  border: '1px solid rgba(74, 46, 32, 0.16)',
                  borderRadius: 12,
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.78rem',
                  fontFamily: 'Inter, sans-serif',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  marginBottom: '0.85rem',
                  lineHeight: 1.45,
                }}
              >
                {captionText}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <a
                  href={storyImageUrl}
                  download={`sipscouts-story-${storyModalVenue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="warm-btn"
                  style={{
                    width: '100%',
                    minBlockSize: 42,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.65rem 1rem',
                    fontSize: '0.88rem',
                  }}
                >
                  📥 Save / Open 9:16 Story Image
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(captionText)
                      setStoryCaptionCopied(true)
                      setTimeout(() => setStoryCaptionCopied(false), 3000)
                    } catch {
                      // Ignore
                    }
                  }}
                  className="warm-btn-ghost"
                  style={{
                    width: '100%',
                    minBlockSize: 40,
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: '1.5px solid var(--primary)',
                    color: 'var(--primary)',
                    background: 'rgba(255,255,255,0.92)',
                    cursor: 'pointer',
                  }}
                >
                  {storyCaptionCopied ? '✅ Caption & @Tags Copied!' : `📋 Copy @Tags (${venueIgHandle ? `@${venueIgHandle} + ` : ''}@SipScoutsApp)`}
                </button>

                <button
                  type="button"
                  onClick={() => setStoryModalVenue(null)}
                  className="warm-btn-ghost"
                  style={{ width: '100%', minBlockSize: 38, padding: '0.5rem 1rem', cursor: 'pointer', border: 'none' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
