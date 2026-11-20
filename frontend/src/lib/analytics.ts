import { createClient } from '@/lib/supabase'

export type VenueActionType =
  | 'directions'
  | 'call'
  | 'instagram'
  | 'website'
  | 'bookmark'
  | 'share_venue'
  | 'share_badge'
  | 'share_app'
  | 'referral_claim'
  | 'utm_visit'

export interface TrackVenueActionInput {
  venue_name: string
  action_type: VenueActionType
  venue_address?: string
  venue_type?: string
  searched_drink?: string
  searched_ingredient?: string
  city?: string
  zip_code?: string
  latitude?: number | null
  longitude?: number | null
  user_id?: string | null
}

const LOCAL_CLICKS_KEY = 'sipscouts_venue_clicks_backup_v1'

export function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod|android|mobile/.test(ua) ? 'mobile' : 'desktop'
}

export async function trackVenueAction(input: TrackVenueActionInput): Promise<void> {
  const device_type = getDeviceType()
  const clicked_at = new Date().toISOString()

  // 1. Save to local backup so /merchant always reflects immediate clicks even before SQL migration is run
  try {
    const existingRaw = localStorage.getItem(LOCAL_CLICKS_KEY)
    const existing = existingRaw ? JSON.parse(existingRaw) : []
    existing.unshift({ ...input, device_type, clicked_at })
    localStorage.setItem(LOCAL_CLICKS_KEY, JSON.stringify(existing.slice(0, 200)))
  } catch {
    // Ignore storage errors
  }

  // 2. Log directly to Supabase public.venue_clicks
  try {
    const supabase = createClient()
    let uid = input.user_id ?? null
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      uid = user?.id ?? null
    }

    await supabase.from('venue_clicks').insert({
      user_id: uid,
      venue_name: input.venue_name,
      venue_address: input.venue_address || null,
      venue_type: input.venue_type || null,
      action_type: input.action_type,
      searched_drink: input.searched_drink || null,
      searched_ingredient: input.searched_ingredient || null,
      city: input.city || null,
      zip_code: input.zip_code || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      device_type,
    })
  } catch {
    // Non-fatal if table is not yet created
  }
}

export function getLocalVenueClicksBackup(): Array<TrackVenueActionInput & { device_type: string; clicked_at: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_CLICKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const CLAIMED_REF_KEY = 'sipscouts_claimed_ref_v1'
const SESSION_UTM_KEY = 'sipscouts_session_utm_v1'

export function captureUtmAndReferral(currentUserId?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const utmSource = (params.get('utm_source') || '').trim()
    const utmCampaign = (params.get('utm_campaign') || params.get('utm_medium') || '').trim()
    const cid = (params.get('cid') || '').trim()
    const ref = (params.get('ref') || '').trim()

    if ((utmSource || cid) && !sessionStorage.getItem(SESSION_UTM_KEY)) {
      sessionStorage.setItem(SESSION_UTM_KEY, `${utmSource}|${cid}`)
      trackVenueAction({
        venue_name: '__UTM_VISIT__',
        action_type: 'utm_visit',
        searched_drink: utmSource || cid,
        searched_ingredient: cid || utmCampaign,
        city: utmCampaign || utmSource,
        user_id: currentUserId ?? null,
      })
    }

    if (ref && ref !== currentUserId && !localStorage.getItem(CLAIMED_REF_KEY)) {
      localStorage.setItem(CLAIMED_REF_KEY, ref)
      trackVenueAction({
        venue_name: '__REFERRAL__',
        action_type: 'referral_claim',
        searched_drink: ref,
        city: utmSource || 'invite',
        user_id: currentUserId ?? null,
      })
    }
  } catch {
    // Ignore storage/URL errors
  }
}
