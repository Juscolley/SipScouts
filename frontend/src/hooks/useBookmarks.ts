import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface Bookmark {
  id: string
  venue_name: string
  venue_address: string
  venue_type: string
  latitude: number
  longitude: number
  notes: string
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        // Ensure a corresponding row exists in public.users so bookmarks FK always succeeds
        await supabase
          .from('users')
          .upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true })
        supabase
          .from('bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .then(({ data }) => setBookmarks((data ?? []) as Bookmark[]))
      }
    })
  }, [])

  const isBookmarked = useCallback(
    (venueName: string) => bookmarks.some(b => b.venue_name === venueName),
    [bookmarks]
  )

  const toggle = useCallback(
    async (venue: { name: string; address: string; type: string; lat: number; lng: number }) => {
      if (!userId) return
      const supabase = createClient()
      const existing = bookmarks.find(b => b.venue_name === venue.name)

      if (existing) {
        await supabase.from('bookmarks').delete().eq('id', existing.id)
        setBookmarks(b => b.filter(x => x.id !== existing.id))
      } else {
        const { data } = await supabase
          .from('bookmarks')
          .insert({
            user_id: userId,
            venue_name: venue.name,
            venue_address: venue.address,
            venue_type: venue.type,
            latitude: venue.lat,
            longitude: venue.lng,
          })
          .select()
          .single()
        if (data) setBookmarks(b => [...b, data as Bookmark])
      }
    },
    [userId, bookmarks]
  )

  return { bookmarks, isBookmarked, toggle, isLoggedIn: !!userId }
}
