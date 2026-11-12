import { usePlaceName } from '../../../hooks/usePlaceName'
import { formatCoordinates, type Coordinates } from '../../../lib/coordinates'
import { summarizeNetwork } from '../../../lib/nearbyReadings'
import { formatRecordedAt, type NetworkReading } from '../../../lib/networkReading'
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

type NetworkDetailsProps = {
  networkName: string
  location: string
  readings: NetworkReading[]
  showMapHint?: boolean
}

// Readings have no id of their own; two with the same spot and speed would be indistinguishable
// in the list anyway.
function readingKey(reading: NetworkReading) {
  return `${reading.longitude},${reading.latitude},${reading.downloadMbps}`
}

function speedTier(downloadMbps: number): 'slow' | 'okay' | 'fast' {
  if (downloadMbps < 5) return 'slow'
  if (downloadMbps < 25) return 'okay'
  return 'fast'
}

export function SelectedNetwork({ networkName, clickedAt, readings }: SelectedNetworkProps) {
  const placeName = usePlaceName(clickedAt)
  return (
    <section className="side-panel-section">
      <NetworkDetails
        networkName={networkName}
        location={placeName ?? formatCoordinates(clickedAt)}
        readings={readings}
        showMapHint
      />
    </section>
  )
}

export function NetworkDetails({
  networkName,
  location,
  readings,
  showMapHint = false,
}: NetworkDetailsProps) {
  const { speeds, readingCount } = summarizeNetwork(networkName, readings)
  const readingsFastestFirst = [...readings].sort((a, b) => b.downloadMbps - a.downloadMbps)
  const averageLabel =
    readingCount > 1 ? `Network average of ${readingCount} readings` : 'Only 1 reading so far'
  const listLabel = readingCount > 1 ? `Show all ${readingCount} readings` : 'Show the reading'

  return (
    <>
      <header className="selected-network-header">
        <h2 className="side-panel-heading">{networkName}</h2>
        <div className="selected-network-location">{location}</div>
      </header>

      <div className="selected-network-average">
        <div className="selected-network-speed">
          <SpeedFigures speeds={speeds} />
        </div>
        <div className="selected-network-detail">{averageLabel}</div>
        <NetworkSummary speeds={speeds} />
      </div>

      <details className="selected-network-readings">
        <summary>{listLabel}</summary>
        <div className="selected-network-speed-legend" aria-label="Download speed legend">
          <span>
            <i className="selected-network-speed-dot selected-network-speed-slow" aria-hidden="true" />
            Slow (&lt;5 Mbps)
          </span>
          <span>
            <i className="selected-network-speed-dot selected-network-speed-okay" aria-hidden="true" />
            Okay (5–25 Mbps)
          </span>
          <span>
            <i className="selected-network-speed-dot selected-network-speed-fast" aria-hidden="true" />
            Fast (25+ Mbps)
          </span>
        </div>
        <ul className="selected-network-reading-list">
          {readingsFastestFirst.map((reading) => (
            <li
              key={readingKey(reading)}
              className={`selected-network-reading selected-network-reading-${speedTier(reading.downloadMbps)}`}
            >
              <SpeedFigures speeds={reading} />
              <div className="selected-network-detail">{formatCoordinates(reading)}</div>
              {reading.recordedAt && (
                <div className="selected-network-detail">
                  Measured {formatRecordedAt(reading.recordedAt)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </details>

      {showMapHint && (
        <p className="selected-network-detail">
          The map shows only {networkName}. Click anywhere else on the map to go back to your
          location.
        </p>
      )}
    </>
  )
}
