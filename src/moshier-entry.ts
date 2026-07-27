/**
 * GPL-3.0 sub-path entry point (`hd-chart-engine/moshier`).
 *
 * Importing anything from here links the `ephemeris` package (GPL-3.0) into
 * your program, and your combined work becomes subject to GPL-3.0 terms. That
 * includes JavaScript you serve to a browser, which counts as distribution.
 * See NOTICE.md.
 *
 * In exchange you get sub-arcsecond accuracy on every direct body, which is
 * what makes base meaningful. The MIT default engine is accurate through color
 * and usually tone, but not base.
 */
export { createMoshierEngine, computeBodyLongitudes, sunLongitude } from './ephemeris/moshier'
export type {
  EphemerisEngine, Convention, PlanetKey, BodyLongitudes,
} from './ephemeris/types'
