import { useEffect, useState } from 'react'
import type { Coordinates } from '../lib/coordinates'
import { reverseGeocode } from '../lib/photonGeocoder'

type PlaceNameLookup = { key: string; placeName: string | null }

function coordinatesKey({ longitude, latitude }: Coordinates) {
  return `${longitude},${latitude}`
}

export function usePlaceName(coordinates: Coordinates | null): string | null {
  const [lookup, setLookup] = useState<PlaceNameLookup | null>(null)
  const longitude = coordinates?.longitude
  const latitude = coordinates?.latitude

  useEffect(
    function lookUpPlaceName() {
      if (longitude === undefined || latitude === undefined) return
      const key = coordinatesKey({ longitude, latitude })
      const controller = new AbortController()
      reverseGeocode({ longitude, latitude }, controller.signal).then(
        function storePlaceName(placeName) {
          setLookup({ key, placeName })
        },
        // The address is only a label next to the coordinates, so a failed lookup just leaves it out.
        function leaveOutPlaceName() {
          if (!controller.signal.aborted) setLookup({ key, placeName: null })
        },
      )
      return function cancelLookup() {
        controller.abort()
      }
    },
    [longitude, latitude],
  )

  // A lookup for an earlier position may still be stored while the new one is in flight.
  const isCurrent = coordinates !== null && lookup?.key === coordinatesKey(coordinates)
  return isCurrent ? lookup.placeName : null
}
