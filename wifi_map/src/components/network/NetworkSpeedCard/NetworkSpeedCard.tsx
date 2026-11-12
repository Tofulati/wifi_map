import type { NearbyNetwork } from '../../../lib/nearbyReadings'
import { formatRecordedAt } from '../../../lib/networkReading'
import { NetworkSummary } from '../NetworkSummary/NetworkSummary'
import { SpeedFigures } from '../SpeedFigures/SpeedFigures'
import './NetworkSpeedCard.css'

type NetworkSpeedCardProps = NearbyNetwork & {
  recordedAt?: string
}

export function NetworkSpeedCard({
  networkName,
  speeds,
  readingCount,
  recordedAt,
}: NetworkSpeedCardProps) {
  const readingCountLabel = readingCount > 1 ? `Average of ${readingCount} readings` : '1 reading'

  return (
    <div className="network-speed-card">
      <div className="network-speed-card-name">{networkName}</div>
      <SpeedFigures speeds={speeds} />
      <div className="network-speed-card-detail">{readingCountLabel}</div>
      {recordedAt && (
        <div className="network-speed-card-detail">Measured {formatRecordedAt(recordedAt)}</div>
      )}
      <NetworkSummary speeds={speeds} />
    </div>
  )
}
