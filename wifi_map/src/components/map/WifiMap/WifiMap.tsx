import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { setWorkerUrl, type MapGeoJSONFeature } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import MapView, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Popup,
  Source,
} from 'react-map-gl/maplibre'
import type {
  GeolocateControlInstance,
  GeolocateErrorEvent,
  GeolocateResultEvent,
  MapEvent,
  MapLayerMouseEvent,
  MapRef,
} from 'react-map-gl/maplibre'
import type { FeatureCollection, GeoJsonProperties, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createDemoReadings } from '../../../data/demoReadings'
import type { Coordinates } from '../../../lib/coordinates'
import {
  NEARBY_RADIUS_METERS,
  summarizeNetworksNear,
  type NearbyNetwork,
} from '../../../lib/nearbyReadings'
import { groupByNetworkName } from '../../../lib/networkName'
import {
  LOCATION_OPTIONS,
  type NetworkReading,
  type NetworkSpeeds,
} from '../../../lib/networkReading'
import {
  ensureReadingIdentity,
  loadReadings,
  saveReadings,
} from '../../../lib/readingStore'
import {
  listMeasurements,
  synchronizeReadings,
} from '../../../lib/measurementRepository'
import { supabaseConfigurationMessage } from '../../../lib/supabaseClient'
import { computeSpeedSurfaces, EMPTY_CONTOURS } from '../../../lib/speedContours'
import { NetworkSpeedCard } from '../../network/NetworkSpeedCard/NetworkSpeedCard'
import { PlaceDetails } from '../../panel/PlaceDetails/PlaceDetails'
import { SearchControl, type SearchResult } from '../../panel/SearchControl/SearchControl'
import { SelectedNetwork } from '../../panel/SelectedNetwork/SelectedNetwork'
import { SidePanel } from '../../panel/SidePanel/SidePanel'
import { YourLocation, type UserLocation } from '../../panel/YourLocation/YourLocation'
import './WifiMap.css'
import {
  MAP_CONTAINER_STYLE,
  dimmedSpeedPointsPaint,
  speedBandsPaint,
  speedContourLinesPaint,
  speedPointsPaint,
} from './WifiMap.styles'

// MapLibre looks for its worker next to its own module URL, which doesn't exist once Vite
// pre-bundles it into node_modules/.vite/deps, so tiles and GeoJSON never load without this.
setWorkerUrl(maplibreWorkerUrl)

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CONTOURS_SOURCE_ID = 'speed-contours'
const SPEED_BANDS_LAYER_ID = 'speed-bands'
const SPEED_CONTOUR_LINES_LAYER_ID = 'speed-contour-lines'
const READINGS_SOURCE_PREFIX = 'speed-readings:'
const POINTS_LAYER_PREFIX = 'speed-points:'
const CLUSTER_RADIUS_PX = 40
const USER_LOCATION_ZOOM = 15
const INITIAL_VIEW_STATE = { longitude: -122.4152, latitude: 37.7759, zoom: USER_LOCATION_ZOOM }
const POPUP_OFFSET_PX = 10
const POPUP_MAX_WIDTH = '280px'
const MAP_CONTROLS_POSITION = 'bottom-right'

// Older readings lack upload and latency, so those get their own counts instead of point_count;
// `get` returns null for a missing property.
const CLUSTER_PROPERTIES = {
  totalMbps: ['+', ['get', 'downloadMbps']],
  totalUploadMbps: ['+', ['coalesce', ['get', 'uploadMbps'], 0]],
  uploadCount: ['+', ['case', ['==', ['get', 'uploadMbps'], null], 0, 1]],
  totalLatencyMs: ['+', ['coalesce', ['get', 'latencyMs'], 0]],
  latencyCount: ['+', ['case', ['==', ['get', 'latencyMs'], null], 0, 1]],
}

// A dot on the map: one reading, or a cluster of one network's readings averaged together.
type ReadingDot = NearbyNetwork & { coordinates: Coordinates }

// The side panel shows one thing at a time: where you are, the network of a reading you
// clicked, or a place you searched for.
type PanelSelection =
  | { kind: 'yourLocation' }
  | { kind: 'network'; networkName: string; clickedAt: Coordinates }
  | { kind: 'place'; place: SearchResult }

const YOUR_LOCATION: PanelSelection = { kind: 'yourLocation' }

function readingsSourceId(networkName: string) {
  return `${READINGS_SOURCE_PREFIX}${networkName}`
}

function pointsLayerId(networkName: string) {
  return `${POINTS_LAYER_PREFIX}${networkName}`
}

// Each network has its own source, and clusters don't carry string properties, so the network
// is recovered from the source id.
function networkNameFromSourceId(sourceId: string) {
  return sourceId.slice(READINGS_SOURCE_PREFIX.length)
}

function toPointCollection(readings: NetworkReading[]): FeatureCollection<Point, NetworkSpeeds> {
  return {
    type: 'FeatureCollection',
    features: readings.map((reading) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [reading.longitude, reading.latitude] },
      properties: {
        downloadMbps: reading.downloadMbps,
        uploadMbps: reading.uploadMbps,
        latencyMs: reading.latencyMs,
      },
    })),
  }
}

function average(total: number, count: number) {
  return count > 0 ? total / count : undefined
}

// Feature properties come back from the map untyped, and a missing value may arrive as null.
function optionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function speedsFromProperties(properties: NonNullable<GeoJsonProperties>): NetworkSpeeds {
  if (!properties.point_count) {
    return {
      downloadMbps: properties.downloadMbps,
      uploadMbps: optionalNumber(properties.uploadMbps),
      latencyMs: optionalNumber(properties.latencyMs),
    }
  }
  return {
    downloadMbps: properties.totalMbps / properties.point_count,
    uploadMbps: average(properties.totalUploadMbps, properties.uploadCount),
    latencyMs: average(properties.totalLatencyMs, properties.latencyCount),
  }
}

function readingFromFeature(feature: MapGeoJSONFeature | undefined): ReadingDot | null {
  if (!feature || feature.geometry.type !== 'Point') return null
  const [longitude, latitude] = feature.geometry.coordinates
  return {
    coordinates: { longitude, latitude },
    networkName: networkNameFromSourceId(feature.source),
    speeds: speedsFromProperties(feature.properties),
    readingCount: feature.properties.point_count ?? 1,
  }
}

export function WifiMap() {
  const [hoverInfo, setHoverInfo] = useState<ReadingDot | null>(null)
  const [readings, setReadings] = useState(loadReadings)
  // Kept apart from `readings` so fake data is never written to localStorage.
  const [demoReadings, setDemoReadings] = useState<NetworkReading[] | null>(null)
  const [selection, setSelection] = useState<PanelSelection>(YOUR_LOCATION)
  const [userLocation, setUserLocation] = useState<UserLocation>({ status: 'locating' })
  const [syncError, setSyncError] = useState<string | null>(supabaseConfigurationMessage)
  const mapRef = useRef<MapRef>(null)
  const geolocateControlRef = useRef<GeolocateControlInstance>(null)

  useEffect(
    function persistReadings() {
      saveReadings(readings)
    },
    [readings],
  )

  useEffect(function loadRemoteReadings() {
    if (supabaseConfigurationMessage()) return
    void listMeasurements()
      .then(function mergeRemoteReadings(remoteReadings) {
        setReadings((localReadings) => {
          const merged = new Map(remoteReadings.map((reading) => [reading.id, reading]))
          localReadings.forEach((reading) => merged.set(reading.id, reading))
          return [...merged.values()]
        })
        setSyncError(null)
      })
      .catch(function reportRemoteLoadError(error: unknown) {
        setSyncError(error instanceof Error ? error.message : String(error))
      })
  }, [])

  useEffect(
    function synchronizePendingReadings() {
      const pendingReadings = readings.filter(
        (reading): reading is NetworkReading & { id: string; syncStatus: 'pending' } =>
          reading.id !== undefined && reading.syncStatus === 'pending',
      )
      if (pendingReadings.length === 0 || supabaseConfigurationMessage()) return
      void synchronizeReadings(pendingReadings).then(function updateSyncStatuses(result) {
        setReadings((currentReadings) =>
          currentReadings.map((reading) => {
            if (!reading.id) return reading
            if (result.syncedIds.includes(reading.id)) return { ...reading, syncStatus: 'synced' }
            if (result.failedIds.includes(reading.id)) return { ...reading, syncStatus: 'failed' }
            return reading
          }),
        )
        if (result.failedIds.length > 0) {
          setSyncError('Some measurements could not be synchronized and remain available locally.')
        } else {
          setSyncError(null)
        }
      })
    },
    [readings],
  )

  useEffect(function retryFailedReadingsWhenOnline() {
    function retryFailedReadings() {
      setReadings((currentReadings) =>
        currentReadings.map((reading) =>
          reading.syncStatus === 'failed' ? { ...reading, syncStatus: 'pending' } : reading,
        ),
      )
    }
    window.addEventListener('online', retryFailedReadings)
    return function removeOnlineListener() {
      window.removeEventListener('online', retryFailedReadings)
    }
  }, [])

  const allReadings = useMemo(
    function combineReadings() {
      return [...(demoReadings ?? []), ...readings]
    },
    [readings, demoReadings],
  )

  const readingsByNetwork = useMemo(
    function groupReadings() {
      return groupByNetworkName(allReadings)
    },
    [allReadings],
  )

  const userCoordinates = userLocation.status === 'found' ? userLocation.coordinates : null
  const networksNearUser = useMemo(
    function findNetworksNearUser() {
      return userCoordinates ? summarizeNetworksNear(allReadings, userCoordinates) : []
    },
    [allReadings, userCoordinates],
  )

  // A selected network that's gone, e.g. after hiding the demo data, falls back to your location.
  const activeSelection =
    selection.kind === 'network' && !readingsByNetwork.has(selection.networkName)
      ? YOUR_LOCATION
      : selection
  const selectedPlace = activeSelection.kind === 'place' ? activeSelection.place : null
  const activeFocus = activeSelection.kind === 'network' ? activeSelection.networkName : null

  const networksNearSelectedPlace = useMemo(
    function findNetworksNearSelectedPlace() {
      return selectedPlace ? summarizeNetworksNear(allReadings, selectedPlace.coordinates) : []
    },
    [allReadings, selectedPlace],
  )

  const networkNames = useMemo(
    function sortNetworkNames() {
      return [...readingsByNetwork.keys()].sort((a, b) => a.localeCompare(b))
    },
    [readingsByNetwork],
  )

  // Memoized so hover re-renders don't hand each <Source> a new object it has to deep-compare.
  const pointsByNetwork = useMemo(
    function buildPointCollections() {
      return [...readingsByNetwork].map(([name, group]) => [name, toPointCollection(group)] as const)
    },
    [readingsByNetwork],
  )

  // Both the combined surface and every network's own surface are computed together, so
  // focusing a network only swaps which one is shown.
  const speedSurfaces = useMemo(
    function buildSpeedSurfaces() {
      return computeSpeedSurfaces(readingsByNetwork)
    },
    [readingsByNetwork],
  )

  const displayedContours =
    activeFocus === null
      ? speedSurfaces.combined
      : (speedSurfaces.byNetwork.get(activeFocus) ?? EMPTY_CONTOURS)

  // A reading carries a fresh GPS fix, which is newer than the last one the geolocate control got.
  function handleReading(reading: NetworkReading) {
    setReadings((previous) => [...previous, ensureReadingIdentity(reading)])
    setUserLocation({
      status: 'found',
      coordinates: { longitude: reading.longitude, latitude: reading.latitude },
    })
  }

  function handleSearchResult(result: SearchResult) {
    setSelection({ kind: 'place', place: result })
  }

  // Clearing the search box only matters while the panel is showing the searched place.
  function handleSearchClear() {
    setSelection((previous) => (previous.kind === 'place' ? YOUR_LOCATION : previous))
  }

  function handleDemoToggle(event: ChangeEvent<HTMLInputElement>) {
    const center = mapRef.current?.getCenter()
    setDemoReadings(
      event.target.checked && center
        ? createDemoReadings({ longitude: center.lng, latitude: center.lat })
        : null,
    )
  }

  function handleMouseMove(event: MapLayerMouseEvent) {
    setHoverInfo(readingFromFeature(event.features?.[0]))
  }

  function handleMouseLeave() {
    setHoverInfo(null)
  }

  // Clicking a reading shows its network in the panel and only that network on the map;
  // clicking anywhere else goes back to your location and every network.
  function handleClick(event: MapLayerMouseEvent) {
    const reading = readingFromFeature(event.features?.[0])
    setSelection(
      reading
        ? { kind: 'network', networkName: reading.networkName, clickedAt: reading.coordinates }
        : YOUR_LOCATION,
    )
  }

  function handleLoad(event: MapEvent) {
    // No compass to reset north, so rotation and tilt are locked; these two handlers
    // have no constructor option for it.
    event.target.touchZoomRotate.disableRotation()
    event.target.keyboard.disableRotation()
    geolocateControlRef.current?.trigger()
  }

  // The control zooms to fit the accuracy circle, so coarse fixes land at a different zoom each
  // time; this replaces its animation (flyTo interrupts it) with one at a fixed zoom.
  function handleGeolocate(event: GeolocateResultEvent) {
    const { longitude, latitude } = event.coords
    setUserLocation({ status: 'found', coordinates: { longitude, latitude } })
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: USER_LOCATION_ZOOM })
  }

  function handleGeolocateError(event: GeolocateErrorEvent) {
    setUserLocation({ status: 'unavailable', message: `Location unavailable (${event.message})` })
  }

  let selectionView: ReactNode = null
  if (activeSelection.kind === 'network') {
    selectionView = (
      <SelectedNetwork
        networkName={activeSelection.networkName}
        clickedAt={activeSelection.clickedAt}
        readings={readingsByNetwork.get(activeSelection.networkName) ?? []}
      />
    )
  } else if (activeSelection.kind === 'place') {
    selectionView = (
      <section className="side-panel-section">
        <h2 className="side-panel-heading">Selected place</h2>
        <PlaceDetails
          placeName={activeSelection.place.name}
          coordinates={activeSelection.place.coordinates}
          nearbyNetworks={networksNearSelectedPlace}
          emptyMessage={`No readings within ${NEARBY_RADIUS_METERS} m of this place yet.`}
        />
      </section>
    )
  }

  return (
    <MapView
      ref={mapRef}
      initialViewState={INITIAL_VIEW_STATE}
      style={MAP_CONTAINER_STYLE}
      mapStyle={BASEMAP_STYLE}
      interactiveLayerIds={networkNames.map(pointsLayerId)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      cursor={hoverInfo ? 'pointer' : 'grab'}
      dragRotate={false}
      touchPitch={false}
      onLoad={handleLoad}
    >
      <NavigationControl position={MAP_CONTROLS_POSITION} showCompass={false} />
      <GeolocateControl
        ref={geolocateControlRef}
        position={MAP_CONTROLS_POSITION}
        positionOptions={LOCATION_OPTIONS}
        onGeolocate={handleGeolocate}
        onError={handleGeolocateError}
      />

      <Source id={CONTOURS_SOURCE_ID} type="geojson" data={displayedContours}>
        <Layer id={SPEED_BANDS_LAYER_ID} type="fill" paint={speedBandsPaint} />
        <Layer id={SPEED_CONTOUR_LINES_LAYER_ID} type="line" paint={speedContourLinesPaint} />
      </Source>

      {/* One clustered source per network, because MapLibre clusters every point in a source
          together and would otherwise average speeds across networks. */}
      {pointsByNetwork.map(([networkName, points]) => (
        <Source
          key={networkName}
          id={readingsSourceId(networkName)}
          type="geojson"
          data={points}
          cluster
          clusterRadius={CLUSTER_RADIUS_PX}
          clusterProperties={CLUSTER_PROPERTIES}
        >
          <Layer
            id={pointsLayerId(networkName)}
            type="circle"
            paint={
              activeFocus === null || activeFocus === networkName
                ? speedPointsPaint
                : dimmedSpeedPointsPaint
            }
          />
        </Source>
      ))}

      {hoverInfo && (
        <Popup
          longitude={hoverInfo.coordinates.longitude}
          latitude={hoverInfo.coordinates.latitude}
          offset={POPUP_OFFSET_PX}
          closeButton={false}
          closeOnClick={false}
          maxWidth={POPUP_MAX_WIDTH}
        >
          <NetworkSpeedCard
            networkName={hoverInfo.networkName}
            speeds={hoverInfo.speeds}
            readingCount={hoverInfo.readingCount}
          />
        </Popup>
      )}

      <SidePanel>
        <SearchControl
          zoom={USER_LOCATION_ZOOM}
          onResult={handleSearchResult}
          onClear={handleSearchClear}
        />

        {selectionView}

        {syncError && <p className="wifi-map-sync-error">{syncError}</p>}

        {/* Hidden rather than unmounted so a measurement in progress survives clicking a reading. */}
        <div hidden={activeSelection.kind !== 'yourLocation'}>
          <YourLocation
            userLocation={userLocation}
            nearbyNetworks={networksNearUser}
            knownNetworkNames={networkNames}
            onReading={handleReading}
          />
        </div>

        {import.meta.env.DEV && (
          <label className="wifi-map-demo-toggle">
            <input type="checkbox" checked={demoReadings !== null} onChange={handleDemoToggle} />{' '}
            Show demo data
          </label>
        )}
      </SidePanel>
    </MapView>
  )
}
