import { describe, it, expect } from 'vitest'
import {
  WHEEL_START, GATE_WIDTH, LINE_WIDTH, COLOR_WIDTH, TONE_WIDTH, BASE_WIDTH,
  GATES_BY_WHEEL_INDEX,
} from '../src/wheel'

describe('wheel constants', () => {
  it("starts at 13°15' Scorpio", () => {
    expect(WHEEL_START).toBe(223.25)
  })

  it('divides the circle into 64 gates of 5.625°', () => {
    expect(GATE_WIDTH).toBe(5.625)
    expect(GATE_WIDTH * 64).toBeCloseTo(360, 10)
  })

  it('divides each gate into 6 lines', () => {
    expect(LINE_WIDTH).toBe(0.9375)
    expect(LINE_WIDTH * 6).toBeCloseTo(GATE_WIDTH, 10)
  })

  it('nests color, tone and base at 6, 6 and 5 per level', () => {
    expect(COLOR_WIDTH * 6).toBeCloseTo(LINE_WIDTH, 12)
    expect(TONE_WIDTH * 6).toBeCloseTo(COLOR_WIDTH, 12)
    expect(BASE_WIDTH * 5).toBeCloseTo(TONE_WIDTH, 12)
  })

  it('puts a base slice at 18.75 arc-seconds', () => {
    // The figure the README quotes for scale against ephemeris error.
    expect(BASE_WIDTH * 3600).toBeCloseTo(18.75, 6)
  })
})

describe('gate order', () => {
  it('has 64 entries', () => {
    expect(GATES_BY_WHEEL_INDEX).toHaveLength(64)
  })

  it('contains each gate 1..64 exactly once', () => {
    expect([...GATES_BY_WHEEL_INDEX].sort((a, b) => a - b))
      .toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  it('opens the wheel at gate 1, then 43, then 14', () => {
    expect(GATES_BY_WHEEL_INDEX.slice(0, 3)).toEqual([1, 43, 14])
  })
})
