import {
  WHEEL_START, GATE_WIDTH, LINE_WIDTH, COLOR_WIDTH, TONE_WIDTH, BASE_WIDTH,
  GATES_BY_WHEEL_INDEX,
} from './wheel'
import { signedAngularDiff } from './ephemeris/types'

export { signedAngularDiff }

export type Activation = {
  /** Gate, 1-64. */
  g: number
  /** Line, 1-6. */
  l: number
  /** Color, 1-6. */
  c: number
  /** Tone, 1-6. */
  t: number
  /** Base, 1-5. */
  b: number
}

/**
 * Convert a tropical ecliptic longitude (degrees) to a full HD activation with
 * sub-line resolution.
 *
 * Each level is a plain nested division of the one above, so the whole thing is
 * arithmetic on the offset from the wheel start. The only irregularity is that
 * base divides into 5 rather than 6.
 */
export function longitudeToActivation(lonDeg: number): Activation {
  const lon = ((lonDeg % 360) + 360) % 360
  const offset = (lon - WHEEL_START + 360) % 360

  const wheelIndex = Math.floor(offset / GATE_WIDTH)
  const g = GATES_BY_WHEEL_INDEX[wheelIndex]
  if (g === undefined) {
    throw new RangeError(`wheel index ${wheelIndex} out of range for longitude ${lonDeg}`)
  }

  const lineOffset = offset - wheelIndex * GATE_WIDTH
  const l = Math.floor(lineOffset / LINE_WIDTH) + 1

  const colorOffset = lineOffset - (l - 1) * LINE_WIDTH
  const c = Math.floor(colorOffset / COLOR_WIDTH) + 1

  const toneOffset = colorOffset - (c - 1) * COLOR_WIDTH
  const t = Math.floor(toneOffset / TONE_WIDTH) + 1

  const baseOffset = toneOffset - (t - 1) * TONE_WIDTH
  const b = Math.min(5, Math.floor(baseOffset / BASE_WIDTH) + 1)

  return { g, l, c, t, b }
}

/**
 * Find the Julian Day at which the Sun's ecliptic longitude is 88° behind the
 * Personality Sun. That moment is the HD design crystal, roughly 88 days before
 * birth.
 *
 * Bisection over [JD - 100, JD - 80]. Terminates at under 1e-5° of residual,
 * which is about 0.04 arc-seconds, with a 50-iteration cap.
 *
 * @param personalityJD Julian Day of birth (UT).
 * @param sunLongitude  Sun's ecliptic longitude in degrees at a given JD.
 * @throws {Error} if the residual after 50 iterations exceeds 1e-3°, which means
 *                 the supplied sunLongitude is not monotonic over the window.
 */
export function findDesignJD(
  personalityJD: number,
  sunLongitude: (jd: number) => number,
): number {
  const pSunLon = sunLongitude(personalityJD)
  const targetLon = (((pSunLon - 88) % 360) + 360) % 360

  let lo = personalityJD - 100
  let hi = personalityJD - 80
  let mid = lo
  let lastDiff = Infinity

  for (let i = 0; i < 50; i++) {
    mid = (lo + hi) / 2
    lastDiff = signedAngularDiff(sunLongitude(mid), targetLon)
    if (Math.abs(lastDiff) < 1e-5) return mid
    if (lastDiff > 0) hi = mid
    else lo = mid
  }
  if (Math.abs(lastDiff) > 1e-3) {
    throw new Error(
      `findDesignJD: failed to converge within 50 iterations `
      + `(residual ${lastDiff.toFixed(4)}°). The sunLongitude function may be `
      + `non-monotonic over [JD-100, JD-80].`,
    )
  }
  return mid
}
