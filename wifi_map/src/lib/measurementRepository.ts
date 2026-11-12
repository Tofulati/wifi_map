import type { PostgrestError } from '@supabase/supabase-js'
import { cleanNetworkName, networkNameKey } from './networkName'
import type { NetworkReading } from './networkReading'
import { getSupabaseClient } from './supabaseClient'

const NETWORK_SCOPE = 'anonymous'
const EMPTY_METRICS = {}

type NetworkRow = {
  id: string
}

type MeasurementRow = {
  id: string
  latitude: number
  longitude: number
  download_mbps: number
  upload_mbps: number | null
  latency_ms: number | null
  recorded_at: string
  networks: { ssid: string } | { ssid: string }[] | null
}

export class MeasurementRepositoryError extends Error {
  constructor(message: string, cause?: PostgrestError) {
    super(message, { cause })
    this.name = 'MeasurementRepositoryError'
  }
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new MeasurementRepositoryError('Supabase is not configured')
  return client
}

function rowToReading(row: MeasurementRow): NetworkReading | null {
  const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
  if (
    !network ||
    typeof row.id !== 'string' ||
    !Number.isFinite(row.latitude) ||
    !Number.isFinite(row.longitude) ||
    !Number.isFinite(row.download_mbps) ||
    row.latitude < -90 ||
    row.latitude > 90 ||
    row.longitude < -180 ||
    row.longitude > 180 ||
    row.download_mbps < 0
  ) {
    return null
  }
  return {
    id: row.id,
    networkName: network.ssid,
    downloadMbps: row.download_mbps,
    uploadMbps: row.upload_mbps ?? undefined,
    latencyMs: row.latency_ms ?? undefined,
    longitude: row.longitude,
    latitude: row.latitude,
    recordedAt: row.recorded_at,
    syncStatus: 'synced',
  }
}

function throwRepositoryError(message: string, error: PostgrestError | null): never {
  throw new MeasurementRepositoryError(`${message}: ${error?.message ?? 'unknown database error'}`, error ?? undefined)
}

async function findOrCreateNetwork(networkName: string): Promise<NetworkRow> {
  const client = requireClient()
  const ssid = cleanNetworkName(networkName)
  const normalizedSsid = networkNameKey(ssid)
  const { data, error } = await client
    .from('networks')
    .upsert(
      { ssid, normalized_ssid: normalizedSsid, network_scope: NETWORK_SCOPE },
      { onConflict: 'network_scope,normalized_ssid' },
    )
    .select('id')
    .single()
  if (error || !data) return throwRepositoryError('Unable to save network', error)
  return data
}

export async function saveMeasurement(reading: NetworkReading): Promise<void> {
  if (!reading.id || !reading.recordedAt) {
    throw new MeasurementRepositoryError('Measurement is missing its id or recorded timestamp')
  }
  const client = requireClient()
  const network = await findOrCreateNetwork(reading.networkName)
  const { error } = await client.from('measurements').upsert(
    {
      id: reading.id,
      network_id: network.id,
      latitude: reading.latitude,
      longitude: reading.longitude,
      download_mbps: reading.downloadMbps,
      upload_mbps: reading.uploadMbps ?? null,
      latency_ms: reading.latencyMs ?? null,
      jitter_ms: null,
      signal_strength: null,
      packet_loss: null,
      additional_metrics: EMPTY_METRICS,
      recorded_at: reading.recordedAt,
    },
    { onConflict: 'id' },
  )
  if (error) throwRepositoryError('Unable to save measurement', error)
}

export async function listMeasurements(): Promise<NetworkReading[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('measurements')
    .select(
      'id,latitude,longitude,download_mbps,upload_mbps,latency_ms,recorded_at,networks!inner(ssid)',
    )
    .order('recorded_at', { ascending: false })
  if (error) throwRepositoryError('Unable to load measurements', error)
  return (data as MeasurementRow[]).map(rowToReading).filter((reading): reading is NetworkReading => reading !== null)
}

export async function listMeasurementsForNetwork(networkId: string): Promise<NetworkReading[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('measurements')
    .select(
      'id,latitude,longitude,download_mbps,upload_mbps,latency_ms,recorded_at,networks!inner(ssid)',
    )
    .eq('network_id', networkId)
  if (error) throwRepositoryError('Unable to load network measurements', error)
  return (data as MeasurementRow[]).map(rowToReading).filter((reading): reading is NetworkReading => reading !== null)
}

export async function listMeasurementsInBounds(
  minLatitude: number,
  maxLatitude: number,
  minLongitude: number,
  maxLongitude: number,
): Promise<NetworkReading[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('measurements')
    .select(
      'id,latitude,longitude,download_mbps,upload_mbps,latency_ms,recorded_at,networks!inner(ssid)',
    )
    .gte('latitude', minLatitude)
    .lte('latitude', maxLatitude)
    .gte('longitude', minLongitude)
    .lte('longitude', maxLongitude)
  if (error) throwRepositoryError('Unable to load measurements in bounds', error)
  return (data as MeasurementRow[]).map(rowToReading).filter((reading): reading is NetworkReading => reading !== null)
}

export async function listMeasurementsInTimeRange(
  start: string,
  end: string,
): Promise<NetworkReading[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('measurements')
    .select(
      'id,latitude,longitude,download_mbps,upload_mbps,latency_ms,recorded_at,networks!inner(ssid)',
    )
    .gte('recorded_at', start)
    .lte('recorded_at', end)
  if (error) throwRepositoryError('Unable to load measurements in time range', error)
  return (data as MeasurementRow[]).map(rowToReading).filter((reading): reading is NetworkReading => reading !== null)
}

export async function listNetworks(): Promise<string[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('networks')
    .select('ssid')
    .eq('network_scope', NETWORK_SCOPE)
    .order('ssid')
  if (error) throwRepositoryError('Unable to load networks', error)
  return data.map((network) => network.ssid)
}

export async function synchronizeReadings(readings: NetworkReading[]): Promise<{
  syncedIds: string[]
  failedIds: string[]
}> {
  const results = await Promise.allSettled(readings.map(saveMeasurement))
  return results.reduce(
    (summary, result, index) => {
      const id = readings[index].id
      if (!id) return summary
      if (result.status === 'fulfilled') summary.syncedIds.push(id)
      else summary.failedIds.push(id)
      return summary
    },
    { syncedIds: [], failedIds: [] } as { syncedIds: string[]; failedIds: string[] },
  )
}
