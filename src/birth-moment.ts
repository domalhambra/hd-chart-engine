import { DateTime } from 'luxon'

export class TzError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TzError'
  }
}

export interface BirthInput {
  lat: number
  lon: number
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Local 24-hour time, HH:mm or HH:mm:ss. */
  time: string
  /**
   * IANA zone, e.g. 'America/Los_Angeles'. Required.
   *
   * Resolving a lat/lon to a zone is the caller's job. Keeping that lookup out
   * of this package means no geo-tz dependency and no multi-megabyte timezone
   * shapefile in a browser bundle.
   */
  tz: string
}

export interface BirthMoment {
  tzName: string
  /** ISO 8601 in UTC. */
  utcDateTime: string
  /** Signed hours, e.g. -8 or +11. */
  utcOffsetHours: number
  /** Julian Day in Universal Time. */
  julianDay: number
  /** Non-fatal problems with the input worth surfacing to a user. */
  warnings: string[]
}

/**
 * Resolve a local birth date and time to a UTC moment and Julian Day, using
 * luxon's historical DST rules.
 *
 * Two edge cases get explicit handling, because luxon resolves both silently
 * and a silently wrong birth moment is a silently wrong chart:
 *
 * 1. **Spring-forward gaps.** A local time inside the skipped hour never
 *    happened. Luxon shifts it forward an hour and reports the result as valid.
 *    We detect the shift and warn.
 * 2. **Fall-back ambiguity.** A local time inside the repeated hour happened
 *    twice. Luxon picks the first (daylight) occurrence. We detect it and warn,
 *    because the two readings are an hour apart, which moves the Moon about
 *    33 arc-minutes and can change gate and line.
 */
export function resolveBirthMoment(input: BirthInput): BirthMoment {
  const { date, time, tz: tzName } = input
  const warnings: string[] = []

  if (!tzName) {
    throw new TzError('input.tz is required; pass an IANA zone resolved by the caller')
  }
  if (!DateTime.local().setZone(tzName).isValid) {
    throw new TzError(`unknown IANA zone: ${tzName}`)
  }

  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss = 0] = time.split(':').map(Number)
  if (y === undefined || m === undefined || d === undefined || hh === undefined || mm === undefined) {
    throw new TzError(`unparseable local datetime ${date}T${time}`)
  }

  const local = DateTime.fromObject(
    { year: y, month: m, day: d, hour: hh, minute: mm, second: ss },
    { zone: tzName },
  )

  if (!local.isValid) {
    throw new TzError(
      `unparseable local datetime ${date}T${time} in ${tzName}: ${local.invalidReason}`,
    )
  }

  // Gap: luxon moved the clock forward, so the requested wall time never existed.
  if (local.hour !== hh || local.minute !== mm) {
    warnings.push(
      `local time ${time} does not exist in ${tzName} on ${date} (daylight-saving gap); `
      + `resolved to ${local.toFormat('HH:mm')}`,
    )
  }

  // Ambiguity: if the instant an hour later shows the same wall time under a
  // different offset, this wall time occurred twice. Luxon returned the first.
  const oneHourLater = DateTime.fromMillis(local.toMillis() + 3600_000).setZone(tzName)
  if (
    oneHourLater.offset !== local.offset
    && oneHourLater.hour === local.hour
    && oneHourLater.minute === local.minute
  ) {
    warnings.push(
      `local time ${time} occurred twice in ${tzName} on ${date} (daylight-saving fall-back); `
      + `resolved to the first (daylight) occurrence`,
    )
  }

  const utc = local.toUTC()

  return {
    tzName,
    utcDateTime: utc.toISO()!,
    utcOffsetHours: local.offset / 60,
    // Julian Day (UT) from the Unix epoch, which is JD 2440587.5.
    julianDay: utc.toMillis() / 86400000 + 2440587.5,
    warnings,
  }
}
