import { describe, it, expect } from 'vitest'
import { resolveBirthMoment, TzError } from '../src/birth-moment'

describe('resolveBirthMoment', () => {
  it('resolves a summer Boise birth as MDT', () => {
    const r = resolveBirthMoment({
      lat: 43.615, lon: -116.202, date: '1988-07-15', time: '14:30', tz: 'America/Boise',
    })
    expect(r.tzName).toBe('America/Boise')
    expect(r.utcOffsetHours).toBe(-6)
    expect(r.utcDateTime).toBe('1988-07-15T20:30:00.000Z')
  })

  it('resolves a winter Boise birth as MST', () => {
    const r = resolveBirthMoment({
      lat: 43.615, lon: -116.202, date: '1988-12-15', time: '14:30', tz: 'America/Boise',
    })
    expect(r.utcOffsetHours).toBe(-7)
    expect(r.utcDateTime).toBe('1988-12-15T21:30:00.000Z')
  })

  it('handles southern-hemisphere DST (Hobart in austral summer)', () => {
    const r = resolveBirthMoment({
      lat: -42.882, lon: 147.327, date: '1978-12-22', time: '03:15', tz: 'Australia/Hobart',
    })
    expect(r.utcOffsetHours).toBe(11)
  })

  it('throws TzError when tz is omitted by a JS caller', () => {
    expect(() => resolveBirthMoment({
      lat: 0, lon: 0, date: '2000-01-01', time: '00:00',
    } as any)).toThrow(TzError)
  })

  it('accepts an injected zone without geocoding', () => {
    const r = resolveBirthMoment({
      lat: 0, lon: 0, date: '1990-03-05', time: '06:47', tz: 'America/Los_Angeles',
    })
    expect(r.tzName).toBe('America/Los_Angeles')
    expect(r.utcOffsetHours).toBe(-8)
    expect(r.warnings).toEqual([])
  })

  it('produces a Julian Day matching the UTC moment', () => {
    const r = resolveBirthMoment({
      lat: 43.615, lon: -116.202, date: '2000-01-01', time: '12:00', tz: 'America/Boise',
    })
    expect(r.julianDay).toBeCloseTo(2451545.29167, 4)
  })

  it('accepts seconds in the time and carries them into the moment', () => {
    const r = resolveBirthMoment({
      lat: 0, lon: 0, date: '2000-01-01', time: '12:00:30', tz: 'UTC',
    })
    expect(r.utcDateTime).toBe('2000-01-01T12:00:30.000Z')
  })

  // US DST rules changed in 2007. The same calendar day resolves differently
  // before and after, which is exactly the kind of thing a naive fixed-offset
  // implementation gets wrong.
  it('applies pre-2007 US DST rules (April 1 2005 is still standard time)', () => {
    const r = resolveBirthMoment({
      lat: 34.05, lon: -118.24, date: '2005-04-01', time: '12:00', tz: 'America/Los_Angeles',
    })
    expect(r.utcOffsetHours).toBe(-8)
  })

  it('applies post-2007 US DST rules (April 1 2010 is daylight time)', () => {
    const r = resolveBirthMoment({
      lat: 34.05, lon: -118.24, date: '2010-04-01', time: '12:00', tz: 'America/Los_Angeles',
    })
    expect(r.utcOffsetHours).toBe(-7)
  })

  it('rejects an unknown IANA zone', () => {
    expect(() => resolveBirthMoment({
      lat: 0, lon: 0, date: '2000-01-01', time: '12:00', tz: 'Mars/Olympus_Mons',
    })).toThrow(TzError)
  })

  // Luxon resolves both DST edge cases silently. A silently wrong birth moment
  // is a silently wrong chart, so both must surface as warnings.
  it('warns on a time inside a spring-forward gap', () => {
    // 2010-03-14 02:30 never happened in Los Angeles; the clock jumped 02:00 to 03:00.
    const r = resolveBirthMoment({
      lat: 34.05, lon: -118.24, date: '2010-03-14', time: '02:30', tz: 'America/Los_Angeles',
    })
    expect(r.warnings.join(' ')).toMatch(/does not exist/i)
    expect(r.utcDateTime).toBe('2010-03-14T10:30:00.000Z') // shifted to 03:30 PDT
  })

  it('warns on a time inside a fall-back ambiguity', () => {
    // 2010-11-07 01:30 happened twice in Los Angeles, once PDT and once PST.
    const r = resolveBirthMoment({
      lat: 34.05, lon: -118.24, date: '2010-11-07', time: '01:30', tz: 'America/Los_Angeles',
    })
    expect(r.warnings.join(' ')).toMatch(/occurred twice/i)
    expect(r.utcOffsetHours).toBe(-7) // the first (daylight) occurrence
  })

  it('does not warn on an unambiguous time', () => {
    const r = resolveBirthMoment({
      lat: 34.05, lon: -118.24, date: '2010-06-01', time: '01:30', tz: 'America/Los_Angeles',
    })
    expect(r.warnings).toEqual([])
  })
})
