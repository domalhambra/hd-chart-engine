/**
 * GPL-3.0 BOUNDARY. This module imports the `ephemeris` package (GPL-3.0).
 * It is reachable ONLY through the `hd-chart-engine/moshier` sub-path export.
 * Never import it from src/index.ts or from anything index.ts reaches.
 * tests/licensing-boundary.test.ts enforces that.
 *
 * ---
 *
 * Ephemeris layer built on the Moshier theory (the `ephemeris` package), which
 * is sub-arcsecond against the full Swiss Ephemeris across the test fixture.
 * Fine enough that the ephemeris stops being the limiting factor on tone, and
 * on base for a to-the-second birth time.
 *
 * Two deliberate choices, both documented in docs/ephemeris-ground-truth.md:
 *
 * 1. Time base. The package treats its input instant as TT, but birth moments
 *    are UT. We feed it the instant + ΔT so the physics lands at the correct
 *    TT. Without this the Moon is ~26″ off; with it, ~0.3″.
 *
 * 2. Convention. We return APPARENT (aberration + nutation) ecliptic-of-date
 *    longitudes, the package's native output. Confirmed 2026-06-21 against
 *    Jovian Archive for the Pensacola 1993-10-18 chart: its Personality Sun
 *    base matched apparent, not geometric (the two differ by ~20.5″, about 1.1
 *    base slices). A `convention: 'geometric'` option remains for the
 *    resolution harness; it subtracts annual aberration (Meeus, Ch. 23).
 */
import eph from 'ephemeris'
import { deltaTSeconds } from './delta-t'
import { PLANET_KEYS, norm360 } from './types'
import type { BodyLongitudes, Convention, EphemerisEngine, PlanetKey } from './types'

// HD keys that map straight to a body the package reports.
const PLANET_TO_EPH: Record<string, string> = {
  sun: 'sun', moon: 'moon', mercury: 'mercury', venus: 'venus', mars: 'mars',
  jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune',
  pluto: 'pluto',
}

const DEG = Math.PI / 180
const KAPPA = 20.49552 / 3600 // constant of aberration, degrees

/**
 * Annual aberration in ecliptic longitude (degrees), Meeus Ch. 23. This is the
 * amount aberration ADDS to a geometric longitude, so geometric = apparent − Δλ.
 *   Δλ = (−κ·cos(⊙−λ) + e·κ·cos(ϖ−λ)) / cos β
 * ⊙ is the Sun's longitude (apparent is fine here — it enters only via a
 * cosine of a difference and the sub-arcsecond second-order error is immaterial).
 */
function aberrationLon(sunLon: number, lambda: number, beta: number, T: number): number {
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T
  const peri = 102.93735 + 1.71946 * T + 0.00046 * T * T
  return (
    (-KAPPA * Math.cos((sunLon - lambda) * DEG) + e * KAPPA * Math.cos((peri - lambda) * DEG))
    / Math.cos(beta * DEG)
  )
}

// Apparent ecliptic latitude (degrees) the package reports for a body, or 0.
// Use `.latitude` (radians): it is a plain number for both the Moon and the
// planets, whereas `.dLatitude` is a number for the Moon but a {d,m,s} object
// for the planets.
function eclLatitude(body: any): number {
  const latRad = body?.raw?.position?.apparentGeocentric?.latitude
  return typeof latRad === 'number' ? (latRad * 180) / Math.PI : 0
}

/** A Date at the TT instant for a Julian Day given in UT (TT = UT + ΔT). */
function ttDate(jdUT: number): Date {
  const ms = (jdUT - 2440587.5) * 86400000
  return new Date(ms + deltaTSeconds(jdUT) * 1000)
}

type Observed = Record<string, any>

function observedAt(jdUT: number): Observed {
  // Observer location is irrelevant for geocentric longitudes; pass 0,0,0.
  return eph.getAllPlanets(ttDate(jdUT), 0, 0, 0).observed
}

// Julian centuries of TT from J2000 for a UT Julian Day.
function julianCenturiesTT(jdUT: number): number {
  return (jdUT + deltaTSeconds(jdUT) / 86400 - 2451545) / 36525
}

/**
 * Apparent ecliptic longitude of the Sun, in degrees. Cheap path for the
 * design-arc search (which only needs the Sun); apparent matches the body
 * convention so the 88° solar arc is computed consistently.
 */
export function sunLongitude(jdUT: number): number {
  return norm360(observedAt(jdUT).sun.apparentLongitudeDd)
}

// Moon apparent ecliptic longitude + latitude (degrees) at a UT Julian Day.
// The node derivation below uses apparent (not geometric) Moon directions: the
// node is an orbital-plane construct benchmarked against Swiss TRUE_NODE (which
// is itself aberration-independent), and the apparent directions track it to
// ~3″ whereas removing aberration rotates the derived plane by ~the aberration.
function moonLonLat(jdUT: number): { lon: number; lat: number } {
  const m = observedAt(jdUT).moon
  return { lon: m.apparentLongitudeDd, lat: eclLatitude(m) }
}

/**
 * True lunar node longitude (degrees). The node is the ascending intersection
 * of the Moon's instantaneous orbital plane with the ecliptic. We take the
 * plane normal from two Moon direction vectors a short arc apart — equivalent
 * to L = r × v but using the new, accurate Moon — then read the node longitude
 * as atan2(n_x, −n_y), the same extraction the prior engine used and which was
 * verified against Swiss TRUE_NODE. Node error is dominated by the Moon model,
 * not this derivation (see docs/ephemeris-ground-truth.md), and is immaterial
 * either way.
 */
function trueLunarNodeLongitude(jdUT: number): number {
  const delta = 0.05 // days
  const toVec = ({ lon, lat }: { lon: number; lat: number }) => {
    const cb = Math.cos(lat * DEG)
    return [cb * Math.cos(lon * DEG), cb * Math.sin(lon * DEG), Math.sin(lat * DEG)] as const
  }
  const u1 = toVec(moonLonLat(jdUT - delta))
  const u2 = toVec(moonLonLat(jdUT + delta))
  // n = u1 × u2 — orbital angular-momentum direction (earlier × later, prograde).
  const nx = u1[1] * u2[2] - u1[2] * u2[1]
  const ny = u1[2] * u2[0] - u1[0] * u2[2]
  return norm360((Math.atan2(nx, -ny) * 180) / Math.PI)
}

export function computeBodyLongitudes(
  jdUT: number,
  convention: Convention = 'apparent',
): BodyLongitudes {
  const obs = observedAt(jdUT)
  const T = julianCenturiesTT(jdUT)
  const sunApp = obs.sun.apparentLongitudeDd
  const out = {} as BodyLongitudes
  for (const key of PLANET_KEYS) {
    if (key === 'earth' || key === 'north_node' || key === 'south_node') continue
    const body = obs[PLANET_TO_EPH[key]!]
    const app = body.apparentLongitudeDd
    // 'geometric' subtracts annual aberration; 'apparent' keeps it. The two
    // differ by ~20.5″ (~1.1 base slices) — the resolved HD convention is apparent.
    const ab = convention === 'apparent' ? 0 : aberrationLon(sunApp, app, eclLatitude(body), T)
    out[key] = norm360(app - ab)
  }
  out.earth = norm360(out.sun + 180)
  out.north_node = trueLunarNodeLongitude(jdUT)
  out.south_node = norm360(out.north_node + 180)
  return out
}

/**
 * The high-accuracy engine. Sub-arcsecond on every direct body, so base is
 * meaningful given a to-the-second birth time.
 *
 * Importing this links GPL-3.0 code. See NOTICE.md.
 */
export function createMoshierEngine(): EphemerisEngine {
  return {
    name: 'moshier',
    baseCapable: true,
    bodyLongitudes: (jdUT: number, convention: Convention = 'apparent') =>
      computeBodyLongitudes(jdUT, convention),
    sunLongitude,
  }
}

export type { PlanetKey }
