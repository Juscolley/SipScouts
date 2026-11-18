'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Venue {
  id: string
  name: string
  address: string
  type: 'cafe' | 'bar' | 'tea_house' | 'zero_proof' | string
  lat: number
  lng: number
  tags: string[]
}

interface VenueMapProps {
  venues: Venue[]
  userLat?: number
  userLng?: number
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function ScrollZoomController({
  zoomEnabled,
  setZoomEnabled,
}: {
  zoomEnabled: boolean
  setZoomEnabled: (val: boolean) => void
}) {
  const map = useMap()

  useMapEvents({
    click() {
      if (!zoomEnabled) {
        map.scrollWheelZoom.enable()
        setZoomEnabled(true)
      }
    },
    mouseout() {
      if (zoomEnabled) {
        map.scrollWheelZoom.disable()
        setZoomEnabled(false)
      }
    },
  })

  return null
}

function MapViewportUpdater({
  venues,
  userLat,
  userLng,
}: {
  venues: Venue[]
  userLat?: number
  userLng?: number
}) {
  const map = useMap()

  useEffect(() => {
    if (venues.length > 0) {
      const points: [number, number][] = venues
        .filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng))
        .map(v => [v.lat, v.lng])

      if (points.length > 0) {
        // Include user marker only if it's near the search results (within ~1 degree)
        if (
          userLat !== undefined &&
          userLng !== undefined &&
          Math.abs(userLat - points[0][0]) < 1 &&
          Math.abs(userLng - points[0][1]) < 1
        ) {
          points.push([userLat, userLng])
        }
        const bounds = L.latLngBounds(points)
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
        return
      }
    }

    if (userLat !== undefined && userLng !== undefined) {
      map.setView([userLat, userLng], 13)
    }
  }, [map, venues, userLat, userLng])

  return null
}

function getDirectionsUrl(v: Venue): string {
  const dest =
    v.address && v.address !== 'Nearby' && v.address !== 'Local Neighborhood Spot'
      ? `${v.name}, ${v.address}`
      : `${v.lat},${v.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}

export default function VenueMap({ venues, userLat, userLng }: VenueMapProps) {
  const [zoomEnabled, setZoomEnabled] = useState(false)

  const center: [number, number] =
    userLat && userLng
      ? [userLat, userLng]
      : venues.length > 0
      ? [venues[0].lat, venues[0].lng]
      : DEFAULT_CENTER

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', background: '#EAE2D8' }}
        className="rounded-2xl"
      >
        <ScrollZoomController zoomEnabled={zoomEnabled} setZoomEnabled={setZoomEnabled} />
        <MapViewportUpdater venues={venues} userLat={userLat} userLng={userLng} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLat && userLng && (
          <Marker position={[userLat, userLng]} icon={userIcon}>
            <Popup><strong>You are here</strong></Popup>
          </Marker>
        )}
        {venues.map((v) => (
          <Marker key={v.id} position={[v.lat, v.lng]}>
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', lineHeight: 1.4 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>{v.name}</strong>
                <span style={{ color: '#6E5244', display: 'block', marginBottom: 6 }}>{v.address}</span>
                <a
                  href={getDirectionsUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    color: '#E2725B',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Get Directions →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 450,
          pointerEvents: 'none',
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#4A2E20',
          fontSize: '0.7rem',
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          padding: '0.25rem 0.6rem',
          borderRadius: 99,
          border: '1px solid rgba(74, 46, 32, 0.14)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {zoomEnabled ? 'Scroll zoom active' : 'Click map to enable scroll zoom'}
      </div>
    </div>
  )
}
