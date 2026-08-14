#!/usr/bin/env -S npx tsx
/**
 * Chart CLI. Development tool, not part of the published package.
 *
 * Prints the chart as JSON on stdout and a human summary on stderr, so it can
 * be piped or diffed. `--verbose` adds the raw longitudes, which is what
 * validate-chart.py parses.
 *
 * Unlike the Plateworks HD original this takes coordinates directly and does no
 * geocoding. Resolving a place name to a lat/lon and IANA zone needs geo-tz and
 * a network call, and neither belongs in a library that has to run in a browser.
 *
 *   npx tsx scripts/calculate-chart.ts \
 *     --lat=30.4213 --lon=-87.2169 --tz=America/Chicago \
 *     --date=1993-10-18 --time=01:30 --engine=moshier --verbose
 */
import { parseArgs } from 'node:util'
import { calculateChart, PLANET_KEYS, createAstronomyEngine, resolveBirthMoment, findDesignJD } from '../src/index'
import { createMoshierEngine } from '../src/ephemeris/moshier'
import type { EphemerisEngine } from '../src/ephemeris/types'

class UsageError extends Error {
  constructor(m: string) { super(m); this.name = 'UsageError' }
}

function main() {
  const { values } = parseArgs({
    options: {
      lat: { type: 'string' },
      lon: { type: 'string' },
      tz: { type: 'string' },
      date: { type: 'string' },
      time: { type: 'string' },
      engine: { type: 'string', default: 'astronomy' },
      verbose: { type: 'boolean', default: false },
    },
    strict: true,
  })

  for (const required of ['lat', 'lon', 'tz', 'date', 'time'] as const) {
    if (!values[required]) throw new UsageError(`--${required} is required`)
  }

  let engine: EphemerisEngine
  if (values.engine === 'moshier') engine = createMoshierEngine()
  else if (values.engine === 'astronomy') engine = createAstronomyEngine()
  else throw new UsageError(`--engine must be 'astronomy' or 'moshier', got '${values.engine}'`)

  const input = {
    lat: Number(values.lat), lon: Number(values.lon), tz: values.tz!,
    date: values.date!, time: values.time!,
  }
  const chart = calculateChart(input, { engine })

  process.stdout.write(JSON.stringify(chart, null, 2) + '\n')

  const moment = resolveBirthMoment(input)
  const designJD = findDesignJD(moment.julianDay, jd => engine.sunLongitude(jd))
  const err = (s: string) => process.stderr.write(s + '\n')

  for (const w of chart.warnings) err(`warning: ${w}`)
  err(`engine: ${engine.name} (baseCapable ${engine.baseCapable})`)
  err(`birth: ${input.date} ${input.time} ${input.tz} (UTC${moment.utcOffsetHours >= 0 ? '+' : ''}${moment.utcOffsetHours})`)
  err(`personality JD: ${moment.julianDay.toFixed(6)}`)
  err(`design JD:      ${designJD.toFixed(6)}`)

  if (values.verbose) {
    const pLons = engine.bodyLongitudes(moment.julianDay)
    const dLons = engine.bodyLongitudes(designJD)
    err('\nPersonality longitudes:')
    for (const k of PLANET_KEYS) err(`  ${k.padEnd(11)} ${pLons[k].toFixed(6)}°`)
    err('\nDesign longitudes:')
    for (const k of PLANET_KEYS) err(`  ${k.padEnd(11)} ${dLons[k].toFixed(6)}°`)
  }
}

try {
  main()
} catch (e: any) {
  process.stderr.write(`error: ${e?.message ?? e}\n`)
  process.exit(e?.name === 'UsageError' ? 2 : 1)
}
