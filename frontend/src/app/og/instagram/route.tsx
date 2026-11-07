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
  const theme = searchParams.get('theme') || 'starry_hero'

  const width = 1080
  const height = format === 'square' ? 1080 : 1920
  const isStory = format === 'story'

  // The 4 Giant-Mascot "No Box" Themes
  const isSeamlessMascotHero = [
    'starry_hero',
    'matcha_hero',
    'espresso_hero',
    'terracotta_hero',
  ].includes(theme)

  const logoUrl = `${origin}/sipscouts-logo.png`
  const mascotUrl = `${origin}/sipscouts-mascot.jpg`

  const isCommunityWish =
    drink.toLowerCase().startsWith('i wish') || (mode === 'trend' && drink.length > 45)

  const topPillText =
    isCommunityWish
      ? '💡 COMMUNITY SCOUT WISH'
      : mode === 'trend'
      ? '🔥 NEIGHBORHOOD CRAVING REPORT'
      : '🎯 HIDDEN GEM SIP SPOTLIGHT'

  const mainTitle =
    mode === 'trend'
      ? isCommunityWish
        ? `"${drink}"`
        : `Trending in ${city}: ${drink}`
      : `${drink} at ${venue}`

  const subText =
    mode === 'trend'
      ? isCommunityWish
        ? `📍 Wish from ${city} · Scouted on SipScouts.com`
        : `${signal} · Scouted live on SipScouts.com`
      : `📍 ${city}${dist ? ` · ${dist}` : ''} · Scouted by ${scout}`

  const heroFontSize =
    mainTitle.length > 90
      ? isStory ? '34px' : '26px'
      : mainTitle.length > 60
      ? isStory ? '44px' : '34px'
      : mainTitle.length > 35
      ? isStory ? '52px' : '40px'
      : isStory ? '64px' : '50px'

  const boxFontSize =
    mainTitle.length > 90
      ? isStory ? '34px' : '26px'
      : mainTitle.length > 60
      ? isStory ? '44px' : '34px'
      : mainTitle.length > 35
      ? isStory ? '52px' : '38px'
      : isStory ? '64px' : '48px'

  // Vibrant theme design configurations with BRIGHT, FULL-COLOR MASTERPIECES
  const themeConfig = {
    // ══════════════════════════════════════════════════════════════════
    // 1. LIVELY MASCOT LAYOUTS (FAMOUS ARTWORKS · ZERO-BOX OPEN DESIGN)
    // Ordered: 1. Speakeasy, 2. Matcha, 3. Dark Roast, 4. Terracotta
    // ══════════════════════════════════════════════════════════════════
    starry_hero: {
      artUrl: `${origin}/starry-night.jpg`,
      artOpacity: 0.88,
      veilBg: 'linear-gradient(180deg, rgba(6,9,22,0.35) 0%, rgba(8,12,30,0.15) 50%, rgba(4,6,15,0.55) 100%)',
      border: '#FFD166',
      accentBg: 'rgba(255, 209, 102, 0.35)',
      accentBorder: '#FFD166',
      accentText: '#FFEAA7',
      badgeBg: '#E2725B',
      haloColor: 'rgba(255, 209, 102, 0.65)',
      mascotGlow: '0 0 75px rgba(255, 209, 102, 0.9), 0 20px 50px rgba(0,0,0,0.7)',
      pillBg: 'rgba(10, 16, 40, 0.92)',
      pillBorder: '#FFD166',
      pillText: '#FFD166',
    },
    matcha_hero: {
      artUrl: `${origin}/art-matcha.jpg`,
      artOpacity: 0.88,
      veilBg: 'linear-gradient(180deg, rgba(8,20,12,0.35) 0%, rgba(12,28,16,0.15) 50%, rgba(6,16,10,0.55) 100%)',
      border: '#78B177',
      accentBg: 'rgba(120, 177, 119, 0.35)',
      accentBorder: '#78B177',
      accentText: '#C8ECC7',
      badgeBg: '#5B8C5A',
      haloColor: 'rgba(120, 177, 119, 0.65)',
      mascotGlow: '0 0 75px rgba(120, 177, 119, 0.9), 0 20px 50px rgba(0,0,0,0.7)',
      pillBg: 'rgba(8, 22, 12, 0.92)',
      pillBorder: '#78B177',
      pillText: '#C8ECC7',
    },
    espresso_hero: {
      artUrl: `${origin}/art-espresso.jpg`,
      artOpacity: 0.9,
      veilBg: 'linear-gradient(180deg, rgba(20,12,8,0.35) 0%, rgba(28,17,10,0.15) 50%, rgba(14,8,5,0.55) 100%)',
      border: '#D4A373',
      accentBg: 'rgba(212, 163, 115, 0.35)',
      accentBorder: '#D4A373',
      accentText: '#FAEDCD',
      badgeBg: '#D4A373',
      haloColor: 'rgba(212, 163, 115, 0.65)',
      mascotGlow: '0 0 75px rgba(212, 163, 115, 0.9), 0 20px 50px rgba(0,0,0,0.7)',
      pillBg: 'rgba(22, 14, 9, 0.92)',
      pillBorder: '#D4A373',
      pillText: '#FAEDCD',
    },
    terracotta_hero: {
      artUrl: `${origin}/art-terracotta.jpg`,
      artOpacity: 0.9,
      veilBg: 'linear-gradient(180deg, rgba(28,14,10,0.35) 0%, rgba(42,20,14,0.15) 50%, rgba(18,8,6,0.55) 100%)',
      border: '#E2725B',
      accentBg: 'rgba(226, 114, 91, 0.4)',
      accentBorder: '#E2725B',
      accentText: '#FFCBA4',
      badgeBg: '#E2725B',
      haloColor: 'rgba(226, 114, 91, 0.65)',
      mascotGlow: '0 0 75px rgba(226, 114, 91, 0.9), 0 20px 50px rgba(0,0,0,0.7)',
      pillBg: 'rgba(28, 14, 10, 0.92)',
      pillBorder: '#E2725B',
      pillText: '#FFCBA4',
    },

    // ══════════════════════════════════════════════════════════════════
    // 2. CLASSIC BOXED LAYOUTS (BRIGHT MASTERPIECES · FROSTED GLASS CARDS)
    // Ordered: 1. Speakeasy, 2. Matcha, 3. Dark Roast, 4. Terracotta
    // ══════════════════════════════════════════════════════════════════
    // 1. Speakeasy Boxed (Edward Hopper — "Nighthawks", 1942)
    neon: {
      artUrl: `${origin}/box-nighthawks.jpg`,
      artOpacity: 0.92,
      veilBg: 'transparent',
      border: '#FFD166',
      cardBg: 'rgba(8, 14, 30, 0.88)',
      cardBorder: 'rgba(255, 209, 102, 0.75)',
      accentBg: 'rgba(255, 209, 102, 0.3)',
      accentBorder: '#FFD166',
      accentText: '#FFEAA7',
      badgeBg: '#E2725B',
      mascotGlow: '0 0 50px rgba(255, 209, 102, 0.8)',
    },
    // 2. Matcha Boxed (Hiroshige — "Plum Garden at Kameido")
    matcha: {
      artUrl: `${origin}/box-hiroshige.jpg`,
      artOpacity: 0.92,
      veilBg: 'transparent',
      border: '#78B177',
      cardBg: 'rgba(10, 24, 14, 0.88)',
      cardBorder: 'rgba(120, 177, 119, 0.7)',
      accentBg: 'rgba(120, 177, 119, 0.35)',
      accentBorder: '#78B177',
      accentText: '#C8ECC7',
      badgeBg: '#5B8C5A',
      mascotGlow: '0 0 45px rgba(120, 177, 119, 0.7)',
    },
    // 3. Espresso Boxed (Paul Cézanne — "The Card Players")
    espresso: {
      artUrl: `${origin}/box-cezanne.jpg`,
      artOpacity: 0.92,
      veilBg: 'transparent',
      border: '#D4A373',
      cardBg: 'rgba(24, 14, 8, 0.88)',
      cardBorder: 'rgba(212, 163, 115, 0.7)',
      accentBg: 'rgba(212, 163, 115, 0.35)',
      accentBorder: '#D4A373',
      accentText: '#FAEDCD',
      badgeBg: '#D4A373',
      mascotGlow: '0 0 45px rgba(212, 163, 115, 0.7)',
    },
    // 4. Terracotta Boxed (Gustav Klimt — "The Kiss" Gold Mosaic)
    terracotta: {
      artUrl: `${origin}/box-klimt.jpg`,
      artOpacity: 0.9,
      veilBg: 'transparent',
      border: '#E2725B',
      cardBg: 'rgba(38, 20, 12, 0.88)',
      cardBorder: 'rgba(255, 203, 164, 0.65)',
      accentBg: 'rgba(226, 114, 91, 0.35)',
      accentBorder: '#E2725B',
      accentText: '#FFCBA4',
      badgeBg: '#E2725B',
      mascotGlow: '0 0 45px rgba(226, 114, 91, 0.7)',
    },
  }[theme as string] || {
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
          background: '#0a0d18',
          color: '#FAF3E8',
          padding: isStory ? '85px 68px' : '52px 52px',
          fontFamily: 'sans-serif',
          border: `16px solid ${themeConfig.border}`,
          position: 'relative',
        }}
      >
        {/* Artistic Masterpiece Background Underlay (Bright & Vibrant) */}
        {themeConfig.artUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={themeConfig.artUrl}
            alt="Artistic Masterpiece Background"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: themeConfig.artOpacity || 0.9,
            }}
          />
        )}

        {/* Minimalist readability veil (only for Lively themes where text directly overlays art) */}
        {themeConfig.veilBg && themeConfig.veilBg !== 'transparent' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: themeConfig.veilBg,
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: isStory ? '48px' : '40px',
                  fontWeight: 800,
                  color: '#FAF3E8',
                  letterSpacing: '-1px',
                  textShadow: '0 2px 14px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
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
                  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
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
              background: themeConfig.accentBg,
              border: `2.5px solid ${themeConfig.accentBorder}`,
              borderRadius: '999px',
              padding: isStory ? '12px 28px' : '8px 20px',
              fontSize: isStory ? '22px' : '17px',
              fontWeight: 800,
              color: themeConfig.accentText,
              letterSpacing: '1px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
            }}
          >
            {topPillText}
          </div>
        </div>

        {/* ── SEAMLESS GIANT CENTERED MASCOT LAYOUT (NO BOXES) ── */}
        {isSeamlessMascotHero ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 10,
              width: '100%',
              margin: 'auto 0',
              padding: '12px 0',
            }}
          >
            {/* Giant Centered Mascot */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isStory ? '580px' : '480px',
                height: isStory ? '580px' : '480px',
              }}
            >
              {/* Radial Aura Halo */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '999px',
                  background: `radial-gradient(circle, ${themeConfig.haloColor || 'rgba(255,209,102,0.45)'} 0%, transparent 75%)`,
                  filter: 'blur(22px)',
                }}
              />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mascotUrl}
                alt="SipScouts Giant Mascot"
                width={isStory ? 540 : 440}
                height={isStory ? 540 : 440}
                style={{
                  borderRadius: '999px',
                  border: `8px solid ${themeConfig.border}`,
                  objectFit: 'cover',
                  boxShadow: themeConfig.mascotGlow,
                }}
              />

              {/* Scout Approved Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  background: themeConfig.badgeBg,
                  color: '#FFFFFF',
                  borderRadius: '999px',
                  padding: isStory ? '10px 28px' : '8px 22px',
                  fontSize: isStory ? '22px' : '17px',
                  fontWeight: 800,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
                  letterSpacing: '1px',
                }}
              >
                🏆 Scout Approved
              </div>
            </div>

            {/* Superimposed Clean Text Overlay Under Mascot (No enclosing boxes) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
                marginTop: isStory ? '26px' : '16px',
                maxWidth: '920px',
              }}
            >
              <div
                style={{
                  fontSize: heroFontSize,
                  fontWeight: 800,
                  lineHeight: 1.18,
                  color: '#FFFFFF',
                  textShadow:
                    '0 3px 0 #000, 0 8px 25px rgba(0,0,0,1), 0 0 45px rgba(0,0,0,0.95)',
                }}
              >
                {mainTitle}
              </div>

              <div
                style={{
                  fontSize: isStory ? '32px' : '24px',
                  lineHeight: 1.35,
                  color: themeConfig.accentText,
                  fontWeight: 700,
                  textShadow:
                    '0 2px 0 #000, 0 5px 16px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.9)',
                }}
              >
                {subText}
              </div>

              {/* Tag Pills */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '16px',
                  marginTop: '8px',
                }}
              >
                {handle && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: themeConfig.badgeBg,
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      padding: isStory ? '14px 32px' : '10px 24px',
                      fontSize: isStory ? '28px' : '22px',
                      fontWeight: 800,
                      boxShadow: '0 8px 25px rgba(0,0,0,0.7)',
                    }}
                  >
                    📸 @{handle}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: themeConfig.pillBg || 'rgba(10, 16, 40, 0.92)',
                    border: `2.5px solid ${themeConfig.pillBorder || themeConfig.border}`,
                    color: themeConfig.pillText || themeConfig.accentText,
                    borderRadius: '999px',
                    padding: isStory ? '14px 32px' : '10px 24px',
                    fontSize: isStory ? '28px' : '22px',
                    fontWeight: 800,
                    boxShadow: '0 8px 25px rgba(0,0,0,0.7)',
                  }}
                >
                  🥂 @SipScoutsApp
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── CLASSIC BOXED SPOTLIGHT CARD (FINE ART MASTERPIECE BACKDROPS) ── */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isStory ? '28px' : '18px',
              background: (themeConfig as any).cardBg || 'rgba(10, 14, 30, 0.88)',
              border: `3.5px solid ${(themeConfig as any).cardBorder || 'rgba(255, 209, 102, 0.75)'}`,
              borderRadius: '40px',
              padding: isStory ? '54px 50px' : '38px 42px',
              marginTop: '10px',
              marginBottom: '10px',
              position: 'relative',
              zIndex: 10,
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
            }}
          >
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
                  boxShadow: themeConfig.mascotGlow,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span
                  style={{
                    fontSize: isStory ? '24px' : '19px',
                    color: themeConfig.accentText,
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
                fontSize: boxFontSize,
                fontWeight: 800,
                lineHeight: 1.18,
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
                    background: themeConfig.badgeBg,
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
        )}

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
              background: themeConfig.badgeBg,
              color: '#FFFFFF',
              padding: isStory ? '20px 44px' : '12px 30px',
              borderRadius: '999px',
              fontSize: isStory ? '30px' : '22px',
              fontWeight: 800,
              boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
            }}
          >
            🔍 Search Any Drink or Ingredient at sipscouts.com
          </div>
          <span
            style={{
              fontSize: isStory ? '24px' : '18px',
              color: '#FFCBA4',
              fontWeight: 600,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            Specialty Coffee · Matcha &amp; Tea · Craft Cocktails · Zero-Proof
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
