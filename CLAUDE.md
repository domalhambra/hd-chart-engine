# CLAUDE.md — HD Chart Engine

Operator manual for Claude. The human entry point is `README.md`; the project history and the decisions behind it are in `PROJECT_CHARTER.md`. Read the README before nontrivial work here — its accuracy tables are the package's only credibility.

## What this project is

`hd-chart-engine`: a public, MIT-licensed Human Design chart engine for JavaScript and TypeScript. It turns a birth moment (date, time, latitude, longitude, IANA zone) into gate, line, color, tone and base for all 13 bodies on both the Personality and Design sides.

It exists because every other accurate HD engine routes through Swiss Ephemeris (AGPL or paid). This one does not depend on it. Swiss appears only as a development-time accuracy oracle, never distributed and never linked.

- GitHub: `domalhambra/hd-chart-engine` (public, MIT). npm: `hd-chart-engine`.
- This folder is an independent git repo. It is not part of `plateworks-os`.

**The folder keeps its `Badwater ` prefix on purpose; the package does not.** Repo and npm names are deliberately brand-neutral so anyone can adopt the package. Do not add a brand prefix to the package, and do not rename the folder — the workspace `CLAUDE.md` Projects table routes on this exact folder name. (This repo uses an ordinary `.git` directory, not an external store, so the pointer-file hazard that applies to `badwater-{os,hd,pkm}` does not apply here.)

## The engine split (the rule that shapes everything)

Two ephemeris engines, two licenses. Keep them apart.

| Path | Engine | License | What it can assert |
|---|---|---|---|
| Default — `hd-chart-engine` | `astronomy-engine` | MIT | Gate, line and color. Never reports base as reliable. |
| Opt-in — `hd-chart-engine/moshier` | `ephemeris` (patched Moshier) | GPL-3.0 | Sub-arcsecond on direct bodies; base becomes meaningful at second-precision birth times. |

- `ephemeris` is an **optional peer dependency**. Nothing reachable from the default entry point may import it. `tests/licensing-boundary.test.ts` fails the build if that changes. Never "simplify" by importing the Moshier path from `src/index.ts`.
- Importing the `moshier` sub-path puts the consumer's combined work under GPL-3.0. Serving that JavaScript to a browser is distribution. Say so plainly in any doc that mentions the sub-path.

## Where the math lives

| Path | What |
|---|---|
| `src/ephemeris/astronomy.ts` | the MIT engine — apparent ecliptic longitudes |
| `src/ephemeris/moshier.ts` | the GPL engine, plus the time-base fix (input is UT, upstream assumes TT) |
| `src/ephemeris/delta-t.ts` | ΔT, which the time-base fix depends on |
| `src/wheel.ts` | the 64-gate sequence and the slice widths — the wheel math |
| `src/activation.ts` | longitude → gate / line / color / tone / base |
| `src/birth-moment.ts` | DST-aware historical birth-moment resolution |
| `src/calculator.ts`, `src/index.ts` | `calculateChart`, the public entry point |
| `scripts/validate-chart.py` | the `pyswisseph` validator (`npm run validate`) |
| `docs/ephemeris-ground-truth.md` | the per-body DE431 error tables the README cites |

## Build & test

```sh
npm test          # vitest, ~114 tests
npm run typecheck
npm run validate  # both engines against pyswisseph — needs `pip install pyswisseph`
```

The validator keeps its own copy of the wheel constants and does not import `src/wheel.ts`. That is deliberate: sharing them would make the test a tautology. Do not refactor it to reuse the source.

## Guardrails

- **Never state an accuracy figure the harness has not produced.** Re-run `npm run validate` and update the README table in the same change.
- **Say what is not asserted.** Base needs a to-the-second birth time on any engine. Every chart carries a `precision` object; keep it honest.
- **No silent convention changes.** Apparent-versus-geometric is settled by measurement against a Jovian Archive chart. Any change gets the same empirical treatment.
- **Scope is activations only.** Bodygraph rendering, Type and Authority, Profile, Incarnation Cross, and all interpretive content are out of scope. Meaning lives in the encyclopedia.
- **Conceptual HD questions do not belong here.** What a gate means, how a channel reads, Badwater's own take — route to `Badwater HD/` (design.plateworks.org). This repo answers "what activated", never "what it means".
- **Do not migrate `plateworks-hd` onto this package.** That milestone was examined and dropped on 2026-07-27; the reasoning is in `PROJECT_CHARTER.md`. Hand-port if the math ever changes.

## Releasing

`npm version patch && git push --follow-tags`. CI publishes over OIDC trusted publishing, so no npm token exists on any machine or in any secret. The workflow refuses to publish if the tag disagrees with `package.json`.

## Session logging

Log sessions to the Notion **Session Log** database, parent `{"type": "data_source_id", "data_source_id": "60f3ea17-4424-4815-8a4b-6a4d4de61c4f"}`. Set `Session Title` (title) and `date:Date:start` (ISO date — the expanded property name, not `Date`), plus `Activity` (build | fix | research | write | ops | plan) and `Status` (Complete | In Progress | Blocked). `Quarter` computes itself from Date; never set it by hand.

**No Notion Repo page is recorded for this repo** (checked 2026-08-17). Leave `Repo` unset and say so in the closing summary. Do not borrow another repo's relation.

`Tags` is a JSON array **encoded as a string**, not a native array, and it is a constrained multi-select. A value outside the allowed set fails the whole write with a `validation_error`. Allowed today: `skill development`, `Notion`, `admin`, `Human Design`, `coaching`, `writing`, `DMIHC`, `Claude`, `Ghost CMS`, `SEO`, `Tecopa Plateworks`. Pick from these; do not invent one. If none fit, omit `Tags`. A missing tag costs nothing; an invented one loses the whole log.

Body sections: What We Did / Open Threads / Next Steps / Notes. If Notion is unreachable, append the entry to a repo-local `SESSION_LOG.md` (newest first, append-only, never rewrite history) and say so plainly in the summary.
