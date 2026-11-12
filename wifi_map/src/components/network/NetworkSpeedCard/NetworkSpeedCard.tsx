import type { NearbyNetwork } from '../../../lib/nearbyReadings'
import { formatCoordinates } from '../../../lib/coordinates'
import { formatRecordedAt, type NetworkReading } from '../../../lib/networkReading'
import { NetworkSummary } from '../NetworkSummary/NetworkSummary'
import { SpeedFigures } from '../SpeedFigures/SpeedFigures'
import './NetworkSpeedCard.css'

type NetworkSpeedCardProps = Omit<NearbyNetwork, 'readings'> & {
  recordedAt?: string
  readings?: NetworkReading[]
}

export function NetworkSpeedCard({
  networkName,
  speeds,
  readingCount,
  recordedAt,
  readings,
}: NetworkSpeedCardProps) {
  const readingCountLabel = readingCount > 1 ? `Average of ${readingCount} readings` : '1 reading'
  const readingsFastestFirst = readings
    ? [...readings].sort((a, b) => b.downloadMbps - a.downloadMbps)
    : []

  return (
    <div className="network-speed-card">
      <div className="network-speed-card-name">{networkName}</div>
      <SpeedFigures speeds={speeds} />
      <div className="network-speed-card-detail">{readingCountLabel}</div>
      {recordedAt && (
        <div className="network-speed-card-detail">Measured {formatRecordedAt(recordedAt)}</div>
      )}
      <NetworkSummary speeds={speeds} />
      {readings && (
        <details className="network-speed-card-readings">
          <summary>{readingCount > 1 ? `Show all ${readingCount} readings` : 'Show the reading'}</summary>
          <ul>
            {readingsFastestFirst.map((reading) => (
              <li key={readingKey(reading)}>
                <SpeedFigures speeds={reading} />
                <div className="network-speed-card-detail">{formatCoordinates(reading)}</div>
                {reading.recordedAt && (
                  <div className="network-speed-card-detail">
                    Measured {formatRecordedAt(reading.recordedAt)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function readingKey(reading: NetworkReading) {
  return `${reading.longitude},${reading.latitude},${reading.downloadMbps}`
}
