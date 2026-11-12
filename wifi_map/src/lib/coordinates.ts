export type Coordinates = {
  longitude: number
  latitude: number
}

// Five decimals is about a meter, finer than phone GPS can actually tell apart.
const COORDINATE_DECIMALS = 5

export const METERS_PER_DEGREE_LATITUDE = 111_320
const DEGREES_TO_RADIANS = Math.PI / 180

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(COORDINATE_DECIMALS)}, ${longitude.toFixed(COORDINATE_DECIMALS)}`
}

// A degree of longitude shrinks toward the poles, by the cosine of the latitude.
export function metersPerDegreeLongitude(latitude: number): number {
  return METERS_PER_DEGREE_LATITUDE * Math.cos(latitude * DEGREES_TO_RADIANS)
}
