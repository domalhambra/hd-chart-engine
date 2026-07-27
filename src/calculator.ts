import { resolveBirthMoment, TzError } from './birth-moment'
import { longitudeToActivation, findDesignJD } from './activation'
import type { Activation } from './activation'
import { createAstronomyEngine } from './ephemeris/astronomy'
import { PLANET_KEYS } from './ephemeris/types'
import type { EphemerisEngine, PlanetKey } from './ephemeris/types'

export interface CalculateChartInput {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Local 24-hour time, HH:MM or HH:MM:SS. Seconds unlock reliable base. */
  time: string
  lat: number
  lon: number
  /** IANA zone, pre-resolved by the caller. */
  tz: string
}

export interface CalculateChartOptions {
  /**
   * Which ephemeris to compute with. Defaults to the MIT astronomy engine.
   *
   * Pass `createMoshierEngine()` from `hd-chart-engine/moshier` for
   * sub-arcsecond accuracy and reliable base, accepting GPL-3.0 terms.
   */
  engine?: EphemerisEngine
}

export type PrecisionGrade = 'reliable' | 'estimate'

export interface ChartPrecision {
  gate: PrecisionGrade
  line: PrecisionGrade
  color: PrecisionGrade
  tone: PrecisionGrade
  base: PrecisionGrade
}

export interface HDChart {
  v: 1
  /** Name of the engine that produced this chart. */
  engine: string
  /** Personality and Design activations per body. */
  planets: Record<PlanetKey, { p: Activation; d: Activation }>
  /** How far down the sub-line stack this chart can actually be trusted. */
  precision: ChartPrecision
  /** Non-fatal problems with the birth input, e.g. a daylight-saving ambiguity. */
  warnings: string[]
}

export type CalculatorErrorCode =
  | 'date_out_of_range'
  | 'time_invalid'
  | 'computation_failed'

export class CalculatorError extends Error {
  constructor(
    public readonly code: CalculatorErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`CalculatorError: ${message}`)
    this.name = 'CalculatorError'
  }
}

function validateInput(input: CalculateChartInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new CalculatorError('time_invalid', `malformed date: ${input.date}`)
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.time)) {
    throw new CalculatorError('time_invalid', `malformed time: ${input.time}`)
  }
  const year = Number(input.date.slice(0, 4))
  if (year < 1800 || year > 2200) {
    throw new CalculatorError('date_out_of_range', `year ${year} out of supported range`)
  }
  const [hh = 0, mm = 0, ss = 0] = input.time.split(':').map(Number)
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) {
    throw new CalculatorError('time_invalid', `out-of-range time: ${input.time}`)
  }
}

/**
 * How far down the sub-line stack this chart can be trusted.
 *
 * Two independent limits apply, and the weaker one wins:
 *
 * - **The birth time.** A base slice is 18.75 arc-seconds. One minute of clock
 *   uncertainty is about 33 arc-seconds of Moon motion, roughly 1.8 base
 *   slices. So base is an estimate at minute precision no matter how good the
 *   ephemeris is. No engine fixes this.
 * - **The engine.** An engine whose worst body sits outside a base slice cannot
 *   resolve base even given a perfect birth time. `baseCapable` records that.
 *
 * Gate, line and color are never in question: they are 20250, 3375 and 562.5
 * arc-seconds wide, far beyond any error either engine has.
 */
function gradePrecision(timeHasSeconds: boolean, engine: EphemerisEngine): ChartPrecision {
  return {
    gate: 'reliable',
    line: 'reliable',
    color: 'reliable',
    tone: engine.baseCapable || timeHasSeconds ? 'reliable' : 'estimate',
    base: engine.baseCapable && timeHasSeconds ? 'reliable' : 'estimate',
  }
}

/**
 * Compute a full Human Design chart from a birth moment.
 *
 * The Design side is the moment the Sun was 88° of arc behind its birth
 * position, roughly 88 days earlier, found by bisection on the engine's Sun.
 */
export function calculateChart(
  input: CalculateChartInput,
  opts: CalculateChartOptions = {},
): HDChart {
  validateInput(input)

  const engine = opts.engine ?? createAstronomyEngine()

  let moment: ReturnType<typeof resolveBirthMoment>
  let designJD: number
  let personalityLons: ReturnType<EphemerisEngine['bodyLongitudes']>
  let designLons: ReturnType<EphemerisEngine['bodyLongitudes']>

  try {
    moment = resolveBirthMoment({
      lat: input.lat, lon: input.lon, date: input.date, time: input.time, tz: input.tz,
    })
    designJD = findDesignJD(moment.julianDay, jd => engine.sunLongitude(jd))
    personalityLons = engine.bodyLongitudes(moment.julianDay)
    designLons = engine.bodyLongitudes(designJD)
  } catch (e) {
    if (e instanceof CalculatorError) throw e
    if (e instanceof TzError) throw new CalculatorError('computation_failed', e.message, e)
    throw new CalculatorError('computation_failed', (e as Error).message, e)
  }

  const planets = {} as HDChart['planets']
  for (const k of PLANET_KEYS) {
    planets[k] = {
      p: longitudeToActivation(personalityLons[k]),
      d: longitudeToActivation(designLons[k]),
    }
  }

  return {
    v: 1,
    engine: engine.name,
    planets,
    precision: gradePrecision(input.time.split(':').length === 3, engine),
    warnings: moment.warnings,
  }
}
