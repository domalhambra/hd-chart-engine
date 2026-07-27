import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The MIT promise, made mechanical.
 *
 * The package is MIT, but the higher-accuracy engine links the `ephemeris`
 * package, which is GPL-3.0. That is fine as long as the GPL code is reachable
 * only through the `hd-chart-engine/moshier` sub-path, so a bundler following
 * the default entry point never pulls it in.
 *
 * Nothing enforces that except this test. A single stray import in the MIT
 * surface would silently subject every downstream consumer to GPL-3.0 terms.
 */
const MIT_SURFACE = [
  'src/index.ts',
  'src/calculator.ts',
  'src/activation.ts',
  'src/birth-moment.ts',
  'src/wheel.ts',
  'src/ephemeris/types.ts',
  'src/ephemeris/astronomy.ts',
  'src/ephemeris/delta-t.ts',
]

describe('licensing boundary', () => {
  it.each(MIT_SURFACE)('%s does not import the GPL ephemeris package', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    expect(src, `${file} must not import 'ephemeris'`).not.toMatch(/from\s+['"]ephemeris['"]/)
  })

  it.each(MIT_SURFACE)('%s does not reach the GPL moshier module', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    // Match import/export statements only, so prose in comments stays allowed.
    expect(src, `${file} must not import from moshier`)
      .not.toMatch(/(?:from|import)\s+['"][^'"]*moshier[^'"]*['"]/)
  })

  it('does not re-export the Moshier engine from the MIT entry point', () => {
    const src = readFileSync(join(process.cwd(), 'src/index.ts'), 'utf8')
    expect(src).not.toMatch(/createMoshierEngine/)
  })

  it('declares ephemeris as an optional peer dependency, not a hard one', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.dependencies).not.toHaveProperty('ephemeris')
    expect(pkg.peerDependencies).toHaveProperty('ephemeris')
    expect(pkg.peerDependenciesMeta.ephemeris.optional).toBe(true)
  })

  it('exposes both entry points in the exports map', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(Object.keys(pkg.exports)).toEqual(['.', './moshier'])
  })
})
