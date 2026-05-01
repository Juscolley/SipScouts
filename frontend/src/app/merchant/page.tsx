'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface HourBucket {
  hour_bucket: string
  city: string | null
  zip_code: string | null
  drink: string | null
  ingredient: string | null
  search_volume: number
  avg_results: number
}

export default function MerchantDashboard() {
  const [rows, setRows] = useState<HourBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSearches, setTotalSearches] = useState(0)
  const [topDrink, setTopDrink] = useState('—')
  const [topIngredient, setTopIngredient] = useState('—')
  const [peakHour, setPeakHour] = useState('—')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('merchant_analytics').select('*').order('hour_bucket', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return }
        const d = (data ?? []) as HourBucket[]
        setRows(d)
        const total = d.reduce((s, r) => s + Number(r.search_volume), 0)
        setTotalSearches(total)
        const drinkMap: Record<string, number> = {}
        d.forEach(r => { if (r.drink) drinkMap[r.drink] = (drinkMap[r.drink] ?? 0) + Number(r.search_volume) })
        const topD = Object.entries(drinkMap).sort((a, b) => b[1] - a[1])[0]
        if (topD) setTopDrink(topD[0])
        const ingMap: Record<string, number> = {}
        d.forEach(r => { if (r.ingredient) ingMap[r.ingredient] = (ingMap[r.ingredient] ?? 0) + Number(r.search_volume) })
        const topI = Object.entries(ingMap).sort((a, b) => b[1] - a[1])[0]
        if (topI) setTopIngredient(topI[0])
        const hourMap: Record<string, number> = {}
        d.forEach(r => { const h = new Date(r.hour_bucket).getHours(); const label = `${h}:00`; hourMap[label] = (hourMap[label] ?? 0) + Number(r.search_volume) })
        const topH = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]
        if (topH) setPeakHour(topH[0])
        setLoading(false)
      })
  }, [])

  const stats = [
    { label: 'Total Searches', value: totalSearches },
    { label: 'Top Drink', value: topDrink },
    { label: 'Top Ingredient', value: topIngredient },
    { label: 'Peak Hour', value: peakHour },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fcf6f0' }}>
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <header className="warm-header" style={{ position: 'relative', zIndex: 30 }}>
        <div className="warm-header-inner">
          <a href="/discover" className="logo">SipScouts</a>
          <nav className="nav-links">
            <a href="/discover">Discover</a>
            <a href="/bookmarks">Saved</a>
            <a href="/profile">Profile</a>
            <span className="active">Dashboard</span>
            <span className="tag tag-green">Merchant</span>
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <main className="warm-main">
          <h1 className="hero-title" style={{ marginBottom: '0.3rem' }}>Business Intelligence</h1>
          <p className="hero-sub" style={{ marginBottom: '2rem', fontSize: '0.95rem' }}>Aggregated, anonymised search trends — no user PII included.</p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}><div className="spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map(s => (
                  <div key={s.label} className="stat-card glass">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>Recent Search Activity</h2>
                </div>
                {rows.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No search data yet — searches will appear here as users discover venues.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="warm-table">
                      <thead>
                        <tr>
                          <th>Time</th><th>Drink</th><th>Ingredient</th><th>City / ZIP</th><th style={{ textAlign: 'right' }}>Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-light)' }}>{new Date(r.hour_bucket).toLocaleString()}</td>
                            <td>{r.drink ?? '—'}</td>
                            <td>{r.ingredient ?? '—'}</td>
                            <td style={{ color: 'var(--text-light)' }}>{[r.city, r.zip_code].filter(Boolean).join(', ') || '—'}</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{r.search_volume}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
