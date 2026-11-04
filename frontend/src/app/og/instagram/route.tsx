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
  const isNeonSpeakeasy = theme === 'neon'

  const logoUrl = `${origin}/sipscouts-logo.png`
  const mascotUrl = `${origin}/sipscouts-mascot.jpg`
  const starryNightUrl = `${origin}/starry-night.jpg`

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

  // Vibrant theme palettes
  const themeStyles = {
    terracotta: {
      bg: 'linear-gradient(155deg, #24130C 0%, #4A2E20 50%, #1A0E09 100%)',
      border: '#E2725B',
      cardBg: 'rgba(255, 248, 240, 0.08)',
      cardBorder: 'rgba(255, 203, 164, 0.35)',
      accentBg: 'rgba(226, 114, 91, 0.32)',
      accentBorder: '#E2725B',
      accentText: '#FFCBA4',
      badgeBg: '#E2725B',
      mascotGlow: '0 0 45px rgba(226, 114, 91, 0.45)',
    },
    matcha: {
      bg: 'linear-gradient(155deg, #102414 0%, #1E3D24 50%, #0B180E 100%)',
      border: '#5B8C5A',
      cardBg: 'rgba(255, 248, 240, 0.08)',
      cardBorder: 'rgba(120, 177, 119, 0.38)',
      accentBg: 'rgba(91, 140, 90, 0.35)',
      accentBorder: '#78B177',
      accentText: '#C4E8C2',
      badgeBg: '#5B8C5A',
      mascotGlow: '0 0 45px rgba(91, 140, 90, 0.5)',
    },
    espresso: {
      bg: 'linear-gradient(155deg, #1C120C 0%, #382417 50%, #120B07 100%)',
      border: '#D4A373',
      cardBg: 'rgba(255, 248, 240, 0.08)',
      cardBorder: 'rgba(212, 163, 115, 0.35)',
      accentBg: 'rgba(212, 163, 115, 0.28)',
      accentBorder: '#D4A373',
      accentText: '#FAEDCD',
      badgeBg: '#D4A373',
      mascotGlow: '0 0 45px rgba(212, 163, 115, 0.45)',
    },
    neon: {
      bg: 'linear-gradient(155deg, #0A0F24 0%, #171E42 50%, #060814 100%)',
      border: '#FFD166',
      cardBg: 'rgba(10, 15, 36, 0.78)', // High-contrast frosted backdrop so text never washes out
      cardBorder: 'rgba(255, 209, 102, 0.65)',
      accentBg: 'rgba(255, 209, 102, 0.22)',
      accentBorder: '#FFD166',
      accentText: '#FFEAA7',
      badgeBg: '#E2725B',
      mascotGlow: '0 0 55px rgba(255, 209, 102, 0.65)',
    },
  }[theme as 'terracotta' | 'matcha' | 'espresso' | 'neon'] || {
    bg: 'linear-gradient(155deg, #24130C 0%, #4A2E20 50%, #1A0E09 100%)',
    border: '#E2725B',
    cardBg: 'rgba(255, 248, 240, 0.08)',
    cardBorder: 'rgba(255, 203, 164, 0.35)',
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
        {/* "Starry Night" Artistic Background Underlay (Only for Speakeasy Sunset) */}
        {isNeonSpeakeasy && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={starryNightUrl}
            alt="Starry Night Background"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.52,
            }}
          />
        )}

        {/* Dark readability veil over Starry Night so all text remains crisp and 100% visible */}
        {isNeonSpeakeasy && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(8,12,28,0.7) 0%, rgba(10,16,40,0.6) 50%, rgba(6,9,20,0.85) 100%)',
            }}
          />
        )}

        {/* Top Header Row with Official Smoothed V-Edge Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            position: 'relative',
            zIndex: 10,
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
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)',
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
                  textShadow: '0 2px 6px rgba(0,0,0,0.6)',
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
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            }}
          >
            {topPillText}
          </div>
        </div>

        {/* Center Spotlight with PROMINENT Hero Mascot Feature & Watermark */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isStory ? '28px' : '18px',
            background: themeStyles.cardBg,
            border: `3px solid ${themeStyles.cardBorder}`,
            borderRadius: '40px',
            padding: isStory ? '54px 50px' : '38px 42px',
            marginTop: '10px',
            marginBottom: '10px',
            position: 'relative',
            zIndex: 10,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          }}
        >
          {/* Subtle Artistic Watermark of Mascot in background of card */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mascotUrl}
            alt="Mascot Watermark"
            style={{
              position: 'absolute',
              right: '-60px',
              bottom: '-60px',
              width: isStory ? '420px' : '320px',
              height: isStory ? '420px' : '320px',
              borderRadius: '999px',
              opacity: isNeonSpeakeasy ? 0.12 : 0.08,
              filter: 'blur(1px)',
            }}
          />

          {/* Mascot Centerpiece Feature Badge */}
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
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}
              >
                Scout Approved 🏆
              </span>
              <span
                style={{
                  fontSize: isStory ? '32px' : '24px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
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
              textShadow: '0 2px 14px rgba(0,0,0,0.7)',
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
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
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
                  boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
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
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
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
            position: 'relative',
            zIndex: 10,
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
              boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            }}
          >
            🔍 Search Any Drink or Ingredient at sipscouts.com
          </div>
          <span
            style={{
              fontSize: isStory ? '24px' : '18px',
              color: '#FFCBA4',
              fontWeight: 600,
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
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
