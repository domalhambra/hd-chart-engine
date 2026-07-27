/**
 * The seam between the HD layer and whichever ephemeris computes positions.
 *
 * Two implementations ship. `astronomy.ts` is the MIT default. `moshier.ts` is
 * more accurate but GPL-3.0, and is reachable only through the
 * `hd-chart-engine/moshier` sub-path export. Nothing above this file may import
 * a concrete engine directly, which is what keeps the GPL code out of an MIT
 * consumer's bundle. `tests/licensing-boundary.test.ts` enforces it.
 */

export const PLANET_KEYS = [
  'sun', 'earth', 'moon', 'north_node', 'south_node',
  'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
] as const

export type PlanetKey = (typeof PLANET_KEYS)[number]

/** Geocentric ecliptic longitude in degrees [0, 360) for each HD body. */
export type BodyLongitudes = Record<PlanetKey, number>

/**
 * Which longitude convention to return.
 *
 * Human Design uses APPARENT positions, meaning aberration and nutation are
 * included. This was settled empirically on 2026-06-21 rather than assumed: for
 * the Pensacola 1993-10-18 01:30 chart the two conventions agree on gate, line,
 * color and tone but split on base, and Jovian Archive reports the apparent
 * value. Aberration is about 20.5", which is 1.1 base slices, so the question
 * is invisible at every coarser resolution and only surfaces at base.
 *
 * 'geometric' exists for the comparison harness. Do not ship it.
 */
export type Convention = 'geometric' | 'apparent'

export interface EphemerisEngine {
  /** Short identifier, e.g. 'astronomy-engine' or 'moshier'. Surfaces on the chart and in reports. */
  readonly name: string

  /** Whether this engine resolves base reliably given a second-precision birth time. */
  readonly baseCapable: boolean

  /** Apparent geocentric ecliptic-of-date longitudes, degrees [0, 360). */
  bodyLongitudes(jdUT: number, convention?: Convention): BodyLongitudes

  /**
   * Sun longitude only. The design-arc bisection calls this up to 50 times per
   * chart, so engines should keep this cheaper than a full body sweep.
   */
  sunLongitude(jdUT: number): number
}

export function norm360(d: number): number {
  return ((d % 360) + 360) % 360
}

/** Signed difference (a - b) in degrees, normalized to (-180, 180]. */
export function signedAngularDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}
