import type { Metadata } from 'next'
import ShareClientView from './ShareClientView'

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const badge = (typeof params.badge === 'string' ? params.badge : '') || 'Founding Sip Scout'
  const scout = (typeof params.scout === 'string' ? params.scout : '') || 'Your Friend'
  const venue = typeof params.venue === 'string' ? params.venue : ''
  const drink = (typeof params.drink === 'string' ? params.drink : '') || 'Specialty Coffee, Matcha, Cocktails & Zero-Proof'
  const city = typeof params.city === 'string' ? params.city : ''

  const ogParams = new URLSearchParams()
  ogParams.set('badge', badge)
  ogParams.set('scout', scout)
  if (venue) ogParams.set('venue', venue)
  if (drink) ogParams.set('drink', drink)
  if (city) ogParams.set('city', city)

  const title = venue
    ? `${scout} invited you to try ${drink} at ${venue} · SipScouts`
    : `${scout} unlocked the "${badge}" Badge on SipScouts!`

  const description = venue
    ? `Tap to view ${venue}${city ? ` in ${city}` : ''}, claim your free SipScouts badge, or forward to a friend!`
    : `Sip DNA: ${drink}. Tap to claim your own free SipScouts badge and discover hidden-gem cafés, tea houses, cocktail bars & zero-proof spots nearby!`

  const ogImageUrl = `https://www.sipscouts.com/og/badge?${ogParams.toString()}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams
  const badge = (typeof params.badge === 'string' ? params.badge : '') || 'Founding Sip Scout'
  const scout = (typeof params.scout === 'string' ? params.scout : '') || 'A Fellow Scout'
  const venue = typeof params.venue === 'string' ? params.venue : ''
  const address = typeof params.address === 'string' ? params.address : ''
  const drink = (typeof params.drink === 'string' ? params.drink : '') || 'Specialty Coffee, Matcha, Cocktails & Zero-Proof'
  const city = typeof params.city === 'string' ? params.city : ''
  const rawLat = typeof params.lat === 'string' ? parseFloat(params.lat) : undefined
  const rawLng = typeof params.lng === 'string' ? parseFloat(params.lng) : undefined
  const venueLat = typeof rawLat === 'number' && !Number.isNaN(rawLat) ? rawLat : undefined
  const venueLng = typeof rawLng === 'number' && !Number.isNaN(rawLng) ? rawLng : undefined
  const ig = typeof params.ig === 'string' ? params.ig : ''
  const website = typeof params.website === 'string' ? params.website : ''
  const phone = typeof params.phone === 'string' ? params.phone : ''

  return (
    <ShareClientView
      badge={badge}
      scout={scout}
      venue={venue}
      address={address}
      drink={drink}
      city={city}
      venueLat={venueLat}
      venueLng={venueLng}
      ig={ig}
      website={website}
      phone={phone}
    />
  )
}
