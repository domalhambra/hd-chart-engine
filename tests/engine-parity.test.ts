import { describe, it, expect } from 'vitest'
import fixture from './fixtures/synthetic-charts.json'
import {
  PLANET_KEYS, createAstronomyEngine, longitudeToActivation, findDesignJD, resolveBirthMoment,
} from '../src/index'
import { createMoshierEngine } from '../src/ephemeris/moshier'

/**
 * The load-bearing test of the two-engine design.
 *
 * The MIT engine is the free tier. If it disagreed with the accurate engine in
 * any way a reader would notice, the free tier would not be usable and the
 * licensing model would fail.
 *
 * "Zero disagreements" is the wrong assertion, though, and worth explaining
 * because it is the trap this test was originally written into. The fixture
 * deliberately includes gate-boundary candidates (`gb-1` through `gb-6`), and a
 * body sitting exactly on a slice edge will be sorted differently by any two
 * ephemerides that differ at all. That is a property of edges, not a defect.
 *
 * So the assertion is sharper: every disagreement must be a **boundary
 * straddle**. If two longitudes disagree about which slice they are in but sit
 * closer together than the error budget, the boundary provably lies between
 * them and neither engine is wrong in any meaningful sense. A disagreement
 * wider than the budget means the engines genuinely diverge, which is a bug.
 *
 * The median check is the convention guard: reverting the MIT engine to
 * geometric longitudes would shift it ~20.5" across the board, which no
 * straddle rule would catch but the median catches immediately.
 *
 * 30 charts x 13 bodies x 2 sides = 780 rows.
 */
const astro = createAstronomyEngine()
const moshier = createMoshierEngine()

/** Widest credible separation between the two engines, in arc-seconds. */
const BUDGET_ARCSEC = 30

const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600

type Row = {
  id: string
  body: string
  side: 'p' | 'd'
  deltaArcsec: number
  a: ReturnType<typeof longitudeToActivation>
  m: ReturnType<typeof longitudeToActivation>
}

const rows: Row[] = []
for (const c of fixture.charts) {
  const moment = resolveBirthMoment({
    lat: c.lat, lon: c.lon, date: c.date, time: c.time, tz: c.tz,
  })
  // Each engine solves the design arc with its own Sun, so the two design
  // moments differ by up to ~53 seconds of clock. That is correct: each engine
  // stays internally consistent. It does mean design-side bodies separate a
  // little more than personality-side ones.
  const sides = [
    { side: 'p' as const, jdA: moment.julianDay, jdM: moment.julianDay },
    {
      side: 'd' as const,
      jdA: findDesignJD(moment.julianDay, jd => astro.sunLongitude(jd)),
      jdM: findDesignJD(moment.julianDay, jd => moshier.sunLongitude(jd)),
    },
  ]
  for (const { side, jdA, jdM } of sides) {
    const lonsA = astro.bodyLongitudes(jdA)
    const lonsM = moshier.bodyLongitudes(jdM)
    for (const k of PLANET_KEYS) {
      rows.push({
        id: c.id,
        body: k,
        side,
        deltaArcsec: arcsec(lonsA[k], lonsM[k]),
        a: longitudeToActivation(lonsA[k]),
        m: longitudeToActivation(lonsM[k]),
      })
    }
  }
}

const label = (r: Row) => `${r.id}/${r.side}/${r.body} (Δ${r.deltaArcsec.toFixed(2)}")`
const disagreeing = (field: 'g' | 'l' | 'c' | 't' | 'b') =>
  rows.filter(r => r.a[field] !== r.m[field])

const deltas = rows.map(r => r.deltaArcsec).sort((x, y) => x - y)
const median = deltas[Math.floor(deltas.length / 2)]!
const p95 = deltas[Math.floor(deltas.length * 0.95)]!
const max = deltas[deltas.length - 1]!

describe('engine parity across the 30-chart fixture', () => {
  it('compares every row', () => {
    expect(rows).toHaveLength(30 * PLANET_KEYS.length * 2)
  })

  it('tracks the accurate engine to within the error budget on every body', () => {
    const overBudget = rows.filter(r => r.deltaArcsec > BUDGET_ARCSEC)
    expect(overBudget.map(label)).toEqual([])
  })

  it('holds the median separation well under the aberration constant', () => {
    // Aberration is ~20.5". A regression to geometric would push the median to
    // roughly that. Measured median is ~1.7".
    expect(median).toBeLessThan(5)
  })

  it('has no GATE disagreement that is not a boundary straddle', () => {
    const real = disagreeing('g').filter(r => r.deltaArcsec > BUDGET_ARCSEC)
    expect(real.map(label)).toEqual([])
  })

  it('has no LINE disagreement that is not a boundary straddle', () => {
    const real = disagreeing('l').filter(r => r.deltaArcsec > BUDGET_ARCSEC)
    expect(real.map(label)).toEqual([])
  })

  it('keeps gate and line straddles rare (currently 1 row in 780)', () => {
    // Documents the measured state. A change that introduced many straddles
    // would be a real regression even though each one is individually benign.
    const straddles = [...disagreeing('g'), ...disagreeing('l')]
    expect(straddles.length).toBeLessThanOrEqual(4)
  })

  it('agrees on COLOR for at least 99% of rows', () => {
    expect(disagreeing('c').length / rows.length).toBeLessThan(0.01)
  })

  it('reports the full disagreement profile for the README', () => {
    const pct = (f: 'c' | 't' | 'b') => (disagreeing(f).length / rows.length) * 100
    const report = [
      `rows: ${rows.length}`,
      `separation: median ${median.toFixed(2)}" p95 ${p95.toFixed(2)}" max ${max.toFixed(2)}"`,
      `gate ${disagreeing('g').length}, line ${disagreeing('l').length} (all boundary straddles)`,
      `color ${pct('c').toFixed(2)}%, tone ${pct('t').toFixed(2)}%, base ${pct('b').toFixed(2)}%`,
    ].join('\n')
    process.stdout.write(`\n${report}\n`)

    // Tone and base are where the MIT engine is expected to slip. These are
    // documented ceilings, not aspirations.
    expect(disagreeing('t').length / rows.length).toBeLessThan(0.15)
    expect(disagreeing('b').length / rows.length).toBeLessThan(0.65)
  })
})
