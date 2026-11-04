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
  const theme = searchParams.get('theme') || 'terracotta' // 'terracotta' | 'matcha' | 'espresso' | 'neon'

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

  // Vibrant, category-themed color palettes that make the mascot and logo pop!
  const themeStyles = {
    terracotta: {
      bg: 'linear-gradient(155deg, #24130C 0%, #4A2E20 50%, #1A0E09 100%)',
      border: '#E2725B',
      accentBg: 'rgba(226, 114, 91, 0.32)',
      accentBorder: '#E2725B',
      accentText: '#FFCBA4',
      badgeBg: '#E2725B',
      mascotGlow: '0 0 45px rgba(226, 114, 91, 0.45)',
    },
    matcha: {
      bg: 'linear-gradient(155deg, #102414 0%, #1E3D24 50%, #0B180E 100%)',
      border: '#5B8C5A',
      accentBg: 'rgba(91, 140, 90, 0.35)',
      accentBorder: '#78B177',
      accentText: '#C4E8C2',
      badgeBg: '#5B8C5A',
      mascotGlow: '0 0 45px rgba(91, 140, 90, 0.5)',
    },
    espresso: {
      bg: 'linear-gradient(155deg, #1C120C 0%, #382417 50%, #120B07 100%)',
      border: '#D4A373',
      accentBg: 'rgba(212, 163, 115, 0.28)',
      accentBorder: '#D4A373',
      accentText: '#FAEDCD',
      badgeBg: '#D4A373',
      mascotGlow: '0 0 45px rgba(212, 163, 115, 0.45)',
    },
    neon: {
      bg: 'linear-gradient(155deg, #180D24 0%, #30174A 50%, #0E0717 100%)',
      border: '#E2725B',
      accentBg: 'rgba(255, 107, 107, 0.32)',
      accentBorder: '#FF8E72',
      accentText: '#FFD3B6',
      badgeBg: '#FF6B6B',
      mascotGlow: '0 0 50px rgba(255, 107, 107, 0.55)',
    },
  }[theme as 'terracotta' | 'matcha' | 'espresso' | 'neon'] || {
    bg: 'linear-gradient(155deg, #24130C 0%, #4A2E20 50%, #1A0E09 100%)',
    border: '#E2725B',
    accentBg: 'rgba(226, 114, 91, 0.32)',
    accentBorder: '#E2725B',
    accentText: '#FFCBA4',
    badgeBg: '#E2725B',
    mascotGlow: '0 0 45px rgba(226, 114, 91, 0.45)',
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: themeStyles.bg,
          color: '#FAF3E8',
          padding: isStory ? '90px 72px' : '58px 58px',
          fontFamily: 'sans-serif',
          border: `16px solid ${themeStyles.border}`,
          position: 'relative',
        }}
      >
        {/* Top Header Row with Official Smoothed V-Edge Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="SipScouts"
              width={isStory ? 112 : 92}
              height={isStory ? 112 : 92}
              style={{
                borderRadius: '26px',
                border: '3.5px solid #FFCBA4',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: isStory ? '48px' : '40px',
                  fontWeight: 800,
                  color: '#FAF3E8',
                  letterSpacing: '-1px',
                }}
              >
                SipScouts
              </span>
              <span
                style={{
                  fontSize: isStory ? '22px' : '18px',
                  color: '#FFCBA4',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}
              >
                @SIPSCOUTSAPP · SIPSCOUTS.COM
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: themeStyles.accentBg,
              border: `2px solid ${themeStyles.accentBorder}`,
              borderRadius: '999px',
              padding: isStory ? '12px 28px' : '8px 20px',
              fontSize: isStory ? '22px' : '17px',
              fontWeight: 800,
              color: themeStyles.accentText,
              letterSpacing: '1px',
            }}
          >
            {topPillText}
          </div>
        </div>

        {/* Center Spotlight with PROMINENT Hero Mascot Feature */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isStory ? '28px' : '18px',
            background: 'rgba(255, 248, 240, 0.08)',
            border: '3px solid rgba(255, 203, 164, 0.35)',
            borderRadius: '40px',
            padding: isStory ? '54px 50px' : '38px 42px',
            marginTop: '10px',
            marginBottom: '10px',
            position: 'relative',
          }}
        >
          {/* Mascot Centerpiece Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mascotUrl}
              alt="SipScouts Aardvark Mascot"
              width={isStory ? 140 : 110}
              height={isStory ? 140 : 110}
              style={{
                borderRadius: '32px',
                border: '4px solid #FAF3E8',
                objectFit: 'cover',
                boxShadow: themeStyles.mascotGlow,
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                style={{
                  fontSize: isStory ? '24px' : '19px',
                  color: themeStyles.accentText,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                }}
              >
                Scout Approved 🏆
              </span>
              <span
                style={{
                  fontSize: isStory ? '32px' : '24px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                Curated by @SipScoutsApp
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: isStory ? '64px' : '48px',
              fontWeight: 800,
              lineHeight: 1.14,
              color: '#FFFFFF',
            }}
          >
            {mainTitle}
          </div>

          <div
            style={{
              fontSize: isStory ? '32px' : '24px',
              lineHeight: 1.35,
              color: '#E8D5C4',
              fontWeight: 600,
            }}
          >
            {subText}
          </div>

          {/* Tag Pills Row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              marginTop: '6px',
            }}
          >
            {handle && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: themeStyles.badgeBg,
                  color: '#FFFFFF',
                  borderRadius: '999px',
                  padding: isStory ? '14px 32px' : '10px 24px',
                  fontSize: isStory ? '28px' : '22px',
                  fontWeight: 800,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
                }}
              >
                📸 @{handle}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 203, 164, 0.22)',
                border: '2.5px solid #FFCBA4',
                color: '#FFCBA4',
                borderRadius: '999px',
                padding: isStory ? '14px 32px' : '10px 24px',
                fontSize: isStory ? '28px' : '22px',
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
            gap: isStory ? '18px' : '12px',
            borderTop: '2px solid rgba(255, 203, 164, 0.24)',
            paddingTop: isStory ? '34px' : '20px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: themeStyles.badgeBg,
              color: '#FFFFFF',
              padding: isStory ? '20px 44px' : '12px 30px',
              borderRadius: '999px',
              fontSize: isStory ? '30px' : '22px',
              fontWeight: 800,
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            }}
          >
            🔍 Search Any Drink or Ingredient at sipscouts.com
          </div>
          <span
            style={{
              fontSize: isStory ? '24px' : '18px',
              color: '#FFCBA4',
              fontWeight: 600,
            }}
          >
            Specialty Coffee · Matcha &amp; Tea · Craft Cocktails Within 55 Miles
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
