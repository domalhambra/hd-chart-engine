# Decisions

Durable choices that constrain later work, dated, with the reason and where
the decision is carried. Never delete a row. When a decision is reversed,
mark the old row superseded and add the new one under its own date.

Rows cite a commit in this repo, a section of one of the two inherited
reports (`chart-validation-report.md`, `ephemeris-ground-truth.md`), or the
extraction plan under `docs/superpowers/plans/`. The plan and the charter are
gitignored (see the 2026-07-27 rows), so a clone has neither. Where a row
cites the charter, the pointer file `../PROJECT_CHARTER.md` says where it
lives.

## 2026-05-06 to 2026-05-08 (inside Plateworks HD, before extraction)

The calculator lived in the encyclopedia site. These rows are the ones that
still shape this package.

| Decision | Why | Source |
|---|---|---|
| Validation is stratified by field: gate and line zero-tolerance, color and tone rate-capped, base exploratory. **Superseded 2026-07-27** by per-engine thresholds. | The sub-line slices sit below the precision floor of either ephemeris. | `chart-validation-report.md`, Conclusion |
| Sub-line disagreements that cluster at slice boundaries are not bugs in either engine. | Two independent polynomials that differ at all will sort an edge body differently. | `chart-validation-report.md`, Results. Formalised later as the straddle rule. |
| The color threshold was relaxed from zero to 5 percent. **Superseded 2026-07-27.** | Three color disagreements in 780 rows, all at boundaries. | `chart-validation-report.md`, Spec amendment |
| **True Node, not Mean Node.** | A Jovian Archive chart (Pensacola, 1993-10-18 01:30) matched on 22 activations and disagreed on all four node activations. The gap matched the True-versus-Mean oscillation. | `chart-validation-report.md`, True Node correction; `../tests/ephemeris-astronomy.test.ts` and `../tests/ephemeris-moshier.test.ts` ("derives True Node, not Mean Node") |
| The tone threshold was widened from 5 to 10 percent. **Superseded 2026-07-27.** | The True Node raised the cross-engine noise floor. Gate and line stayed at zero. | `chart-validation-report.md`, True Node correction |

## 2026-06-20 to 2026-06-21 (the ground-truth investigation)

| Decision | Why | Source |
|---|---|---|
| The node derivation is not the source of node error. The Moon model is. | Three derivations agreed to under 0.05 arc-seconds across 60 moments. | `ephemeris-ground-truth.md`, Finding 1 |
| The accurate engine is the `ephemeris` package (Moshier theory) fed the instant plus ΔT. | Upstream treats a UT input as TT, about 48 seconds. With ΔT every direct body is sub-arcsecond. | `ephemeris-ground-truth.md`, Engine-selection spike |
| The Moshier swap kept the geometric convention on 2026-06-21. **Superseded the same day.** | Apparent flipped 2 of 104 fixture lines, an unacceptable change on an unresolved question. | `ephemeris-ground-truth.md`, Implemented |
| **Human Design uses apparent positions** (aberration and nutation included). Settled by measurement, not assumed. | The Pensacola chart agrees under both conventions down to tone and splits on base. Jovian reports the apparent value. The geometric engine had 2 lines wrong. | `ephemeris-ground-truth.md`, Convention resolved; `../src/ephemeris/types.ts`; `../tests/calculator.test.ts` (Jovian calibration) |
| Base is reliable only with a to-the-second birth time. One minute of clock uncertainty is about 1.8 base slices of Moon motion. | The birth time, not the ephemeris, is the limit once the engine is sub-arcsecond. | `ephemeris-ground-truth.md`, Precision-aware confidence; `../src/calculator.ts` `gradePrecision` |

## 2026-07-27 (extraction day)

| Decision | Why | Source |
|---|---|---|
| **The package is MIT with an opt-in GPL-3.0 engine.** The exports map is the licensing boundary: `"."` is MIT-only, `"./moshier"` reaches the `ephemeris` package. `ephemeris` is an optional peer dependency. | Every other accurate HD engine routes through Swiss Ephemeris (AGPL or paid). A closed-source adopter needs a clean MIT path. | commits dee22e5, da0bea3; `../NOTICE.md`; `../tests/licensing-boundary.test.ts` |
| Nothing reachable from `../src/index.ts` may import the Moshier module. A test fails the build if that changes. | One stray import would subject every downstream consumer to GPL-3.0 terms. | `../tests/licensing-boundary.test.ts`; `../src/ephemeris/types.ts` header |
| Repo and npm names are `hd-chart-engine`, unscoped and brand-neutral. | The name was unclaimed on npm. Anyone can adopt a package that carries no property prefix. | extraction plan, Open questions 1; commit dee22e5; `../package.json` |
| Wheel data is self-contained in `../src/wheel.ts`, transcribed and verified against each gate's recorded starting longitude. | A standalone package cannot depend on the encyclopedia's synthesis index JSON. | commit e4028ea; `../tests/wheel.test.ts` |
| `../src/wheel.ts` holds data only. `../src/activation.ts` is pure math with no ephemeris knowledge. `../src/ephemeris/types.ts` is the seam. | Each layer tests without the one below it. | extraction plan, Responsibility boundaries |
| ΔT is the Espenak-Meeus polynomials, ported unchanged. | The `ephemeris` package needs a TT instant. The polynomials are public domain and accurate to about a second. | commit 4b2cc45; `../src/ephemeris/delta-t.ts` |
| `EphemerisEngine` carries `baseCapable`. Precision grading reads it rather than sniffing `engine.name`. | A capability flag survives a renamed engine. | commit 6514fe2 |
| `moduleResolution` is `Bundler`, not the `NodeNext` the plan named. | `NodeNext` needs explicit `.js` extensions on relative imports, which the ported code does not use. tsup produces the published output. | commit 6514fe2; `../tsconfig.json` |
| DST gaps and fall-back ambiguities are detected explicitly and warn rather than throw. | The inherited fallback branch could never fire. An hour of error moves the Moon about 33 arc-minutes, enough to change gate and line. | commit b27aa6d; `../src/birth-moment.ts`; `../tests/birth-moment.test.ts` |
| Place-name and zone resolution stay out of the package. `tz` is a required IANA zone the caller resolves. | A geo-tz lookup needs a network call or a multi-megabyte shapefile, and the package must run in a browser. | commit b27aa6d (the API), commit 74a09d8 (the reason); `../src/birth-moment.ts` `BirthInput` |
| The Moshier engine is pinned to Swiss reference values at under 3 arc-seconds, with direct assertions on the ΔT shift and the aberration separation. | An upstream change to `ephemeris` must not silently reintroduce the 26 arc-second Moon error. | commit 76747d9; `../tests/ephemeris-moshier.test.ts` |
| **The MIT engine runs apparent.** Its geometric path throws rather than returning the wrong convention. | The inherited code ran it geometric. At JD 2447956.5 geometric is 21.1 arc-seconds from Swiss on the Sun where apparent is 0.46. | commit 87a9491; `../src/ephemeris/astronomy.ts`; `../tests/ephemeris-astronomy.test.ts` |
| Both engines derive the node the same way: the normal of the Moon's orbital plane from two directions a short arc apart. | The engines stay comparable, and the arc-normal beats L = r × v off `GeoMoonState` (4.64 versus 5.17 arc-seconds). | commit 87a9491 |
| `calculateChart(input, { engine })` takes an options bag and defaults to the MIT engine. The chart carries `v: 1`, the engine name, a `precision` object, and `warnings`. | Precision depends on both birth-time precision and engine capability. The package owns it, not a consumer's UI. | commit dc3cdc8; `../src/calculator.ts` |
| The Jovian Archive calibration is a test: Pensacola 1993-10-18 01:30 resolves the Personality Sun to 32.5.3.4, base 2. | Ground truth from an independent authority, not two engines agreeing with each other. | commit dc3cdc8; `../tests/calculator.test.ts` |
| **Parity asserts boundary straddles, not zero disagreement.** Every gate or line disagreement must sit inside the 30 arc-second budget. Median separation must stay under 5 arc-seconds. | The `gb-*` fixtures put bodies on slice edges on purpose. The median guard catches a silent revert to geometric, which no straddle rule would. | commit f43d65e; `../tests/engine-parity.test.ts` |
| The validator takes `--engine` and keeps separate longitude budgets for direct bodies and lunar nodes. | The two fail for different reasons. A first run with one 10 arc-second budget failed on a 32 arc-second node while the worst direct body was 2.8. | commit 74a09d8; `../scripts/validate-chart.py` `THRESHOLDS` |
| The validator keeps its own copy of the wheel constants and never imports `../src/wheel.ts`. | Sharing them would make the test a tautology. | `../scripts/validate-chart.py` header |
| The two inherited reports stay tracked, each with a preamble saying what in them is superseded. | They are the evidence behind the README's accuracy claims. | commit 74a09d8 (added both reports with their preambles); commit 11f7ada (removed the charter and the plan, and left the reports tracked) |
| Every figure in the README traces to a committed run, and the oracle caveat is stated rather than buried. | The accuracy tables are the package's only credibility. | commit 10f92cd; `../README.md` |
| `moshier-entry.ts` lives at the `src/` root. `../tests/bundle-boundary.test.ts` checks `dist/` and skips when it is absent. | tsup preserved structure from the entries' common root and the exports map pointed at a file that did not exist. Source-level checks could never catch that. | commit 5b2f8c7 |
| The charter and the extraction plan are gitignored. The charter is a 440-byte pointer to the workspace. | The plan carries absolute local paths and the charter carries workspace routing and strategy. Neither belongs in a public package. | commit 11f7ada; `../.gitignore`; `../PROJECT_CHARTER.md` |
| CI runs typecheck, build, test, and `npm pack --dry-run` on Node 20, the floor in `engines`. **Build runs before test.** | The bundle-boundary suite skips without `dist/`. Testing first would silently skip the checks that prove the GPL dependency stays out of the MIT entry. | commit 8d3bb42; `../.github/workflows/ci.yml` |
| CI ignores `**.md` changes. **Superseded 2026-09-08.** | Doc-only commits stayed off the runner. | commit 8d3bb42 |
| The Swiss validation is a manual workflow, not a push gate. | It spawns 60 tsx subprocesses and measures something that changes only when an engine or dependency does. | commit 8d3bb42; `../.github/workflows/validate-ephemeris.yml` |
| The whole-circle smoke test steps at 0.1 degrees. | Halved the suite's runtime. No practical step is exhaustive over 69,120 base slices, and the boundary cases are asserted exactly. | commit 8d3bb42; `../tests/activation.test.ts` |
| vitest is pinned to 3.x. | vitest 4 pulled rolldown, whose wasm binding's optional tree the lockfile recorded inconsistently, so `npm ci` failed on Linux only. | commit bd207c6; `../package.json` |
| **Releases publish from CI over OIDC trusted publishing** with `--provenance`. No npm token exists anywhere. The workflow refuses a tag that disagrees with `package.json`. | A burned version number is permanent on npm. The attestation links the tarball to the commit that built it. | commit b996d14; `../.github/workflows/release.yml` |
| The release workflow runs Node 24 while CI runs Node 20. | Trusted publishing needs npm 11.5.1 or newer, and Node 20 ships npm 10. | commit b996d14 |
| 0.1.0 was published before the release workflow existed. 0.1.1 is the first tag the workflow can publish. | The install line landed with 0.1.0 live (commit 22670d0) before the workflow (commit b996d14). | commits 22670d0, b996d14, cf13a4c; tag `v0.1.1` |
| **Plateworks HD is not migrated onto this package.** Hand-port if the math changes. | The calculation math had been stable since 2026-06-21. The parity suite, the validator, and the Jovian calibration prove the package. Integration would prove only integration. | `../CLAUDE.md` guardrail; the charter (private), "Where this landed" |

## 2026-08-14

| Decision | Why | Source |
|---|---|---|
| CI also runs on `claude/**` pushes. The release workflow stays off branch pushes: `v*` tags and manual dispatch only. | Cloud sessions push there and never to `main`, so the gate fired only after a human opened the PR. A cloud branch must not publish to npm. | commit f1eb71f; `../.github/workflows/ci.yml` |
| Provenance comments name Plateworks HD, not Badwater HD. Repo and package names are unchanged. | The encyclopedia repo was renamed. The package was brand-neutral from the start. | commit 6050026 |

## 2026-08-17

| Decision | Why | Source |
|---|---|---|
| The repo gets a `CLAUDE.md` consolidating the charter's guardrails and the MIT/GPL split. **Superseded 2026-09-08** by the router layout. | It was the only routed project without one. | commit 621354c |
| Sessions log with no `Repo` relation. **Superseded 2026-09-08.** | No Notion Repo row was found at the time. | commit 621354c |
| The workspace folder keeps its `Badwater ` prefix. The package name stays brand-neutral. | The workspace guide routes on the exact folder name. | `../CLAUDE.md` (commit 621354c) |

## 2026-09-08

| Decision | Why | Source |
|---|---|---|
| This repo follows the documentation standard at the Medium tier: `../CLAUDE.md` is a router under 2,000 tokens, `architecture.md` and `changing-things.md` carry the detail, and the vendored `../scripts/docs_check.py` runs from `../tests/docs.test.ts` with the suite. | Eleven source modules, a validation harness, and a release workflow. A library with one surface and no native app is not Large. | `superpowers/specs/2026-09-08-documentation-layout-design.md` |
| The check runs with `--known-absent PROJECT_CHARTER.md`. The charter stays a gitignored pointer. | A clone has no charter, and the docs may still say where it lives. | the layout spec; `../PROJECT_CHARTER.md` |
| `../.gitignore` ignores `docs/superpowers/plans/` instead of `docs/superpowers/`. Specs under `docs/superpowers/specs/` are tracked; the extraction plan stays on disk only, and the check runs with `--known-absent docs/superpowers/plans/`. Narrows the 2026-07-27 row, which stays true. | A layout spec a clone cannot read cannot govern the clone, and the check has to reach CI. The plan carries absolute local paths and stays private. | the layout spec; `../.gitignore` |
| `../.gitignore` also ignores Python bytecode caches. | `../scripts/docs_check.py` is the repo's first importable Python file, and running it writes a cache directory next to it. A compiled artifact must not reach a public repo. | `../.gitignore` |
| CI no longer ignores `**.md` changes. Supersedes the 2026-07-27 `paths-ignore` row. | The docs check is a test. A docs-only push must run the gate it exists for. | the layout spec; `../.github/workflows/ci.yml` |
| Sessions log against the `HD Chart Engine` row in the Notion Repos database. Supersedes the 2026-08-17 row. | The row exists. Fetched 2026-09-08: the page is titled `HD Chart Engine`, its `Remote` property names this repo, and it sits in the Repos data source. | `../CLAUDE.md`, Session logging |
| The old guide's "Where the math lives" table moved to `architecture.md`, Module map. The router's table routes "which file owns a behavior" there. | A module map describes and does not prescribe. The router carries rules and routes. | `../CLAUDE.md`; `architecture.md`, Module map |
| The old guide's "Build & test" block moved to `../README.md`, Prove a change, and the preamble of `changing-things.md`. The build-before-test gate and the test count stay in the router's Working here. | A procedure belongs in the task doc. The gate is a rule, so it stays in the router. | `../CLAUDE.md`, Working here |
| The old guide's "Releasing" procedure moved to `changing-things.md`, Cut a release, and `../README.md`, Ship it. OIDC, `--provenance`, the tag check, and the trusted publisher stay in the router as invariant 9. | The same split: the steps are a procedure, the publish constraints are a rule. | `../CLAUDE.md`, invariant 9 |
| The old guide's workspace-internal note is gone: the git-store pointer-file hazard, and the line saying this folder is an independent repo outside `plateworks-os`. This repo uses an ordinary `.git` directory. Invariant 8 keeps the part a public reader needs: the folder keeps its `Badwater ` prefix and the names stay brand-neutral. | Workspace-internal. It tells a public reader nothing about this repo. | `../CLAUDE.md`, invariant 8 |
| The old guide's opening line, "Read the README before nontrivial work here", and its row for `ephemeris-ground-truth.md` are folded into the router's first row and its "Any accuracy figure" row, and into the Reference table of `docs/README.md`. | One router table, not a preamble plus a table. | `../CLAUDE.md`, Read this before changing that; `docs/README.md`, Reference |

## Rejected and deferred

| Date | Item | Why | Source |
|---|---|---|---|
| 2026-06-20 | `astronomia` as the accurate engine. | Its Moon is Meeus's abridged ELP: 12.47 arc-seconds mean, no better than astronomy-engine. | `ephemeris-ground-truth.md`, Engine-selection spike |
| 2026-06-20 | Porting Moshier or ELP series from scratch. | The `ephemeris` package plus ΔT reaches sub-arcsecond without it. | `ephemeris-ground-truth.md` |
| 2026-07-27 | A scoped npm name. | `hd-chart-engine` was unclaimed. | extraction plan, Open questions 1 |
| 2026-07-27 | Zero gate and line disagreement as the parity assertion. | Failed on `gb-2` Design Uranus, 6.49 arc-seconds apart across an exact gate boundary. | commit f43d65e |
| 2026-07-27 | One combined longitude budget in the validator. | Fails on a definitional node difference or hides a real direct-body regression. | commit 74a09d8 |
| 2026-07-27 | Geocoding or zone lookup inside the package. | Network or a multi-megabyte shapefile, in a browser library. | `../README.md`; `../src/birth-moment.ts` |
| 2026-07-27 | Running the Swiss validation on every push. | Minutes per run, and it measures the engines, not application code. | commit 8d3bb42 |
| 2026-07-27 | A Node version matrix in CI. | Testing the Node 20 floor catches more than testing the newest release. Add a matrix if that stops being true. | `../.github/workflows/ci.yml` comment |
| 2026-07-27 | vitest 4. | Rolldown's wasm binding broke `npm ci` on Linux. 3.2.7 clears the same advisories. | commit bd207c6 |
| 2026-07-27 | Committing the Swiss `.se1` data files. | Not redistributable. `EPHE_PATH` points at a local copy instead. | `../.gitignore`; `../.github/workflows/validate-ephemeris.yml` comment |
| 2026-07-27 | Migrating Plateworks HD onto the package. | See the 2026-07-27 row. Reconsider only if the site ever moves to the MIT engine. | `../CLAUDE.md`; the charter (private) |
| 2026-07-27 | A second-precision UI inside the package. | The precision model moved into the chart object. Any UI belongs to a consumer. | extraction plan, Open questions 2; commit dc3cdc8 |
| 2026-08-14 | Running the release workflow on `claude/**` branches. | A cloud branch has no business publishing to npm. | commit f1eb71f |
| 2026-08-17 | Renaming the workspace folder to drop the `Badwater ` prefix. | The workspace routes on the exact name. | `../CLAUDE.md` (commit 621354c) |
