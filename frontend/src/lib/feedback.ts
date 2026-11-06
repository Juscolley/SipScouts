import { createClient } from '@/lib/supabase'
import { getDeviceType } from '@/lib/analytics'

export interface UserFeedbackInput {
  craving_or_feature_wish: string
  user_email?: string | null
  city_or_zip?: string | null
  device_type?: 'mobile' | 'desktop'
  user_id?: string | null
}

export interface UserFeedbackRow {
  id: string
  submitted_at: string
  craving_or_feature_wish: string
  user_email?: string | null
  city_or_zip?: string | null
  device_type?: string | null
  user_id?: string | null
}

const LOCAL_FEEDBACK_KEY = 'sipscouts_user_feedback_v1'

export function getLocalFeedbackBackup(): UserFeedbackRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function submitUserFeedback(input: UserFeedbackInput): Promise<{ ok: boolean; error?: string }> {
  const wish = input.craving_or_feature_wish.trim()
  if (!wish) {
    return { ok: false, error: 'Please enter a drink or feature wish.' }
  }

  const device_type = input.device_type || getDeviceType()
  const submitted_at = new Date().toISOString()
  const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const record: UserFeedbackRow = {
    id: tempId,
    submitted_at,
    craving_or_feature_wish: wish,
    user_email: input.user_email?.trim() || null,
    city_or_zip: input.city_or_zip?.trim() || null,
    device_type,
    user_id: input.user_id || null,
  }

  // 1. Always store locally first so feedback is never lost if network or table is pending
  try {
    const existing = getLocalFeedbackBackup()
    existing.unshift(record)
    localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(existing.slice(0, 100)))
  } catch {
    // Ignore local storage quota limits
  }

  // 2. Insert into Supabase table public.user_feedback
  try {
    const supabase = createClient()
    let uid = input.user_id || null
    if (!uid) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        uid = user?.id ?? null
      } catch {
        // Guest user
      }
    }

    const { error } = await supabase.from('user_feedback').insert({
      craving_or_feature_wish: wish,
      user_email: input.user_email?.trim() || null,
      city_or_zip: input.city_or_zip?.trim() || null,
      device_type,
      user_id: uid,
    })

    if (error) {
      // If table doesn't exist yet, we still return ok because local backup is preserved
      console.warn('Supabase feedback insert note:', error.message)
    }
  } catch (err) {
    console.warn('Network issue while logging feedback to Supabase:', err)
  }

  return { ok: true }
}
