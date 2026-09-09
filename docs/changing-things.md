# Changing things

One section per task. Each names the file to edit, the test that judges it,
and the check that proves it. Before any claim of done: `npm run build`,
then `npm test` and `npm run typecheck`. Build first, because the four
bundle-boundary tests skip when `dist/` is absent. A change under
`src/ephemeris/` or to a dependency also needs `npm run validate`.

The rules that must not break are in `../CLAUDE.md`. Which file owns what
is in `architecture.md`.

## Set up a machine

1. Clone `hd-chart-engine` and run `npm ci`. Node 20 or newer.
2. `npm run build && npm test && npm run typecheck`. Expect 119 tests.
3. For the Swiss validator: `pip install pyswisseph`, then `npm run validate`.
   Without the Swiss `.se1` data files, pyswisseph runs in Moshier mode.
   To use the full JPL DE431 oracle, point `EPHE_PATH` at a local copy of
   the files. They are gitignored and not redistributable.
4. To print one chart: `npm run chart -- --lat=30.4213 --lon=-87.2169
   --tz=America/Chicago --date=1993-10-18 --time=01:30 --engine=moshier`.
   Add `--verbose` for raw longitudes.

The charter is a gitignored pointer (`../PROJECT_CHARTER.md`) to a private
workspace file. A clone does not have it.

## Change an engine, or bump astronomy-engine or ephemeris

1. Edit `src/ephemeris/astronomy.ts` (MIT default), `src/ephemeris/moshier.ts`
   (GPL-3.0, sub-path only), or `src/ephemeris/delta-t.ts`. The seam is
   `src/ephemeris/types.ts`; read its header before you change a convention.
2. `tests/ephemeris-astronomy.test.ts`, `tests/ephemeris-moshier.test.ts`,
   `tests/delta-t.test.ts`. The Moshier test pins Swiss reference values at
   under 3 arc-seconds. A bumped `ephemeris` that fails it is a finding, not
   a threshold to loosen.
3. `npm test`. `tests/engine-parity.test.ts` must still pass: every gate or
   line disagreement a boundary straddle, median under 5 arc-seconds.
4. `npm run validate`. Exit 0 only inside `THRESHOLDS` in
   `scripts/validate-chart.py`.
5. On GitHub, run the manual workflow "Validate against Swiss Ephemeris"
   (`.github/workflows/validate-ephemeris.yml`, Actions tab, Run workflow).
6. Update the `## Accuracy` table in `../README.md` in the same change. See
   "Re-run the Swiss validation and quote a figure".

Never let the MIT engine reach `src/ephemeris/moshier.ts` or the `ephemeris`
package. See "Check the licensing boundary".

## Change the wheel or the activation math

1. `src/wheel.ts` holds data only: `WHEEL_START`, the slice widths, the 64
   gates in wheel order. `src/activation.ts` holds the math:
   `longitudeToActivation` and `findDesignJD`. Keep that split.
2. `tests/wheel.test.ts` and `tests/activation.test.ts`. Boundary cases are
   asserted exactly; the whole-circle smoke test steps at 0.1 degrees.
3. `npm test`, then `npm run validate`. The validator keeps its own copy of
   the wheel constants and never imports `src/wheel.ts`. A wheel change must
   agree with those independent constants, or the validator says which side
   is wrong. Do not refactor the validator to reuse the source.

## Change birth-moment resolution

1. `src/birth-moment.ts`: IANA zone validation, luxon historical DST, the
   Julian Day, the two DST warnings. `tz` stays a required IANA zone the
   caller resolves. No geocoding, no zone lookup, in this package.
2. `tests/birth-moment.test.ts` holds the DST cases: the spring-forward gap,
   the fall-back ambiguity, pre-2007 and post-2007 US rules, southern
   hemisphere summer. Add a case before you change a rule.
3. `npm test`. Warnings land in `chart.warnings`, never as errors.

## Change the public API or precision grading

1. `src/calculator.ts`: `calculateChart`, the `CalculatorError` codes,
   `gradePrecision`, the `HDChart` shape. `src/index.ts` is the MIT entry
   and re-exports the public surface.
2. Keep the `v: 1` semantics of `HDChart`, or bump `v` and say so in
   `decisions.md`. A consumer reads `precision` to know what to trust.
3. `tests/calculator.test.ts`. It carries the Jovian Archive calibration:
   Pensacola 1993-10-18 01:30 resolves the Personality Sun to 32.5.3.4,
   base 2. That assertion does not move.
4. `npm run typecheck`, `npm run build`, `npm test`. A new export from
   `src/index.ts` must pass `tests/licensing-boundary.test.ts`.

## Add a fixture chart

1. Add the chart to `tests/fixtures/synthetic-charts.json`. There are 30.
   The `gb-1` to `gb-6` charts put bodies on slice edges on purpose. Keep
   the id scheme.
2. `npm test`. `tests/engine-parity.test.ts` reads the fixture and prints a
   cross-engine disagreement profile. That profile is a guard, not a
   published number.
3. `npm run validate`. The validator reads the same fixture, one tsx
   subprocess per chart per engine. It produces the README's Accuracy table.
4. If the validator figures change, update the `## Accuracy` table in
   `../README.md` in the same change. If the parity straddle changes, update
   the `gb-2` sentence under it.

## Re-run the Swiss validation and quote a figure

Never state an accuracy figure the harness has not produced.

1. `pip install pyswisseph`, then `npm run validate`. `validate:moshier`
   and `validate:astronomy` run one engine each.
2. `EPHE_PATH=/path/to/ephe npm run validate` for the DE431 oracle. The
   committed README run used pyswisseph in Moshier mode, an approximation
   that shares its theory with the Moshier engine and flatters that column.
   Say which oracle produced a figure.
3. Copy the figures into the `## Accuracy` table in `../README.md`, and the
   caveat with them. The `gb-2` straddle sentence under the table comes from
   the parity test in `npm test`, not from the validator.
4. If a figure crosses a slice width (a base is 18.75 arc-seconds), revisit
   `baseCapable` on the engine and `gradePrecision` in `src/calculator.ts`.

## Resolve a convention question

Apparent versus geometric was settled on 2026-06-21 against a Jovian
Archive chart, not by reasoning. Any new question gets the same treatment.

1. `npx tsx scripts/dev-convention-compare.ts --date=... --time=...
   --lat=... --lon=... --tz=...` prints one chart under both conventions.
2. Compare against an authoritative published chart.
3. Add the case to `tests/calculator.test.ts` or the engine test, then
   record the outcome in `decisions.md`. The MIT engine throws on
   `'geometric'`; keep it that way unless a measurement says otherwise.

## Check the licensing boundary

The exports map in `../package.json` is the boundary. `"."` reaches MIT code
only. `"./moshier"` reaches the GPL-3.0 `ephemeris` package, and a consumer
who imports `'hd-chart-engine/moshier'` is under GPL-3.0 terms. Serving that
JavaScript to a browser is distribution. Every document that names the
sub-path says so.

1. `tests/licensing-boundary.test.ts` lists the eight source files that must
   not import `ephemeris` or the Moshier module, and checks the optional
   peer dependency and the exports map.
2. `npm run build && npm test`. With `dist/` present,
   `tests/bundle-boundary.test.ts` proves the same against the built output.
3. `ephemeris` stays an optional peer dependency, never a dependency. Check
   `../NOTICE.md` when a dependency changes.

## Cut a release

1. A trusted publisher on npmjs.com must point at this repo and
   `.github/workflows/release.yml`. Without it, the publish step fails on
   auth. No npm token exists anywhere; do not create one.
2. Build, test, typecheck, and validate on `main` first. A burned version
   number is permanent on npm.
3. `npm version patch && git push --follow-tags`.
4. The `v*` tag runs `release.yml` on Node 24. It refuses a tag that
   disagrees with `package.json`, then runs typecheck, build, and the suite,
   then `npm publish --provenance --access public`.
5. Check the Actions run, then `npm view hd-chart-engine version`.

`ci.yml` runs on every push to `main` and `claude/**` and on pull requests.
The release workflow runs on a `v*` tag, plus a manual `workflow_dispatch`.
A push to `claude/**` never publishes. Do not dispatch the workflow from a
branch: the tag-versus-`package.json` guard runs only on a tag, so a manual
run reaches `npm publish` unchecked.

## Run CI on a cloud branch

Cloud sessions push `claude/*` branches, never `main`. A push there runs
`.github/workflows/ci.yml`: `npm ci`, typecheck, build, test,
`npm pack --dry-run`, on Node 20. Landing on `main` is a pull request. A
docs-only push runs the same gate, because the docs check is a test.

## Record a decision or write a spec

- A durable choice gets a row in `decisions.md` with the date, the reason,
  and the commit or spec section that carries it. Never delete a row; mark
  it superseded. Open the matching Notion Decisions record (see
  `../CLAUDE.md`, Session logging).
- A new spec goes in `docs/superpowers/specs/` with an index row in
  `README.md` and, when it governs behavior, a row in the guide's "Read this
  before changing that" table. `docs/superpowers/plans/` stays gitignored;
  a plan is on disk only.
- `tests/docs.test.ts` runs `scripts/docs_check.py` with the suite. It
  fails when a doc is not indexed, a quoted path does not exist, or
  `../CLAUDE.md` reaches its budget. It passes `--known-absent
  PROJECT_CHARTER.md` and `--known-absent docs/superpowers/plans/`, because
  a clone has neither. Canon outside this repo is quoted as
  `00_Resources/<file>`.
