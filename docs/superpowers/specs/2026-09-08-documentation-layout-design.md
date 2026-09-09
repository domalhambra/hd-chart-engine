# Documentation layout

**Status:** Shipped 2026-09-08.
**Scope:** How this repo is documented, per the workspace's
`00_Resources/documentation-standard.md`.
**Tier:** Medium. Ten TypeScript modules plus an ambient declaration under
`src/`, five development and validation scripts, eleven test files with a
30-chart fixture, and three workflows including an OIDC release. Not Large: one surface (an npm
library), no host, no native app, no runbooks. The charter is a private
workspace file, and the repo keeps only a gitignored pointer to it.

## What was wrong

- `CLAUDE.md` (commit 621354c, 2026-08-17) was an operator manual, not a
  router: an inline module map, a build section, a release procedure, and no
  route to `docs/README.md`, which did not exist. Two backtick tokens read as
  dead paths to the check: the owner-qualified repo name and the
  `moshier` import specifier.
- Its session-logging section said no Notion Repo page existed for this repo
  (checked 2026-08-17). The `HD Chart Engine` row exists in the Repos
  database.
- No `docs/README.md`, no `docs/architecture.md`, no
  `docs/changing-things.md`, no `docs/decisions.md`, no `AGENTS.md`. Roughly
  sixty durable choices lived in two inherited reports, the extraction plan,
  commit messages, and workflow comments.
- `README.md` said `npm test` runs 114 tests. That was true on a fresh clone,
  and 118 with `dist/` present, because the four bundle-boundary tests skip
  without a build. `tests/docs.test.ts` moved both counts to 115 and 119. The
  README had no "Where to go next" table and did not name the guide.
- `docs/ephemeris-ground-truth.md` quoted `docs/reference/chart-validation-report.md`,
  the pre-extraction path. The check did not report it only because the
  top-level docs pass runs after `docs/README.md` exists.
- `.gitignore` (commit 11f7ada) ignored `docs/superpowers/` wholesale, so a
  layout spec written there would never reach GitHub or CI.
- `.github/workflows/ci.yml` (commit 8d3bb42) carried `paths-ignore: ['**.md']`
  on both `push` and `pull_request`, so a docs-only push skipped the gate the
  docs check needs.

## The layout

| File | Role |
|---|---|
| `README.md` | What the package is, install and usage, the engine choice, the accuracy tables with their oracle caveat, what is not asserted, the three corrections, prove a change, ship it, where to go next. The accuracy and correction sections stay here because the README is published in the npm tarball and is the package's public evidence. |
| `CLAUDE.md` | A router under 2,000 tokens: identity, the "read this before changing that" table, ten invariants with reasons, working here, session logging inlined with the Repo relation. |
| `AGENTS.md` | Points any other agent at the guide, with the build and test commands and the two rules an agent breaks most easily. |
| `docs/README.md` | Every document with a "read when": working docs, this spec, the gitignored plan, the two inherited reports as reference, canon outside the repo. |
| `docs/architecture.md` | The two layers behind one licensing boundary, the module map (file, owns, tested by), runtime behavior, delivery (the npm package, CI, the release workflow), environment (`EPHE_PATH`), verification and the validator thresholds, cross-repo dependencies. |
| `docs/changing-things.md` | One section per task, twelve in all, from setting up a machine to cutting a release. |
| `docs/decisions.md` | Dated log from 2026-05-06, with superseded rows kept and marked, plus a "Rejected and deferred" table. |
| `docs/chart-validation-report.md`, `docs/ephemeris-ground-truth.md` | Inherited history, tracked as the evidence behind the README's accuracy claims. Each opens with a 2026-07-27 preamble naming what is superseded. |
| `docs/superpowers/plans/2026-07-27-hd-chart-engine-extraction.md` | The extraction plan. Gitignored, on disk only: it carries absolute local paths. |
| `scripts/docs_check.py` | The check, vendored byte for byte from the workspace. The pair still needs a row in the workspace's `00_Resources/VENDORED.md`; that row is not yet written. |
| `tests/docs.test.ts` | Spawns `python3` on the check with the suite and asserts exit 0. |

## What differs from the earlier rollouts

- **A third wiring pattern.** The Garden vendors the check and runs it under
  pytest. Reno and the Hub port it to vitest. This repo vendors the Python
  script and spawns it from a vitest test, so the reference script stays
  byte-identical and the suite stays `npm test`.
- **`--known-absent PROJECT_CHARTER.md`.** The charter moved to the private
  workspace on 2026-07-27 (commit 11f7ada). The pointer file is gitignored,
  so a clone has no charter, and the docs still say where it lives.
- **`--known-absent docs/superpowers/plans/`, and `.gitignore` narrowed.**
  The rule `docs/superpowers/` became `docs/superpowers/plans/` so this spec
  is tracked and reaches CI, while the extraction plan stays on disk only.
  The check walks the filesystem, so locally the plan must be indexed. In CI
  the file does not exist, so the index row would be a dead path without the
  prefix entry. The index row and the `decisions.md` preamble therefore quote
  the plan with its `docs/` prefix. The check resolves a backtick token from
  the quoting file's folder first and falls back to the repo root only when
  that target is absent, so a bare `superpowers/plans/...` token quoted
  inside `docs/` resolves without the `docs/` prefix on a clone and never
  matches the known-absent entry. Round 1 of the fact-check found exactly
  that: the wired command returned two dead paths on a clone-shaped tree. The
  2026-07-27 decision row (charter and plan gitignored) stays true.
- **CI runs on docs-only pushes.** Both `paths-ignore: ['**.md']` blocks come
  out of `ci.yml`. The docs check is a test, and a docs change must run the
  gate it exists for. The 2026-07-27 `paths-ignore` decision is marked
  superseded.
- **No files moved and no specs copied in.** Badwater OS holds no spec or
  plan for this repo. The two inherited reports stay at the top of `docs/`,
  where the check path-checks them. One token in
  `docs/ephemeris-ground-truth.md` changed to `chart-validation-report.md`,
  the smallest edit that makes the quote true. That file already carried a
  post-dated preamble, so it had been edited after its date before. The same
  stale `docs/reference/` prefix also survives in a comment in
  `scripts/dev-node-methods.ts`, which the check never reads because path
  extraction covers Markdown only. That comment is corrected in the same
  change.
- **`.gitignore` also ignores `__pycache__/`.** Running the vendored Python
  check writes a bytecode cache beside it. This repo had no rule for one,
  because it had no importable Python file until now.
- **Quoting conventions the check forces.** The `moshier` sub-path is quoted
  as `'hd-chart-engine/moshier'` or `"./moshier"`, with the code quotes
  inside the backticks so the extractor skips it. The GitHub repo is quoted
  as `hd-chart-engine`, never owner-qualified. A sibling workspace repo is
  quoted as `../<Folder name>/<path>`. The folder names carry spaces, which
  the check skips, so it does not validate those quotes.
- **A public repo.** Nothing here describes private workspace strategy. The
  Notion data source ids are inlined, as the previous guide already did.

## Done means

- `npm run build`, then `npm test` and `npm run typecheck` pass,
  `tests/docs.test.ts` included, with the flags named above.
- Every claim in the new docs was checked against the code, the workflows,
  and the git log by a second pass before commit.
- `docs/decisions.md` carries the 2026-09-08 rows for the tier, the two
  known-absent entries, the `.gitignore` narrowing, the CI change, and the
  Notion Repo relation.
