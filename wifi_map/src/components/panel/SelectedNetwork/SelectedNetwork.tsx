import { usePlaceName } from '../../../hooks/usePlaceName'
import { formatCoordinates, type Coordinates } from '../../../lib/coordinates'
import { summarizeNetwork } from '../../../lib/nearbyReadings'
import type { NetworkReading } from '../../../lib/networkReading'
import { NetworkSummary } from '../../network/NetworkSummary/NetworkSummary'
import { SpeedFigures } from '../../network/SpeedFigures/SpeedFigures'
import './SelectedNetwork.css'

type SelectedNetworkProps = {
  networkName: string
  // Where the clicked dot is: a single reading, or the center of a cluster of them.
  clickedAt: Coordinates
  // Every reading on this network, wherever on the map it was taken.
  readings: NetworkReading[]
}

// Readings have no id of their own; two with the same spot and speed would be indistinguishable
// in the list anyway.
function readingKey(reading: NetworkReading) {
  return `${reading.longitude},${reading.latitude},${reading.downloadMbps}`
}

export function SelectedNetwork({ networkName, clickedAt, readings }: SelectedNetworkProps) {
  const placeName = usePlaceName(clickedAt)
  const { speeds, readingCount } = summarizeNetwork(networkName, readings)
  const readingsFastestFirst = [...readings].sort((a, b) => b.downloadMbps - a.downloadMbps)
  const averageLabel =
    readingCount > 1 ? `Network average of ${readingCount} readings` : 'Only 1 reading so far'
  const listLabel = readingCount > 1 ? `Show all ${readingCount} readings` : 'Show the reading'

  return (
    <section className="side-panel-section">
      <header>
        <h2 className="side-panel-heading">{networkName}</h2>
        <div className="selected-network-location">{placeName ?? formatCoordinates(clickedAt)}</div>
      </header>

      <div className="selected-network-average">
        <SpeedFigures speeds={speeds} />
        <div className="selected-network-detail">{averageLabel}</div>
        <NetworkSummary speeds={speeds} />
      </div>

      <details className="selected-network-readings">
        <summary>{listLabel}</summary>
        <ul className="selected-network-reading-list">
          {readingsFastestFirst.map((reading) => (
            <li key={readingKey(reading)}>
              <SpeedFigures speeds={reading} />
              <div className="selected-network-detail">{formatCoordinates(reading)}</div>
            </li>
          ))}
        </ul>
      </details>

      <p className="selected-network-detail">
        The map shows only {networkName}. Click anywhere else on the map to go back to your
        location.
      </p>
    </section>
  )
}
