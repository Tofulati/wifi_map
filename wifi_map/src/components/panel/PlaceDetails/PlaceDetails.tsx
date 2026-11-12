import { formatCoordinates, type Coordinates } from '../../../lib/coordinates'
import type { NearbyNetwork } from '../../../lib/nearbyReadings'
import { NetworkSpeedCard } from '../../network/NetworkSpeedCard/NetworkSpeedCard'
import './PlaceDetails.css'

type PlaceDetailsProps = {
  placeName: string | null
  coordinates: Coordinates
  nearbyNetworks: NearbyNetwork[]
  emptyMessage: string
}

export function PlaceDetails({
  placeName,
  coordinates,
  nearbyNetworks,
  emptyMessage,
}: PlaceDetailsProps) {
  return (
    <div className="place-details">
      {placeName && <div className="place-details-name">{placeName}</div>}
      <div className="place-details-coordinates">{formatCoordinates(coordinates)}</div>
      {nearbyNetworks.length === 0 ? (
        <p className="place-details-empty">{emptyMessage}</p>
      ) : (
        <ul className="place-details-networks">
          {nearbyNetworks.map((network) => (
            <li key={network.networkName}>
              <NetworkSpeedCard {...network} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
