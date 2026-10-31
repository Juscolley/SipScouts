'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getLocalVenueClicksBackup } from '@/lib/analytics'

interface HourBucket {
  hour_bucket: string
  city: string | null
  zip_code: string | null
  drink: string | null
  ingredient: string | null
  search_volume: number
  avg_results: number
}

interface VenueClickRow {
  venue_name: string
  venue_address?: string | null
  venue_type?: string | null
  action_type: string
  searched_drink?: string | null
  searched_ingredient?: string | null
  city?: string | null
  zip_code?: string | null
  clicked_at: string
}

interface VenueLeadSummary {
  venue_name: string
  location: string
  calls: number
  instagram: number
  website: number
  bookmarks: number
  shares: number
  total: number
  topCraving: string
}

const CREATOR_ADMIN_EMAIL = 'juscolley0603@gmail.com'

export default function MerchantDashboard() {
  const [rows, setRows] = useState<HourBucket[]>([])
  const [clickRows, setClickRows] = useState<VenueClickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorizedCreator, setIsAuthorizedCreator] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = (user?.email ?? '').trim().toLowerCase()
      if (email !== CREATOR_ADMIN_EMAIL) {
        setIsAuthorizedCreator(false)
        setLoading(false)
        return
      }

      setIsAuthorizedCreator(true)
      Promise.all([
        supabase
          .from('merchant_analytics')
          .select('*')
          .order('hour_bucket', { ascending: false })
          .limit(150),
        supabase
          .from('venue_clicks')
          .select('*')
          .order('clicked_at', { ascending: false })
          .limit(200),
      ]).then(([analyticsRes, clicksRes]) => {
        const d = ((analyticsRes.data ?? []) as HourBucket[])
        setRows(d)

        const dbClicks = ((clicksRes.data ?? []) as VenueClickRow[])
        const localBackup = getLocalVenueClicksBackup() as VenueClickRow[]
        const mergedClicks = dbClicks.length > 0 ? dbClicks : localBackup
        setClickRows(mergedClicks)
        setLoading(false)
      })
    })
  }, [])

  const filteredRows = useMemo(() => {
    const q = locationFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      r =>
        (r.city ?? '').toLowerCase().includes(q) ||
        (r.zip_code ?? '').toLowerCase().includes(q)
    )
  }, [rows, locationFilter])

  const filteredClicks = useMemo(() => {
    const q = locationFilter.trim().toLowerCase()
    if (!q) return clickRows
    return clickRows.filter(
      c =>
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.zip_code ?? '').toLowerCase().includes(q) ||
        (c.venue_address ?? '').toLowerCase().includes(q)
    )
  }, [clickRows, locationFilter])

  const {
    totalSearches,
    topDrink,
    topIngredient,
    peakHour,
    unmetOpportunities,
    venueLeads,
    totalLeadsAndShares,
  } = useMemo(() => {
    let total = 0
    const drinkMap: Record<string, number> = {}
    const ingMap: Record<string, number> = {}
    const hourMap: Record<string, number> = {}

    // Group for Unmet Demand / Supply Gap
    const gapMap: Record<
      string,
      {
        craving: string
        location: string
        volume: number
        resultsWeightedSum: number
      }
    > = {}

    filteredRows.forEach(r => {
      const vol = Number(r.search_volume) || 0
      const avgRes = Number(r.avg_results) || 0
      total += vol

      if (r.drink) drinkMap[r.drink] = (drinkMap[r.drink] ?? 0) + vol
      if (r.ingredient) ingMap[r.ingredient] = (ingMap[r.ingredient] ?? 0) + vol

      const h = new Date(r.hour_bucket).getHours()
      if (!Number.isNaN(h)) {
        const ampm = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
        hourMap[ampm] = (hourMap[ampm] ?? 0) + vol
      }

      const cravingLabel = [r.drink, r.ingredient].filter(Boolean).join(' + ')
      if (cravingLabel) {
        const locLabel = [r.city, r.zip_code].filter(Boolean).join(', ') || 'All Areas'
        const key = `${cravingLabel.toLowerCase()}__${locLabel.toLowerCase()}`
        if (!gapMap[key]) {
          gapMap[key] = {
            craving: cravingLabel,
            location: locLabel,
            volume: 0,
            resultsWeightedSum: 0,
          }
        }
        gapMap[key].volume += vol
        gapMap[key].resultsWeightedSum += avgRes * vol
      }
    })

    const topD = Object.entries(drinkMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const topI = Object.entries(ingMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const topH = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    const unmetList = Object.values(gapMap)
      .map(item => {
        const avgResults = item.volume > 0 ? item.resultsWeightedSum / item.volume : 0
        const opportunityScore = Number(
          (item.volume * (16 / Math.max(avgResults + 1, 1))).toFixed(1)
        )
        return {
          craving: item.craving,
          location: item.location,
          volume: item.volume,
          avgResults: Number(avgResults.toFixed(1)),
          opportunityScore,
        }
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore || b.volume - a.volume)

    // Aggregate Venue Clicks & Viral Shares
    const leadMap: Record<string, VenueLeadSummary> = {}
    let leadTotal = 0

    filteredClicks.forEach(c => {
      leadTotal += 1
      const vName = c.venue_name === '__BADGE_SHARE__' ? '🏅 Scout Badge & Sip DNA Shares' : c.venue_name
      if (!leadMap[vName]) {
        leadMap[vName] = {
          venue_name: vName,
          location: [c.city, c.zip_code].filter(Boolean).join(', ') || c.venue_address || 'Local Area',
          calls: 0,
          instagram: 0,
          website: 0,
          bookmarks: 0,
          shares: 0,
          total: 0,
          topCraving: [c.searched_drink, c.searched_ingredient].filter(Boolean).join(' + ') || 'General Discovery',
        }
      }
      const entry = leadMap[vName]
      entry.total += 1
      if (c.action_type === 'call') entry.calls += 1
      else if (c.action_type === 'instagram') entry.instagram += 1
      else if (c.action_type === 'website') entry.website += 1
      else if (c.action_type === 'bookmark') entry.bookmarks += 1
      else if (c.action_type === 'share_venue' || c.action_type === 'share_badge') entry.shares += 1
    })

    return {
      totalSearches: total,
      topDrink: topD,
      topIngredient: topI,
      peakHour: topH,
      unmetOpportunities: unmetList,
      venueLeads: Object.values(leadMap).sort((a, b) => b.total - a.total),
      totalLeadsAndShares: leadTotal,
    }
  }, [filteredRows, filteredClicks])

  function handleExportCsv() {
    const headers = ['Time', 'Drink', 'Ingredient', 'City', 'ZIP', 'Search Volume', 'Avg Local Results']
    const csvLines = [
      headers.join(','),
      ...filteredRows.map(r =>
        [
          `"${new Date(r.hour_bucket).toISOString()}"`,
          `"${(r.drink ?? '').replace(/"/g, '""')}"`,
          `"${(r.ingredient ?? '').replace(/"/g, '""')}"`,
          `"${(r.city ?? '').replace(/"/g, '""')}"`,
          `"${(r.zip_code ?? '').replace(/"/g, '""')}"`,
          r.search_volume,
          Number(r.avg_results ?? 0).toFixed(1),
        ].join(',')
      ),
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sipscouts-b2b-report-${locationFilter.trim() || 'all-markets'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = [
    { label: 'Total Searches', value: totalSearches },
    { label: 'Top Craved Drink', value: topDrink },
    { label: 'Top Ingredient', value: topIngredient },
    { label: 'Peak Craving Hour', value: peakHour },
    { label: 'Venue Leads & Shares', value: totalLeadsAndShares },
    { label: 'Tracked Cravings', value: unmetOpportunities.length },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">
            <img src="/sipscouts-logo.png" alt="SipScouts" className="logo-mark" />
            <span>SipScouts</span>
          </a>
          <nav className="nav-links">
            <a href="/discover">Discover</a>
            <a href="/bookmarks">Saved</a>
            <a href="/profile">Profile</a>
            <span className="active">Dashboard</span>
            <span className="tag tag-green">Merchant B2B</span>
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
            <div>
              <h1 className="hero-title" style={{ marginBottom: '0.3rem' }}>B2B Market &amp; Craving Intelligence</h1>
              <p className="hero-sub" style={{ marginBottom: 0, fontSize: '0.95rem' }}>
                Live neighborhood demand, unmet menu opportunities, and direct venue lead attribution.
              </p>
            </div>
            {isAuthorizedCreator && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  placeholder="Filter by City or ZIP (e.g. 07044)…"
                  className="warm-input"
                  style={{ width: 235, padding: '0.6rem 0.9rem', fontSize: '0.88rem' }}
                />
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="warm-btn"
                  style={{ padding: '0.65rem 1.1rem', fontSize: '0.85rem', borderRadius: 10 }}
                >
                  📥 Export B2B Report (CSV)
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}><div className="spinner" /></div>
          ) : !isAuthorizedCreator ? (
            <div className="glass" style={{ maxWidth: 480, margin: '2rem auto', padding: '3rem 2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🔒</p>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                Creator &amp; Admin Access Only
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', color: 'var(--text-light)', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                The SipScouts B2B Market &amp; Craving Intelligence Dashboard is private and restricted to the SipScouts Creator account.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/login" className="warm-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  Sign In as Creator
                </a>
                <a href="/discover" className="warm-btn-ghost" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  ← Back to Search
                </a>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Executive KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.85rem' }}>
                {stats.map(s => (
                  <div key={s.label} className="stat-card glass" style={{ padding: '1.15rem 1.25rem' }}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ fontSize: '1.65rem' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* 1. UNMET CRAVING / SUPPLY GAP REPORT */}
              <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.35rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 className="section-title" style={{ margin: 0, color: 'var(--primary)' }}>
                      🔥 Unmet Neighborhood Cravings &amp; Menu Supply-Gap Report
                    </h2>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                      High-intent drink &amp; ingredient searches ranked against local supply — ideal for advising cafés &amp; bars on what to add to their menu next.
                    </p>
                  </div>
                </div>
                {unmetOpportunities.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No drink/ingredient searches matched this filter yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="warm-table">
                      <thead>
                        <tr>
                          <th>Craved Drink / Ingredient</th>
                          <th>Market (City / ZIP)</th>
                          <th style={{ textAlign: 'right' }}>Search Volume</th>
                          <th style={{ textAlign: 'right' }}>Avg Local Supply</th>
                          <th style={{ textAlign: 'right' }}>Opportunity Score</th>
                          <th>B2B Menu Signal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmetOpportunities.slice(0, 15).map((u, i) => {
                          const isHighGap = u.avgResults <= 6
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{u.craving}</td>
                              <td style={{ color: 'var(--text-light)' }}>{u.location}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{u.volume}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>{u.avgResults} spots</td>
                              <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>{u.opportunityScore}</td>
                              <td>
                                {isHighGap ? (
                                  <span className="tag" style={{ fontSize: '0.73rem', fontWeight: 700 }}>
                                    🔥 High Supply Gap
                                  </span>
                                ) : (
                                  <span className="tag tag-green" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                                    ⚡ Active Local Demand
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. VENUE LEAD & VIRAL SHARE ATTRIBUTION */}
              <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.35rem', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="section-title" style={{ margin: 0, color: 'var(--text-main)' }}>
                    🎯 Direct Venue Lead &amp; Viral Share Attribution (Calls · Instagram · Menu · Saves · Invites)
                  </h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                    Tracks every customer click from SipScouts directly to a venue&apos;s phone, Instagram, menu/website, bookmarks, or friend text invites.
                  </p>
                </div>
                {venueLeads.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem' }}>
                    As users tap <strong>📞 Call</strong>, <strong>📸 Instagram</strong>, <strong>🌐 Menu / Site</strong>, <strong>🔖 Save</strong>, or <strong>🥂 Share / Invite</strong> on any venue card, live lead counts will appear here automatically.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="warm-table">
                      <thead>
                        <tr>
                          <th>Venue</th>
                          <th>Top Craving Searched</th>
                          <th style={{ textAlign: 'center' }}>📞 Calls</th>
                          <th style={{ textAlign: 'center' }}>📸 Instagram</th>
                          <th style={{ textAlign: 'center' }}>🌐 Menu/Site</th>
                          <th style={{ textAlign: 'center' }}>🔖 Saves</th>
                          <th style={{ textAlign: 'center' }}>🥂 Shares</th>
                          <th style={{ textAlign: 'right' }}>Total Leads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venueLeads.map((v, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{v.venue_name}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-light)' }}>{v.location}</div>
                            </td>
                            <td>{v.topCraving}</td>
                            <td style={{ textAlign: 'center' }}>{v.calls}</td>
                            <td style={{ textAlign: 'center' }}>{v.instagram}</td>
                            <td style={{ textAlign: 'center' }}>{v.website}</td>
                            <td style={{ textAlign: 'center' }}>{v.bookmarks}</td>
                            <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 600 }}>{v.shares}</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>{v.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. RAW HOURLY SEARCH LOG */}
              <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>Recent Search Activity Log</h2>
                </div>
                {filteredRows.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No search data yet — searches will appear here as users discover venues.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="warm-table">
                      <thead>
                        <tr>
                          <th>Time</th><th>Drink</th><th>Ingredient</th><th>City / ZIP</th><th style={{ textAlign: 'right' }}>Avg Spots</th><th style={{ textAlign: 'right' }}>Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-light)' }}>{new Date(r.hour_bucket).toLocaleString()}</td>
                            <td>{r.drink ?? '—'}</td>
                            <td>{r.ingredient ?? '—'}</td>
                            <td style={{ color: 'var(--text-light)' }}>{[r.city, r.zip_code].filter(Boolean).join(', ') || '—'}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>{Number(r.avg_results ?? 0).toFixed(0)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{r.search_volume}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
