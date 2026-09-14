# Documentation index

Every document in this folder, and when to read it. `tests/docs.test.ts`
runs `scripts/docs_check.py` with the suite: it fails when a file under
`docs/` is missing from this list, when a quoted path in `../CLAUDE.md`,
`../README.md`, `../AGENTS.md`, this file, or any top-level doc here does
not exist, when the guide reaches 2,000 tokens, or when it stops routing to a
task doc. It runs with `--known-absent PROJECT_CHARTER.md` and
`--known-absent docs/superpowers/plans/`, because a clone has neither. Quote
a known-absent path from the repo root, prefix included. Quote the plan as
`docs/superpowers/plans/2026-07-27-hd-chart-engine-extraction.md`, or the
resolved path will not match the known-absent entry.

## Working documents

| Document | Read when |
|---|---|
| `architecture.md` | You are new here, or you need to know which file owns a behavior and which test covers it. The two layers behind one licensing boundary, the module map, delivery (the npm package, CI, the release workflow), `EPHE_PATH`, the verification harness and its thresholds. |
| `changing-things.md` | You are about to change something. One section per task: set up a machine, an engine or a dependency bump, the wheel or activation math, birth-moment resolution, the public API or precision grading, a fixture chart, the Swiss validation and its figures, a convention question, the licensing boundary, a release, a cloud branch, a decision or spec. |
| `decisions.md` | Something looks like a past decision and you want the reason before you touch it. Dated from 2026-05-06, with superseded rows kept and marked, and a "Rejected and deferred" table. |

## Specifications

| Document | Read when |
|---|---|
| `superpowers/specs/2026-09-08-documentation-layout-design.md` | Changing how this repo is documented: the Medium tier, why the charter is `--known-absent`, why `docs/superpowers/plans/` stays gitignored while the specs folder is tracked, and why CI no longer ignores `**.md`. |

## Plans and handoffs

History, not to-do lists. No handoff file exists; `architecture.md` is the
current record of state.

| Document | Read when |
|---|---|
| `docs/superpowers/plans/2026-07-27-hd-chart-engine-extraction.md` | You want the task-by-task record of the extraction from Plateworks HD, the responsibility boundaries, and the open questions put to Dom. Gitignored, on disk only: it carries absolute local paths, so a clone does not have it. It names `NodeNext`; the repo shipped `moduleResolution: Bundler` (commit 6514fe2). |

## Reference

The two reports inherited from Plateworks HD. Both are tracked on purpose:
they are the evidence behind the accuracy claims in `../README.md`. Each
opens with a 2026-07-27 preamble that says which of its conclusions are
superseded. Where a report conflicts with `architecture.md`, the
architecture doc describes what exists.

| Document | Read when |
|---|---|
| `chart-validation-report.md` | You want the original 2026-05-06 validation of the `astronomy-engine` calculator inside the site. History: it ran geometric against geometric, and its "base is not asserted" reflects the accuracy of that time. The preamble names both. Still worth reading: why sub-line disagreements cluster at slice boundaries, the argument the straddle rule formalises. |
| `ephemeris-ground-truth.md` | You want the 2026-06-20 investigation that produced the engine choice. What still stands: the ΔT diagnosis (the Moshier error was a UT-versus-TT time base), the apparent-convention resolution against a Jovian Archive chart, and the finding that the node derivation is not the source of node error. The preamble names the two conclusions that measurement in this repo superseded. |

## Canon that lives outside this repo

In the Plateworks OS workspace, at `../../00-09 System/00 Resources/` from
this repo on Dom's Mac; quoted here as `00_Resources/` by convention. A clone
does not have it.

| Document | Governs |
|---|---|
| `00_Resources/documentation-standard.md` | The shape of this folder and the check that enforces it. |
