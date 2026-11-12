import { distance } from '@turf/distance'
import { groupByNetworkName } from './networkName'
import type { Coordinates, NetworkReading, NetworkSpeeds } from './networkReading'

// Roughly one building or cafe. Indoor GPS is often off by 20–50 m, so a tighter radius would
// make a spot you already measured look unmeasured.
export const NEARBY_RADIUS_METERS = 50

export type NearbyNetwork = {
  networkName: string
  speeds: NetworkSpeeds
  readingCount: number
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

// Older readings lack upload and latency, so those average only over the readings that have them.
function meanOfMeasured(values: (number | undefined)[]): number | undefined {
  const measured = values.filter((value) => value !== undefined)
  return measured.length > 0 ? mean(measured) : undefined
}

function toPosition({ longitude, latitude }: Coordinates) {
  return [longitude, latitude]
}

// Averages readings that all belong to one network.
export function summarizeNetwork(networkName: string, readings: NetworkReading[]): NearbyNetwork {
  return {
    networkName,
    readingCount: readings.length,
    speeds: {
      downloadMbps: mean(readings.map((reading) => reading.downloadMbps)),
      uploadMbps: meanOfMeasured(readings.map((reading) => reading.uploadMbps)),
      latencyMs: meanOfMeasured(readings.map((reading) => reading.latencyMs)),
    },
  }
}

// One entry per network, fastest first. Speeds are never averaged across networks, matching
// how the map keeps each network's readings separate.
export function summarizeNetworksNear(
  readings: NetworkReading[],
  center: Coordinates,
): NearbyNetwork[] {
  const nearby = readings.filter(
    (reading) =>
      distance(toPosition(reading), toPosition(center), { units: 'meters' }) <= NEARBY_RADIUS_METERS,
  )

  return [...groupByNetworkName(nearby)]
    .map(([networkName, group]) => summarizeNetwork(networkName, group))
    .sort((a, b) => b.speeds.downloadMbps - a.speeds.downloadMbps)
}
