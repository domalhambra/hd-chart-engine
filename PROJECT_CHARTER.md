# Project Charter — HD Chart Engine

_Chartered 2026-07-27. Extraction project: the code already exists and is validated inside `Badwater HD`. This charter covers pulling it out, licensing it, and publishing it._

## What it is

A free, open-source **Human Design chart engine** for JavaScript and TypeScript. It turns a birth moment (date, time, latitude, longitude, IANA zone) into a full activation set: gate, line, color, tone, and base for all 13 bodies on both the Personality and Design sides.

It ships in two layers:

1. **Ephemeris layer.** Geocentric apparent ecliptic longitudes with a corrected time base, the resolved apparent-vs-geometric convention, and a true lunar node derivation. Useful on its own to anyone doing tropical astrology in JS.
2. **HD layer.** Wheel slicing to base resolution, the 88-degree design-arc solve, and DST-aware historical birth-moment resolution.

The point of publishing is that every accurate HD chart engine currently routes through Swiss Ephemeris, which is AGPL or a paid commercial license. This one does not depend on it at all. Swiss appears only as a test oracle.

## Vision / done state

A published npm package and public GitHub repo that a developer can install and get correct gate and line output from on the first try, with the accuracy claims backed by committed error tables against full Swiss Ephemeris (JPL DE431). `design.badwater.guide` consumes the package rather than a private copy, which is the proof that it works.

Success is someone else shipping an HD tool on it.

## Why it warrants its own repo

Four things in here are not available anywhere else for free:

- **A time-base correction to the `ephemeris` package.** Upstream treats its input instant as Terrestrial Time when birth data is Universal Time. That is roughly a 48-second error. Correcting it moves the Moon from 25.9 arc-seconds mean error to 0.27, and every direct body to sub-arcsecond. See `docs/reference/ephemeris-ground-truth.md` in Badwater HD.
- **The apparent-vs-geometric convention, resolved empirically.** Settled against a Jovian Archive chart at base resolution on 2026-06-21. HD uses apparent positions. This corrected 2 of 104 fixture lines, so the prior geometric output was wrong, not merely imprecise.
- **A true lunar node derivation** that tracks Swiss `TRUE_NODE` to about 3 arc-seconds using apparent Moon directions over a short arc.
- **The measurement work itself.** Per-body error tables against DE431 across 60 moments, comparing astronomy-engine, raw Moshier, patched Moshier, and astronomia. That documentation is the real asset. It is what someone else would spend a month rediscovering.

## Location & filing

- **Repo folder:** `Projects/Badwater OS/Badwater HD Chart Engine/`
- **GitHub:** `domalhambra/hd-chart-engine` (public)
- **npm:** `hd-chart-engine`
- **Workspace filing:** add a row to the `Badwater OS/CLAUDE.md` Projects table once the repo exists. No Fallback route is needed; conceptual HD questions still route to `Badwater HD`.
- **JD context:** subject-matter home is *30-39 Human Design*, but as a full-repo project it lives under `Badwater OS/` alongside PKM, HD, Garden, Ignition, and Trails.

## Licensing model

**MIT core, optional GPL precision engine.** This is the decision that makes the project usable by other people.

| Layer | Engine | License | Accuracy |
|---|---|---|---|
| Default | `astronomy-engine` | MIT | Gate, line, and color exact. Tone occasionally off near boundaries, base unreliable. |
| Optional | `ephemeris` (patched Moshier) | GPL-3.0 | Sub-arcsecond on every direct body. Base assertable at second-precision birth times. |

The package itself is MIT. `ephemeris` is an **optional peer dependency**: install it and the engine uses it, omit it and the engine falls back to astronomy-engine. A commercial closed-source adopter can use the MIT path. Anyone who wants base precision opts into copyleft knowingly.

This also resolves a live question about `design.badwater.guide`, which currently ships GPL-3.0 code into the browser bundle.

**Open risk to close before the MIT path ships:** astronomy-engine was previously used with *geometric* longitudes, which is now known to be the wrong convention. The MIT path must emit apparent positions (aberration plus nutation) and be re-validated against Swiss apparent, or it will reproduce the 2 wrong lines the convention fix corrected. Do not ship the default engine on the old numbers.

## Extraction manifest

From `Badwater HD`, roughly 500 lines of source:

| Source | Destination layer |
|---|---|
| `src/lib/chart-ephemeris.ts` | ephemeris |
| `src/lib/delta-t.ts` | ephemeris |
| `src/lib/chart-math.ts` | HD |
| `src/lib/chart-tz.ts` | HD |
| `src/lib/chart-calculator.ts` | HD (public entry point) |
| `tests/lib/chart-{ephemeris,math,tz,calculator}.test.ts` | tests |
| `tests/fixtures/synthetic-charts.json` | fixtures (30 charts) |
| `scripts/validate-chart.py`, `dev-node-eval.py`, `dev-node-methods.ts`, `dev-convention-compare.ts` | validation harness |
| `docs/reference/ephemeris-ground-truth.md`, `chart-validation-report.md` | docs, becomes the README's evidence |

`chart-math.ts` currently imports the wheel constants from `docs/reference/synthesis-index.json`. That coupling has to be cut: the package needs its own wheel table.

**Stays in Badwater HD:** `transit-chart.ts` and `transit-ingress.ts` are site features. They import from the package rather than move into it.

## How Badwater HD consumes it

Git submodule plus an npm workspace dependency, so the site builds from source and a change can be made in one place and tested in both. Not a published-version dependency during development, which would slow the feedback loop for no benefit while there is exactly one consumer.

Consumers to keep green: `ConnectionTool.svelte`, `dashboard/BirthDataForm.svelte`, `transit-chart.ts`, `transit-ingress.ts`, and the `npm run chart` CLI.

## Verification gates

- `vitest run` on the extracted suite, including the regression test that pins the ephemeris to Swiss reference values at under 3 arc-seconds so an upstream change cannot silently reintroduce the time-base error.
- `python3 scripts/validate-chart.py` against pyswisseph in Moshier mode. Thresholds: gate and line zero-tolerance, color and tone rate-capped, max longitude disagreement 60 arc-seconds.
- The DE431 harness (`dev-node-eval.py`, needs `EPHE_PATH` and the `.se1` files, which are not committed) re-run whenever an engine or convention changes. Its output is what the README's accuracy table cites.
- Both engine paths validated separately. The MIT default gets its own published error table, not an inherited one.
- Badwater HD's own suite passes against the extracted package before the submodule swap is considered done.

## Milestones

- [ ] Scaffold the repo, MIT license, pluggable engine interface
- [ ] Move the ephemeris layer, cut the `synthesis-index.json` coupling
- [ ] Move the HD layer and the test suite
- [ ] Bring the astronomy-engine path onto apparent positions and validate it against Swiss apparent
- [ ] README with both accuracy tables and an honest statement of what each engine path can and cannot assert
- [ ] Swap `Badwater HD` onto the package, full site suite green
- [ ] Publish to npm and make the GitHub repo public
- [ ] File the project in `Badwater OS/CLAUDE.md`

## Guardrails / principles

- **Claims are backed by committed measurements.** Never state an accuracy figure the harness has not produced. The credibility of this package is the only thing it has.
- **Say what is not asserted.** Base needs a to-the-second birth time regardless of engine. One minute of clock uncertainty is about 1.8 base slices of Moon motion. The README says so plainly.
- **No silent convention changes.** Apparent versus geometric is settled and documented. Any future change to it gets the same empirical treatment against a real reference chart.
- **Accessible by default.** The MIT path has to be genuinely good, not a crippled teaser. Gate, line, and color are what almost every consumer needs, and they are exact.

## Out of scope

Bodygraph rendering, type and authority derivation, profile and cross naming, and any interpretive content. This package returns activations. Meaning lives in the encyclopedia.

## Logging strategy

Session work logs to the Notion Session Log per the workspace convention. Once the repo exists it gets its own `Repo` relation ID; until then, sessions log against `Badwater HD`.
