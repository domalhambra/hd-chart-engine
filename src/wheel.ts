/**
 * The Human Design wheel: 64 gates mapped onto the tropical zodiac.
 *
 * The wheel opens at 13°15'00" Scorpio (223.25° tropical) with gate 1 and runs
 * prograde in equal 5.625° gates. Each gate divides into 6 lines, each line
 * into 6 colors, each color into 6 tones, and each tone into 5 bases.
 *
 * Slice sizes in arc-seconds, which is the unit ephemeris error is measured in:
 *
 *   gate   20250"    line   3375"    color  562.5"
 *   tone      93.75"  base     18.75"
 *
 * That bottom figure is why base is the hardest field to get right. An engine
 * has to be accurate to well under 18.75" for base to mean anything, and so
 * does the birth time: one minute of clock uncertainty moves the Moon about
 * 33", or 1.8 base slices.
 *
 * Gate order is fixed by the system and is not the numeric sequence. Transcribed
 * from the Badwater HD encyclopedia's wheel index and verified against each
 * gate's recorded starting longitude.
 */

export const WHEEL_START = 223.25
export const GATE_WIDTH = 5.625
export const LINE_WIDTH = GATE_WIDTH / 6 // 0.9375
export const COLOR_WIDTH = LINE_WIDTH / 6 // 0.15625
export const TONE_WIDTH = COLOR_WIDTH / 6 // 0.0260416…
export const BASE_WIDTH = TONE_WIDTH / 5 // 0.0052083…

/** Gate numbers indexed by wheel position (0-based, so index 0 is gate 1). */
export const GATES_BY_WHEEL_INDEX: readonly number[] = [
   1, 43, 14, 34,  9,  5, 26, 11,
  10, 58, 38, 54, 61, 60, 41, 19,
  13, 49, 30, 55, 37, 63, 22, 36,
  25, 17, 21, 51, 42,  3, 27, 24,
   2, 23,  8, 20, 16, 35, 45, 12,
  15, 52, 39, 53, 62, 56, 31, 33,
   7,  4, 29, 59, 40, 64, 47,  6,
  46, 18, 48, 57, 32, 50, 28, 44,
]
