import { canonicalizeNetworkNames, UNNAMED_NETWORK } from './networkName'
import type { NetworkReading } from './networkReading'

const STORAGE_KEY = 'wifi-map:readings'
const LAST_NETWORK_KEY = 'wifi-map:last-network'
const READING_ID_PREFIX = 'wifi-reading-'

function isFiniteNumber(field: unknown): field is number {
  return typeof field === 'number' && Number.isFinite(field)
}

// Stored data outlives code changes and can be edited in devtools, so drop any entry that no
// longer has the shape the map expects instead of letting one bad entry break rendering.
function toNetworkReading(value: unknown): NetworkReading | null {
  if (typeof value !== 'object' || value === null) return null
  const { networkName, downloadMbps, uploadMbps, latencyMs, longitude, latitude } =
    value as Record<string, unknown>
  if (![downloadMbps, longitude, latitude].every(isFiniteNumber)) return null
  const record = value as Record<string, unknown>
  return {
    id: typeof record.id === 'string' ? record.id : createReadingId(),
    // Readings saved before names existed are kept, grouped together instead of guessed at.
    networkName: typeof networkName === 'string' ? networkName : UNNAMED_NETWORK,
    downloadMbps: downloadMbps as number,
    // Readings saved before upload and latency were measured simply lack them.
    uploadMbps: isFiniteNumber(uploadMbps) ? uploadMbps : undefined,
    latencyMs: isFiniteNumber(latencyMs) ? latencyMs : undefined,
    longitude: longitude as number,
    latitude: latitude as number,
    // Older local entries had no collection timestamp; use the migration time so they can still
    // be uploaded without inventing a misleading epoch date.
    recordedAt: typeof record.recordedAt === 'string' ? record.recordedAt : new Date().toISOString(),
    syncStatus:
      record.syncStatus === 'synced' || record.syncStatus === 'failed' ? record.syncStatus : 'pending',
  }
}

export function createReadingId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${READING_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ensureReadingIdentity(reading: NetworkReading): NetworkReading {
  return {
    ...reading,
    id: reading.id ?? createReadingId(),
    recordedAt: reading.recordedAt ?? new Date().toISOString(),
    syncStatus: reading.syncStatus ?? 'pending',
  }
}

export function loadReadings(): NetworkReading[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const readings = parsed
      .map(toNetworkReading)
      .filter((reading): reading is NetworkReading => reading !== null)
    // Re-applying the naming rules on load means rule changes also fix up older data.
    return canonicalizeNetworkNames(readings).map(ensureReadingIdentity)
  } catch {
    return []
  }
}

export function saveReadings(readings: NetworkReading[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings))
}

export function loadLastNetworkName(): string {
  return localStorage.getItem(LAST_NETWORK_KEY) ?? ''
}

export function saveLastNetworkName(name: string) {
  localStorage.setItem(LAST_NETWORK_KEY, name)
}
