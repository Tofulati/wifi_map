import type { NetworkSpeeds } from '../../../lib/networkReading'

const MBPS_DECIMALS = 1

type SpeedFiguresProps = {
  speeds: NetworkSpeeds
}

export function SpeedFigures({ speeds }: SpeedFiguresProps) {
  return (
    <span>
      <strong>{speeds.downloadMbps.toFixed(MBPS_DECIMALS)} Mbps</strong> down
      {speeds.uploadMbps !== undefined && ` · ${speeds.uploadMbps.toFixed(MBPS_DECIMALS)} up`}
      {speeds.latencyMs !== undefined && ` · ${Math.round(speeds.latencyMs)} ms ping`}
    </span>
  )
}
