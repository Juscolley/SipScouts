import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const format = searchParams.get('format') === 'square' ? 'square' : 'story'
  const mode = searchParams.get('mode') === 'trend' ? 'trend' : 'venue'
  const venue = searchParams.get('venue') || 'Local Hidden Gem'
  const drink = searchParams.get('drink') || 'Pistachio Matcha Latte'
  const city = searchParams.get('city') || 'Your Neighborhood'
  const handle = (searchParams.get('handle') || '').replace(/^@/, '').trim()
  const scout = searchParams.get('scout') || 'SipScouts'
  const signal = searchParams.get('signal') || 'High Local Craving Demand'
  const dist = searchParams.get('dist') || ''

  const width = 1080
  const height = format === 'square' ? 1080 : 1920
  const isStory = format === 'story'

  const logoUrl = `${origin}/sipscouts-logo.png`
  const mascotUrl = `${origin}/sipscouts-mascot.jpg`

  const topPillText =
    mode === 'trend'
      ? '🔥 NEIGHBORHOOD CRAVING REPORT'
      : '🎯 HIDDEN GEM SIP SPOTLIGHT'

  const mainTitle =
    mode === 'trend'
      ? `Trending in ${city}: ${drink}`
      : `${drink} at ${venue}`

  const subText =
    mode === 'trend'
      ? `${signal} · Scouted live on SipScouts.com`
      : `📍 ${city}${dist ? ` · ${dist}` : ''} · Scouted by ${scout}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(155deg, #24130C 0%, #4A2E20 50%, #1A0E09 100%)',
          color: '#FAF3E8',
          padding: isStory ? '110px 76px' : '68px 68px',
          fontFamily: 'sans-serif',
          border: '16px solid #E2725B',
        }}
      >
        {/* Top Brand Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="SipScouts"
              width={isStory ? 116 : 96}
              height={isStory ? 116 : 96}
              style={{
                borderRadius: '28px',
                border: '4px solid #FFCBA4',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: isStory ? '52px' : '44px',
                  fontWeight: 800,
                  color: '#FAF3E8',
                  letterSpacing: '-1px',
                }}
              >
                SipScouts
              </span>
              <span
                style={{
                  fontSize: isStory ? '24px' : '20px',
                  color: '#FFCBA4',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}
              >
                @SIPSCOUTSAPP · SIPSCOUTS.COM
              </span>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mascotUrl}
            alt="SipScouts Mascot"
            width={isStory ? 116 : 96}
            height={isStory ? 116 : 96}
            style={{
              borderRadius: '28px',
              border: '4px solid #E2725B',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Center Spotlight Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isStory ? '36px' : '24px',
            background: 'rgba(255, 248, 240, 0.07)',
            border: '3px solid rgba(255, 203, 164, 0.35)',
            borderRadius: '42px',
            padding: isStory ? '64px 56px' : '44px 48px',
            marginTop: isStory ? '20px' : '12px',
            marginBottom: isStory ? '20px' : '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: 'rgba(226, 114, 91, 0.28)',
              border: '2px solid #E2725B',
              borderRadius: '999px',
              padding: isStory ? '14px 32px' : '10px 24px',
              fontSize: isStory ? '26px' : '22px',
              fontWeight: 800,
              color: '#FFCBA4',
              letterSpacing: '1.5px',
            }}
          >
            {topPillText}
          </div>

          <div
            style={{
              fontSize: isStory ? '72px' : '54px',
              fontWeight: 800,
              lineHeight: 1.14,
              color: '#FFFFFF',
            }}
          >
            {mainTitle}
          </div>

          <div
            style={{
              fontSize: isStory ? '34px' : '26px',
              lineHeight: 1.38,
              color: '#E8D5C4',
              fontWeight: 600,
            }}
          >
            {subText}
          </div>

          {/* @Handle Tag Pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '18px',
              marginTop: isStory ? '18px' : '8px',
            }}
          >
            {handle && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#E2725B',
                  color: '#FFFFFF',
                  borderRadius: '999px',
                  padding: isStory ? '16px 34px' : '12px 26px',
                  fontSize: isStory ? '30px' : '24px',
                  fontWeight: 800,
                }}
              >
                📸 @{handle}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 203, 164, 0.18)',
                border: '2px solid #FFCBA4',
                color: '#FFCBA4',
                borderRadius: '999px',
                padding: isStory ? '16px 34px' : '12px 26px',
                fontSize: isStory ? '30px' : '24px',
                fontWeight: 800,
              }}
            >
              🥂 @SipScoutsApp
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isStory ? '22px' : '14px',
            borderTop: '2px solid rgba(255, 203, 164, 0.24)',
            paddingTop: isStory ? '40px' : '24px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#E2725B',
              color: '#FFFFFF',
              padding: isStory ? '22px 46px' : '14px 34px',
              borderRadius: '999px',
              fontSize: isStory ? '32px' : '24px',
              fontWeight: 800,
            }}
          >
            🔍 Search Any Drink or Ingredient at sipscouts.com
          </div>
          <span
            style={{
              fontSize: isStory ? '26px' : '20px',
              color: '#FFCBA4',
              fontWeight: 600,
            }}
          >
            Coffee · Matcha &amp; Tea · Craft Cocktails Within 55 Miles
          </span>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  )
}
