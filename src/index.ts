/**
 * hd-chart-engine — MIT entry point.
 *
 * Everything reachable from here is MIT licensed. The higher-accuracy Moshier
 * engine lives behind the `hd-chart-engine/moshier` sub-path because it links
 * GPL-3.0 code; it is deliberately not re-exported here. See NOTICE.md.
 */
export { calculateChart, CalculatorError } from './calculator'
export type {
  CalculateChartInput, CalculateChartOptions, CalculatorErrorCode,
  PrecisionGrade, ChartPrecision, HDChart,
} from './calculator'

export { longitudeToActivation, findDesignJD, signedAngularDiff } from './activation'
export type { Activation } from './activation'

export { resolveBirthMoment, TzError } from './birth-moment'
export type { BirthInput, BirthMoment } from './birth-moment'

export { createAstronomyEngine } from './ephemeris/astronomy'
export { PLANET_KEYS, norm360 } from './ephemeris/types'
export type { EphemerisEngine, PlanetKey, BodyLongitudes, Convention } from './ephemeris/types'

export {
  WHEEL_START, GATE_WIDTH, LINE_WIDTH, COLOR_WIDTH, TONE_WIDTH, BASE_WIDTH,
  GATES_BY_WHEEL_INDEX,
} from './wheel'
