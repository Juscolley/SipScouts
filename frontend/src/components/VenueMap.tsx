'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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
  type: 'cafe' | 'bar'
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

export default function VenueMap({ venues, userLat, userLng }: VenueMapProps) {
  const center: [number, number] =
    userLat && userLng
      ? [userLat, userLng]
      : venues.length > 0
      ? [venues[0].lat, venues[0].lng]
      : DEFAULT_CENTER

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
      className="rounded-2xl"
    >
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
            <div className="text-sm">
              <strong>{v.name}</strong>
              <br />
              {v.address}
              <br />
              <span className="capitalize text-indigo-600">{v.type}</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

