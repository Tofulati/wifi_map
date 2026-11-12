import SpeedTest, { type MeasurementConfig } from '@cloudflare/speedtest'
import type { Coordinates } from './coordinates'

// Upload and latency are optional because readings saved before they were measured don't have them.
export type NetworkSpeeds = {
  downloadMbps: number
  uploadMbps?: number
  latencyMs?: number
}

export type NetworkReading = NetworkSpeeds &
  Coordinates & {
    networkName: string
  }

// The library's default sequence goes up to 250 MB downloads, which takes close to a minute.
// This ramps up to 25 MB down and 10 MB up, and each direction stops early once a request size
// takes over a second, which is enough to saturate typical Wi-Fi without burning time or data.
// Directions are interleaved like the default so a slow download can't use up the whole time
// limit before any upload is measured.
const MEASUREMENTS: MeasurementConfig[] = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e6, count: 6 },
  { type: 'upload', bytes: 1e5, count: 4 },
  { type: 'upload', bytes: 1e6, count: 4 },
  { type: 'download', bytes: 1e7, count: 4 },
  { type: 'upload', bytes: 1e7, count: 3 },
  { type: 'download', bytes: 2.5e7, count: 2 },
]

const SPEED_TEST_TIME_LIMIT_MS = 30_000
const BITS_PER_MEGABIT = 1e6

export const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
}

export function measureSpeeds(): Promise<NetworkSpeeds> {
  return new Promise(function runSpeedTest(resolve, reject) {
    let lastError: string | undefined
    const speedTest = new SpeedTest({
      measurements: MEASUREMENTS,
      measureDownloadLoadedLatency: false,
      measureUploadLoadedLatency: false,
      abortTestDuration: SPEED_TEST_TIME_LIMIT_MS,
      logAimApiUrl: null,
    })

    speedTest.onError = function rememberError(message) {
      lastError = message
    }
    // Only download is required: a reading without upload or latency is still worth mapping.
    speedTest.onFinish = function reportSpeeds(results) {
      const downloadBitsPerSecond = results.getDownloadBandwidth()
      if (downloadBitsPerSecond === undefined) {
        reject(new Error(lastError ?? 'Speed test finished without a usable download measurement'))
        return
      }
      const uploadBitsPerSecond = results.getUploadBandwidth()
      resolve({
        downloadMbps: downloadBitsPerSecond / BITS_PER_MEGABIT,
        uploadMbps:
          uploadBitsPerSecond === undefined ? undefined : uploadBitsPerSecond / BITS_PER_MEGABIT,
        latencyMs: results.getUnloadedLatency(),
      })
    }
  })
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise(function requestPosition(resolve, reject) {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support geolocation'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      // GeolocationPositionError isn't an Error subclass, so wrap it to keep `.message` handling uniform.
      function rejectWithError(error) {
        reject(new Error(`Location unavailable: ${error.message}`))
      },
      LOCATION_OPTIONS,
    )
  })
}

export async function takeNetworkReading(networkName: string): Promise<NetworkReading> {
  // Sequential so a denied or failed location doesn't leave a speed test downloading in the background.
  const position = await getCurrentPosition()
  const speeds = await measureSpeeds()
  return {
    networkName,
    ...speeds,
    longitude: position.coords.longitude,
    latitude: position.coords.latitude,
  }
}
