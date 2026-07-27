# hd-chart-engine

[![CI](https://github.com/domalhambra/hd-chart-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/domalhambra/hd-chart-engine/actions/workflows/ci.yml)

A Human Design chart engine for JavaScript and TypeScript. Give it a birth moment, get gate, line, color, tone and base for all 13 bodies on both the Personality and Design sides.

```js
import { calculateChart } from 'hd-chart-engine'

const chart = calculateChart({
  date: '1993-10-18',
  time: '01:30',
  lat: 30.4213,
  lon: -87.2169,
  tz: 'America/Chicago',
})

chart.planets.sun.p     // { g: 32, l: 5, c: 3, t: 4, b: 2 }
chart.planets.sun.d     // the Design side, 88° of solar arc earlier
chart.precision.base    // 'estimate' at minute precision
```

Resolving a place name to coordinates and an IANA zone is your job. That needs a network call or a multi-megabyte timezone shapefile, and neither belongs in a library that has to run in a browser.

## Why this exists

Every accurate Human Design chart engine routes through the Swiss Ephemeris, which is AGPL or a paid commercial license. That is a real cost for anyone building an HD tool, and it is the reason so few exist.

This package does not depend on it. Swiss Ephemeris appears only in the development-time validation harness, where `pyswisseph` acts as an accuracy oracle. It is never distributed and never linked. See [NOTICE.md](NOTICE.md).

## Choosing an engine

The default is MIT and free of copyleft. A second engine is available for higher accuracy, and it links GPL-3.0 code.

```js
// MIT. Gate, line and color are solid.
import { calculateChart } from 'hd-chart-engine'
calculateChart(input)

// GPL-3.0. Sub-arcsecond, and base becomes meaningful.
import { createMoshierEngine } from 'hd-chart-engine/moshier'
calculateChart(input, { engine: createMoshierEngine() })
```

Importing the `moshier` sub-path links the `ephemeris` package (GPL-3.0) into your program, and your combined work becomes subject to GPL-3.0 terms. Serving JavaScript to a browser counts as distribution, so a web app that imports it is publishing GPL code. Install `ephemeris` yourself if you want that path; it is an optional peer dependency.

Nothing reachable from the default entry point imports it, and [`tests/licensing-boundary.test.ts`](tests/licensing-boundary.test.ts) fails the build if that ever changes.

## Accuracy

Slice widths set the scale for everything below. A gate is 20250 arc-seconds wide, a line 3375, a color 562.5, a tone 93.75, and a base 18.75. An engine needs to be accurate to well inside a slice for that slice to mean anything.

Measured against `pyswisseph` over the 30-chart fixture, 780 rows (30 charts × 13 bodies × 2 sides). Reproduce with `npm run validate`.

| | moshier | astronomy-engine (default) |
|---|---:|---:|
| gate disagreements | 0 | 1 |
| line disagreements | 0 | 1 |
| color | 0.51% | 1.15% |
| tone | 2.18% | 4.74% |
| base | 9.49% | 21.79% |
| median longitude error | 0.108″ | 1.931″ |
| p95 | 11.989″ | 15.227″ |
| worst direct body | 2.802″ (Pluto) | 26.656″ (Design Moon) |
| worst node | 32.259″ | 28.747″ |

The default engine's single gate and line disagreement is one row, `gb-2` Design Uranus, where the two engines sit 6.49″ apart and straddle an exact gate boundary at 268.25°. The fixture contains deliberate boundary cases, and any two ephemerides that differ at all will sort a body sitting on an edge differently. The validator allows a gate or line disagreement only when the two longitudes are closer together than the error budget, which means the boundary provably lies between them.

Direct bodies and lunar nodes carry separate budgets because they fail for different reasons. A direct-body disagreement means one ephemeris is less accurate. A node disagreement is mostly definitional: `pyswisseph` derives the true node with a refined integrator, and this package takes the normal of the Moon's orbital plane over a short arc. Those two answers differ by up to about 30″ regardless of how good either Moon model is.

**Read the oracle caveat before quoting these numbers.** The committed run uses `pyswisseph` in Moshier mode, with no `.se1` data files. That is itself a truncated approximation, and it shares its underlying theory with the `moshier` engine, so it flatters that column. Point `EPHE_PATH` at the Swiss data files for a real JPL DE431 oracle:

```bash
EPHE_PATH=/path/to/ephe npm run validate
```

The per-body DE431 figures in [docs/ephemeris-ground-truth.md](docs/ephemeris-ground-truth.md) came from a run with those files present. That document's table for `astronomy-engine` was measured on geometric longitudes and understates the apparent path substantially: at JD 2447956.5 the apparent Moon is 0.14″ from Swiss where the table implies 12.61″.

## What this does not assert

Base needs a to-the-second birth time. One minute of clock uncertainty is roughly 33″ of Moon motion, about 1.8 base slices, so a chart built from a rounded birth time cannot resolve base no matter which engine computed it. Every chart carries a `precision` object saying so:

```js
calculateChart({ ...input, time: '01:30' }).precision.base            // 'estimate'
calculateChart({ ...input, time: '01:30:00' },
  { engine: createMoshierEngine() }).precision.base                   // 'reliable'
```

The MIT engine never reports base as reliable. Its Design Moon runs to 26.656″, wider than a base slice, so the field is not recoverable on that path even given a perfect birth time.

Gate, line and color are reliable everywhere. They are wide enough that no error either engine carries can reach them.

## The corrections in here

Three things in this package are not available elsewhere, and they are the reason it was worth extracting.

**A time-base fix for the `ephemeris` package.** Upstream treats its input instant as Terrestrial Time when birth data is Universal Time, which is roughly a 48-second error. The signature is a Sun error and a Moon error in a 13× ratio, matching their angular-speed ratio. Feeding it the instant plus ΔT moves the Moon from 25.93″ mean error to 0.27″ and brings every direct body under an arc-second. [`tests/ephemeris-moshier.test.ts`](tests/ephemeris-moshier.test.ts) pins this against Swiss reference values so an upstream change cannot silently reintroduce it.

**The apparent convention, settled by measurement.** Human Design uses apparent positions, meaning aberration and nutation are included. Aberration is about 20.5″, or 1.1 base slices, so the question is invisible at every resolution above base and only surfaces there. It was settled on 2026-06-21 against a Jovian Archive chart: for Pensacola 1993-10-18 01:30 the two conventions agree down to tone and split on base, geometric giving 3 and apparent giving 2, and Jovian reports 2. Reproduce it with `npx tsx scripts/dev-convention-compare.ts`.

**A true node derivation that holds up.** Taking the normal of the Moon's orbital plane from two direction vectors a short arc apart tracks Swiss `TRUE_NODE` to about 3″ on the Moshier engine and 4.6″ on the MIT one. A Moon longitude error is largely along-track and barely tips the plane that fixes the node, so the node tolerates a worse Moon than you would expect.

## Scope

This package returns activations. Bodygraph rendering, Type and Authority derivation, Profile and Incarnation Cross naming, and anything interpretive are all out of scope.

Supported range is 1800 to 2200.

## Development

```bash
npm test              # 114 tests
npm run typecheck
npm run validate      # both engines against pyswisseph, needs `pip install pyswisseph`
npm run chart -- --lat=30.4213 --lon=-87.2169 --tz=America/Chicago \
                 --date=1993-10-18 --time=01:30 --engine=moshier
```

The validator keeps its own independent encoding of the wheel constants and the 64-gate sequence, and deliberately does not import `src/wheel.ts`. Sharing them would make it a tautology.

## License

MIT. See [LICENSE](LICENSE), and [NOTICE.md](NOTICE.md) for the GPL-3.0 sub-path and third-party components.
