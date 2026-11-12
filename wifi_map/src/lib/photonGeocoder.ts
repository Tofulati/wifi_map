import type { CarmenGeojsonFeature, MaplibreGeocoderApi } from '@maplibre/maplibre-gl-geocoder'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Coordinates } from './networkReading'

// Komoot's public demo server: no API key, but only for "reasonable" traffic and with no uptime
// guarantee. Point these at a self-hosted Photon if the app outgrows that.
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/'
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse'

type PhotonProperties = {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  state?: string
  country?: string
  type?: string
  // Ordered [minLon, maxLat, maxLon, minLat], not the GeoJSON [minLon, minLat, maxLon, maxLat].
  extent?: [number, number, number, number]
}

function toCarmenFeature(feature: Feature<Point, PhotonProperties>): CarmenGeojsonFeature {
  const { name, housenumber, street, city, state, country, type, extent } = feature.properties
  const streetAddress = [housenumber, street].filter(Boolean).join(' ')
  const text = name || streetAddress || city || state || country || 'Unnamed place'
  const [longitude, latitude] = feature.geometry.coordinates
  // The dropdown shows the first comma-separated part as the title and the rest as the address.
  const placeNameParts = [text, streetAddress, city, state, country].filter(Boolean)

  return {
    ...feature,
    text,
    place_name: [...new Set(placeNameParts)].join(', '),
    place_type: [type ?? 'place'],
    center: [longitude, latitude],
    bbox: extent && [extent[0], extent[3], extent[2], extent[1]],
  }
}

export const photonGeocoderApi: MaplibreGeocoderApi = {
  forwardGeocode: async ({ query, limit, proximity }) => {
    const params = new URLSearchParams({ q: String(query) })
    if (limit) params.set('limit', String(limit))
    if (proximity) {
      params.set('lon', String(proximity[0]))
      params.set('lat', String(proximity[1]))
    }

    const response = await fetch(`${PHOTON_SEARCH_URL}?${params}`)
    if (!response.ok) throw new Error(`Photon search failed with HTTP ${response.status}`)
    const results: FeatureCollection<Point, PhotonProperties> = await response.json()

    return { type: 'FeatureCollection', features: results.features.map(toCarmenFeature) }
  },
}

export async function reverseGeocode(
  { longitude, latitude }: Coordinates,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({ lon: String(longitude), lat: String(latitude), limit: '1' })
  const response = await fetch(`${PHOTON_REVERSE_URL}?${params}`, { signal })
  if (!response.ok) throw new Error(`Photon reverse lookup failed with HTTP ${response.status}`)
  const results: FeatureCollection<Point, PhotonProperties> = await response.json()
  const [nearest] = results.features
  return nearest ? toCarmenFeature(nearest).place_name : null
}
