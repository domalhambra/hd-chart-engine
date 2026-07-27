/**
 * MIT default engine, built on astronomy-engine.
 *
 * Convention: APPARENT. `Ecliptic(GeoVector(body, date, true))` returns true
 * ecliptic of date (precession and nutation applied) with aberration included,
 * which is the Human Design convention. See ./types.ts for how that was
 * settled.
 *
 * The earlier Badwater HD code ran this engine GEOMETRIC, which put 2 of 104
 * fixture lines on the wrong side of a boundary. Do not pass `false` here. At
 * the reference moment below, geometric is 21.1″ from Swiss on the Sun where
 * apparent is 0.46″, so the difference is not subtle once you measure it.
 *
 * No ΔT shift. astronomy-engine takes a UTC instant and converts to TT
 * internally. The `+ ΔT` correction in ./moshier.ts works around a bug specific
 * to the `ephemeris` package and must not be copied here.
 */
import { Body, GeoVector, Ecliptic, EclipticGeoMoon } from 'astronomy-engine'
import { PLANET_KEYS, norm360 } from './types'
import type { BodyLongitudes, Convention, EphemerisEngine, PlanetKey } from './types'

const DEG = Math.PI / 180

const BODY_MAP: Partial<Record<PlanetKey, Body>> = {
  sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
  mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
  uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
}

/** astronomy-engine takes a Date; a UT Julian Day converts directly. */
function dateOf(jdUT: number): Date {
  return new Date((jdUT - 2440587.5) * 86400000)
}

function apparentLongitude(body: Body, date: Date): number {
  return norm360(Ecliptic(GeoVector(body, date, true)).elon)
}

function toVec(latDeg: number, lonDeg: number): readonly [number, number, number] {
  const cb = Math.cos(latDeg * DEG)
  return [cb * Math.cos(lonDeg * DEG), cb * Math.sin(lonDeg * DEG), Math.sin(latDeg * DEG)]
}

/**
 * True lunar node: the ascending intersection of the Moon's instantaneous
 * orbital plane with the ecliptic.
 *
 * Same derivation as the Moshier engine, so the two stay comparable: take the
 * plane normal from two Moon direction vectors a short arc apart (equivalent to
 * L = r × v), then read the node longitude as atan2(n_x, −n_y).
 *
 * Measured at 4.6″ against Swiss TRUE_NODE, which is better than this engine's
 * own Moon longitude and better than the L = r × v form off GeoMoonState (5.2″).
 * A Moon longitude error is largely along-track and barely tips the orbital
 * plane that fixes the node, so the node tolerates it.
 */
function trueNodeLongitude(jdUT: number): number {
  const delta = 0.05 // days
  const m1 = EclipticGeoMoon(dateOf(jdUT - delta))
  const m2 = EclipticGeoMoon(dateOf(jdUT + delta))
  const u1 = toVec(m1.lat, m1.lon)
  const u2 = toVec(m2.lat, m2.lon)
  // n = u1 × u2 — orbital angular-momentum direction (earlier × later, prograde).
  const nx = u1[1] * u2[2] - u1[2] * u2[1]
  const ny = u1[2] * u2[0] - u1[0] * u2[2]
  return norm360((Math.atan2(nx, -ny) * 180) / Math.PI)
}

export function computeBodyLongitudes(
  jdUT: number,
  convention: Convention = 'apparent',
): BodyLongitudes {
  if (convention === 'geometric') {
    throw new Error(
      'astronomy engine: the geometric convention is not supported. Human Design uses '
      + 'apparent positions. Use the moshier engine if you need geometric for comparison.',
    )
  }
  const date = dateOf(jdUT)
  const out = {} as BodyLongitudes
  for (const key of PLANET_KEYS) {
    if (key === 'earth' || key === 'north_node' || key === 'south_node') continue
    out[key] = apparentLongitude(BODY_MAP[key]!, date)
  }
  out.earth = norm360(out.sun + 180)
  out.north_node = trueNodeLongitude(jdUT)
  out.south_node = norm360(out.north_node + 180)
  return out
}

export function sunLongitude(jdUT: number): number {
  return apparentLongitude(Body.Sun, dateOf(jdUT))
}

/**
 * The MIT engine. Accurate through gate, line and color at every birth-time
 * precision.
 *
 * `baseCapable` is false: see the README's accuracy table. Base slices are
 * 18.75″ wide and this engine does not hold every body inside that reliably.
 * Use the `hd-chart-engine/moshier` sub-path when base matters, and accept the
 * GPL-3.0 terms that come with it.
 */
export function createAstronomyEngine(): EphemerisEngine {
  return {
    name: 'astronomy-engine',
    baseCapable: false,
    bodyLongitudes: computeBodyLongitudes,
    sunLongitude,
  }
}
