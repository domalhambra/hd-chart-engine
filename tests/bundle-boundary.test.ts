import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The MIT promise, checked against what actually ships.
 *
 * tests/licensing-boundary.test.ts checks the source. This checks the build
 * output, which is what a consumer installs. Both are needed: source can be
 * clean while the exports map points at a path that does not exist, or a
 * bundler change can inline the GPL dependency into the default entry.
 *
 * Skips when dist/ is absent so `npm test` works on a fresh clone. CI and the
 * release flow run `npm run build` first, which is where this matters.
 */
const dist = (p: string) => join(process.cwd(), 'dist', p)
const built = existsSync(dist('index.js'))

/** Real import/require of the GPL package, ignoring source-path comments. */
const IMPORTS_EPHEMERIS = /(?:from\s*["']ephemeris["']|require\(\s*["']ephemeris["']\s*\)|import\s*\(\s*["']ephemeris["']\s*\))/

describe.skipIf(!built)('shipped bundle boundary', () => {
  it('the MIT entry does not import the GPL ephemeris package', () => {
    expect(IMPORTS_EPHEMERIS.test(readFileSync(dist('index.js'), 'utf8'))).toBe(false)
  })

  it('no chunk reachable from the MIT entry imports it either', () => {
    const entry = readFileSync(dist('index.js'), 'utf8')
    for (const m of entry.matchAll(/from\s*["'](\.\/[^"']+)["']/g)) {
      const chunk = dist(m[1]!.replace(/^\.\//, ''))
      if (!existsSync(chunk)) continue
      expect(IMPORTS_EPHEMERIS.test(readFileSync(chunk, 'utf8')), `${m[1]} imports ephemeris`).toBe(false)
    }
  })

  it('the GPL entry does import it, so the sub-path is doing its job', () => {
    expect(IMPORTS_EPHEMERIS.test(readFileSync(dist('moshier-entry.js'), 'utf8'))).toBe(true)
  })

  it('every path in the exports map exists on disk', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    for (const [name, entry] of Object.entries<Record<string, string>>(pkg.exports)) {
      for (const [kind, rel] of Object.entries(entry)) {
        expect(existsSync(join(process.cwd(), rel)), `exports["${name}"].${kind} -> ${rel} missing`).toBe(true)
      }
    }
  })
})
