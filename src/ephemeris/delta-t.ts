/**
 * ΔT (TT − UT) in seconds, via the Espenak–Meeus polynomial expressions
 * (NASA, public domain; https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html).
 *
 * Needed because the chart ephemeris computes positions at Terrestrial Time
 * (TT) while birth moments are Universal Time (UT): TT = UT + ΔT. The segments
 * below cover the calculator's supported 1800–2200 range.
 *
 * Accuracy is ~1 s or better across the modern era — far finer than any chart
 * subdivision (one second of ΔT moves the Moon ~0.5″, well under a base slice
 * of 18.75″).
 */

/** Decimal year for the ΔT polynomials: year + (month − 0.5) / 12. */
export function decimalYear(jdUT: number): number {
  const d = new Date((jdUT - 2440587.5) * 86400000)
  return d.getUTCFullYear() + (d.getUTCMonth() + 0.5) / 12
}

/** ΔT = TT − UT, in seconds, for a Julian Day (UT). */
export function deltaTSeconds(jdUT: number): number {
  const y = decimalYear(jdUT)
  let t: number

  if (y < 1860) {
    t = y - 1800
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3
      - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6
      + 0.000000000875 * t ** 7
  }
  if (y < 1900) {
    t = y - 1860
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174
  }
  if (y < 1920) {
    t = y - 1900
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3
      - 0.000197 * t ** 4
  }
  if (y < 1941) {
    t = y - 1920
    return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3
  }
  if (y < 1961) {
    t = y - 1950
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547
  }
  if (y < 1986) {
    t = y - 1975
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718
  }
  if (y < 2005) {
    t = y - 2000
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3
      + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
  }
  if (y < 2050) {
    t = y - 2000
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2
  }
  if (y < 2150) {
    return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y)
  }
  // y >= 2150 (calculator caps at 2200)
  const u = (y - 1820) / 100
  return -20 + 32 * u ** 2
}
