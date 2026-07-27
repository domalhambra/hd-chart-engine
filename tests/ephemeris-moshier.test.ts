import { describe, it, expect } from 'vitest'
import { createMoshierEngine } from '../src/ephemeris/moshier'
import { PLANET_KEYS } from '../src/ephemeris/types'

const engine = createMoshierEngine()

describe('moshier engine', () => {
  it('returns one longitude per HD planet key, in range', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    for (const k of PLANET_KEYS) {
      expect(typeof lons[k]).toBe('number')
      expect(lons[k]).toBeGreaterThanOrEqual(0)
      expect(lons[k]).toBeLessThan(360)
    }
  })

  it('holds Earth exactly 180° from Sun', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    expect((lons.earth - lons.sun + 360) % 360).toBeCloseTo(180, 6)
  })

  it('holds South Node exactly 180° from North Node', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    expect((lons.south_node - lons.north_node + 360) % 360).toBeCloseTo(180, 6)
  })

  it('places the Sun near 280° in early January 2000', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    expect(lons.sun).toBeGreaterThan(278)
    expect(lons.sun).toBeLessThan(282)
  })

  it('derives True Node, not Mean Node, at J2000', () => {
    // True Node at J2000.0 is ~123.953° (pyswisseph TRUE_NODE: 123.95289).
    // The Mean Node is 125.044°; the ~1.1° gap distinguishes them.
    const lons = engine.bodyLongitudes(2451545.0)
    expect(lons.north_node).toBeCloseTo(123.953, 1)
  })

  it('reports itself as base-capable', () => {
    expect(engine.name).toBe('moshier')
    expect(engine.baseCapable).toBe(true)
  })

  it('agrees between the cheap Sun path and the full sweep', () => {
    expect(engine.sunLongitude(2451545.0)).toBeCloseTo(engine.bodyLongitudes(2451545.0).sun, 9)
  })

  // Accuracy regression guard. Pins the engine to full Swiss Ephemeris
  // (apparent, the HD convention) reference longitudes at JD 2447956.5. The 3"
  // tolerance is far tighter than the ~8-26" shift a UT-vs-TT time-base
  // regression would cause, e.g. if the `ephemeris` package fixes its internal
  // time handling and the + ΔT compensation becomes a double correction. So
  // this fails loudly rather than silently degrading base.
  // Reference values from pyswisseph FLG_SWIEPH; see docs/ephemeris-ground-truth.md.
  it('matches Swiss Ephemeris to < 3 arc-seconds at a historical moment', () => {
    // JD 2447956.5 is 1990-03-06 00:00 UT. The comment inherited from Badwater HD
    // said 1990-01-27, which is JD 2447918.5. The reference values below belong
    // to 2447956.5; only the comment was wrong.
    const lons = engine.bodyLongitudes(2447956.5)
    const swiss: Record<string, number> = {
      sun: 345.15348, moon: 99.65815, mercury: 333.90853,
      saturn: 292.56322, pluto: 227.72326, north_node: 316.23713,
    }
    for (const [body, ref] of Object.entries(swiss)) {
      const arcsec = Math.abs(
        ((lons[body as keyof typeof lons] - ref + 540) % 360) - 180,
      ) * 3600
      expect(arcsec, `${body} drifted ${arcsec.toFixed(2)}″ from Swiss`).toBeLessThan(3)
    }
  })

  // The ΔT correction, asserted directly. Without the + ΔT input shift the Moon
  // sits ~26" off (mean 25.93", max 39.56"); with it, 0.27" mean. Removing the
  // shift fails here rather than quietly degrading base.
  it('applies the ΔT time-base correction', () => {
    const moon = engine.bodyLongitudes(2447956.5).moon
    expect(Math.abs(moon - 99.65815) * 3600).toBeLessThan(3)
  })

  // Aberration is ~20.5", or 1.1 base slices. The two conventions must differ by
  // about that much, which proves the geometric path actually removes it.
  it('separates apparent from geometric by roughly the aberration constant', () => {
    const app = engine.bodyLongitudes(2447956.5, 'apparent').sun
    const geo = engine.bodyLongitudes(2447956.5, 'geometric').sun
    const arcsec = Math.abs(((app - geo + 540) % 360) - 180) * 3600
    expect(arcsec).toBeGreaterThan(15)
    expect(arcsec).toBeLessThan(26)
  })
})
