import { useState, useEffect } from 'react'

interface GeoLocation {
  latitude: number | null
  longitude: number | null
  error: string | null
  loading: boolean
}

export function useGeolocation(): GeoLocation {
  const [state, setState] = useState<GeoLocation>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: 'Geolocation not supported' }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState({ latitude: null, longitude: null, error: err.message, loading: false })
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  return state
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
