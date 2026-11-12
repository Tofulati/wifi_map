import type { NetworkReading } from '../lib/networkReading'

type DemoZone = {
  networkName: string
  eastMeters: number
  northMeters: number
  typicalMbps: number
  spreadMbps: number
  // Most home and cafe connections upload at a fraction of their download speed.
  uploadShare: number
  typicalLatencyMs: number
  count: number
}

// One network per color band, plus two networks sharing the bottom-left area to show that a fast
// and a slow network in the same place are mapped separately instead of averaged together.
const DEMO_ZONES: DemoZone[] = [
  { networkName: 'Sunrise Cafe', eastMeters: -350, northMeters: 250, typicalMbps: 180, spreadMbps: 40, uploadShare: 0.2, typicalLatencyMs: 15, count: 20 },
  { networkName: 'Oak St Library', eastMeters: 300, northMeters: 200, typicalMbps: 40, spreadMbps: 15, uploadShare: 0.5, typicalLatencyMs: 25, count: 15 },
  { networkName: 'Corner Market Guest', eastMeters: 250, northMeters: -300, typicalMbps: 6, spreadMbps: 4, uploadShare: 0.15, typicalLatencyMs: 120, count: 15 },
  { networkName: 'Velvet Lounge', eastMeters: -300, northMeters: -250, typicalMbps: 120, spreadMbps: 30, uploadShare: 0.1, typicalLatencyMs: 20, count: 12 },
  { networkName: 'City Free WiFi', eastMeters: -300, northMeters: -250, typicalMbps: 8, spreadMbps: 5, uploadShare: 0.1, typicalLatencyMs: 90, count: 12 },
]

const LATENCY_SPREAD = 0.3
const roundToTenth = (value: number) => Math.round(value * 10) / 10

const ZONE_RADIUS_METERS = 120
const METERS_PER_DEGREE_LATITUDE = 111_320

// Seeded PRNG (mulberry32) so the demo layout is identical every time it's shown.
function createRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDemoReadings(center: { longitude: number; latitude: number }): NetworkReading[] {
  const random = createRandom(42)
  // A degree of longitude shrinks by cos(latitude); without this the zones come out as ellipses.
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE * Math.cos((center.latitude * Math.PI) / 180)

  return DEMO_ZONES.flatMap((zone) =>
    Array.from({ length: zone.count }, () => {
      const angle = random() * 2 * Math.PI
      // sqrt spreads points evenly over the disc instead of bunching them at the center.
      const distance = Math.sqrt(random()) * ZONE_RADIUS_METERS
      const east = zone.eastMeters + Math.cos(angle) * distance
      const north = zone.northMeters + Math.sin(angle) * distance
      const downloadMbps = Math.max(
        0.5,
        roundToTenth(zone.typicalMbps + (random() * 2 - 1) * zone.spreadMbps),
      )
      const latencyMs = zone.typicalLatencyMs * (1 + (random() * 2 - 1) * LATENCY_SPREAD)

      return {
        networkName: zone.networkName,
        downloadMbps,
        uploadMbps: Math.max(0.1, roundToTenth(downloadMbps * zone.uploadShare)),
        latencyMs: Math.round(latencyMs),
        longitude: center.longitude + east / metersPerDegreeLongitude,
        latitude: center.latitude + north / METERS_PER_DEGREE_LATITUDE,
      }
    }),
  )
}
