import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * Every e2e lane directory must belong to exactly ONE Playwright project.
 *
 * This exists because the opposite happened. The `contract` project is the only one that selects by
 * EXCLUSION (`testIgnore`) — every other project uses `testMatch` — so it silently adopts any lane
 * directory nobody remembered to exclude. Adding `e2e/dashboard-media/` did exactly that:
 * `testIgnore` listed `dashboard/**`, which does not match `dashboard-media/**`, so the media specs
 * ran a SECOND time under `contract`, against Prism. Prism replays one static example and holds no
 * mutable state, so all 19 of them failed describing the wrong backend rather than the product.
 *
 * A comment in the config would not have caught it. This does, for the next lane as well as this one.
 *
 * Deliberately TEXT-BASED rather than importing the config: `playwright.config.ts` throws at module
 * scope when `.output/server/index.mjs` is absent (an intentional, actionable guard), which would
 * make this unit test depend on a production build having been made first.
 */
const ROOT = process.cwd()
const config = readFileSync(resolve(ROOT, 'playwright.config.ts'), 'utf8')

/** Lane directories: everything under `e2e/` that holds specs, minus the flat root-level files. */
const laneDirs = readdirSync(resolve(ROOT, 'e2e'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  // `scenarios` and friends are lanes; there is no non-lane subdirectory today, but a directory
  // holding no spec at all (fixtures, helpers) is not a lane and must not be required to be one.
  .filter(dir => readdirSync(resolve(ROOT, 'e2e', dir)).some(file => file.endsWith('.spec.ts')))

/** The directories the `contract` project excludes, read out of its `testIgnore` array. */
function contractIgnores() {
  const block = /name:\s*'contract',[\s\S]*?testIgnore:\s*\[([\s\S]*?)\]/.exec(config)
  expect(block, 'the contract project must declare a testIgnore array').not.toBeNull()
  return [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map(match => match[1])
}

describe('Playwright lane isolation', () => {
  it('finds the lane directories', () => {
    // Guards the guard: a glob that silently matched nothing would make every assertion vacuous.
    expect(laneDirs.length).toBeGreaterThan(0)
    expect(laneDirs).toContain('dashboard-media')
  })

  it.each(laneDirs)('e2e/%s is excluded from the catch-all `contract` project', (dir) => {
    // Exact-prefix matching, mirroring how picomatch reads these globs: `dashboard/**` does NOT
    // cover `dashboard-media/**`, and asserting with `includes` would wrongly say it does.
    expect(contractIgnores()).toContain(`${dir}/**`)
  })

  it.each(laneDirs)('e2e/%s is claimed by a project via testMatch', (dir) => {
    expect(config).toContain(`testMatch: '${dir}/**/*.spec.ts'`)
  })

  it('keeps every mutable-backend lane to a SINGLE spec file', () => {
    // `workers` is a top-level Playwright option and `fullyParallel: false` only serialises tests
    // WITHIN a file, so a lane backed by mutable state is serial exactly as long as it is one file.
    // A second file would be scheduled on another worker and the two would reset each other's
    // fixtures mid-assertion — measured previously at `--repeat-each=3 --workers=2`.
    for (const dir of ['dashboard', 'dashboard-media', 'dashboard-articles', 'dedupe']) {
      const specs = readdirSync(resolve(ROOT, 'e2e', dir)).filter(file => file.endsWith('.spec.ts'))
      expect(specs, `e2e/${dir} is a mutable lane and must hold exactly one spec file`).toHaveLength(1)
    }
  })
})
