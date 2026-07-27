# HD Chart Engine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Human Design chart calculator out of `Badwater HD` into a standalone, MIT-licensed `hd-chart-engine` package that produces correct gate, line, color, tone, and base activations without any Swiss Ephemeris dependency.

**Architecture:** One repo, two layers. An **ephemeris layer** behind a small `EphemerisEngine` interface with two implementations: an MIT default built on `astronomy-engine`, and an opt-in sub-path export built on the patched Moshier `ephemeris` package (GPL-3.0). An **HD layer** on top: wheel slicing to base resolution, the 88-degree design-arc solve, and DST-aware birth-moment resolution. The GPL code is reachable only through the `hd-chart-engine/moshier` sub-path, so a bundler never pulls it into an MIT consumer's build.

**Tech Stack:** TypeScript (ESM, `NodeNext`), vitest, tsup for build, `astronomy-engine` (MIT dependency), `ephemeris` (GPL-3.0 optional peer dependency), `luxon`. Validation harness in Python via `pyswisseph`.

**Source of truth:** `PROJECT_CHARTER.md` in this folder. All ported code lives in `Projects/Badwater OS/Badwater HD/` and is referenced below by its path there, abbreviated `$HD`.

**Scope:** This plan covers building and validating the standalone package. Migrating `design.badwater.guide` onto it and publishing to npm is a **second plan**, written after this one is green. Do not touch the Badwater HD repo during this plan.

---

## File Structure

```
Badwater HD Chart Engine/
  package.json                  # MIT, exports "." and "./moshier"
  tsconfig.json
  vitest.config.ts
  LICENSE                       # MIT
  NOTICE.md                     # third-party licensing, incl. the GPL sub-path
  README.md                     # accuracy tables, honest limits
  src/
    index.ts                    # public API (MIT surface)
    wheel.ts                    # 64-gate wheel order + slice constants
    activation.ts               # longitudeToActivation, signedAngularDiff, findDesignJD
    birth-moment.ts             # resolveBirthMoment, TzError
    calculator.ts               # calculateChart, CalculatorError
    ephemeris/
      types.ts                  # EphemerisEngine, PlanetKey, BodyLongitudes, Convention
      delta-t.ts                # Espenak-Meeus ΔT
      astronomy.ts              # MIT default engine
      moshier.ts                # GPL-3.0 opt-in engine
      moshier-entry.ts          # the "./moshier" export barrel
  tests/
    wheel.test.ts
    activation.test.ts
    birth-moment.test.ts
    calculator.test.ts
    delta-t.test.ts
    ephemeris-moshier.test.ts
    ephemeris-astronomy.test.ts
    engine-parity.test.ts       # the load-bearing one
    fixtures/
      synthetic-charts.json     # 30 charts, from $HD/tests/fixtures/
  scripts/
    validate-chart.py           # pyswisseph Moshier-mode validator
    dev-node-eval.py            # DE431 oracle
    dev-node-methods.ts
    dev-convention-compare.ts
  docs/
    ephemeris-ground-truth.md   # from $HD/docs/reference/
    chart-validation-report.md  # from $HD/docs/reference/
```

**Responsibility boundaries.** `wheel.ts` holds data only, no logic. `activation.ts` is pure math with zero ephemeris knowledge, which is why it can be tested without any engine. `ephemeris/types.ts` is the seam: everything above it is engine-agnostic. `moshier.ts` must never be imported from `index.ts` or anything it reaches, or the GPL code lands in the MIT bundle. That constraint is enforced by a test in Task 9.

---

## Task 1: Repo scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `NOTICE.md`

- [ ] **Step 1: Initialise the repo**

```bash
cd "/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD Chart Engine"
git init
```

- [ ] **Step 2: Write `package.json`**

The `exports` map is the licensing boundary. `ephemeris` is an **optional peer dependency**, so `npm install hd-chart-engine` does not pull GPL code.

```json
{
  "name": "hd-chart-engine",
  "version": "0.1.0",
  "description": "Human Design chart engine. Gate, line, color, tone and base activations from a birth moment, with no Swiss Ephemeris dependency.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE", "NOTICE.md"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./moshier": { "types": "./dist/moshier-entry.d.ts", "import": "./dist/moshier-entry.js" }
  },
  "scripts": {
    "build": "tsup src/index.ts src/ephemeris/moshier-entry.ts --format esm --dts --clean",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "astronomy-engine": "^2.1.19",
    "luxon": "^3.7.2"
  },
  "peerDependencies": { "ephemeris": "^2.2.0" },
  "peerDependenciesMeta": { "ephemeris": { "optional": true } },
  "devDependencies": {
    "@types/luxon": "^3.4.2",
    "@types/node": "^22.10.0",
    "ephemeris": "^2.2.0",
    "tsup": "^8.3.5",
    "typescript": "^5.9.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
*.se1
.DS_Store
```

- [ ] **Step 6: Add the MIT `LICENSE`** (standard MIT text, copyright "2026 Dom Alhambra").

- [ ] **Step 7: Write `NOTICE.md`**

This file is the honest account of the licensing split. It must state: the package is MIT; `astronomy-engine` is MIT; `luxon` is MIT; the `ephemeris` package reachable via the `hd-chart-engine/moshier` sub-path is **GPL-3.0**, and importing that sub-path subjects the importing work to GPL-3.0 terms; ΔT polynomials are Espenak-Meeus (NASA, public domain); Swiss Ephemeris is used only as a **test oracle** and is not distributed or linked.

- [ ] **Step 8: Install and verify the toolchain**

```bash
npm install
npx tsc --noEmit
```

Expected: install succeeds, `tsc` exits 0 with no files to check yet.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold hd-chart-engine (MIT, dual-export licensing boundary)"
```

---

## Task 2: Wheel data (cut the `synthesis-index.json` coupling)

`$HD/src/lib/chart-math.ts:1` imports wheel constants from `docs/reference/synthesis-index.json`, which is encyclopedia reference data. The package needs its own copy of just the two things it uses: the slice constants and the gate order by wheel position.

**Files:**
- Create: `src/wheel.ts`
- Test: `tests/wheel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { WHEEL_START, GATE_WIDTH, LINE_WIDTH, GATES_BY_WHEEL_INDEX } from '../src/wheel'

describe('wheel constants', () => {
  it('starts at 13°15\' Scorpio', () => {
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/wheel.test.ts`
Expected: FAIL, cannot resolve `../src/wheel`.

- [ ] **Step 3: Generate `src/wheel.ts` from the encyclopedia's data**

Do not hand-type 64 numbers. Generate the literal once, then commit it as a plain module:

```bash
node -e "
const w = require('/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD/docs/reference/synthesis-index.json');
const order = w.gates.slice().sort((a,b) => a.wheelPosition - b.wheelPosition).map(g => g.gate);
console.log(JSON.stringify(order));
"
```

Paste the result into the array below.

```ts
/**
 * The Human Design wheel: 64 gates mapped onto the tropical zodiac.
 *
 * The wheel begins at 13°15'00\" Scorpio (223.25° tropical) with gate 1, and
 * runs prograde in 5.625° gates. Each gate divides into 6 lines, each line into
 * 6 colors, each color into 6 tones, each tone into 5 bases.
 *
 * Gate order is fixed by the system and is not the numeric sequence. Sourced
 * from the Badwater HD encyclopedia's wheel index.
 */

export const WHEEL_START = 223.25
export const GATE_WIDTH = 5.625
export const LINE_WIDTH = GATE_WIDTH / 6      // 0.9375
export const COLOR_WIDTH = LINE_WIDTH / 6     // 0.15625
export const TONE_WIDTH = COLOR_WIDTH / 6     // 0.0260416…
export const BASE_WIDTH = TONE_WIDTH / 5      // 0.0052083…

/** Gate numbers indexed by wheel position (0-based). */
export const GATES_BY_WHEEL_INDEX: readonly number[] = [
  /* paste the generated array here */
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/wheel.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/wheel.ts tests/wheel.test.ts
git commit -m "feat: add self-contained wheel data, decoupled from encyclopedia reference JSON"
```

---

## Task 3: ΔT

Straight port. `$HD/src/lib/delta-t.ts` has no dependencies and needs no changes.

**Files:**
- Create: `src/ephemeris/delta-t.ts` (copy of `$HD/src/lib/delta-t.ts`)
- Test: `tests/delta-t.test.ts`

- [ ] **Step 1: Write the failing test**

The values below are the Espenak-Meeus published figures for their eras. They pin the polynomial segments and, critically, catch a discontinuity introduced by a bad edit at a segment boundary.

```ts
import { describe, it, expect } from 'vitest'
import { deltaTSeconds, decimalYear } from '../src/ephemeris/delta-t'

const jdOf = (iso: string) => new Date(iso).getTime() / 86400000 + 2440587.5

describe('decimalYear', () => {
  it('maps mid-January 2000 to 2000.04', () => {
    expect(decimalYear(jdOf('2000-01-15T00:00:00Z'))).toBeCloseTo(2000 + 0.5 / 12, 6)
  })
})

describe('deltaTSeconds', () => {
  it.each([
    ['1900-07-01T00:00:00Z', -2.8, 2],
    ['1950-07-01T00:00:00Z', 29.1, 2],
    ['1990-07-01T00:00:00Z', 56.9, 2],
    ['2000-07-01T00:00:00Z', 63.9, 1],
    ['2020-07-01T00:00:00Z', 71.6, 2],
  ])('is within tolerance at %s', (iso, expected, tol) => {
    expect(deltaTSeconds(jdOf(iso))).toBeCloseTo(expected, 0)
    expect(Math.abs(deltaTSeconds(jdOf(iso)) - expected)).toBeLessThan(tol)
  })

  it('is continuous across every segment boundary', () => {
    for (const year of [1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050, 2150]) {
      const before = deltaTSeconds(jdOf(`${year - 1}-12-31T00:00:00Z`))
      const after = deltaTSeconds(jdOf(`${year}-01-31T00:00:00Z`))
      expect(Math.abs(after - before), `discontinuity at ${year}`).toBeLessThan(3)
    }
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/delta-t.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Copy the source**

```bash
cp "/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD/src/lib/delta-t.ts" src/ephemeris/delta-t.ts
```

No edits needed. It imports nothing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/delta-t.test.ts`
Expected: PASS.

If the continuity test fails at a boundary, **do not widen the tolerance.** Espenak-Meeus segments genuinely meet within a second or two; a real discontinuity means a transcription error in a polynomial coefficient.

- [ ] **Step 5: Commit**

```bash
git add src/ephemeris/delta-t.ts tests/delta-t.test.ts
git commit -m "feat: port Espenak-Meeus ΔT with segment-continuity tests"
```

---

## Task 4: Engine interface

The seam that makes the dual-licensing model work. No implementation yet, types only.

**Files:**
- Create: `src/ephemeris/types.ts`

- [ ] **Step 1: Write the interface**

```ts
/**
 * The seam between the HD layer and whichever ephemeris computes positions.
 *
 * Two implementations ship: `astronomy.ts` (MIT, the default) and `moshier.ts`
 * (GPL-3.0, opt-in via the `hd-chart-engine/moshier` sub-path). Nothing above
 * this file may import a concrete engine directly.
 */

export const PLANET_KEYS = [
  'sun', 'earth', 'moon', 'north_node', 'south_node',
  'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
] as const

export type PlanetKey = (typeof PLANET_KEYS)[number]
export type BodyLongitudes = Record<PlanetKey, number>

/**
 * Which longitude convention to return.
 *
 * Human Design uses APPARENT positions (aberration + nutation). This was
 * settled empirically on 2026-06-21 against a Jovian Archive chart at base
 * resolution: for Pensacola 1993-10-18 01:30 the two conventions agree on
 * gate·line·color·tone but split on base, and Jovian reports the apparent
 * value. See docs/ephemeris-ground-truth.md.
 *
 * 'geometric' exists only for the comparison harness. Do not ship it.
 */
export type Convention = 'geometric' | 'apparent'

export interface EphemerisEngine {
  /** Short identifier, e.g. 'astronomy-engine' or 'moshier'. Used in errors and reports. */
  readonly name: string
  /** Apparent (by default) geocentric ecliptic-of-date longitudes, degrees [0, 360). */
  bodyLongitudes(jdUT: number, convention?: Convention): BodyLongitudes
  /** Sun longitude only. The design-arc search calls this ~50 times, so engines should keep it cheap. */
  sunLongitude(jdUT: number): number
}

export function norm360(d: number): number {
  return ((d % 360) + 360) % 360
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ephemeris/types.ts
git commit -m "feat: add EphemerisEngine interface as the licensing and accuracy seam"
```

---

## Task 5: Activation math

Port of `$HD/src/lib/chart-math.ts`, with the JSON import replaced by `wheel.ts` and the slice constants moved out.

**Files:**
- Create: `src/activation.ts`
- Test: `tests/activation.test.ts`
- Reference: `$HD/src/lib/chart-math.ts`, `$HD/tests/lib/chart-math.test.ts`

- [ ] **Step 1: Write the failing test**

Port the existing cases from `$HD/tests/lib/chart-math.test.ts`, then add these boundary cases, which are the ones that actually protect the slicing:

```ts
import { describe, it, expect } from 'vitest'
import { longitudeToActivation, signedAngularDiff, findDesignJD } from '../src/activation'
import { WHEEL_START, GATE_WIDTH, LINE_WIDTH } from '../src/wheel'

describe('longitudeToActivation', () => {
  it('puts the wheel start at gate 1 line 1 color 1 tone 1 base 1', () => {
    expect(longitudeToActivation(WHEEL_START)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  it('wraps: one full turn returns to the start', () => {
    expect(longitudeToActivation(WHEEL_START + 360)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  it('normalises negative longitudes', () => {
    expect(longitudeToActivation(WHEEL_START - 360)).toEqual({ g: 1, l: 1, c: 1, t: 1, b: 1 })
  })

  it('advances to line 2 exactly at the line boundary', () => {
    expect(longitudeToActivation(WHEEL_START + LINE_WIDTH).l).toBe(2)
  })

  it('advances to wheel position 2 (gate 43) exactly at the gate boundary', () => {
    expect(longitudeToActivation(WHEEL_START + GATE_WIDTH).g).toBe(43)
  })

  it('stays in range for every field across the whole circle', () => {
    for (let lon = 0; lon < 360; lon += 0.01) {
      const a = longitudeToActivation(lon)
      expect(a.g).toBeGreaterThanOrEqual(1); expect(a.g).toBeLessThanOrEqual(64)
      expect(a.l).toBeGreaterThanOrEqual(1); expect(a.l).toBeLessThanOrEqual(6)
      expect(a.c).toBeGreaterThanOrEqual(1); expect(a.c).toBeLessThanOrEqual(6)
      expect(a.t).toBeGreaterThanOrEqual(1); expect(a.t).toBeLessThanOrEqual(6)
      expect(a.b).toBeGreaterThanOrEqual(1); expect(a.b).toBeLessThanOrEqual(5)
    }
  })
})

describe('signedAngularDiff', () => {
  it('is 0 for identical angles', () => expect(signedAngularDiff(10, 10)).toBe(0))
  it('handles the wrap point', () => expect(signedAngularDiff(1, 359)).toBeCloseTo(2, 10))
  it('is negative when behind', () => expect(signedAngularDiff(359, 1)).toBeCloseTo(-2, 10))
})

describe('findDesignJD', () => {
  // A synthetic Sun moving at exactly 1°/day makes the expected answer exact:
  // 88° of arc is 88 days earlier.
  const linearSun = (jd: number) => ((jd % 360) + 360) % 360

  it('lands 88 days back for a 1°/day Sun', () => {
    const jd = 2451545.0
    expect(findDesignJD(jd, linearSun)).toBeCloseTo(jd - 88, 4)
  })

  it('throws when the Sun function is non-monotonic over the window', () => {
    expect(() => findDesignJD(2451545.0, () => 123)).toThrow(/converge/)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/activation.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/activation.ts`**

Copy `$HD/src/lib/chart-math.ts` and make exactly these changes:
1. Delete the `import wheel from '../../docs/reference/synthesis-index.json'` line and the three `export const` re-derivations from it.
2. Import from `./wheel` instead: `import { WHEEL_START, GATE_WIDTH, LINE_WIDTH, COLOR_WIDTH, TONE_WIDTH, BASE_WIDTH, GATES_BY_WHEEL_INDEX } from './wheel'`.
3. Delete the local `COLOR_WIDTH` / `TONE_WIDTH` / `BASE_WIDTH` consts and the `GATES_BY_WHEEL_INDEX` derivation, now supplied by `wheel.ts`.
4. Guard the gate lookup for `noUncheckedIndexedAccess`:

```ts
  const g = GATES_BY_WHEEL_INDEX[wheelIndex]
  if (g === undefined) throw new RangeError(`wheel index ${wheelIndex} out of range for longitude ${lonDeg}`)
```

Everything else, including `findDesignJD` and its bisection bounds and thresholds, is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/activation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/activation.ts tests/activation.test.ts
git commit -m "feat: port activation math onto self-contained wheel data"
```

---

## Task 6: Birth-moment resolution

Port of `$HD/src/lib/chart-tz.ts`. One behaviour change: the original throws if `tz` is missing but types it as required, and its DST fallback branch passes a `setZone` option that does nothing. Tidy both.

**Files:**
- Create: `src/birth-moment.ts`
- Test: `tests/birth-moment.test.ts`
- Reference: `$HD/src/lib/chart-tz.ts`, `$HD/tests/lib/chart-tz.test.ts`

- [ ] **Step 1: Write the failing test**

Port `$HD/tests/lib/chart-tz.test.ts` wholesale, then add:

```ts
it('resolves a historical pre-DST-reform date with the correct offset', () => {
  // US DST rules changed in 2007. April 1 2005 was still standard time.
  const m = resolveBirthMoment({
    lat: 34.05, lon: -118.24, date: '2005-04-01', time: '12:00', tz: 'America/Los_Angeles',
  })
  expect(m.utcOffsetHours).toBe(-8)
})

it('resolves the same calendar day in 2010 as daylight time', () => {
  const m = resolveBirthMoment({
    lat: 34.05, lon: -118.24, date: '2010-04-01', time: '12:00', tz: 'America/Los_Angeles',
  })
  expect(m.utcOffsetHours).toBe(-7)
})

it('rejects an invalid IANA zone', () => {
  expect(() => resolveBirthMoment({
    lat: 0, lon: 0, date: '2000-01-01', time: '12:00', tz: 'Mars/Olympus_Mons',
  })).toThrow(TzError)
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/birth-moment.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/birth-moment.ts`**

Copy `$HD/src/lib/chart-tz.ts` and make exactly these changes:
1. Keep `tz` required in `BirthInput`, and keep the runtime guard (JS callers exist).
2. Replace the dead `setZone` fallback with an explicit invalid-zone check up front, so a bad zone throws `TzError` rather than falling through:

```ts
  if (!DateTime.local().setZone(tzName).isValid) {
    throw new TzError(`unknown IANA zone: ${tzName}`)
  }
```

3. Keep the ambiguous-DST warning path. Luxon resolves ambiguous local times to the first (daylight) occurrence; record that in `warnings` rather than silently choosing.
4. Note in the docstring that geocoding is the caller's job. The package stays free of `geo-tz` so it works in a browser bundle.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/birth-moment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/birth-moment.ts tests/birth-moment.test.ts
git commit -m "feat: port birth-moment resolution with explicit invalid-zone handling"
```

---

## Task 7: Moshier engine (GPL sub-path)

Port of `$HD/src/lib/chart-ephemeris.ts` behind the `EphemerisEngine` interface. This is the accurate path and the one that already has a Swiss-pinned regression test.

**Files:**
- Create: `src/ephemeris/moshier.ts`, `src/ephemeris/moshier-entry.ts`, `src/types/ephemeris.d.ts`
- Test: `tests/ephemeris-moshier.test.ts`
- Reference: `$HD/src/lib/chart-ephemeris.ts`, `$HD/tests/lib/chart-ephemeris.test.ts`

- [ ] **Step 1: Write the failing test**

Port `$HD/tests/lib/chart-ephemeris.test.ts` verbatim, changing only the import to `createMoshierEngine` and calling `engine.bodyLongitudes(jd)`. **Keep the Swiss regression test and its 3-arc-second tolerance exactly as written.** That test is the reason this package can make an accuracy claim.

Add one test the original lacks, pinning the ΔT correction directly:

```ts
it('applies the ΔT time-base correction (without it the Moon is ~26″ off)', () => {
  // The `ephemeris` package treats its input instant as TT; birth data is UT.
  // Feeding it instant + ΔT is what collapses the Moon from 25.93″ mean error
  // to 0.27″. This asserts the corrected value, so removing the ΔT shift fails
  // here loudly rather than silently degrading base.
  const engine = createMoshierEngine()
  const moon = engine.bodyLongitudes(2447956.5).moon
  expect(Math.abs(moon - 99.65815) * 3600).toBeLessThan(3)
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/ephemeris-moshier.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Copy the ambient type declaration**

```bash
mkdir -p src/types
cp "/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD/src/types/ephemeris.d.ts" src/types/ephemeris.d.ts
```

Update the comment's file reference from `src/lib/chart-ephemeris.ts` to `src/ephemeris/moshier.ts`.

- [ ] **Step 4: Write `src/ephemeris/moshier.ts`**

Copy `$HD/src/lib/chart-ephemeris.ts` and make exactly these changes:
1. Import `PLANET_KEYS`, types and `norm360` from `./types`; delete the local copies.
2. Import `deltaTSeconds` from `./delta-t` (path unchanged in effect).
3. Wrap the exported functions in a factory that returns an `EphemerisEngine`:

```ts
export function createMoshierEngine(): EphemerisEngine {
  return {
    name: 'moshier',
    bodyLongitudes: (jdUT, convention = 'apparent') => computeBodyLongitudes(jdUT, convention),
    sunLongitude,
  }
}
```

4. Preserve every comment in that file. The ΔT rationale, the apparent-convention finding, and the node-derivation note are the documentation that keeps a future maintainer from "simplifying" a correction back out.
5. Add a file-header banner:

```ts
/**
 * GPL-3.0 BOUNDARY. This module imports the `ephemeris` package (GPL-3.0).
 * It is reachable ONLY via the `hd-chart-engine/moshier` sub-path export.
 * Never import it from src/index.ts or anything index.ts reaches.
 */
```

- [ ] **Step 5: Write `src/ephemeris/moshier-entry.ts`**

```ts
export { createMoshierEngine } from './moshier'
export type { EphemerisEngine, Convention, PlanetKey, BodyLongitudes } from './types'
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/ephemeris-moshier.test.ts`
Expected: PASS, including the < 3 arc-second Swiss regression.

If the Swiss test fails, **stop and investigate before touching the tolerance.** The most likely cause is upstream `ephemeris` fixing its own time base, which would make the `+ ΔT` compensation a double correction. See `docs/ephemeris-ground-truth.md`.

- [ ] **Step 7: Commit**

```bash
git add src/ephemeris/moshier.ts src/ephemeris/moshier-entry.ts src/types/ephemeris.d.ts tests/ephemeris-moshier.test.ts
git commit -m "feat: port patched-Moshier engine behind EphemerisEngine, Swiss-pinned"
```

---

## Task 8: astronomy-engine engine (MIT default)

**This is the one genuinely new piece of engineering in the plan, and the charter's named open risk.** The old Badwater HD code used astronomy-engine with *geometric* longitudes, which is now known to be the wrong convention: it put 2 of 104 fixture lines on the wrong side of a boundary. The MIT default must emit **apparent** positions.

`Ecliptic(GeoVector(body, date, true))` returns true-ecliptic-of-date coordinates with aberration applied, which is exactly the apparent convention. Nutation and precession are already in the ECT frame. astronomy-engine takes UTC directly and handles TT internally, so **no ΔT shift here** — that correction is specific to the `ephemeris` package's bug.

**Files:**
- Create: `src/ephemeris/astronomy.ts`
- Test: `tests/ephemeris-astronomy.test.ts`

- [ ] **Step 1: Write the failing test**

Tolerances differ from Moshier deliberately: astronomy-engine's real errors run 0.5″ (Sun) to about 22″ (Moon). The test asserts the published accuracy, so a regression is visible.

```ts
import { describe, it, expect } from 'vitest'
import { createAstronomyEngine } from '../src/ephemeris/astronomy'

const engine = createAstronomyEngine()

describe('astronomy engine', () => {
  it('returns a longitude for every planet key, in range', () => {
    const lons = engine.bodyLongitudes(2451545.0)
    for (const v of Object.values(lons)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(360)
    }
  })

  it('holds Earth opposite Sun and South Node opposite North Node', () => {
    const l = engine.bodyLongitudes(2451545.0)
    expect((l.earth - l.sun + 360) % 360).toBeCloseTo(180, 6)
    expect((l.south_node - l.north_node + 360) % 360).toBeCloseTo(180, 6)
  })

  it('derives True Node, not Mean Node, at J2000', () => {
    // True 123.953°, Mean 125.044°. ±0.05° excludes Mean.
    expect(engine.bodyLongitudes(2451545.0).north_node).toBeCloseTo(123.953, 1)
  })

  // The convention guard. These are full Swiss Ephemeris APPARENT longitudes,
  // the same reference moment the Moshier test uses. Geometric values sit ~20.5″
  // away, so a regression to geometric fails this test.
  it('emits APPARENT longitudes, within its published accuracy of Swiss', () => {
    const lons = engine.bodyLongitudes(2447956.5) // 1990-01-27 00:00 UT
    const swiss: Record<string, number> = {
      sun: 345.15348, moon: 99.65815, mercury: 333.90853,
      saturn: 292.56322, pluto: 227.72326,
    }
    const budget: Record<string, number> = {
      sun: 3, mercury: 8, saturn: 13, pluto: 5, moon: 25,
    }
    for (const [body, ref] of Object.entries(swiss)) {
      const arcsec = Math.abs(((lons[body as keyof typeof lons] - ref + 540) % 360) - 180) * 3600
      expect(arcsec, `${body} off by ${arcsec.toFixed(2)}″`).toBeLessThan(budget[body]!)
    }
  })

  it('is cheap on the Sun-only path', () => {
    expect(engine.sunLongitude(2451545.0)).toBeCloseTo(engine.bodyLongitudes(2451545.0).sun, 6)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/ephemeris-astronomy.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/ephemeris/astronomy.ts`**

```ts
/**
 * MIT default engine, built on astronomy-engine.
 *
 * Convention: APPARENT. `Ecliptic(GeoVector(body, date, true))` gives true
 * ecliptic of date (precession + nutation) with aberration applied, which is
 * the Human Design convention (see ./types.ts). The earlier Badwater HD code
 * ran this engine GEOMETRIC, which put 2 of 104 fixture lines on the wrong side
 * of a boundary. Do not pass `false` here.
 *
 * No ΔT shift: astronomy-engine takes UTC and converts to TT internally. The
 * `+ ΔT` correction in ./moshier.ts works around a bug specific to the
 * `ephemeris` package and must not be copied here.
 *
 * Accuracy vs full Swiss Ephemeris (DE431), 60 fixture moments: Sun 0.52″ mean
 * / 2.12″ max, Moon 12.61″ / 21.93″, node 4.10″ / 11.78″. Gate, line and color
 * are unaffected at these magnitudes. Tone can flip near a boundary; base
 * (18.75″ per slice) is NOT reliable on this engine. Use the moshier sub-path
 * if you need base.
 */
import { Body, GeoVector, Ecliptic, GeoMoonState, MakeTime } from 'astronomy-engine'
import { PLANET_KEYS, norm360 } from './types'
import type { EphemerisEngine, BodyLongitudes, Convention, PlanetKey } from './types'

const BODY_MAP: Record<string, Body> = {
  sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
  mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
  uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
}

/** astronomy-engine takes a Date; JD (UT) converts directly. */
function dateOf(jdUT: number): Date {
  return new Date((jdUT - 2440587.5) * 86400000)
}

function apparentLongitude(body: Body, date: Date): number {
  return norm360(Ecliptic(GeoVector(body, date, true)).elon)
}

/**
 * True lunar node from the Moon's angular momentum, L = r × v, rotated into the
 * ecliptic of date. Verified against Swiss TRUE_NODE at ~4″ mean, which is
 * better than this engine's own Moon longitude: a Moon error is largely
 * along-track and barely tips the orbital plane that fixes the node.
 */
function trueNodeLongitude(date: Date): number {
  const st = GeoMoonState(date)
  const rot = Ecliptic({ x: st.x, y: st.y, z: st.z, t: st.t } as any)
  const vel = Ecliptic({ x: st.vx, y: st.vy, z: st.vz, t: st.t } as any)
  // Cross product of ecliptic position × velocity gives the orbit normal.
  const r = sphericalToVec(rot.elat, rot.elon, 1)
  const v = sphericalToVec(vel.elat, vel.elon, 1)
  const nx = r[1] * v[2] - r[2] * v[1]
  const ny = r[2] * v[0] - r[0] * v[2]
  return norm360((Math.atan2(nx, -ny) * 180) / Math.PI)
}

function sphericalToVec(latDeg: number, lonDeg: number, r: number): [number, number, number] {
  const la = (latDeg * Math.PI) / 180
  const lo = (lonDeg * Math.PI) / 180
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)]
}

export function createAstronomyEngine(): EphemerisEngine {
  const bodyLongitudes = (jdUT: number, convention: Convention = 'apparent'): BodyLongitudes => {
    if (convention === 'geometric') {
      throw new Error(
        'astronomy engine: geometric convention is not supported. HD uses apparent positions.',
      )
    }
    const date = dateOf(jdUT)
    const out = {} as BodyLongitudes
    for (const key of PLANET_KEYS as readonly PlanetKey[]) {
      if (key === 'earth' || key === 'north_node' || key === 'south_node') continue
      out[key] = apparentLongitude(BODY_MAP[key]!, date)
    }
    out.earth = norm360(out.sun + 180)
    out.north_node = trueNodeLongitude(date)
    out.south_node = norm360(out.north_node + 180)
    return out
  }

  return {
    name: 'astronomy-engine',
    bodyLongitudes,
    sunLongitude: (jdUT) => apparentLongitude(Body.Sun, dateOf(jdUT)),
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/ephemeris-astronomy.test.ts`
Expected: PASS.

**If the node derivation is off**, the likely cause is the `Ecliptic()` rotation of a raw velocity vector, which is not a position and may not rotate cleanly through that API. Fall back to the arc-normal method that `moshier.ts` uses (two Moon direction vectors ±0.05 days apart, crossed). The ground-truth investigation found all three derivations agree to under 0.05″, so either is correct; pick whichever the API supports cleanly and note the choice in a comment.

- [ ] **Step 5: Commit**

```bash
git add src/ephemeris/astronomy.ts tests/ephemeris-astronomy.test.ts
git commit -m "feat: add MIT astronomy-engine path on the apparent convention"
```

---

## Task 9: Public API and the licensing-boundary test

**Files:**
- Create: `src/calculator.ts`, `src/index.ts`
- Test: `tests/calculator.test.ts`
- Reference: `$HD/src/lib/chart-calculator.ts`, `$HD/tests/lib/chart-calculator.test.ts`

- [ ] **Step 1: Write the failing test**

Port `$HD/tests/lib/chart-calculator.test.ts`, then add:

```ts
it('defaults to the MIT engine', () => {
  const chart = calculateChart({
    date: '1993-10-18', time: '01:30', lat: 30.42, lon: -87.22, tz: 'America/Chicago',
  })
  expect(chart.engine).toBe('astronomy-engine')
})

it('accepts an injected engine', () => {
  const chart = calculateChart(
    { date: '1993-10-18', time: '01:30', lat: 30.42, lon: -87.22, tz: 'America/Chicago' },
    { engine: createMoshierEngine() },
  )
  expect(chart.engine).toBe('moshier')
})

it('reports base as an estimate when the birth time has no seconds', () => {
  const chart = calculateChart({
    date: '1993-10-18', time: '01:30', lat: 30.42, lon: -87.22, tz: 'America/Chicago',
  })
  expect(chart.precision.base).toBe('estimate')
})

it('reports base as reliable only at second precision on the Moshier engine', () => {
  const chart = calculateChart(
    { date: '1993-10-18', time: '01:30:00', lat: 30.42, lon: -87.22, tz: 'America/Chicago' },
    { engine: createMoshierEngine() },
  )
  expect(chart.precision.base).toBe('reliable')
})
```

And the boundary test, which is what keeps the MIT promise honest:

```ts
// tests/licensing-boundary.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('licensing boundary', () => {
  it('no MIT-surface module imports the GPL ephemeris package', () => {
    const mitFiles = [
      'src/index.ts', 'src/calculator.ts', 'src/activation.ts',
      'src/birth-moment.ts', 'src/wheel.ts',
      'src/ephemeris/types.ts', 'src/ephemeris/astronomy.ts', 'src/ephemeris/delta-t.ts',
    ]
    for (const f of mitFiles) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src, `${f} must not import the GPL 'ephemeris' package`).not.toMatch(/from ['"]ephemeris['"]/)
      expect(src, `${f} must not reach the GPL moshier module`).not.toMatch(/from ['"].*moshier['"]/)
    }
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run tests/calculator.test.ts tests/licensing-boundary.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/calculator.ts`**

Copy `$HD/src/lib/chart-calculator.ts` and make exactly these changes:
1. Take an options bag: `calculateChart(input, opts: { engine?: EphemerisEngine } = {})`, defaulting to `createAstronomyEngine()`.
2. Replace the direct `computeBodyLongitudes` / `sunLongitude` imports with calls on `opts.engine`.
3. Return `engine: engine.name` on the chart so a consumer can tell which path produced it.
4. Add the precision model, which the site currently keeps in Svelte components. It belongs in the package:

```ts
export type PrecisionGrade = 'reliable' | 'estimate'

/**
 * What each sub-line layer is worth, given the birth-time precision and engine.
 *
 * A base slice is 18.75″ of arc. One minute of clock uncertainty is ~33″ of
 * Moon motion, about 1.8 base slices, so base is an estimate at minute
 * precision no matter how good the ephemeris is. The astronomy engine's Moon
 * is 12-22″ off on its own, so base is never reliable on it.
 */
function gradePrecision(timeHasSeconds: boolean, engineName: string) {
  const second = timeHasSeconds
  const precise = engineName === 'moshier'
  return {
    gate:  'reliable' as PrecisionGrade,
    line:  'reliable' as PrecisionGrade,
    color: 'reliable' as PrecisionGrade,
    tone:  (second || precise) ? 'reliable' : 'estimate' as PrecisionGrade,
    base:  (second && precise) ? 'reliable' : 'estimate' as PrecisionGrade,
  }
}
```

5. Keep `CalculatorError`, the 1800-2200 range check, and the input validation unchanged.

- [ ] **Step 4: Write `src/index.ts`**

```ts
export { calculateChart, CalculatorError } from './calculator'
export type { CalculateChartInput, CalculatorErrorCode, PrecisionGrade } from './calculator'
export { longitudeToActivation, signedAngularDiff, findDesignJD } from './activation'
export type { Activation } from './activation'
export { resolveBirthMoment, TzError } from './birth-moment'
export type { BirthInput, BirthMoment } from './birth-moment'
export { createAstronomyEngine } from './ephemeris/astronomy'
export { PLANET_KEYS } from './ephemeris/types'
export type { EphemerisEngine, PlanetKey, BodyLongitudes, Convention } from './ephemeris/types'
export * from './wheel'
```

Note the deliberate omission: `createMoshierEngine` is **not** exported here.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS, all suites.

- [ ] **Step 6: Commit**

```bash
git add src/calculator.ts src/index.ts tests/calculator.test.ts tests/licensing-boundary.test.ts
git commit -m "feat: add public API with injectable engine and precision grading"
```

---

## Task 10: Cross-engine parity on the 30-chart fixture

The load-bearing test of the whole dual-engine design. If the MIT engine disagrees with Moshier on a gate or a line, the free tier is not usable and the plan's premise fails.

**Files:**
- Create: `tests/fixtures/synthetic-charts.json` (copy), `tests/engine-parity.test.ts`

- [ ] **Step 1: Copy the fixture**

```bash
mkdir -p tests/fixtures
cp "/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD/tests/fixtures/synthetic-charts.json" tests/fixtures/
```

- [ ] **Step 2: Write the parity test**

```ts
import { describe, it, expect } from 'vitest'
import charts from './fixtures/synthetic-charts.json'
import { calculateChart, PLANET_KEYS, createAstronomyEngine } from '../src/index'
import { createMoshierEngine } from '../src/ephemeris/moshier'

const astro = createAstronomyEngine()
const moshier = createMoshierEngine()

describe('engine parity across the 30-chart fixture', () => {
  const rows: Array<{ chart: string; body: string; side: string; a: any; m: any }> = []

  for (const c of charts as any[]) {
    const input = { date: c.date, time: c.time, lat: c.lat, lon: c.lon, tz: c.tz }
    const A = calculateChart(input, { engine: astro })
    const M = calculateChart(input, { engine: moshier })
    for (const k of PLANET_KEYS) {
      for (const side of ['p', 'd'] as const) {
        rows.push({ chart: c.name, body: k, side, a: A.planets[k][side], m: M.planets[k][side] })
      }
    }
  }

  it('agrees on GATE for every row (zero tolerance)', () => {
    const bad = rows.filter(r => r.a.g !== r.m.g)
    expect(bad.map(r => `${r.chart}/${r.side}/${r.body}`)).toEqual([])
  })

  it('agrees on LINE for every row (zero tolerance)', () => {
    const bad = rows.filter(r => r.a.l !== r.m.l)
    expect(bad.map(r => `${r.chart}/${r.side}/${r.body}`)).toEqual([])
  })

  it('agrees on COLOR for at least 99% of rows', () => {
    const bad = rows.filter(r => r.a.c !== r.m.c)
    expect(bad.length / rows.length).toBeLessThan(0.01)
  })

  it('records the tone and base disagreement rates for the README', () => {
    const tone = rows.filter(r => r.a.t !== r.m.t).length / rows.length
    const base = rows.filter(r => r.a.b !== r.m.b).length / rows.length
    console.log(`tone disagreement ${(tone * 100).toFixed(1)}%, base ${(base * 100).toFixed(1)}%`)
    expect(tone).toBeLessThan(0.15)   // documented, not aspirational
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run tests/engine-parity.test.ts`
Expected: PASS on gate and line.

**If gate or line disagree, stop.** That is the charter's named risk materialising. Diagnose before proceeding: the near-certain cause is the astronomy engine not actually emitting apparent positions. Compare a single body's longitude between the two engines; a systematic ~20.5″ offset is aberration, meaning `GeoVector`'s third argument or the `Ecliptic` frame is wrong.

Record the actual tone and base percentages the test logs. They go in the README verbatim.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/synthetic-charts.json tests/engine-parity.test.ts
git commit -m "test: pin cross-engine gate/line parity across the 30-chart fixture"
```

---

## Task 11: Validation harness and docs

**Files:**
- Copy: `scripts/validate-chart.py`, `scripts/dev-node-eval.py`, `scripts/dev-node-methods.ts`, `scripts/dev-convention-compare.ts`
- Copy: `docs/ephemeris-ground-truth.md`, `docs/chart-validation-report.md`

- [ ] **Step 1: Copy the harness and reports**

```bash
mkdir -p scripts docs
cd "/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD Chart Engine"
SRC="/Users/dom/Documents/Claude/Projects/Badwater OS/Badwater HD"
cp "$SRC"/scripts/{validate-chart.py,dev-node-eval.py,dev-node-methods.ts,dev-convention-compare.ts} scripts/
cp "$SRC"/docs/reference/{ephemeris-ground-truth.md,chart-validation-report.md} docs/
```

- [ ] **Step 2: Repoint every import path in the copied scripts**

`src/lib/chart-ephemeris.ts` becomes `src/ephemeris/moshier.ts`, `src/lib/chart-math.ts` becomes `src/activation.ts`, `src/lib/chart-tz.ts` becomes `src/birth-moment.ts`. Grep to confirm nothing still points at `src/lib/`:

```bash
grep -rn "src/lib/" scripts/ docs/ || echo "clean"
```

- [ ] **Step 3: Extend the harness to cover both engines**

`validate-chart.py` compares one engine against pyswisseph. Add a `--engine {astronomy,moshier}` flag so both paths get their own report, and have the TS side select the engine accordingly.

- [ ] **Step 4: Run the validator against both engines**

```bash
pip install pyswisseph
python3 scripts/validate-chart.py --engine moshier
python3 scripts/validate-chart.py --engine astronomy
```

Expected: both exit 0. The Moshier run should reproduce the published figures (gate/line/color 0/0/0, tone 0.3%, base 1.9%, max 3.0″). The astronomy run is new; record whatever it produces.

- [ ] **Step 5: Add a docs preamble**

Both copied reports were written inside Badwater HD and refer to "the production engine" as a single thing. Add a short note at the top of each explaining that the package now ships two engines, and which one the report's figures describe.

- [ ] **Step 6: Commit**

```bash
git add scripts docs
git commit -m "test: port the Swiss validation harness, both engine paths"
```

---

## Task 12: README

The README is the deliverable that makes this worth publishing. It carries the measurements.

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write it**

Required sections, in order:

1. **What it does.** One paragraph, one code sample that goes from birth data to activations in five lines.
2. **Why it exists.** Every accurate HD engine routes through Swiss Ephemeris (AGPL or paid). This one does not depend on it. Swiss appears only as a test oracle.
3. **Accuracy**, with both tables from the parity test and the validation runs, per body, in arc-seconds, against DE431. State the slice sizes for scale: gate 20250″, line 3375″, color 562.5″, tone 93.75″, base 18.75″.
4. **Choosing an engine**, with the licensing consequence stated plainly and without euphemism. MIT default: gate, line, color exact. GPL sub-path: sub-arcsecond, base assertable.
5. **What is not asserted.** Base needs a to-the-second birth time on the Moshier engine. One minute of clock uncertainty is about 1.8 base slices of Moon motion. No engine fixes that.
6. **The corrections this package makes**, which is the original contribution: the ΔT time-base fix, the apparent-convention resolution, the true node derivation. Link to `docs/ephemeris-ground-truth.md`.
7. **Scope.** Activations only. No bodygraph rendering, no type or authority derivation, no interpretation.

Follow `$BADWATER_OS/00_Resources/voice-principles.md`. No em dashes.

- [ ] **Step 2: Verify every number in the README traces to a committed measurement**

Run: `npx vitest run` and `python3 scripts/validate-chart.py --engine moshier`, then check each figure against the output. Any number that cannot be traced comes out of the README.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with traceable accuracy tables and honest limits"
```

---

## Task 13: Full green and handoff

- [ ] **Step 1: Full suite**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, `dist/` contains `index.js` and `moshier-entry.js`.

- [ ] **Step 2: Verify the GPL code is not in the MIT bundle**

```bash
grep -c "ephemeris" dist/index.js || echo "clean: no ephemeris in MIT entry"
```

Expected: the `ephemeris` package's code must not appear in `dist/index.js`.

- [ ] **Step 3: Commit and write the follow-on plan**

The second plan covers migrating `design.badwater.guide` onto the package (submodule plus npm workspace, keeping `ConnectionTool.svelte`, `dashboard/BirthDataForm.svelte`, `transit-chart.ts`, `transit-ingress.ts` and the `npm run chart` CLI green), then publishing to npm and filing the project in `Badwater OS/CLAUDE.md`.

---

## Open questions for Dom

1. ~~**npm scope.**~~ Resolved 2026-07-27: `hd-chart-engine` is unclaimed on npm (registry returns 404), so the plan uses the unscoped name.
2. **Second-precision UI.** The precision model moves into the package in Task 9. The site's `PlanetChartIndicator.svelte` currently owns that logic and will need to read it from the chart object during the migration plan.
