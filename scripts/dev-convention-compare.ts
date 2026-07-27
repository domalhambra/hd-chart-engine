#!/usr/bin/env -S npx tsx
/**
 * Dev tool: print a chart's color/tone/base under BOTH the geometric and
 * apparent conventions, side by side, to resolve which one Jovian Archive /
 * Genetic Matrix use at base resolution. The two differ by annual aberration
 * (~20.5″ ≈ 1.1 base slices), so base usually differs between them.
 *
 *   npx tsx scripts/dev-convention-compare.ts \
 *     --date=1990-03-05 --time=06:47:30 \
 *     --lat=39.5296 --lon=-119.8138 --tz=America/Los_Angeles
 *
 * Compare the two columns against an authoritative chart's color/tone/base
 * (Sun/Earth and others). The column that matches is the convention to assert.
 */
import { parseArgs } from 'node:util'
import { resolveBirthMoment } from '../src/birth-moment'
import { computeBodyLongitudes, sunLongitude } from '../src/ephemeris/moshier'
import { PLANET_KEYS } from '../src/ephemeris/types'
import { longitudeToActivation, findDesignJD } from '../src/activation'

const { values } = parseArgs({
  options: {
    date: { type: 'string' }, time: { type: 'string' },
    lat: { type: 'string' }, lon: { type: 'string' }, tz: { type: 'string' },
  },
})
for (const k of ['date', 'time', 'lat', 'lon', 'tz'] as const) {
  if (!values[k]) { console.error(`missing --${k}`); process.exit(1) }
}

const moment = resolveBirthMoment({
  date: values.date!, time: values.time!,
  lat: Number(values.lat), lon: Number(values.lon), tz: values.tz!,
})
const designJD = findDesignJD(moment.julianDay, sunLongitude)

const fmt = (a: { g: number; l: number; c?: number; t?: number; b?: number }) =>
  `${String(a.g).padStart(2)}.${a.l}.${a.c}.${a.t}.${a.b}`

for (const [label, jd] of [['PERSONALITY', moment.julianDay], ['DESIGN', designJD]] as const) {
  const geo = computeBodyLongitudes(jd, 'geometric')
  const app = computeBodyLongitudes(jd, 'apparent')
  console.log(`\n${label}  (gate.line.color.tone.base)`)
  console.log(`${'body'.padEnd(12)}${'geometric'.padEnd(14)}${'apparent'.padEnd(14)}diff`)
  console.log('-'.repeat(48))
  for (const k of PLANET_KEYS) {
    const g = longitudeToActivation(geo[k])
    const a = longitudeToActivation(app[k])
    const diff = g.c !== a.c ? 'color' : g.t !== a.t ? 'tone' : g.b !== a.b ? 'base' : ''
    console.log(`${k.padEnd(12)}${fmt(g).padEnd(14)}${fmt(a).padEnd(14)}${diff}`)
  }
}
