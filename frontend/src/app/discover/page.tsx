'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  Search,
  MapPin,
  Navigation,
  Bookmark,
  MoreHorizontal,
  Phone,
  Globe,
  Share2,
  Sparkles,
  Lightbulb,
  Menu,
  X,
  Check,
  Map as MapIcon,
  Coffee,
  Wine,
  Leaf,
  GlassWater,
  Star,
  ExternalLink,
  Copy,
  UserPlus,
  Camera,
} from 'lucide-react'
import { useGeolocation, distanceKm } from '@/hooks/useGeolocation'
import { useBookmarks } from '@/hooks/useBookmarks'
import { createClient } from '@/lib/supabase'
import { trackVenueAction, captureUtmAndReferral } from '@/lib/analytics'
import NotificationBell from '@/components/NotificationBell'
import InstallAppButton from '@/components/InstallAppButton'
import FeedbackModal from '@/components/FeedbackModal'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

interface Venue {
  id: string
  name: string
  address: string
  type: 'cafe' | 'bar' | 'tea_house' | 'zero_proof' | string
  lat: number
  lng: number
  tags: string[]
  rating?: number | null
  phone?: string | null
  open_now?: boolean | null
  website?: string | null
  instagram_url?: string | null
  photo_url?: string | null
  evidence?: string | null
  match_tier?: 'exact' | 'potential'
  distance_km?: number | null
  distance_mode?: 'driving' | 'straight_line'
  distanceKm?: number
}

function getDirectionsUrl(v: Venue, originLocation?: string): string {
  const dest =
    v.address && v.address !== 'Nearby' && v.address !== 'Local Neighborhood Spot'
      ? `${v.name}, ${v.address}`
      : `${v.lat},${v.lng}`
  const originParam = originLocation && originLocation.trim()
    ? `&origin=${encodeURIComponent(originLocation.trim())}`
    : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${originParam}`
}

function prefersMiles(): boolean {
  if (typeof navigator === 'undefined') return true
  const lang = (navigator.language || 'en-US').toLowerCase()
  return lang === 'en-us' || lang.endsWith('-us') || lang === 'en-lr' || lang === 'en-mm'
}

function formatDistance(km: number): string {
  if (prefersMiles()) {
    const miles = km * 0.621371
    if (miles < 0.1) return `${Math.max(50, Math.round(miles * 5280))} ft away`
    return `${miles.toFixed(1)} mi away`
  }
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

function getVenueCategoryInfo(type: string): { label: string; kind: 'tea' | 'bar' | 'zero' | 'cafe' } {
  const t = (type || 'cafe').toLowerCase()
  if (t === 'tea_house') return { label: 'Tea House', kind: 'tea' }
  if (t === 'bar') return { label: 'Bar', kind: 'bar' }
  if (t === 'zero_proof') return { label: 'Zero-Proof', kind: 'zero' }
  return { label: 'Café', kind: 'cafe' }
}

interface MemberProfileSummary {
  name: string
  zip_code: string
  favorite_drinks: string[]
  favorite_ingredients: string[]
}

const SEARCH_STORAGE_KEY = 'sipscouts_last_search_v1'

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
  const [searchOriginMode, setSearchOriginMode] = useState<'gps' | 'ip' | 'zip'>('gps')
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [profilePromptVenue, setProfilePromptVenue] = useState<string | null>(null)
  const [memberProfile, setMemberProfile] = useState<MemberProfileSummary | null>(null)
  const [copiedVenueId, setCopiedVenueId] = useState<string | null>(null)
  const [deepLinkCopied, setDeepLinkCopied] = useState(false)
  const [appShareCopied, setAppShareCopied] = useState(false)
  const [storyModalVenue, setStoryModalVenue] = useState<Venue | null>(null)
  const [storyTheme, setStoryTheme] = useState<
    'starry_hero' | 'matcha_hero' | 'espresso_hero' | 'terracotta_hero' | 'neon' | 'matcha' | 'espresso' | 'terracotta'
  >('starry_hero')
  const [storyFormat, setStoryFormat] = useState<'story' | 'square'>('story')
  const [isSharingImage, setIsSharingImage] = useState(false)
  const [storyCaptionCopied, setStoryCaptionCopied] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackDefaultWish, setFeedbackDefaultWish] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [openMoreVenueId, setOpenMoreVenueId] = useState<string | null>(null)
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({})

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
      let originMode: 'gps' | 'ip' | 'zip' = geo.source === 'gps' ? 'gps' : 'ip'

      if (opts.locationVal.trim()) {
        params.set('zip_code', opts.locationVal.trim())
        originMode = 'zip'
      } else {
        // When Zip/City is left blank, ALWAYS try to get a fresh real GPS fix first (never fall back to profile ZIP)
        if (geo.source !== 'gps' && typeof navigator !== 'undefined' && navigator.geolocation) {
          const freshGps = await new Promise<{ lat: number; lng: number } | null>(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => {
                navigator.geolocation.getCurrentPosition(
                  pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => resolve(null),
                  { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
                )
              },
              { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
            )
          })
          if (freshGps) {
            activeLat = freshGps.lat
            activeLng = freshGps.lng
            originMode = 'gps'
          }
        }
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
                originMode = 'ip'
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
      setSearchOriginMode(originMode)

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
          .map(v => ({
            ...v,
            distanceKm: typeof v.distance_km === 'number' ? v.distance_km : distanceKm(refLat, refLng, v.lat, v.lng),
          }))
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

  // Capture any ?utm_source=, ?cid=, or ?ref= attribution on load
  useEffect(() => {
    captureUtmAndReferral(userId)
  }, [userId])

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
      executeSearch({
        drinkVal: urlDrink,
        ingredientVal: urlIngredient,
        locationVal: urlZip,
      })
      return
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
    if (v.lat !== undefined && v.lat !== null) shareParams.set('lat', String(v.lat))
    if (v.lng !== undefined && v.lng !== null) shareParams.set('lng', String(v.lng))
    if (v.instagram_url) shareParams.set('ig', v.instagram_url)
    if (v.website) shareParams.set('website', v.website)
    if (v.phone) shareParams.set('phone', v.phone)
    if (userId) shareParams.set('ref', userId)
    shareParams.set('utm_source', 'invite_venue')

    const shareUrl = `${window.location.origin}/share?${shareParams.toString()}`
    const streetName = v.address ? v.address.split(',')[0].trim() : ''
    const locationSnippet = streetName ? ` (${streetName})` : cityVal ? ` (${cityVal})` : ''
    const shareText = `🥂 Meet me for ${activeCraving} at ${v.name}${locationSnippet}! Scouted on SipScouts:`

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

  const hasActiveSearchOrInput = Boolean(
    drink.trim() || ingredient.trim() || locationInput.trim() || searched
  )

  function handleClearSearch() {
    setDrink('')
    setIngredient('')
    setLocationInput('')
    setVenues([])
    setSearchCenter(null)
    setSearched(false)
    setLoading(false)
    setDeepLinkCopied(false)
  }

  async function handleShareApp() {
    const shareUrl = `${window.location.origin}/?ref=share`
    const shareTitle = 'SipScouts — Find Your Next Perfect Sip'
    const shareText =
      '🥂 Check out SipScouts — find hidden-gem coffee, tea, craft cocktails, and zero-proof mocktail spots near you!'

    trackVenueAction({
      venue_name: '__APP_SHARE__',
      action_type: 'share_app',
      searched_drink: drink.trim() || undefined,
      searched_ingredient: ingredient.trim() || undefined,
      city: geo.cityLabel || undefined,
      zip_code: locationInput.trim() || memberProfile?.zip_code?.trim() || undefined,
      latitude: geo.latitude,
      longitude: geo.longitude,
      user_id: userId,
    })

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        return
      } catch {
        // Fallback to clipboard if user cancels or share fails
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
      setAppShareCopied(true)
      setTimeout(() => setAppShareCopied(false), 3000)
    } catch {
      // Ignore
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="warm-header" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">
            <img src="/sipscouts-logo.png" alt="SipScouts" className="logo-mark" />
            <span>SipScouts</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            <span className="active">Discover</span>
            <a href="/bookmarks">Saved</a>
            <a href="/profile">Profile</a>
            <button
              type="button"
              onClick={() => {
                setFeedbackDefaultWish(queryLabel !== 'your perfect sip' ? queryLabel : '')
                setFeedbackModalOpen(true)
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.25rem 0.45rem',
                minHeight: 40,
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="What's one drink or feature you wish SipScouts had?"
            >
              <Lightbulb size={15} />
              <span>Wish a Drink</span>
            </button>
            <a
              href="https://www.instagram.com/sipscoutsapp/"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow @SipScoutsApp on Instagram"
              style={{ gap: '0.3rem' }}
            >
              <InstagramIcon size={15} />
              <span>@SipScoutsApp</span>
            </a>
            {isAdmin && <a href="/merchant">B2B Dashboard</a>}
            {isLoggedIn ? (
              <a href="/profile" className="nav-btn">My Profile</a>
            ) : (
              <>
                <a href="/login?mode=signin">Sign In</a>
                <a href="/login?mode=join" className="nav-btn">Join Free</a>
              </>
            )}
          </nav>

          {/* Mobile Hamburger Button (44x44 tap target) */}
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(prev => !prev)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <nav className="mobile-nav-drawer" aria-label="Mobile Navigation">
            <a href="/discover" onClick={() => setMobileMenuOpen(false)}>
              <Search size={17} /> Discover
            </a>
            <a href="/bookmarks" onClick={() => setMobileMenuOpen(false)}>
              <Bookmark size={17} /> Saved Spots
            </a>
            <a href="/profile" onClick={() => setMobileMenuOpen(false)}>
              <Sparkles size={17} /> Profile &amp; Favorites
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setFeedbackDefaultWish(queryLabel !== 'your perfect sip' ? queryLabel : '')
                setFeedbackModalOpen(true)
              }}
            >
              <Lightbulb size={17} /> Wish a Drink or Feature
            </button>
            <a
              href="https://www.instagram.com/sipscoutsapp/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <InstagramIcon size={17} /> @SipScoutsApp
            </a>
            {isAdmin && (
              <a href="/merchant" onClick={() => setMobileMenuOpen(false)}>
                B2B Dashboard
              </a>
            )}
            {!isLoggedIn && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                <a
                  href="/login?mode=signin"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: '#fff',
                  }}
                >
                  Sign In
                </a>
                <a
                  href="/login?mode=join"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: 10,
                  }}
                >
                  Join Free
                </a>
              </div>
            )}
          </nav>
        )}
      </header>

      {/* Top Hero + Search Banner (clean neutral background below for results) */}
      <div className="hero-section-wrap">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <section style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem 1.25rem', textAlign: 'center' }}>
            <img
              src="/sipscouts-logo.png"
              alt="SipScouts emblem"
              className="hero-logo-badge"
            />
            <h1 className="hero-title">
              Find your next perfect sip
            </h1>
            <p className="hero-sub">
              Coffee, tea, craft cocktails, or zero-proof mocktails — search by drink or ingredient and we&apos;ll surface hidden gems sorted by distance.
            </p>
            {geo.source === 'gps' && (
              <p className="hero-note" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                <MapPin size={14} /> Currently using your exact GPS location
              </p>
            )}
            {geo.source === 'ip' && (
              <p className="hero-note" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <MapPin size={14} />
                <span>Near {geo.cityLabel || 'your area'}</span>
                <button
                  type="button"
                  disabled={geo.loading}
                  onClick={() => geo.requestLocation(true)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.45)',
                    color: '#fff',
                    borderRadius: 99,
                    minHeight: 32,
                    padding: '0.2rem 0.7rem',
                    fontSize: '0.75rem',
                    cursor: geo.loading ? 'wait' : 'pointer',
                    opacity: geo.loading ? 0.8 : 1,
                  }}
                >
                  {geo.loading ? 'Locating…' : 'Use Exact GPS'}
                </button>
              </p>
            )}
            {!geo.latitude && !geo.loading && (
              <p className="hero-note">
                <button
                  type="button"
                  onClick={() => geo.requestLocation(true)}
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    color: '#fff',
                    borderRadius: 99,
                    minHeight: 38,
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <MapPin size={14} /> Tap to Enable Location (or enter Zip / City below)
                </button>
              </p>
            )}
            {geo.error && (
              <p
                role="status"
                style={{
                  marginTop: '0.45rem',
                  fontSize: '0.78rem',
                  color: '#FFE4D6',
                  background: 'rgba(28, 14, 8, 0.55)',
                  display: 'inline-block',
                  padding: '0.35rem 0.8rem',
                  borderRadius: 10,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {geo.error}
              </p>
            )}
          </section>

          <form
            onSubmit={handleSearch}
            autoComplete="off"
            style={{ maxWidth: 880, margin: '0 auto', padding: '0 1.25rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}
          >
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.92)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Drink</label>
              <input
                className="warm-input"
                type="text"
                name="sipscouts_drink"
                value={drink}
                onChange={e => setDrink(e.target.value)}
                placeholder="e.g. Matcha, Oat Latte"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.92)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Ingredient</label>
              <input
                className="warm-input"
                type="text"
                name="sipscouts_ingredient"
                value={ingredient}
                onChange={e => setIngredient(e.target.value)}
                placeholder="e.g. Pistachio, Yuzu"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div style={{ flex: '1 1 170px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 240, 228, 0.92)', textShadow: '0 1px 4px rgba(0,0,0,0.45)', marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>Near (Zip or City)</label>
              <input
                className="warm-input"
                type="text"
                name="sipscouts_location"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Type Zip or City"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255, 240, 228, 0.9)', textShadow: '0 1px 3px rgba(0,0,0,0.5)', marginTop: '0.3rem', display: 'block', fontFamily: 'Inter, sans-serif' }}>
                Leave blank to scout near your location
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '0 1 auto', minWidth: 165, paddingTop: '1.42rem' }}>
              <button
                type="submit"
                className="warm-btn"
                disabled={loading}
                style={{
                  flex: 1,
                  minHeight: 46,
                  padding: '0.7rem 1.35rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <Search size={16} />
                <span>{loading ? 'Searching…' : 'Search'}</span>
              </button>
              {hasActiveSearchOrInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search fields and results"
                  aria-label="Clear search"
                  style={{
                    minHeight: 46,
                    padding: '0 0.95rem',
                    borderRadius: 12,
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    background: 'rgba(255, 255, 255, 0.94)',
                    border: '1px solid rgba(74, 46, 32, 0.22)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <X size={15} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </form>

          {/* Secondary Utility Row (subdued so Search stays the single bold CTA) */}
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '0 1.25rem 1.75rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap',
            }}
          >
            <InstallAppButton />
            <NotificationBell />
            <button
              type="button"
              onClick={handleShareApp}
              className="warm-btn-ghost"
              style={{
                minHeight: 44,
                padding: '0.55rem 1.15rem',
                borderRadius: 99,
                fontSize: '0.88rem',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                background: appShareCopied ? '#1a7a42' : 'rgba(255, 255, 255, 0.92)',
                border: appShareCopied ? '1.5px solid #1a7a42' : '1.5px solid rgba(255, 255, 255, 0.65)',
                color: appShareCopied ? '#FFFFFF' : 'var(--text-main)',
                boxShadow: '0 4px 14px rgba(28, 14, 8, 0.16)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
              title="Share SipScouts with a friend"
            >
              {appShareCopied ? <Check size={15} /> : <Share2 size={15} />}
              <span>{appShareCopied ? 'App Link Copied!' : 'Share SipScouts'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area on Clean Neutral Background */}
      <div style={{ position: 'relative', zIndex: 10, paddingTop: '1.25rem' }}>

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
                        locationVal: locationInput.trim(),
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
                        locationVal: locationInput.trim(),
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
          <section style={{ maxWidth: 1024, margin: '0 auto', padding: '0 1.25rem 4rem' }}>
            {showMap && (
              <div style={{ height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <VenueMap venues={venues} userLat={(searchCenter?.lat ?? geo.latitude) ?? undefined} userLng={(searchCenter?.lng ?? geo.longitude) ?? undefined} />
              </div>
            )}

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
              <div className="glass" style={{ padding: '2.75rem 1.5rem', textAlign: 'center', borderRadius: 24, maxWidth: 540, margin: '0 auto' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🔍</div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', color: 'var(--text-main)', margin: '0 0 0.45rem' }}>
                  No exact matches found within 55 miles
                </h3>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', color: 'var(--text-light)', margin: '0 auto 1.35rem', lineHeight: 1.5 }}>
                  Can&apos;t find &ldquo;{queryLabel}&rdquo;? Tell our scouts what drink or feature you wish SipScouts had, and we&apos;ll scout nearby spots or notify you when it lands!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackDefaultWish(queryLabel !== 'your perfect sip' ? queryLabel : '')
                    setFeedbackModalOpen(true)
                  }}
                  className="warm-btn"
                  style={{
                    padding: '0.65rem 1.35rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    borderRadius: 99,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span>💡</span>
                  <span>Wish This Drink into SipScouts →</span>
                </button>
              </div>
            ) : (
              (() => {
                const exactMatches = venues.filter(v => v.match_tier !== 'potential' && !v.tags.includes('Potential Match'))
                const potentialMatches = venues.filter(v => v.match_tier === 'potential' || v.tags.includes('Potential Match'))

                const renderVenueCard = (v: Venue, isPotential: boolean) => {
                  const cat = getVenueCategoryInfo(v.type)
                  const starTag = v.tags.find(t => t.startsWith('★'))
                  const displayRating = v.rating ? `${v.rating}` : starTag ? starTag.replace(/^★\s*/, '') : null
                  const hasPhoto = Boolean(v.photo_url && !failedPhotos[v.id])
                  const isMoreOpen = openMoreVenueId === v.id
                  const isVerifiedIg = Boolean(v.instagram_url)
                  const igHref =
                    v.instagram_url ||
                    `https://www.google.com/search?q=${encodeURIComponent(v.name + (v.address ? ' ' + v.address : '') + ' instagram')}`

                  const CategoryIcon =
                    cat.kind === 'tea'
                      ? Leaf
                      : cat.kind === 'bar'
                      ? Wine
                      : cat.kind === 'zero'
                      ? GlassWater
                      : Coffee

                  return (
                    <div
                      key={v.id}
                      className="warm-card"
                      style={{
                        background: '#FFFFFF',
                        padding: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 18px rgba(46, 29, 20, 0.06)',
                      }}
                    >
                      {/* Card Photo / Category Banner */}
                      <div
                        style={{
                          position: 'relative',
                          height: hasPhoto ? 156 : 76,
                          background:
                            cat.kind === 'tea'
                              ? 'linear-gradient(135deg, #E8F0E6 0%, #D4E4CF 100%)'
                              : cat.kind === 'bar'
                              ? 'linear-gradient(135deg, #F3E6E2 0%, #E7D2CB 100%)'
                              : cat.kind === 'zero'
                              ? 'linear-gradient(135deg, #E6EEF2 0%, #D0E1EB 100%)'
                              : 'linear-gradient(135deg, #F6EDE4 0%, #EADBC9 100%)',
                          overflow: 'hidden',
                        }}
                      >
                        {hasPhoto ? (
                          <img
                            src={v.photo_url!}
                            alt={v.name}
                            loading="lazy"
                            onError={() => setFailedPhotos(prev => ({ ...prev, [v.id]: true }))}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div
                            style={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-light)',
                              opacity: 0.45,
                            }}
                          >
                            <CategoryIcon size={28} />
                          </div>
                        )}

                        {/* Category & Match Tier Pill Overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            display: 'flex',
                            gap: '0.35rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '0.24rem 0.55rem',
                              borderRadius: 99,
                              background: 'rgba(255, 255, 255, 0.94)',
                              color: 'var(--text-main)',
                              fontFamily: 'Inter, sans-serif',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            }}
                          >
                            <CategoryIcon size={12} />
                            {cat.label}
                          </span>
                          {!isPotential && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '0.24rem 0.55rem',
                                borderRadius: 99,
                                background: 'rgba(226, 114, 91, 0.95)',
                                color: '#fff',
                                fontFamily: 'Inter, sans-serif',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              }}
                            >
                              Exact Match
                            </span>
                          )}
                        </div>

                        {displayRating && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.24rem 0.55rem',
                              borderRadius: 99,
                              background: 'rgba(255, 255, 255, 0.94)',
                              color: 'var(--text-main)',
                              fontFamily: 'Inter, sans-serif',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            }}
                          >
                            <Star size={12} fill="#E2725B" color="#E2725B" />
                            <span>{displayRating}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '1rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.55rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.25 }}>
                              {v.name}
                            </h3>
                            {v.open_now === true && (
                              <span
                                style={{
                                  flexShrink: 0,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.18rem 0.5rem',
                                  borderRadius: 99,
                                  background: 'rgba(46, 125, 50, 0.1)',
                                  color: '#1e6b23',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                Open
                              </span>
                            )}
                            {v.open_now === false && (
                              <span
                                style={{
                                  flexShrink: 0,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.18rem 0.5rem',
                                  borderRadius: 99,
                                  background: 'rgba(169, 68, 66, 0.1)',
                                  color: '#9e3331',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                Closed
                              </span>
                            )}
                          </div>

                          {v.distanceKm !== undefined && (
                            <p className="distance" style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '0.2rem' }}>
                              {searchOriginMode === 'ip'
                                ? `~${formatDistance(v.distanceKm)} (approx. area)`
                                : v.distance_mode === 'straight_line' || typeof v.distance_km !== 'number'
                                ? `~${formatDistance(v.distanceKm)} (straight-line)`
                                : formatDistance(v.distanceKm)}
                            </p>
                          )}
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-light)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                            {v.address}
                          </p>
                        </div>

                        {/* Match Evidence Proof (only shown for genuine drink/specialty matches) */}
                        {v.evidence && !v.evidence.startsWith('Nearby ') && (
                          <div
                            style={{
                              fontSize: '0.78rem',
                              lineHeight: 1.4,
                              color: 'var(--text-main)',
                              background: 'rgba(226, 114, 91, 0.08)',
                              borderLeft: '3px solid var(--primary)',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0 8px 8px 0',
                              fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            {v.evidence}
                          </div>
                        )}

                        {/* Primary Action Row: Directions (Main) + Save + More */}
                        <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <a
                            href={getDirectionsUrl(v, locationInput)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              trackVenueAction({
                                venue_name: v.name,
                                venue_address: v.address,
                                venue_type: v.type,
                                action_type: 'directions',
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
                              flex: 1,
                              minHeight: 44,
                              padding: '0.5rem 0.9rem',
                              borderRadius: 12,
                              background: 'var(--primary)',
                              color: '#FFFFFF',
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '0.86rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 3px 10px rgba(226, 114, 91, 0.28)',
                            }}
                          >
                            <Navigation size={15} />
                            <span>Directions</span>
                          </a>

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
                              minHeight: 44,
                              padding: '0.5rem 0.85rem',
                              borderRadius: 12,
                              background: isBookmarked(v.name) ? 'rgba(226, 114, 91, 0.14)' : '#FFFFFF',
                              border: '1.5px solid var(--border)',
                              color: isBookmarked(v.name) ? 'var(--primary)' : 'var(--text-main)',
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                            title={isBookmarked(v.name) ? 'Remove from Saved' : 'Save this location'}
                          >
                            <Bookmark size={15} fill={isBookmarked(v.name) ? 'currentColor' : 'none'} />
                            <span>{isBookmarked(v.name) ? 'Saved' : 'Save'}</span>
                          </button>

                          <button
                            type="button"
                            aria-label={`More actions for ${v.name}`}
                            aria-expanded={isMoreOpen}
                            onClick={() => setOpenMoreVenueId(prev => (prev === v.id ? null : v.id))}
                            style={{
                              minHeight: 44,
                              minWidth: 44,
                              borderRadius: 12,
                              background: isMoreOpen ? 'rgba(74, 46, 32, 0.08)' : '#FFFFFF',
                              border: '1.5px solid var(--border)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Call, Instagram, Menu & Share"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        {/* Collapsible "More" Menu */}
                        {isMoreOpen && (
                          <div
                            style={{
                              marginTop: '0.35rem',
                              padding: '0.6rem',
                              borderRadius: 12,
                              background: '#FAF7F2',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.3rem',
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
                                  minHeight: 40,
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: 'var(--text-main)',
                                  textDecoration: 'none',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                <Phone size={14} /> Call {v.phone}
                              </a>
                            )}

                            <a
                              href={igHref}
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
                                minHeight: 40,
                                padding: '0.35rem 0.65rem',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-main)',
                                textDecoration: 'none',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <InstagramIcon size={14} />
                                {isVerifiedIg ? 'Official Instagram' : 'Search on Instagram'}
                              </span>
                              <ExternalLink size={13} color="var(--text-muted)" />
                            </a>

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
                                  minHeight: 40,
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: 'var(--text-main)',
                                  textDecoration: 'none',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Globe size={14} /> Menu / Website
                                </span>
                                <ExternalLink size={13} color="var(--text-muted)" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleInviteFriendToVenue(v)}
                              style={{
                                minHeight: 40,
                                padding: '0.35rem 0.65rem',
                                borderRadius: 8,
                                border: 'none',
                                background: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              {copiedVenueId === v.id ? <Check size={14} color="#1a7a42" /> : <UserPlus size={14} />}
                              <span>{copiedVenueId === v.id ? 'Invite Link Copied!' : 'Invite a Friend'}</span>
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
                              style={{
                                minHeight: 40,
                                padding: '0.35rem 0.65rem',
                                borderRadius: 8,
                                border: 'none',
                                background: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              <Camera size={14} />
                              <span>Create IG Story Card</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    {/* Results Summary & Map Toggle Bar */}
                    <div
                      style={{
                        padding: '0.75rem 1.1rem',
                        borderRadius: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.6rem',
                        background: '#FFFFFF',
                        border: '1px solid var(--border)',
                        boxShadow: '0 2px 10px rgba(46, 29, 20, 0.04)',
                      }}
                    >
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.86rem', color: 'var(--text-main)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                        <MapPin size={16} color="var(--primary)" />
                        <span>Found <strong>{venues.length} local spots</strong> for &ldquo;{queryLabel}&rdquo;</span>
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setShowMap(prev => !prev)}
                          style={{
                            minHeight: 40,
                            padding: '0.4rem 0.9rem',
                            borderRadius: 99,
                            border: '1px solid var(--border)',
                            background: '#FAF7F2',
                            color: 'var(--text-main)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <MapIcon size={14} />
                          <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleShareDeepLink}
                          style={{
                            minHeight: 40,
                            padding: '0.4rem 0.95rem',
                            borderRadius: 99,
                            border: '1px solid var(--primary)',
                            background: deepLinkCopied ? 'var(--primary)' : 'rgba(226, 114, 91, 0.1)',
                            color: deepLinkCopied ? '#fff' : 'var(--primary)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          {deepLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{deepLinkCopied ? 'Link Copied!' : 'Share Search'}</span>
                        </button>
                      </div>
                    </div>

                    {exactMatches.length > 0 && (
                      <div>
                        <div style={{ marginBottom: '0.9rem' }}>
                          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', color: 'var(--text-main)', margin: 0 }}>
                            Closest Exact Matches ({exactMatches.length})
                          </h2>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.84rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                            Spots whose menus, reviews, or specialty profiles match your search.
                          </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))', gap: '1rem' }}>
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

                    {/* Inline Community Wish Invitation */}
                    <div
                      className="glass"
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: 20,
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.92)',
                        border: '1.5px dashed rgba(226, 114, 91, 0.45)',
                        marginTop: '0.5rem',
                      }}
                    >
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', color: 'var(--text-main)', margin: '0 0 0.3rem' }}>
                        What&apos;s one drink or feature you wish SipScouts had?
                      </h3>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-light)', margin: '0 0 0.85rem' }}>
                        Help shape the next release — tell our scouting team what you&apos;d love to discover next.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackDefaultWish(queryLabel !== 'your perfect sip' ? queryLabel : '')
                          setFeedbackModalOpen(true)
                        }}
                        className="warm-btn"
                        style={{ padding: '0.5rem 1.15rem', fontSize: '0.84rem', borderRadius: 99 }}
                      >
                        💡 Add to Scout Wishlist →
                      </button>
                    </div>
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
        const activeCraving = [drink.trim(), ingredient.trim()].filter(Boolean).join(' + ') || 'Specialty Coffee, Matcha, Cocktails & Zero-Proof'
        const cityVal = locationInput.trim() || geo.cityLabel || 'Local Gem'
        const venueIgHandle = extractIgHandle(storyModalVenue.instagram_url)
        const distVal = storyModalVenue.distanceKm !== undefined ? `${(storyModalVenue.distanceKm * 0.621371).toFixed(1)} mi away` : ''
        const scoutName = memberProfile?.name?.trim() || 'SipScouts'

        const storyParams = new URLSearchParams({
          mode: 'venue',
          format: storyFormat,
          venue: storyModalVenue.name,
          drink: activeCraving,
          city: cityVal,
          scout: scoutName,
          theme: storyTheme,
          ...(venueIgHandle ? { handle: venueIgHandle } : {}),
          ...(distVal ? { dist: distVal } : {}),
        })
        const storyImageUrl = `/og/instagram?${storyParams.toString()}`
        const captionText = `🎯 Just scouted ${activeCraving} at ${storyModalVenue.name}${venueIgHandle ? ` (@${venueIgHandle})` : ''} on @SipScoutsApp! ☕🍸 Search any drink or ingredient near you at sipscouts.com #SipScouts`

        const handleShareOrSave = async () => {
          setIsSharingImage(true)
          try {
            const res = await fetch(storyImageUrl)
            const blob = await res.blob()
            const fileName = `sipscouts-${storyFormat}-${storyModalVenue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
            const file = new File([blob], fileName, { type: 'image/png' })
            if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `SipScouts — ${storyModalVenue.name}`,
                text: captionText,
              })
            } else {
              window.open(storyImageUrl, '_blank')
            }
          } catch (err) {
            if ((err as Error)?.name !== 'AbortError') {
              window.open(storyImageUrl, '_blank')
            }
          } finally {
            setIsSharingImage(false)
          }
        }

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
              background: 'rgba(28, 12, 6, 0.76)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem',
              overflowY: 'auto',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="glass"
              style={{
                maxWidth: 440,
                width: '100%',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '1.25rem 1.1rem',
                background: '#fcf6f0',
                borderRadius: 24,
                color: 'var(--text-main)',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              }}
            >
              <h3 id="ig-story-modal-title" style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', margin: '0 0 0.25rem' }}>
                📸 Instagram Card Creator
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-light)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                {venueIgHandle ? (
                  <>Tagging <strong>@{venueIgHandle}</strong> & <strong>@SipScoutsApp</strong></>
                ) : (
                  <>Tag <strong>@SipScoutsApp</strong> in your post or story!</>
                )}
              </p>

              {/* Format Switcher: 9:16 Story vs 1:1 Feed Post */}
              <div style={{ display: 'inline-flex', background: 'rgba(74, 46, 32, 0.08)', borderRadius: 10, padding: 3, marginBottom: '0.75rem', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setStoryFormat('story')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 8,
                    border: 'none',
                    background: storyFormat === 'story' ? 'var(--primary)' : 'transparent',
                    color: storyFormat === 'story' ? '#fff' : 'var(--text-main)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  📱 9:16 Story
                </button>
                <button
                  type="button"
                  onClick={() => setStoryFormat('square')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 8,
                    border: 'none',
                    background: storyFormat === 'square' ? 'var(--primary)' : 'transparent',
                    color: storyFormat === 'square' ? '#fff' : 'var(--text-main)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  🟦 1:1 Feed Post
                </button>
              </div>

              {/* Theme Selector: Mascot Hero Layouts */}
              <div style={{ marginBottom: '0.65rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem', letterSpacing: '0.04em' }}>
                  🎨 Lively Mascot Themes:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
                  {[
                    { key: 'starry_hero', label: '🌌 Speakeasy' },
                    { key: 'matcha_hero', label: '🍵 Matcha Zen' },
                    { key: 'espresso_hero', label: '☕ Dark Roast' },
                    { key: 'terracotta_hero', label: '🏺 Terracotta' },
                  ].map(t => {
                    const isSelected = storyTheme === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setStoryTheme(t.key as any)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: 8,
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid rgba(74, 46, 32, 0.16)',
                          background: isSelected ? 'rgba(226, 114, 91, 0.15)' : '#ffffff',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          fontSize: '0.72rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Theme Selector: Classic Boxed Layouts */}
              <div style={{ marginBottom: '0.85rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem', letterSpacing: '0.04em' }}>
                  📦 Classic Gallery Boxed:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
                  {[
                    { key: 'neon', label: '🍸 Nighthawks' },
                    { key: 'matcha', label: '🍵 Hiroshige' },
                    { key: 'espresso', label: '☕ Cézanne' },
                    { key: 'terracotta', label: '🏺 Klimt Gold' },
                  ].map(t => {
                    const isSelected = storyTheme === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setStoryTheme(t.key as any)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: 8,
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid rgba(74, 46, 32, 0.16)',
                          background: isSelected ? 'rgba(226, 114, 91, 0.15)' : '#ffffff',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          fontSize: '0.72rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Image Preview with dynamic aspect ratio */}
              <div
                style={{
                  width: '100%',
                  maxWidth: storyFormat === 'story' ? 210 : 250,
                  margin: '0 auto 0.85rem',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 8px 24px rgba(74, 46, 32, 0.2)',
                  background: '#24130C',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={storyImageUrl}
                  src={storyImageUrl}
                  alt={`Instagram card for ${storyModalVenue.name}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>

              {/* Pre-formatted caption box */}
              <div
                style={{
                  background: 'rgba(74, 46, 32, 0.06)',
                  border: '1px solid rgba(74, 46, 32, 0.16)',
                  borderRadius: 12,
                  padding: '0.55rem 0.7rem',
                  fontSize: '0.76rem',
                  fontFamily: 'Inter, sans-serif',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  marginBottom: '0.85rem',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                {captionText}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleShareOrSave}
                  disabled={isSharingImage}
                  className="warm-btn"
                  style={{
                    width: '100%',
                    minBlockSize: 42,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.65rem 1rem',
                    fontSize: '0.86rem',
                    cursor: isSharingImage ? 'wait' : 'pointer',
                  }}
                >
                  {isSharingImage ? '⏳ Preparing Image...' : '📤 Share to Instagram / Save'}
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <a
                    href={storyImageUrl}
                    download={`sipscouts-${storyFormat}-${storyModalVenue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="warm-btn-ghost"
                    style={{
                      minBlockSize: 38,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-main)',
                      background: '#ffffff',
                    }}
                  >
                    📥 Download
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
                      minBlockSize: 38,
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1.5px solid var(--primary)',
                      color: 'var(--primary)',
                      background: 'rgba(255,255,255,0.95)',
                      cursor: 'pointer',
                    }}
                  >
                    {storyCaptionCopied ? '✅ Copied!' : '📋 Copy @Tags'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStoryModalVenue(null)}
                  className="warm-btn-ghost"
                  style={{ width: '100%', minBlockSize: 34, padding: '0.4rem 1rem', cursor: 'pointer', border: 'none', color: 'var(--text-light)', fontSize: '0.8rem' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Community Wishlist & Feedback Modal (triggered from Top Nav, Mobile Menu, or Results Footer) */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        defaultWish={feedbackDefaultWish}
        defaultCityOrZip={locationInput.trim() || geo.cityLabel || ''}
        userId={userId}
      />
    </div>
  )
}
