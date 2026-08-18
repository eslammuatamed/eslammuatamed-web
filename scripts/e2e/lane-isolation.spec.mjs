import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { LANES, lanesToBoot, selectedProjects, shardPlan } from './lanes.ts'

/**
 * Every e2e lane directory must belong to exactly ONE Playwright project, and every mutable lane must
 * hold exactly ONE spec file.
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
 * WHAT CHANGED, AND WHY THIS IS NO LONGER TEXT-BASED. It used to read `playwright.config.ts` as a
 * STRING and match its `testIgnore` / `testMatch` literals with regexes, because importing the config
 * throws at module scope when `.output/server/index.mjs` is absent — an intentional, actionable guard
 * that would otherwise make this unit test depend on a production build. That reason still holds, and
 * the config is still not imported here. What changed is that the config no longer HOLDS the lane
 * declarations: they live in `./lanes.ts`, a side-effect-free registry that the config, the shard
 * runner and this guard all derive from. So the assertions moved to the registry, where they are
 * exact instead of regex-shaped — and asserting the generated `testIgnore` is now pointless, because
 * it is generated FROM the list this file checks. `contract` adopting a forgotten directory is
 * therefore prevented by construction; what remains possible, and what this file now guards, is a
 * lane directory that exists on disk with NO registry record at all.
 *
 * That reframing also closed a hole. The old single-spec-file check ran against a HAND-WRITTEN list of
 * four directories, and `cache` was not on it — a serial lane whose backend mutates its gallery mid-
 * test, with no guard against a second spec file joining it. Deriving the list from
 * `resetsBackendState` covers every mutable lane, including the ones added after this comment.
 */
const ROOT = process.cwd()

/** Lane directories on disk: everything under `e2e/` that holds specs. */
const specDirs = readdirSync(resolve(ROOT, 'e2e'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  // A directory holding no spec at all (fixtures, helpers) is not a lane and must not be required
  // to be one.
  .filter(dir => readdirSync(resolve(ROOT, 'e2e', dir)).some(file => file.endsWith('.spec.ts')))

const specsIn = dir => readdirSync(resolve(ROOT, 'e2e', dir)).filter(file => file.endsWith('.spec.ts'))

describe('Playwright lane isolation', () => {
  it('finds the lane directories', () => {
    // Guards the guard: a glob that silently matched nothing would make every assertion vacuous.
    expect(specDirs.length).toBeGreaterThan(0)
    expect(specDirs).toContain('dashboard-media')
    expect(LANES.length).toBeGreaterThan(0)
  })

  it.each(specDirs)('e2e/%s has a lane record', (dir) => {
    // The failure this replaces: an unregistered directory is not excluded from `contract`'s
    // generated `testIgnore`, so `contract` adopts it and runs it against the wrong backend.
    expect(LANES.map(lane => lane.dir)).toContain(dir)
  })

  it.each(LANES.filter(lane => lane.dir !== null))('the $project lane owns a real directory with specs', (lane) => {
    expect(specDirs).toContain(lane.dir)
    expect(specsIn(lane.dir).length).toBeGreaterThan(0)
  })

  it('gives exactly one project to each lane directory', () => {
    const dirs = LANES.map(lane => lane.dir).filter(dir => dir !== null)
    expect(new Set(dirs).size).toBe(dirs.length)
    const projects = LANES.map(lane => lane.project)
    expect(new Set(projects).size).toBe(projects.length)
  })

  it('keeps every mutable-backend lane to a SINGLE spec file', () => {
    // `workers` is a top-level Playwright option and `fullyParallel: false` only serialises tests
    // WITHIN a file, so a lane backed by mutable state is serial exactly as long as it is one file.
    // A second file would be scheduled on another worker and the two would reset each other's
    // fixtures mid-assertion — measured previously at `--repeat-each=3 --workers=2`.
    const mutable = LANES.filter(lane => lane.resetsBackendState)
    // Guards the guard: an empty filter would make the loop below assert nothing.
    expect(mutable.length).toBeGreaterThan(0)
    for (const lane of mutable) {
      expect(
        specsIn(lane.dir),
        `e2e/${lane.dir} is a mutable lane and must hold exactly one spec file`
      ).toHaveLength(1)
    }
  })

  it('gives every lane its own port pair', () => {
    // Two lanes MAY share a backend script — `dashboard-login` runs the `dashboard` server precisely
    // so it can have its own process — but they may never share a port, or one lane's Nitro would
    // answer with the other's fixtures.
    const ports = LANES.flatMap(lane => [lane.ports.webDefault, lane.ports.apiDefault])
    expect(new Set(ports).size).toBe(ports.length)
    const envVars = LANES.flatMap(lane => [lane.ports.webEnv, lane.ports.apiEnv])
    expect(new Set(envVars).size).toBe(envVars.length)
  })

  it('states why every lane needs its own process pair', () => {
    for (const lane of LANES) {
      expect(lane.why.length, `${lane.project} must record why it is a separate lane`).toBeGreaterThan(20)
      expect(lane.readyPath.startsWith('/'), `${lane.project} readyPath must be a path`).toBe(true)
    }
  })
})

/**
 * The server-selection logic, which is new and load-bearing: get it wrong and a lane runs with no
 * server, which surfaces as a navigation timeout that reads as a product failure.
 */
describe('lane server selection', () => {
  it('boots every lane when no --project is given', () => {
    // A `--grep`-only or `--last-failed` run may touch any lane, so starving it would turn a filter
    // into a false failure.
    expect(lanesToBoot(['node', 'playwright'], {})).toHaveLength(LANES.length)
    expect(lanesToBoot(['node', 'playwright', '--grep', 'axe'], {})).toHaveLength(LANES.length)
  })

  it('boots ONLY the named lane — the whole point of the change', () => {
    const booted = lanesToBoot(['node', 'playwright', '--project=dashboard-articles'], {})
    expect(booted.map(lane => lane.project)).toEqual(['dashboard-articles'])
  })

  it('reads both --project spellings, repeated and variadic', () => {
    expect(selectedProjects(['--project=a', '--project=b'])).toEqual(new Set(['a', 'b']))
    expect(selectedProjects(['--project', 'a', 'b', '--workers=2'])).toEqual(new Set(['a', 'b']))
    // A following flag must not be swallowed as a project name.
    expect(selectedProjects(['--project', 'a', '--workers=2'])).toEqual(new Set(['a']))
    expect(selectedProjects(['--workers=2'])).toEqual(new Set())
  })

  it('throws on a project with no lane record instead of booting nothing for it', () => {
    expect(() => lanesToBoot(['node', 'playwright', '--project=not-a-lane'], {}))
      .toThrow(/no lane record/)
  })

  it('restores the pre-change behaviour under E2E_ALL_LANE_SERVERS, which the negative control needs', () => {
    const booted = lanesToBoot(
      ['node', 'playwright', '--project=dashboard-articles'],
      { E2E_ALL_LANE_SERVERS: '1' }
    )
    expect(booted).toHaveLength(LANES.length)
  })
})

describe('the full-suite shard plan', () => {
  it('covers every lane exactly once', () => {
    const planned = shardPlan(LANES, 4).flat()
    expect(planned).toHaveLength(LANES.length)
    expect(new Set(planned)).toEqual(new Set(LANES.map(lane => lane.project)))
  })

  it('never exceeds the concurrent-lane budget', () => {
    for (const budget of [1, 2, 3, 4, 7, LANES.length, LANES.length + 5]) {
      for (const shard of shardPlan(LANES, budget)) {
        expect(shard.length).toBeLessThanOrEqual(budget)
        expect(shard.length).toBeGreaterThan(0)
      }
    }
  })
})
