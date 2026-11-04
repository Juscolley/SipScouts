import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const badge = searchParams.get('badge') || 'Founding Sip Scout'
  const scout = searchParams.get('scout') || 'A Fellow Scout'
  const venue = searchParams.get('venue') || ''
  const drink = searchParams.get('drink') || 'Specialty Coffee, Matcha & Craft Cocktails'
  const city = searchParams.get('city') || ''
  const logoUrl = `${origin}/sipscouts-logo.png`

  const headline = venue
    ? `${scout} scouted ${drink} at ${venue}`
    : `${scout} unlocked "${badge}" on SipScouts`

  const subline = venue
    ? `${city ? `📍 ${city} · ` : ''}Tap to view this spot, claim your Scout Badge, or meet up for a sip!`
    : `Sip DNA: ${drink}${city ? ` · 📍 ${city}` : ''} — Tap to claim your free Scout Badge!`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #2A1810 0%, #4A2E20 55%, #1E110B 100%)',
          color: '#FAF3E8',
          padding: '54px 64px',
          fontFamily: 'sans-serif',
          border: '12px solid #E2725B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="SipScouts"
              width={96}
              height={96}
              style={{
                borderRadius: '22px',
                border: '3px solid #FFCBA4',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '42px', fontWeight: 800, color: '#FAF3E8', letterSpacing: '-0.5px' }}>
                SipScouts
              </span>
              <span style={{ fontSize: '20px', color: '#FFCBA4', fontWeight: 600 }}>
                COFFEE · TEA · CRAFT COCKTAILS
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(226, 114, 91, 0.25)',
              border: '2px solid #E2725B',
              borderRadius: '999px',
              padding: '12px 26px',
              fontSize: '22px',
              fontWeight: 700,
              color: '#FFCBA4',
            }}
          >
            🏅 {badge}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '12px', marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '52px',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#FFFFFF',
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: '26px',
              lineHeight: 1.4,
              color: '#E8D5C4',
            }}
          >
            {subline}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255, 203, 164, 0.22)',
            paddingTop: '22px',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '22px', color: '#FFCBA4', fontWeight: 600 }}>
            sipscouts.com · IG @SipScoutsApp
          </span>
          <div
            style={{
              display: 'flex',
              background: '#E2725B',
              color: '#FFFFFF',
              padding: '10px 24px',
              borderRadius: '14px',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            Tap to Open &amp; Claim Badge →
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
