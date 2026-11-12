import MaplibreGeocoder, { type CarmenGeojsonFeature } from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css'
import * as maplibregl from 'maplibre-gl'
import type { FitBoundsOptions, Map as MaplibreMap } from 'maplibre-gl'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import type { Coordinates } from '../lib/networkReading'
import { photonGeocoderApi } from '../lib/photonGeocoder'
import './SearchControl.css'

export type SearchResult = {
  name: string
  coordinates: Coordinates
}

type SearchControlProps = {
  zoom: number
  onResult: (result: SearchResult) => void
  onClear: () => void
}

function escapeHtml(text: string) {
  const element = document.createElement('div')
  element.textContent = text
  return element.innerHTML
}

// The results dropdown inserts rendered strings as HTML, and OpenStreetMap place names are
// user-edited. The default renderer only exists once onAdd has created the dropdown.
class EscapingGeocoder extends MaplibreGeocoder {
  onAdd(map?: MaplibreMap) {
    const container = super.onAdd(map)
    const renderResult = this.getRenderFunction()
    this.setRenderFunction((feature) =>
      renderResult({ ...feature, place_name: escapeHtml(feature.place_name) }),
    )
    return container
  }
}

// Rendered inside the side panel rather than as a map control, so it calls the geocoder's onAdd
// itself: that's all map.addControl does, apart from placing the element in a map corner.
export function SearchControl({ zoom, onResult, onClear }: SearchControlProps) {
  const { current: mapRef } = useMap()
  const containerRef = useRef<HTMLDivElement>(null)

  const reportResult = useEffectEvent(function reportResult(feature: CarmenGeojsonFeature) {
    if (!feature.center) return
    const [longitude, latitude] = feature.center
    onResult({ name: feature.place_name, coordinates: { longitude, latitude } })
  })
  const reportClear = useEffectEvent(function reportClear() {
    onClear()
  })

  useEffect(
    function mountGeocoder() {
      const container = containerRef.current
      if (!mapRef || !container) return

      // Results with an extent are framed with fitBounds instead of flyTo; maxZoom stops a single
      // building's tiny extent from zooming the map all the way in.
      const flyTo: FitBoundsOptions = { maxZoom: zoom }
      const geocoder = new EscapingGeocoder(photonGeocoderApi, {
        maplibregl,
        placeholder: 'Search for a place or address',
        showResultsWhileTyping: true,
        showResultMarkers: false,
        zoom,
        flyTo,
      })
      geocoder.on('result', function handleResult({ result }) {
        reportResult(result)
      })
      geocoder.on('clear', function handleClear() {
        reportClear()
      })
      container.appendChild(geocoder.onAdd(mapRef.getMap()))

      return function unmountGeocoder() {
        geocoder.onRemove()
      }
    },
    [mapRef, zoom],
  )

  return <div ref={containerRef} className="search-control" />
}
