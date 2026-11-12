import type { ReactNode } from 'react'
import { usePlaceName } from '../hooks/usePlaceName'
import { NEARBY_RADIUS_METERS, type NearbyNetwork } from '../lib/nearbyReadings'
import type { Coordinates, NetworkReading } from '../lib/networkReading'
import { MeasurePanel } from './MeasurePanel'
import { PlaceDetails } from './PlaceDetails'
import './YourLocation.css'

export type UserLocation =
  | { status: 'locating' }
  | { status: 'found'; coordinates: Coordinates }
  | { status: 'unavailable'; message: string }

type YourLocationProps = {
  userLocation: UserLocation
  nearbyNetworks: NearbyNetwork[]
  knownNetworkNames: string[]
  onReading: (reading: NetworkReading) => void
}

export function YourLocation({
  userLocation,
  nearbyNetworks,
  knownNetworkNames,
  onReading,
}: YourLocationProps) {
  const placeName = usePlaceName(userLocation.status === 'found' ? userLocation.coordinates : null)

  let details: ReactNode
  if (userLocation.status === 'found') {
    details = (
      <PlaceDetails
        placeName={placeName}
        coordinates={userLocation.coordinates}
        nearbyNetworks={nearbyNetworks}
        emptyMessage={`No readings within ${NEARBY_RADIUS_METERS} m yet. Measure the network you're on to add the first one.`}
      />
    )
  } else if (userLocation.status === 'unavailable') {
    details = (
      <p className="your-location-status">
        {userLocation.message}. Measuring will ask for your location again.
      </p>
    )
  } else {
    details = <p className="your-location-status">Finding your location…</p>
  }

  // MeasurePanel stays at the same position whatever the location status, so React keeps its
  // in-progress measurement when the status changes (measuring itself updates the location).
  return (
    <section className="side-panel-section">
      <h2 className="side-panel-heading">Your location</h2>
      {details}
      <MeasurePanel knownNetworkNames={knownNetworkNames} onReading={onReading} />
    </section>
  )
}
