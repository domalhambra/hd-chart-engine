import { describe, it, expect } from 'vitest'
import { createAstronomyEngine } from '../src/ephemeris/astronomy'
import { PLANET_KEYS } from '../src/ephemeris/types'

const engine = createAstronomyEngine()

describe('astronomy engine', () => {
  it('returns one longitude per HD planet key, in range', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    for (const k of PLANET_KEYS) {
      expect(typeof lons[k]).toBe('number')
      expect(lons[k]).toBeGreaterThanOrEqual(0)
      expect(lons[k]).toBeLessThan(360)
    }
  })

  it('holds Earth opposite Sun and South Node opposite North Node', () => {
    const l = engine.bodyLongitudes(2451545.0)
    expect((l.earth - l.sun + 360) % 360).toBeCloseTo(180, 6)
    expect((l.south_node - l.north_node + 360) % 360).toBeCloseTo(180, 6)
  })

  it('derives True Node, not Mean Node, at J2000', () => {
    // True 123.953°, Mean 125.044°. A ±0.05° window excludes Mean.
    expect(engine.bodyLongitudes(2451545.0).north_node).toBeCloseTo(123.953, 1)
  })

  it('reports itself as not base-capable', () => {
    expect(engine.name).toBe('astronomy-engine')
    expect(engine.baseCapable).toBe(false)
  })

  it('agrees between the cheap Sun path and the full sweep', () => {
    expect(engine.sunLongitude(2451545.0)).toBeCloseTo(engine.bodyLongitudes(2451545.0).sun, 9)
  })

  it('refuses the geometric convention rather than silently returning it', () => {
    expect(() => engine.bodyLongitudes(2451545.0, 'geometric')).toThrow(/apparent/i)
  })

  // The convention guard, and the reason this engine was rewritten.
  //
  // These are full Swiss Ephemeris APPARENT longitudes at JD 2447956.5
  // (1990-03-06 00:00 UT), the same reference moment the Moshier test uses.
  // Geometric longitudes sit ~21" away on the Sun, so a regression to the old
  // geometric behaviour fails here immediately.
  it('emits APPARENT longitudes, within its published accuracy of Swiss', () => {
    const lons = engine.bodyLongitudes(2447956.5)
    const swiss: Record<string, number> = {
      sun: 345.15348, moon: 99.65815, mercury: 333.90853,
      saturn: 292.56322, pluto: 227.72326, north_node: 316.23713,
    }
    // Per-body budgets sized to measured error with headroom, not to whatever
    // the engine happens to produce today.
    const budget: Record<string, number> = {
      sun: 3, moon: 3, mercury: 8, saturn: 5, pluto: 6, north_node: 12,
    }
    for (const [body, ref] of Object.entries(swiss)) {
      const arcsec = Math.abs(
        ((lons[body as keyof typeof lons] - ref + 540) % 360) - 180,
      ) * 3600
      expect(arcsec, `${body} off by ${arcsec.toFixed(2)}″`).toBeLessThan(budget[body]!)
    }
  })
})
