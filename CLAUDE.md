# HD Chart Engine

`hd-chart-engine`: a public, MIT-licensed Human Design chart engine for JavaScript and TypeScript. A birth moment (date, time, latitude, longitude, IANA zone) goes in. Gate, line, color, tone, and base for all 13 bodies on both sides come out. Every other accurate engine routes through the Swiss Ephemeris (AGPL or paid). Here Swiss is only a development-time oracle, never distributed, never linked. A TypeScript library (vitest, tsup) published to npm with two entry points. The human entry point is `README.md`. The charter is private: `PROJECT_CHARTER.md` is a gitignored pointer, so a clone lacks it.

This file is a router: the rules that must not break, and the one document to read for each change. Everything else lives in `docs/`, indexed at `docs/README.md`.

## Read this before changing that

| Changing | Read first |
|---|---|
| Anything, for the first time | `README.md`, then `docs/architecture.md` |
| An engine or dependency, the wheel or activation math, birth-moment resolution, the API or precision grading, a fixture, a convention, the licensing boundary, a release, a cloud branch, a decision or spec, a new machine | `docs/changing-things.md` (one section per task) |
| Which file owns a behavior, how the package ships, `EPHE_PATH`, the validator thresholds | `docs/architecture.md` |
| Any accuracy figure | `README.md` (Accuracy), `scripts/validate-chart.py` (`THRESHOLDS`). The table comes from `npm run validate`, not from the parity test. |
| A dependency, after `docs/changing-things.md` | `NOTICE.md`, for the licensing note |
| Something that looks like a past decision | `docs/decisions.md` |
| How this repo is documented | `docs/superpowers/specs/2026-09-08-documentation-layout-design.md` |
| A conceptual HD question | Not here: `../../20-29 Properties/23 Plateworks HD/` (design.plateworks.org). This repo answers "what activated", never "what it means". |

New specs are written into `docs/superpowers/specs/` and added to `docs/README.md`.

## Invariants

1. **The exports map is the licensing boundary.** Nothing reachable from `src/index.ts` may import `src/ephemeris/moshier.ts` or the `ephemeris` package. `tests/licensing-boundary.test.ts` (source) and `tests/bundle-boundary.test.ts` (`dist/`) fail if that changes. `ephemeris` stays an optional peer dependency. Importing `'hd-chart-engine/moshier'` puts the consumer under GPL-3.0, and serving that JavaScript to a browser is distribution. Every doc that explains the sub-path to a consumer says so.
2. **The validator is independent.** `scripts/validate-chart.py` keeps its own wheel constants and never imports `src/wheel.ts`. Sharing them makes the test a tautology.
3. **Never state an accuracy figure the harness has not produced.** Re-run `npm run validate` and update the README table in the same change.
4. **Say what is not asserted.** Base needs a to-the-second birth time on any engine: one minute is about 1.8 base slices. The MIT engine is never base-capable, because its Design Moon error (26.656 arc-seconds) is wider than a base slice. Every chart carries a `precision` object.
5. **No silent convention changes.** Apparent was settled 2026-06-21 against a Jovian Archive chart (Pensacola 1993-10-18 01:30, Personality Sun 32.5.3.4, base 2). The MIT engine throws on geometric. Any change gets the same empirical treatment.
6. **Scope is activations only.** No bodygraph, Type, Authority, Profile, Cross, or interpretation. Meaning lives in the encyclopedia.
7. **Do not migrate `plateworks-hd` onto this package.** Examined and dropped 2026-07-27. If the math changes, hand-port the diff.
8. **Names are brand-neutral.** Repo and npm are `hd-chart-engine`. This folder is an independent git repo, and the workspace folder keeps its `Badwater ` prefix because the workspace guide routes on the exact name. Rename neither.
9. **Releases publish over OIDC trusted publishing with `--provenance`.** No npm token exists anywhere. `release.yml` refuses a tag that disagrees with `package.json`. The trusted publisher on npmjs.com must point at this repo and `release.yml`, or publish fails on auth.
10. **A cloud branch runs `ci.yml` only.** `claude/**` pushes never run `release.yml`. It takes a `v*` tag or a manual dispatch; a dispatch skips the tag check.

## Working here

- `npm run build`, then `npm test` and `npm run typecheck`, before any claim of done. Build first everywhere, CI and release included: 119 tests, of which the four bundle-boundary tests skip without `dist/`.
- `npm run validate` needs `pip install pyswisseph`. Without `EPHE_PATH` it runs pyswisseph in Moshier mode, which flatters the moshier column. The `.se1` files are gitignored and not redistributable.
- CI tests the Node 20 floor; release runs on Node 24. vitest is pinned to 3.x: vitest 4's rolldown binding broke `npm ci` on Linux (commit bd207c6).
- Docs-only pushes run CI. `tests/docs.test.ts` runs `scripts/docs_check.py` with `--known-absent PROJECT_CHARTER.md --known-absent docs/superpowers/plans/`. It path-checks this file, `README.md`, `AGENTS.md`, `docs/README.md` and the top-level docs, and holds this file under 2,000 tokens. Quote a known-absent path from the repo root, prefix included, or the check will not match it on a clone.
- In docs, quote the sub-path as `'hd-chart-engine/moshier'` or `"./moshier"` (code quotes inside the backticks) and the GitHub repo as `hd-chart-engine` bare. Anything else reads as a dead path.

## Session logging

Log every session to the repo `plateworks-session-log`. On Dom's Mac it is
checked out at `00-09 System/04 Session Log/` in the workspace; elsewhere,
clone it beside this one if it is not present. Its convention file,
CONVENTION.md, is
self-contained: format, tag set, and procedure. If the repo is unreachable,
append the entry to `SESSION_LOG.md` here under a heading saying it belongs in
the log repo, and say the push is pending.
