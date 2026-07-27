/**
 * Dev harness: emit per-body ecliptic longitudes (the production engine,
 * astronomy-engine) for a list of Julian Days (UT) read from stdin, one JD per
 * line. Output: one JSON object per line, { jd, moon, m0, sun, mercury, ... }
 * where "m0" is the True-Node longitude.
 *
 * Pairs with scripts/dev-node-eval.py, which supplies the JDs and scores these
 * against a Swiss Ephemeris oracle. Not part of the build; a measurement tool
 * for ephemeris-accuracy work.
 *
 * NOTE (2026-06-20): finite-difference-velocity and arc-normal variants of the
 * node derivation were tested here and proved bit-identical to the production
 * `L = r × v` (m0) to <0.05" across 60 fixture moments — the node error is the
 * Moon *model*, not the derivation. Those variants were removed; see
 * docs/reference/ephemeris-ground-truth.md for the data and conclusion.
 */
import * as AstronomyNS from 'astronomy-engine'
import { readFileSync } from 'fs'

const Astronomy: typeof AstronomyNS =
  ((AstronomyNS as any).default && (AstronomyNS as any).default.Body)
    ? (AstronomyNS as any).default
    : (AstronomyNS as any)
const { Body, MakeTime, GeoMoonState, EclipticGeoMoon, GeoVector, Ecliptic, Vector } = Astronomy

function jdToDate(jdUT: number): Date {
  return new Date((jdUT - 2440587.5) * 86400000)
}

// Production bodies computed the same way as src/ephemeris/moshier.ts:
// geocentric, geometric (no aberration), ecliptic-of-date longitude.
const PLANET_BODIES: Record<string, any> = {
  sun: Body.Sun, mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars,
  jupiter: Body.Jupiter, saturn: Body.Saturn, uranus: Body.Uranus,
  neptune: Body.Neptune, pluto: Body.Pluto,
}

function planetLon(body: any, jd: number): number {
  const ec = Ecliptic(GeoVector(body, MakeTime(jdToDate(jd)), false))
  return ((ec.elon % 360) + 360) % 360
}

function moonLon(jd: number): number {
  const m = EclipticGeoMoon(MakeTime(jdToDate(jd)))
  return ((m.lon % 360) + 360) % 360
}

// True-Node longitude — production method (src/ephemeris/moshier.ts):
// L = r × v from the reported state vector, rotated into the ecliptic of date;
// ascending node n = ẑ × L_ecl = (−Ly, Lx, 0) → lon = atan2(Lx, −Ly).
function nodeLon(jd: number): number {
  const time = MakeTime(jdToDate(jd))
  const s = GeoMoonState(time)
  const Lx = s.y * s.vz - s.z * s.vy
  const Ly = s.z * s.vx - s.x * s.vz
  const Lz = s.x * s.vy - s.y * s.vx
  const Lecl = Ecliptic(new Vector(Lx, Ly, Lz, time))
  const lon = (Math.atan2(Lecl.vec.x, -Lecl.vec.y) * 180) / Math.PI
  return ((lon % 360) + 360) % 360
}

const input = readFileSync(0, 'utf8') as string
for (const line of input.split('\n')) {
  const s = line.trim()
  if (!s) continue
  const jd = Number(s)
  const row: Record<string, number> = { jd, moon: moonLon(jd), m0: nodeLon(jd) }
  for (const [name, body] of Object.entries(PLANET_BODIES)) {
    row[name] = planetLon(body, jd)
  }
  process.stdout.write(JSON.stringify(row) + '\n')
}
