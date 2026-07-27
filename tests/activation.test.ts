import { describe, it, expect } from 'vitest'
import { longitudeToActivation, signedAngularDiff, findDesignJD } from '../src/activation'
import { WHEEL_START, GATE_WIDTH, LINE_WIDTH } from '../src/wheel'

describe('longitudeToActivation', () => {
  it('returns gate 1 line 1 at the wheel start', () => {
    expect(longitudeToActivation(WHEEL_START)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  // Cross-checks against the printed wheel, carried over from Badwater HD.
  it("places gate 56 line 5 at 120.5° (00°07'30\" Leo)", () => {
    const a = longitudeToActivation(120.5)
    expect(a.g).toBe(56)
    expect(a.l).toBe(5)
  })

  it("places gate 7 line 1 at 133.3° (13°15'00\" Leo)", () => {
    const a = longitudeToActivation(133.3)
    expect(a.g).toBe(7)
    expect(a.l).toBe(1)
  })

  it('wraps below the wheel start into gate 44 line 6', () => {
    const a = longitudeToActivation(223.0)
    expect(a.g).toBe(44)
    expect(a.l).toBe(6)
  })

  it('handles the Aries crossing (gate 25 at 1°)', () => {
    expect(longitudeToActivation(1.0).g).toBe(25)
  })

  it('subdivides a single line into 6 colors', () => {
    expect(longitudeToActivation(223.25).c).toBe(1)
    expect(longitudeToActivation(224.1).c).toBe(6)
  })

  it('returns to the start after one full turn', () => {
    expect(longitudeToActivation(WHEEL_START + 360)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  it('normalises negative longitudes', () => {
    expect(longitudeToActivation(WHEEL_START - 360)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  it('advances to line 2 exactly at the line boundary', () => {
    expect(longitudeToActivation(WHEEL_START + LINE_WIDTH).l).toBe(2)
  })

  it('advances to wheel position 2 (gate 43) exactly at the gate boundary', () => {
    expect(longitudeToActivation(WHEEL_START + GATE_WIDTH).g).toBe(43)
  })

  it('keeps every field in range across the whole circle', () => {
    for (let lon = 0; lon < 360; lon += 0.01) {
      const a = longitudeToActivation(lon)
      expect(a.g).toBeGreaterThanOrEqual(1); expect(a.g).toBeLessThanOrEqual(64)
      expect(a.l).toBeGreaterThanOrEqual(1); expect(a.l).toBeLessThanOrEqual(6)
      expect(a.c).toBeGreaterThanOrEqual(1); expect(a.c).toBeLessThanOrEqual(6)
      expect(a.t).toBeGreaterThanOrEqual(1); expect(a.t).toBeLessThanOrEqual(6)
      expect(a.b).toBeGreaterThanOrEqual(1); expect(a.b).toBeLessThanOrEqual(5)
    }
  })

  it('visits all 64 gates exactly once per turn, in wheel order', () => {
    const seen: number[] = []
    for (let i = 0; i < 64; i++) {
      // Sample mid-gate to stay clear of boundary rounding.
      seen.push(longitudeToActivation(WHEEL_START + i * GATE_WIDTH + GATE_WIDTH / 2).g)
    }
    expect(new Set(seen).size).toBe(64)
    expect(seen.slice(0, 3)).toEqual([1, 43, 14])
  })
})

describe('signedAngularDiff', () => {
  it('is 0 for identical angles', () => expect(signedAngularDiff(50, 50)).toBe(0))
  it('is positive when just ahead', () => expect(signedAngularDiff(51, 50)).toBeCloseTo(1, 6))
  it('handles wrap forward', () => expect(signedAngularDiff(1, 359)).toBeCloseTo(2, 6))
  it('handles wrap backward', () => expect(signedAngularDiff(359, 1)).toBeCloseTo(-2, 6))
})

describe('findDesignJD', () => {
  // Synthetic Sun at exactly 1°/day makes the expected answer exact:
  // 88° of solar arc is 88 days earlier.
  const sun = (jd: number) => ((jd - 1000) % 360)

  it('finds the JD where the Sun is 88° back', () => {
    expect(findDesignJD(1188, sun)).toBeCloseTo(1100, 4)
  })

  it('handles a target that wraps below 0', () => {
    const designJD = findDesignJD(1390, sun) // personality Sun 30°, target 302°
    expect(sun(designJD)).toBeCloseTo(302, 3)
  })

  it('lands 88 days back for a 1°/day Sun', () => {
    const jd = 2451545.0
    const linear = (x: number) => ((x % 360) + 360) % 360
    expect(findDesignJD(jd, linear)).toBeCloseTo(jd - 88, 4)
  })

  it('throws rather than returning a wrong answer for a stationary Sun', () => {
    expect(() => findDesignJD(2451545, () => 100)).toThrow(/non-monotonic/i)
  })
})
