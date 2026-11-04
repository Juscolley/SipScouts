import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function extractInstagramHandle(url?: string | null): string {
  if (!url) return ''
  try {
    const cleaned = url.replace(/\/+$/, '')
    const parts = cleaned.split('/')
    const last = parts[parts.length - 1] || ''
    if (!last || last.startsWith('?') || last === 'instagram.com' || last === 'www.instagram.com') {
      return ''
    }
    return last.replace(/^@/, '')
  } catch {
    return ''
  }
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const posts: Array<{
    type: 'venue_spotlight' | 'craving_trend'
    headline: string
    drink: string
    venue?: string
    city: string
    venue_handle?: string
    square_image_url: string
    story_image_url: string
    caption: string
    deep_link_url: string
  }> = []

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const [{ data: clicks }, { data: trends }] = await Promise.all([
        supabase
          .from('venue_clicks')
          .select('*')
          .neq('venue_name', '__BADGE_SHARE__')
          .order('clicked_at', { ascending: false })
          .limit(10),
        supabase
          .from('merchant_analytics')
          .select('*')
          .order('hour_bucket', { ascending: false })
          .limit(10),
      ])

      if (clicks && clicks.length > 0) {
        const topClick = clicks[0]
        const drink =
          [topClick.searched_drink, topClick.searched_ingredient].filter(Boolean).join(' + ') ||
          'Specialty Matcha & Espresso'
        const city = [topClick.city, topClick.zip_code].filter(Boolean).join(', ') || 'Your Neighborhood'
        const venue = topClick.venue_name || 'Local Hidden Gem'
        const handle = extractInstagramHandle(topClick.instagram_url)

        const qSquare = new URLSearchParams({
          mode: 'venue',
          format: 'square',
          venue,
          drink,
          city,
          ...(handle ? { handle } : {}),
        })
        const qStory = new URLSearchParams({
          mode: 'venue',
          format: 'story',
          venue,
          drink,
          city,
          ...(handle ? { handle } : {}),
        })

        const deepLink = `${origin}/discover?drink=${encodeURIComponent(topClick.searched_drink || drink)}&zip=${encodeURIComponent(topClick.zip_code || topClick.city || '')}&autosearch=1`

        posts.push({
          type: 'venue_spotlight',
          headline: `${drink} at ${venue}`,
          drink,
          venue,
          city,
          venue_handle: handle ? `@${handle}` : undefined,
          square_image_url: `${origin}/og/instagram?${qSquare.toString()}`,
          story_image_url: `${origin}/og/instagram?${qStory.toString()}`,
          caption: `🎯 Hidden Gem Sip Spotlight: Craving ${drink} near ${city}? Our scouts just surfaced ${venue}${handle ? ` (@${handle})` : ''}! ☕🍸\n\nTap the link in @SipScoutsApp bio or visit sipscouts.com to search any drink or ingredient within 55 miles — 100% free, no App Store download needed.\n\n📸 Follow @SipScoutsApp & tag us in your next favorite sip!\n\n#SipScouts #CoffeeLovers #MatchaLovers #CraftCocktails #HiddenGems`,
          deep_link_url: deepLink,
        })
      }

      if (trends && trends.length > 0) {
        const topTrend = trends[0]
        const drink =
          [topTrend.drink, topTrend.ingredient].filter(Boolean).join(' + ') ||
          'Pistachio Matcha Latte'
        const city = [topTrend.city, topTrend.zip_code].filter(Boolean).join(', ') || 'Local Metro'
        const signal =
          Number(topTrend.avg_results ?? 0) <= 6
            ? `🔥 High Supply Gap (${Number(topTrend.avg_results ?? 0).toFixed(0)} local spots)`
            : `⚡ Active Neighborhood Demand (${topTrend.search_volume ?? 1}+ recent scouts)`

        const qSquare = new URLSearchParams({
          mode: 'trend',
          format: 'square',
          drink,
          city,
          signal,
        })
        const qStory = new URLSearchParams({
          mode: 'trend',
          format: 'story',
          drink,
          city,
          signal,
        })

        const deepLink = `${origin}/discover?drink=${encodeURIComponent(topTrend.drink || drink)}&zip=${encodeURIComponent(topTrend.zip_code || topTrend.city || '')}&autosearch=1`

        posts.push({
          type: 'craving_trend',
          headline: `Trending Craving in ${city}: ${drink}`,
          drink,
          city,
          square_image_url: `${origin}/og/instagram?${qSquare.toString()}`,
          story_image_url: `${origin}/og/instagram?${qStory.toString()}`,
          caption: `🔥 Neighborhood Craving Report: "${drink}" is trending right now in ${city} (${signal})!\n\nKnow a local café, tea house, or cocktail bar that makes an unforgettable ${drink}? Tag their @handle below so our community can scout them!\n\n🔍 Search any drink or ingredient at sipscouts.com (link in @SipScoutsApp bio).\n\n#SipScouts #DrinkDiscovery #SpecialtyCoffee #Matcha #CraftCocktails`,
          deep_link_url: deepLink,
        })
      }
    } catch {
      // Fallback below if DB query fails
    }
  }

  if (posts.length === 0) {
    const defaultDrink = 'Pistachio Matcha & Espresso Martini'
    const defaultCity = 'Your Area'
    const qSquare = new URLSearchParams({
      mode: 'trend',
      format: 'square',
      drink: defaultDrink,
      city: defaultCity,
      signal: 'Scouted Live Within 55 Miles',
    })
    const qStory = new URLSearchParams({
      mode: 'trend',
      format: 'story',
      drink: defaultDrink,
      city: defaultCity,
      signal: 'Scouted Live Within 55 Miles',
    })
    posts.push({
      type: 'craving_trend',
      headline: `Trending on SipScouts: ${defaultDrink}`,
      drink: defaultDrink,
      city: defaultCity,
      square_image_url: `${origin}/og/instagram?${qSquare.toString()}`,
      story_image_url: `${origin}/og/instagram?${qStory.toString()}`,
      caption: `🥂 Craving something specific? Search by drink OR ingredient on SipScouts.com and discover the closest Exact Match & Potential Match cafés, tea houses, and cocktail bars within 55 miles!\n\nFollow @SipScoutsApp and claim your free Scout Badge at sipscouts.com 🏅\n\n#SipScouts #SpecialtyCoffee #CeremonialMatcha #CraftCocktails #LocalGems`,
      deep_link_url: `${origin}/discover`,
    })
  }

  return NextResponse.json({
    account: '@SipScoutsApp',
    instagram_url: 'https://www.instagram.com/sipscoutsapp/',
    generated_at: new Date().toISOString(),
    posts,
  })
}
