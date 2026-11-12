import type { NearbyNetwork } from '../lib/nearbyReadings'
import './NetworkSpeedCard.css'
import { NetworkSummary, SpeedFigures } from './NetworkSummary'

type NetworkSpeedCardProps = NearbyNetwork

export function NetworkSpeedCard({ networkName, speeds, readingCount }: NetworkSpeedCardProps) {
  const readingCountLabel = readingCount > 1 ? `Average of ${readingCount} readings` : '1 reading'

  return (
    <div className="network-speed-card">
      <div className="network-speed-card-name">{networkName}</div>
      <SpeedFigures speeds={speeds} />
      <div className="network-speed-card-detail">{readingCountLabel}</div>
      <NetworkSummary speeds={speeds} />
    </div>
  )
}
