import { describe, it, expect } from 'vitest'
import { deltaTSeconds, decimalYear } from '../src/ephemeris/delta-t'

const jdOf = (iso: string) => new Date(iso).getTime() / 86400000 + 2440587.5

describe('decimalYear', () => {
  it('maps mid-January 2000 to 2000 + 0.5/12', () => {
    expect(decimalYear(jdOf('2000-01-15T00:00:00Z'))).toBeCloseTo(2000 + 0.5 / 12, 6)
  })

  it('maps mid-July 2000 to 2000 + 6.5/12', () => {
    expect(decimalYear(jdOf('2000-07-15T00:00:00Z'))).toBeCloseTo(2000 + 6.5 / 12, 6)
  })
})

describe('deltaTSeconds', () => {
  // Published Espenak-Meeus values for their eras. These pin the polynomial
  // segments: a mistranscribed coefficient shows up here immediately.
  it.each([
    ['1900-07-01T00:00:00Z', -2.8, 2],
    ['1950-07-01T00:00:00Z', 29.1, 2],
    ['1990-07-01T00:00:00Z', 56.9, 2],
    ['2000-07-01T00:00:00Z', 63.9, 1],
    ['2020-07-01T00:00:00Z', 71.6, 2],
  ])('is within tolerance at %s', (iso, expected, tol) => {
    expect(Math.abs(deltaTSeconds(jdOf(iso)) - expected)).toBeLessThan(tol)
  })

  it('is continuous across every segment boundary', () => {
    for (const year of [1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050, 2150]) {
      const before = deltaTSeconds(jdOf(`${year - 1}-12-31T00:00:00Z`))
      const after = deltaTSeconds(jdOf(`${year}-01-31T00:00:00Z`))
      expect(Math.abs(after - before), `discontinuity at ${year}`).toBeLessThan(3)
    }
  })

  it('is finite and positive-definite in magnitude across the supported range', () => {
    for (let y = 1800; y <= 2200; y += 5) {
      const dt = deltaTSeconds(jdOf(`${y}-07-01T00:00:00Z`))
      expect(Number.isFinite(dt), `ΔT not finite at ${y}`).toBe(true)
      expect(Math.abs(dt), `ΔT implausible at ${y}`).toBeLessThan(600)
    }
  })
})
