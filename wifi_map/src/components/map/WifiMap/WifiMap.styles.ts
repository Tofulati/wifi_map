import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from 'maplibre-gl'
import type { CSSProperties } from 'react'

export const MAP_CONTAINER_STYLE: CSSProperties = { width: '100%', height: '100%' }

const SLOW_MBPS = 5
const MEDIUM_MBPS = 25
const FAST_MBPS = 100
// Keep in sync with --color-speed-* in src/styles/variables.css.
const SLOW_COLOR = 'rgb(215, 48, 39)'
const MEDIUM_COLOR = 'rgb(254, 224, 139)'
const FAST_COLOR = 'rgb(26, 152, 80)'

const BAND_FILL_OPACITY = 0.45
const CONTOUR_LINE_COLOR = 'rgba(60, 60, 60, 0.35)'
const CONTOUR_LINE_WIDTH_PX = 1
const CLUSTER_RADIUS_PX = 7
const POINT_RADIUS_PX = 5
const POINT_STROKE_COLOR = 'white'
const POINT_STROKE_WIDTH_PX = 1.5
const POINT_OPACITY = 1
// Readings from networks other than the focused one stay clickable but recede.
const DIMMED_POINT_OPACITY = 0.25

// Clusters only carry a running sum and a count, so the average has to be derived per feature.
const averageMbps: ExpressionSpecification = [
  'case',
  ['has', 'point_count'],
  ['/', ['get', 'totalMbps'], ['get', 'point_count']],
  ['get', 'downloadMbps'],
]

function speedColor(mbps: ExpressionSpecification): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    mbps,
    SLOW_MBPS, SLOW_COLOR,
    MEDIUM_MBPS, MEDIUM_COLOR,
    FAST_MBPS, FAST_COLOR,
  ]
}

export const speedBandsPaint: FillLayerSpecification['paint'] = {
  'fill-color': speedColor(['get', 'minMbps']),
  'fill-opacity': BAND_FILL_OPACITY,
}

// Neighboring bands share edges, so outlining the band polygons draws the contour lines.
export const speedContourLinesPaint: LineLayerSpecification['paint'] = {
  'line-color': CONTOUR_LINE_COLOR,
  'line-width': CONTOUR_LINE_WIDTH_PX,
}

export const speedPointsPaint: CircleLayerSpecification['paint'] = {
  'circle-radius': ['case', ['has', 'point_count'], CLUSTER_RADIUS_PX, POINT_RADIUS_PX],
  'circle-color': speedColor(averageMbps),
  'circle-stroke-color': POINT_STROKE_COLOR,
  'circle-stroke-width': POINT_STROKE_WIDTH_PX,
  'circle-opacity': POINT_OPACITY,
  'circle-stroke-opacity': POINT_OPACITY,
}

export const dimmedSpeedPointsPaint: CircleLayerSpecification['paint'] = {
  ...speedPointsPaint,
  'circle-opacity': DIMMED_POINT_OPACITY,
  'circle-stroke-opacity': DIMMED_POINT_OPACITY,
}
