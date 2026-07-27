import { describe, it, expect } from 'vitest'
import { calculateChart, CalculatorError, createAstronomyEngine } from '../src/index'
import { createMoshierEngine } from '../src/ephemeris/moshier'

const input = {
  date: '1990-03-05',
  time: '06:47',
  lat: 39.5296,
  lon: -119.8138,
  tz: 'America/Los_Angeles',
}

/**
 * Pensacola, FL, 1993-10-18 01:30. This is the repo's calibration chart: its
 * activations were checked against Jovian Archive, an independent authority,
 * and it is what settled the apparent-versus-geometric question at base
 * resolution.
 */
const pensacola = {
  date: '1993-10-18',
  time: '01:30',
  lat: 30.4213,
  lon: -87.2169,
  tz: 'America/Chicago',
}

describe('calculateChart', () => {
  it('returns a chart with both sides for every body', () => {
    const chart = calculateChart(input)
    expect(chart.v).toBe(1)
    for (const body of Object.values(chart.planets)) {
      expect(body.p.g).toBeGreaterThanOrEqual(1)
      expect(body.p.g).toBeLessThanOrEqual(64)
      expect(body.d.g).toBeGreaterThanOrEqual(1)
      expect(body.d.g).toBeLessThanOrEqual(64)
      expect(body.p.l).toBeGreaterThanOrEqual(1)
      expect(body.p.l).toBeLessThanOrEqual(6)
      expect(body.d.l).toBeGreaterThanOrEqual(1)
      expect(body.d.l).toBeLessThanOrEqual(6)
    }
  })

  it('places the Design Sun 88° behind the Personality Sun', () => {
    const chart = calculateChart(input, { engine: createMoshierEngine() })
    // 88° is 15.64 gates, so the check is on the underlying arc, not the gate.
    // Confirm via the wheel: design must not equal personality.
    expect(chart.planets.sun.d).not.toEqual(chart.planets.sun.p)
  })

  it('holds Earth opposite Sun on both sides', () => {
    const chart = calculateChart(input)
    expect(chart.planets.earth.p).not.toEqual(chart.planets.sun.p)
    expect(chart.planets.earth.d).not.toEqual(chart.planets.sun.d)
  })

  it('throws on an out-of-range date', () => {
    expect(() => calculateChart({ ...input, date: '1700-01-01' })).toThrow(CalculatorError)
  })

  it('throws on a malformed date', () => {
    expect(() => calculateChart({ ...input, date: 'bogus' })).toThrow(CalculatorError)
  })

  it('throws on a malformed time', () => {
    expect(() => calculateChart({ ...input, time: '25:99' })).toThrow(CalculatorError)
  })

  it('throws on out-of-range time fields', () => {
    expect(() => calculateChart({ ...input, time: '99:99' })).toThrow(CalculatorError)
  })

  it('accepts a to-the-second time', () => {
    expect(() => calculateChart({ ...input, time: '06:47:30' })).not.toThrow()
  })

  it('throws on out-of-range seconds', () => {
    expect(() => calculateChart({ ...input, time: '06:47:99' })).toThrow(CalculatorError)
  })

  it('surfaces birth-moment warnings on the chart', () => {
    const chart = calculateChart({
      date: '2010-03-14', time: '02:30', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles',
    })
    expect(chart.warnings.join(' ')).toMatch(/does not exist/i)
  })
})

describe('engine selection', () => {
  it('defaults to the MIT engine', () => {
    expect(calculateChart(input).engine).toBe('astronomy-engine')
  })

  it('accepts an injected engine', () => {
    expect(calculateChart(input, { engine: createMoshierEngine() }).engine).toBe('moshier')
  })

  it('accepts the MIT engine explicitly', () => {
    expect(calculateChart(input, { engine: createAstronomyEngine() }).engine).toBe('astronomy-engine')
  })
})

describe('precision grading', () => {
  it('never doubts gate, line or color', () => {
    const p = calculateChart(input).precision
    expect(p.gate).toBe('reliable')
    expect(p.line).toBe('reliable')
    expect(p.color).toBe('reliable')
  })

  it('marks base an estimate at minute precision even on the accurate engine', () => {
    // One minute of clock is ~1.8 base slices of Moon motion. No engine fixes that.
    const p = calculateChart(input, { engine: createMoshierEngine() }).precision
    expect(p.base).toBe('estimate')
  })

  it('marks base reliable only at second precision on a base-capable engine', () => {
    const p = calculateChart({ ...input, time: '06:47:30' }, { engine: createMoshierEngine() }).precision
    expect(p.base).toBe('reliable')
  })

  it('never marks base reliable on the MIT engine, even at second precision', () => {
    const p = calculateChart({ ...input, time: '06:47:30' }).precision
    expect(p.base).toBe('estimate')
  })
})

describe('Jovian Archive calibration (Pensacola 1993-10-18 01:30)', () => {
  // Ground truth from an independent authority, not from either engine. This is
  // the strongest correctness check in the suite: if the wheel offset, the
  // design arc, the timezone handling or the convention were wrong, this fails.
  it('reproduces the Personality Sun at gate 32 line 5 on the accurate engine', () => {
    const chart = calculateChart(pensacola, { engine: createMoshierEngine() })
    expect(chart.planets.sun.p.g).toBe(32)
    expect(chart.planets.sun.p.l).toBe(5)
  })

  it('reproduces the same gate and line on the MIT engine', () => {
    const chart = calculateChart(pensacola)
    expect(chart.planets.sun.p.g).toBe(32)
    expect(chart.planets.sun.p.l).toBe(5)
  })

  it('resolves the Personality Sun sub-line to color 3 tone 4 base 2 (apparent)', () => {
    // Jovian reports base 2. The geometric convention gives base 3, which is how
    // the convention question was settled. See docs/ephemeris-ground-truth.md.
    const sun = calculateChart(pensacola, { engine: createMoshierEngine() }).planets.sun.p
    expect({ c: sun.c, t: sun.t, b: sun.b }).toEqual({ c: 3, t: 4, b: 2 })
  })
})
