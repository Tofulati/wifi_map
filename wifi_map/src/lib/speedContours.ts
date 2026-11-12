import { difference } from '@turf/difference'
import { distance } from '@turf/distance'
import { interpolate } from '@turf/interpolate'
import { intersect } from '@turf/intersect'
import { isobands } from '@turf/isobands'
import type {
  BBox,
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson'
import { METERS_PER_DEGREE_LATITUDE, metersPerDegreeLongitude } from './coordinates'
import type { NetworkReading } from './networkReading'

export type SpeedBandProperties = { minMbps: number }
export type SpeedContours = FeatureCollection<Polygon | MultiPolygon, SpeedBandProperties>

export type SpeedSurfaces = {
  // One surface for everything: where networks overlap, their own surfaces are averaged.
  combined: SpeedContours
  // Each network's surface on its own, for when one network is focused.
  byNetwork: Map<string, SpeedContours>
}

type Area = Feature<Polygon | MultiPolygon>
type Band = Feature<Polygon | MultiPolygon, SpeedBandProperties>
type SpeedGrid = FeatureCollection<Point, { downloadMbps: number }>
// A piece of the map covered by exactly this set of networks.
type CoverageRegion = { networkNames: string[]; area: Area }

// The last break only caps the top band; isobands needs an upper edge for every band.
const SPEED_BREAKS_MBPS = [0, 10, 25, 50, 100, 100_000]
const BELOW_ALL_BANDS_MBPS = SPEED_BREAKS_MBPS[0] - 1
const COVERAGE_RADIUS_METERS = 150
// Grid cells between the area being contoured and the grid border, where the forced border drop lives.
const BORDER_MARGIN_CELLS = 3
const MIN_CELL_METERS = 20
// Interpolation compares every grid point with every reading, so the grid is capped and cells
// grow instead when readings are spread over a large area.
const MAX_GRID_POINTS = 5_000
// IDW drifts toward the average of all readings away from any one reading; power 3 (vs the usual
// 2) keeps a slow area's edges from being pulled up by fast readings a few hundred meters away.
const IDW_POWER = 3

export const EMPTY_CONTOURS: SpeedContours = { type: 'FeatureCollection', features: [] }

function paddedBounds(positions: Position[], padMeters: number): BBox {
  const longitudes = positions.map((position) => position[0])
  const latitudes = positions.map((position) => position[1])
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const padLatitude = padMeters / METERS_PER_DEGREE_LATITUDE
  const padLongitude = padMeters / metersPerDegreeLongitude((south + north) / 2)
  return [
    Math.min(...longitudes) - padLongitude,
    south - padLatitude,
    Math.max(...longitudes) + padLongitude,
    north + padLatitude,
  ]
}

function cellSizeMeters([west, south, east, north]: BBox): number {
  const heightMeters = (north - south) * METERS_PER_DEGREE_LATITUDE
  const widthMeters = (east - west) * metersPerDegreeLongitude((south + north) / 2)
  return Math.max(MIN_CELL_METERS, Math.sqrt((widthMeters * heightMeters) / MAX_GRID_POINTS))
}

// Sizes a grid for the given positions, extending it a few cells past `padMeters` so the border
// drop added by closeGridBorder never reaches the area that gets kept.
function gridFor(positions: Position[], padMeters: number): { cellMeters: number; bbox: BBox } {
  const cellMeters = cellSizeMeters(paddedBounds(positions, padMeters))
  return { cellMeters, bbox: paddedBounds(positions, padMeters + BORDER_MARGIN_CELLS * cellMeters) }
}

function readingPositions(readings: NetworkReading[]): Position[] {
  return readings.map((reading) => [reading.longitude, reading.latitude])
}

function areaPositions(area: Area): Position[] {
  return area.geometry.type === 'Polygon'
    ? area.geometry.coordinates.flat()
    : area.geometry.coordinates.flat(2)
}

function toReadingPoints(readings: NetworkReading[]): SpeedGrid {
  return {
    type: 'FeatureCollection',
    features: readings.map((reading) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [reading.longitude, reading.latitude] },
      properties: { downloadMbps: reading.downloadMbps },
    })),
  }
}

// Turf's interpolate builds its grid from the bbox and cell size alone, so two calls with the
// same grid line up point for point, which averageGrids relies on.
function speedGrid(readings: NetworkReading[], cellMeters: number, bbox: BBox): SpeedGrid {
  return interpolate(toReadingPoints(readings), cellMeters, {
    gridType: 'point',
    property: 'downloadMbps',
    units: 'meters',
    weight: IDW_POWER,
    bbox,
  }) as SpeedGrid
}

function averageGrids(grids: SpeedGrid[]): SpeedGrid {
  return {
    type: 'FeatureCollection',
    features: grids[0].features.map((gridPoint, index) => ({
      ...gridPoint,
      properties: {
        downloadMbps:
          grids.reduce((total, grid) => total + grid.features[index].properties.downloadMbps, 0) /
          grids.length,
      },
    })),
  }
}

// Turf's isobands can't close a band that runs off the edge of the grid: it returns only the
// band's inner rings, so a band covering most of the area vanishes. Forcing the outermost grid
// points below every band closes all contours inside the grid. The drop this creates lies
// outside the area being contoured, so clipping removes it.
function closeGridBorder(grid: SpeedGrid): SpeedGrid {
  const longitudes = grid.features.map((point) => point.geometry.coordinates[0])
  const latitudes = grid.features.map((point) => point.geometry.coordinates[1])
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)

  return {
    ...grid,
    features: grid.features.map(function dropIfOnBorder(point) {
      const [longitude, latitude] = point.geometry.coordinates
      const isOnBorder =
        longitude === west || longitude === east || latitude === south || latitude === north
      if (!isOnBorder) return point
      return { ...point, properties: { downloadMbps: BELOW_ALL_BANDS_MBPS } }
    }),
  }
}

// isobands has no "no data" value, so masking the speed grid directly would draw every
// threshold as a thin ring where the surface drops off. Instead bands are computed unmasked and
// clipped to the area they belong to.
function clippedBands(grid: SpeedGrid, clipTo: Area): Band[] {
  const bands = isobands(closeGridBorder(grid), SPEED_BREAKS_MBPS, {
    zProperty: 'downloadMbps',
    breaksProperties: SPEED_BREAKS_MBPS.slice(0, -1).map((minMbps) => ({ minMbps })),
  })
  return bands.features
    .filter((band) => band.geometry.coordinates.length > 0)
    .map((band) =>
      intersect<SpeedBandProperties>(
        { type: 'FeatureCollection', features: [band, clipTo] },
        { properties: { minMbps: band.properties?.minMbps } },
      ),
    )
    .filter((band): band is Band => band !== null)
}

// The area within COVERAGE_RADIUS_METERS of any reading, traced from a grid of distances.
function coverageArea(readings: NetworkReading[], grid: SpeedGrid): Area {
  const readingPoints = toReadingPoints(readings)
  const distanceGrid: FeatureCollection<Point, { metersToReading: number }> = {
    type: 'FeatureCollection',
    features: grid.features.map((gridPoint) => ({
      type: 'Feature',
      geometry: gridPoint.geometry,
      properties: {
        metersToReading: Math.min(
          ...readingPoints.features.map((reading) =>
            distance(gridPoint, reading, { units: 'meters' }),
          ),
        ),
      },
    })),
  }
  return isobands(distanceGrid, [0, COVERAGE_RADIUS_METERS], { zProperty: 'metersToReading' })
    .features[0]
}

// Cuts the map into pieces that are each covered by one fixed set of networks. Inside a piece
// the averaged surface is smooth; the set only changes along piece edges, so a network's
// coverage ending inside another's shows as a clean color edge rather than made-up rings.
function splitByCoverage(coverageByNetwork: [string, Area][]): CoverageRegion[] {
  let regions: CoverageRegion[] = []
  for (const [networkName, coverage] of coverageByNetwork) {
    const nextRegions: CoverageRegion[] = []
    for (const region of regions) {
      const pair: FeatureCollection<Polygon | MultiPolygon> = {
        type: 'FeatureCollection',
        features: [region.area, coverage],
      }
      const shared = intersect(pair)
      const notShared = difference(pair)
      if (shared) nextRegions.push({ networkNames: [...region.networkNames, networkName], area: shared })
      if (notShared) nextRegions.push({ ...region, area: notShared })
    }
    const onlyThisNetwork =
      regions.length === 0
        ? coverage
        : difference({ type: 'FeatureCollection', features: [coverage, ...regions.map((region) => region.area)] })
    if (onlyThisNetwork) nextRegions.push({ networkNames: [networkName], area: onlyThisNetwork })
    regions = nextRegions
  }
  return regions
}

function averagedRegionBands(
  region: CoverageRegion,
  readingsByNetwork: ReadonlyMap<string, NetworkReading[]>,
): Band[] {
  const { cellMeters, bbox } = gridFor(areaPositions(region.area), 0)
  const grids = region.networkNames.map((networkName) =>
    speedGrid(readingsByNetwork.get(networkName) ?? [], cellMeters, bbox),
  )
  return clippedBands(averageGrids(grids), region.area)
}

// Speeds on different networks say nothing about each other, so no surface ever interpolates
// across networks: each network gets its own, and overlaps average those finished surfaces.
export function computeSpeedSurfaces(
  readingsByNetwork: ReadonlyMap<string, NetworkReading[]>,
): SpeedSurfaces {
  const byNetwork = new Map<string, SpeedContours>()
  const coverageByNetwork: [string, Area][] = []

  for (const [networkName, readings] of readingsByNetwork) {
    if (readings.length === 0) continue
    const { cellMeters, bbox } = gridFor(readingPositions(readings), COVERAGE_RADIUS_METERS)
    const grid = speedGrid(readings, cellMeters, bbox)
    const coverage = coverageArea(readings, grid)
    coverageByNetwork.push([networkName, coverage])
    byNetwork.set(networkName, { type: 'FeatureCollection', features: clippedBands(grid, coverage) })
  }

  const combinedBands = splitByCoverage(coverageByNetwork).flatMap((region) =>
    averagedRegionBands(region, readingsByNetwork),
  )
  return { combined: { type: 'FeatureCollection', features: combinedBands }, byNetwork }
}
