# Architecture

Read this to learn which file owns which behavior. For the rules that must
not break, read `../CLAUDE.md`. For step-by-step changes, read
`changing-things.md`.

## The shape

One TypeScript library, published to npm as `hd-chart-engine`. No host, no
server, no runtime network call. It turns a birth moment into gate, line,
color, tone, and base for 13 bodies on the Personality and Design sides.

Two layers sit behind one licensing boundary. The ephemeris layer computes
apparent geocentric ecliptic longitudes. The HD layer slices them onto the
wheel, solves the 88-degree design arc, and resolves the birth moment. The
boundary is the exports map in `../package.json`: `"."` reaches MIT code only,
`"./moshier"` reaches the GPL-3.0 `ephemeris` package. A consumer who imports
the sub-path is under GPL-3.0 terms, and serving that JavaScript to a browser
is distribution.

```
{ date, time, lat, lon, tz }                    caller resolves the IANA zone
        │
        ▼
src/calculator.ts   validate (1800..2200, HH:MM or HH:MM:SS)
        │
        ├─▶ src/birth-moment.ts   luxon: local wall time → UTC → Julian Day (UT), DST warnings
        │
        ├─▶ src/activation.ts     findDesignJD: bisection on engine.sunLongitude to 88° back
        │
        ├─▶ engine.bodyLongitudes(jd)  ×2 (Personality, Design)
        │        │
        │        │   src/ephemeris/types.ts   EphemerisEngine { name, baseCapable, bodyLongitudes, sunLongitude }
        │        ├── src/ephemeris/astronomy.ts   MIT default, apparent, baseCapable: false
        │        └── src/ephemeris/moshier.ts     GPL-3.0, instant + ΔT (src/ephemeris/delta-t.ts), baseCapable: true
        │
        ├─▶ src/activation.ts + src/wheel.ts   longitude → { g, l, c, t, b }
        │
        └─▶ gradePrecision(seconds present?, engine.baseCapable)
        ▼
HDChart { v: 1, engine, planets[13]{ p, d }, precision, warnings }

src/index.ts          the "." entry: calculateChart, the MIT engine, the wheel constants
src/moshier-entry.ts  the "./moshier" entry: createMoshierEngine. The only route to GPL code.
```

`tsup` builds both entries to `dist/index.js` and `dist/moshier-entry.js`
with declarations. Nothing under `src/` that `src/index.ts` reaches may
import `src/ephemeris/moshier.ts`. Two tests enforce that, one on the source
and one on the built output.

## Module map

Every module under `src/` and every script has a row. The documentation
check, `../scripts/docs_check.py` and `../tests/docs.test.ts`, is described
under Verification instead.

| File | Owns | Tested by |
|---|---|---|
| `../src/index.ts` | The MIT entry point. Re-exports `calculateChart`, the activation math, birth-moment resolution, `createAstronomyEngine`, the engine types, and the wheel constants. Never the Moshier engine. | `../tests/licensing-boundary.test.ts` (no Moshier re-export), `../tests/calculator.test.ts` and `../tests/engine-parity.test.ts` (import through it) |
| `../src/moshier-entry.ts` | The GPL-3.0 sub-path entry. Exports `createMoshierEngine`, `computeBodyLongitudes`, `sunLongitude`. | `../tests/bundle-boundary.test.ts` (the built entry imports `ephemeris` and every exports-map path resolves) |
| `../src/calculator.ts` | `calculateChart`: input validation, the `CalculatorError` codes (`date_out_of_range`, `time_invalid`, `computation_failed`), engine selection, `gradePrecision`, the `HDChart` shape. | `../tests/calculator.test.ts` |
| `../src/activation.ts` | `longitudeToActivation` (nested division of the wheel offset, base capped at 5) and `findDesignJD` (bisection over [JD - 100, JD - 80], 50 iterations, throws on non-convergence). Pure math, no engine. | `../tests/activation.test.ts` |
| `../src/wheel.ts` | Data only: `WHEEL_START` 223.25°, the five slice widths, `GATES_BY_WHEEL_INDEX` (64 gates in wheel order). | `../tests/wheel.test.ts` |
| `../src/birth-moment.ts` | `resolveBirthMoment`: IANA zone validation, luxon historical DST, Julian Day (UT), the two DST warnings (gap, fall-back). `TzError`. | `../tests/birth-moment.test.ts` |
| `../src/ephemeris/types.ts` | The seam: `EphemerisEngine`, `PLANET_KEYS` (13 bodies), `BodyLongitudes`, `Convention`, `norm360`, `signedAngularDiff`. The header records why the convention is apparent. | via every engine test |
| `../src/ephemeris/astronomy.ts` | The MIT engine on `astronomy-engine`: apparent longitudes, Earth opposite Sun, the arc-normal True Node (delta 0.05 days). Throws on `convention: 'geometric'`. | `../tests/ephemeris-astronomy.test.ts` |
| `../src/ephemeris/moshier.ts` | The GPL engine on `ephemeris`: the TT instant (UT plus ΔT), apparent by default, geometric by subtracting annual aberration (Meeus chapter 23) for the harness only, the same node derivation. | `../tests/ephemeris-moshier.test.ts` |
| `../src/ephemeris/delta-t.ts` | `deltaTSeconds` and `decimalYear`: Espenak-Meeus ΔT polynomials, 1800 to 2200. | `../tests/delta-t.test.ts` |
| `../src/types/ephemeris.d.ts` | Ambient types for the `ephemeris` package, which ships none. | - not covered (`npm run typecheck` compiles it) |
| `../scripts/calculate-chart.ts` | The chart CLI (`npm run chart`). JSON on stdout, a summary on stderr, `--verbose` adds raw longitudes. The validator shells out to it. Not published. | - not covered directly (`npm run validate` drives it) |
| `../scripts/validate-chart.py` | The Swiss validator (`npm run validate`): its own wheel constants, an inline pyswisseph pipeline, per-engine `THRESHOLDS`, separate direct-body and node budgets, the straddle rule. | - not covered (it is the harness) |
| `../scripts/dev-convention-compare.ts` | Prints one chart under both conventions. Settled the apparent question on 2026-06-21. | - not covered |
| `../scripts/dev-node-methods.ts`, `../scripts/dev-node-eval.py` | The DE431 harness pair: astronomy-engine longitudes per Julian Day, scored against full Swiss Ephemeris. Needs the `.se1` files. Geometric on purpose. | - not covered |
| `../tests/fixtures/synthetic-charts.json` | 30 charts: 20th-century spread, hemisphere balance, DST edges, design-arc timings, gate-boundary candidates `gb-1` to `gb-6`. 780 rows across 13 bodies and 2 sides. | used by `../tests/engine-parity.test.ts` and the validator |
| `../tests/licensing-boundary.test.ts` | The source-level MIT promise: eight files that must not import `ephemeris` or the Moshier module, the optional peer dependency, the exports map. | itself |
| `../tests/bundle-boundary.test.ts` | The same promise against `dist/`. Skips when `dist/` is absent. | itself |
| `../tests/engine-parity.test.ts` | The MIT engine against the Moshier engine over the fixture: every disagreement a boundary straddle, median under 5 arc-seconds, color agreement at 99 percent or better. Prints a cross-engine disagreement profile. The README's `gb-2` straddle sentence comes from it. The Accuracy table does not: that is `npm run validate`. | itself |
| `../package.json` | The exports map, `files`, `engines` (Node 20 or newer), the scripts, `ephemeris` as an optional peer dependency. | `../tests/licensing-boundary.test.ts`, `../tests/bundle-boundary.test.ts` |
| `../tsconfig.json` | `moduleResolution: Bundler`, strict, `noUncheckedIndexedAccess`, `include` covers `src`, `tests`, `scripts`. | `npm run typecheck` |
| `../vitest.config.ts` | `tests/**/*.test.ts`. | - |
| `../NOTICE.md` | Third-party licensing: what each import path pulls in, and why Swiss Ephemeris is not a dependency. | - not covered |

## Runtime behavior worth knowing

- **Input.** `date` is `YYYY-MM-DD`, `time` is `HH:MM` or `HH:MM:SS`, `tz`
  is an IANA zone the caller resolved. Years outside 1800 to 2200 throw
  `date_out_of_range`. A malformed date or time throws `time_invalid`.
- **Precision grading.** Gate, line, and color are always `reliable`. Tone
  is `reliable` when the engine is base-capable or the time has seconds.
  Base is `reliable` only when both hold. The MIT engine is never
  base-capable: its Design Moon error (26.656 arc-seconds) is wider than a
  base slice (18.75).
- **The design arc.** `findDesignJD` bisects the engine's Sun longitude to
  88 degrees behind the Personality Sun, inside [JD - 100, JD - 80]. The
  interface asks engines to keep `sunLongitude` cheaper than a full sweep,
  because the bisection calls it up to 50 times.
- **DST.** A time inside a spring-forward gap is shifted forward and warned.
  A time inside a fall-back hour resolves to the first (daylight) occurrence
  and warns. Both land in `chart.warnings`, never as errors.
- **Conventions.** Both engines return apparent longitudes. The MIT engine
  throws on `'geometric'`. The Moshier engine accepts it for the comparison
  harness only.
- **The node.** True Node on both engines, from the normal of the Moon's
  orbital plane over a short arc. It tracks Swiss `TRUE_NODE` to about 3
  arc-seconds on Moshier and 4.6 on the MIT engine at a reference moment.
  Across the fixture the worst node error is about 30 arc-seconds on either
  engine. That is definitional rather than accuracy, because the osculating
  node differs between ephemeris models. It is why the node budget is 40.
- **Errors.** `CalculatorError` wraps a `TzError` or any engine failure as
  `computation_failed` and keeps the cause.

## Delivery

There is no host. The deliverable is the npm package.

| Item | Value |
|---|---|
| Build | `npm run build`: `tsup src/index.ts src/moshier-entry.ts --format esm --dts --clean` into `dist/`. |
| Published files | `dist`, `README.md`, `LICENSE`, `NOTICE.md` (the `files` field). |
| Node | 20 or newer (`engines`). CI tests the floor on Node 20. |
| CI | `../.github/workflows/ci.yml`: `npm ci`, typecheck, **build, then test**, `npm pack --dry-run`. Pushes to `main` and `claude/**`, and pull requests. A newer push cancels the run it supersedes. |
| Release | `npm version patch && git push --follow-tags`. The `v*` tag runs `../.github/workflows/release.yml` on Node 24: verify the tag equals `package.json`, typecheck, build, test, `npm publish --provenance --access public`. |
| Credentials | None. OIDC trusted publishing. A trusted publisher on npmjs.com must point at this repo and `release.yml`, or the publish step fails on auth. |
| Swiss validation | `../.github/workflows/validate-ephemeris.yml`, manual only (`workflow_dispatch`). Installs pyswisseph and runs both engines. |
| Domains | None. |

### Environment

No environment variable is read at runtime. The package reads nothing from
`process.env`.

| Variable | Used by | Note |
|---|---|---|
| `EPHE_PATH` | `../scripts/validate-chart.py`, `../scripts/dev-node-eval.py` | Directory holding the Swiss `.se1` data files. The two scripts treat an absent directory differently. `validate-chart.py` falls back to pyswisseph in Moshier mode, a truncated approximation that flatters the Moshier column. `dev-node-eval.py` defaults to `/tmp/ephe`, probes at startup, and exits when the `.se1` files did not load. The files are not committed and not redistributable. |

## Verification

| Check | Command | What it proves |
|---|---|---|
| Unit and parity suite | `npm test` | 119 tests. The four bundle-boundary tests skip without `dist/`, so a fresh clone reports 115 passing and 4 skipped. Includes the licensing boundary, the Swiss-pinned Moshier regression, the Jovian calibration, and the 780-row parity profile. |
| Types | `npm run typecheck` | `tsc --noEmit` over `src`, `tests`, and `scripts`. |
| Bundle boundary | `npm run build && npm test` | With `dist/` present, the four skipped tests run: the MIT entry and its chunks never import `ephemeris`, the GPL entry does, every exports-map path exists. |
| Swiss validation | `npm run validate` | Needs `pip install pyswisseph`. Both engines against pyswisseph over the fixture. Exit 0 only inside `THRESHOLDS`. Re-run it before quoting any accuracy figure. |
| Full oracle | `EPHE_PATH=/path/to/ephe npm run validate` | The same, against JPL DE431 through the Swiss data files. |
| Docs | `../tests/docs.test.ts` | Runs the vendored `../scripts/docs_check.py` with the suite. |

The validator's thresholds, from `../scripts/validate-chart.py`:

| Limit | moshier | astronomy |
|---|---:|---:|
| straddle budget (arc-seconds) | 5.0 | 30.0 |
| max color disagreement rate | 1% | 2% |
| max tone disagreement rate | 5% | 10% |
| max direct-body error (arc-seconds) | 5.0 | 30.0 |
| max node error (arc-seconds) | 40.0 | 40.0 |

A gate or line disagreement passes only as a straddle: the two longitudes
sit closer together than the budget, so the boundary lies between them.

## Cross-repo dependencies

| Dependency | Used by | Note |
|---|---|---|
| `plateworks-hd` (the encyclopedia, private) | history only | The code was extracted from it on 2026-07-27. It is not a consumer, and it is not migrated onto this package. If the math changes, hand-port the diff. Conceptual HD questions route there, not here. |
| The encyclopedia's wheel index | `../src/wheel.ts` | Transcribed once and verified against each gate's starting longitude. No import. |
| `astronomy-engine` (MIT), `luxon` (MIT) | the default path | Runtime dependencies. |
| `ephemeris` (GPL-3.0) | `"./moshier"` only | Optional peer dependency. A dev dependency here so the tests run. |
| `pyswisseph` | the validator and the DE431 harness | Development-time oracle. Never distributed, never linked. |
| `00_Resources/documentation-standard.md` | `docs/` | The shape of this folder and the check that enforces it. |
