import { useState, useEffect, useCallback } from 'react'

export interface GeoLocation {
  latitude: number | null
  longitude: number | null
  cityLabel: string | null
  source: 'gps' | 'ip' | null
  error: string | null
  loading: boolean
  requestLocation: () => void
}

export function useGeolocation(): GeoLocation {
  const [state, setState] = useState<Omit<GeoLocation, 'requestLocation'>>({
    latitude: null,
    longitude: null,
    cityLabel: null,
    source: null,
    error: null,
    loading: true,
  })

  const fetchIpFallback = useCallback(async (reason: string) => {
    try {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
      if (res.ok) {
        const data = await res.json()
        const lat = parseFloat(data.latitude)
        const lng = parseFloat(data.longitude)
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const label = [data.city, data.region].filter(Boolean).join(', ') || 'your area'
          setState({
            latitude: lat,
            longitude: lng,
            cityLabel: label,
            source: 'ip',
            error: null,
            loading: false,
          })
          return
        }
      }
    } catch {
      // Ignore IP fallback failure
    }
    setState({
      latitude: null,
      longitude: null,
      cityLabel: null,
      source: null,
      error: reason,
      loading: false,
    })
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      fetchIpFallback('Geolocation not supported')
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    // Stage 1: Fast Wi-Fi / cell / cached GPS position
    navigator.geolocation.getCurrentPosition(
      pos => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          cityLabel: null,
          source: 'gps',
          error: null,
          loading: false,
        })
      },
      () => {
        // Stage 2: Retry with low-accuracy network location before falling back to IP
        navigator.geolocation.getCurrentPosition(
          pos => {
            setState({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              cityLabel: null,
              source: 'gps',
              error: null,
              loading: false,
            })
          },
          err => {
            fetchIpFallback(err.message)
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
        )
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    )
  }, [fetchIpFallback])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  return { ...state, requestLocation }
}

/** Haversine distance in km between two lat/lng pairs */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
