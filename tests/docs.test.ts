import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * The documentation standard's check, run with the suite.
 *
 * `docs/README.md` must index every document under `docs/`, every path the
 * guide and the docs quote must exist, and `CLAUDE.md` must stay under its
 * token budget. The check itself is `scripts/docs_check.py`, vendored byte
 * for byte from the workspace. This test only runs it. Python is on every
 * Mac and every GitHub runner, so the reference script stays untouched.
 *
 * Two paths are allowed to be absent. `PROJECT_CHARTER.md` is a gitignored
 * pointer to the private charter, so a clone has no file at all.
 * `docs/superpowers/plans/` is gitignored too: the extraction plan is
 * indexed because the check walks the filesystem locally, but in CI the
 * folder does not exist.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const ARGS = [
  'scripts/docs_check.py',
  ROOT,
  '--require', 'docs/architecture.md',
  '--require', 'docs/changing-things.md',
  '--require', 'docs/decisions.md',
  '--known-absent', 'PROJECT_CHARTER.md',
  '--known-absent', 'docs/superpowers/plans/',
]

describe('documentation', () => {
  it('is indexed, quotes only paths that exist, and keeps the guide under budget', () => {
    const run = spawnSync('python3', ARGS, { cwd: ROOT, encoding: 'utf8' })
    expect(run.error, 'python3 must be on PATH').toBeUndefined()
    expect(run.status, `docs_check exited ${run.status}\n${run.stdout}${run.stderr}`).toBe(0)
  })
})
