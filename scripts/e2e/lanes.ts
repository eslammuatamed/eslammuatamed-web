/**
 * ONE record per e2e lane: the Playwright project, the spec directory it owns, the backend that
 * serves it, the ports that pair takes, and whether its specs mutate that backend.
 *
 * WHY THIS FILE EXISTS. `playwright.config.ts` declared every lane three separate times — a port
 * pair, a `projects` entry, and a `webServer` entry — with nothing tying the three together. That
 * was survivable at four lanes and is not at ten, because `webServer` is a TOP-LEVEL array with no
 * per-project scoping: Playwright's webServer documentation exposes no such option, and it was
 * MEASURED — `--project=dashboard-articles`, a run needing exactly ONE lane, booted all ten Nitro
 * servers and passed 48/48 while doing it. Every run therefore paid the whole suite's fixed process
 * cost, whatever it selected.
 *
 * WHAT IS MEASURED, AND WHAT IS NOT. The fixed cost is deterministic and was sampled during a full
 * run on 12 cores: peak load average 17.4, minimum available memory 5.9 GB, ~1 GB of fresh swap on
 * top of what was already resident, ten Nitro servers at ~140–290 MB RSS each plus ten backends,
 * workers and browsers. The INTERMITTENT casualty that first raised this — one test lost per full
 * run to `ECONNRESET` or a 30 s navigation timeout, a different test each time — did **NOT**
 * reproduce on the pre-fix control run for this change: 471 passed, exit 0, 3.8 min. That is
 * recorded rather than quietly dropped, because it decides what this file may claim. A load-
 * dependent failure that is absent from one run is not fixed by anything, and a green run after a
 * change to the process count proves nothing on its own. So this refactor is justified by the
 * DETERMINISTIC quantity — pairs booted per run — and not by a failure it cannot reproduce on demand.
 *
 * Deriving all three declarations from one record is what makes that fixed cost SELECTABLE: a run
 * boots only the lanes it selected, and the full suite runs as bounded shards instead of ten process
 * pairs at once. Adding an FE-3 module adds ONE record here, and the config, the shard plan and the
 * isolation guard all follow it — the previous shape required remembering four places, and one of
 * them (`contract`'s `testIgnore`) fails SILENTLY when forgotten.
 *
 * THE MUTABLE-LANE INVARIANT IS UPHELD, NOT TRADED AWAY. `resetsBackendState: true` still means a
 * dedicated process pair AND exactly one spec file, for the reason the config always gave: `workers`
 * is a top-level option and `fullyParallel: false` only serialises tests WITHIN a file, so a second
 * file lands on a second worker and the two reset each other's fixtures mid-assertion. Nothing here
 * shares a backend process, and no lane became parallel that was not already.
 * `scripts/e2e/lane-isolation.spec.mjs` now asserts that against THIS registry instead of against a
 * regex over the config's text — which is also how `cache` stopped being uncovered: it is serial and
 * mutable, and the old hand-written list of directories to check simply omitted it.
 */

/** A lane's default port pair, and the env var that overrides it for a parallel worktree. */
export interface LanePorts {
  /** Env var holding the port the built Nitro server listens on. */
  readonly webEnv: string
  /** Env var holding the port this lane's backend listens on. */
  readonly apiEnv: string
  readonly webDefault: number
  readonly apiDefault: number
}

export interface Lane {
  /** Playwright project name. */
  readonly project: string
  /**
   * The `e2e/` subdirectory this project owns, or `null` for `contract`, which selects by EXCLUSION
   * and therefore owns every flat spec at the root of `e2e/`.
   */
  readonly dir: string | null
  /** `--backend` value passed to `scripts/ci-preview.mjs`. */
  readonly backend: string
  readonly ports: LanePorts
  /**
   * Readiness path. `/` is the cheapest liveness signal, but `nuxt.config.ts` puts `swr: 60` on `/`,
   * so probing it RENDERS AND CACHES the home page before any test runs. Lanes that count requests
   * or measure a cold route probe `/about`, which carries no SWR rule (INF-A).
   */
  readonly readyPath: string
  /**
   * True when this lane's specs mutate or reset backend state. Implies `fullyParallel: false` AND
   * exactly one spec file — see the header. False for a lane that merely happens to run against a
   * mutable BACKEND without touching its state (`dashboard-login` drives the real sign-in form and
   * one deliberate 401; claiming it is serial would misdescribe why its neighbours are).
   */
  readonly resetsBackendState: boolean
  /** Why this lane needs its own process pair. Kept next to the record it justifies. */
  readonly why: string
}

export const LANES: readonly Lane[] = [
  {
    project: 'contract',
    dir: null,
    backend: 'prism',
    ports: { webEnv: 'CI_PREVIEW_PORT', apiEnv: 'CI_MOCK_PORT', webDefault: 3000, apiDefault: 3001 },
    // `/about`, NOT `/`: `/` carries `swr: 60`, so a probe landing before Prism is listening caches
    // the API-unavailable render and Nitro serves that stale entry for the rest of the lane — the
    // whole contract run then asserts against the error state.
    readyPath: '/about',
    resetsBackendState: false,
    why: 'the primary lane: Prism replaying the committed contract, for routing, ordering, filters, gallery, SEO, locale switching, navigation and axe'
  },
  {
    project: 'ssr-scenarios',
    dir: 'scenarios',
    backend: 'scenarios',
    ports: { webEnv: 'CI_SCENARIO_PORT', apiEnv: 'CI_SCENARIO_MOCK_PORT', webDefault: 3100, apiDefault: 3101 },
    readyPath: '/',
    // Holds NO mutable state: every scenario is selected purely from request path, slug and locale,
    // so one URL always means one scenario no matter what else is in flight. Hence 15 spec files.
    resetsBackendState: false,
    why: 'the six states Prism cannot express, because it replays one example for every slug and locale'
  },
  {
    project: 'about-readiness',
    dir: 'readiness',
    backend: 'about-readiness',
    ports: { webEnv: 'CI_READINESS_PORT', apiEnv: 'CI_READINESS_MOCK_PORT', webDefault: 3200, apiDefault: 3201 },
    readyPath: '/',
    resetsBackendState: false,
    why: 'the About portrait-null settings variant must not be visible to the other lanes, and a variant with no slug or query to select on can only be a property of the process'
  },
  {
    project: 'resume-pdf',
    dir: 'resume-pdf',
    backend: 'resume-pdf',
    ports: { webEnv: 'CI_RESUME_PDF_PORT', apiEnv: 'CI_RESUME_PDF_MOCK_PORT', webDefault: 3300, apiDefault: 3301 },
    readyPath: '/',
    resetsBackendState: false,
    why: 'the populated `resumeAsset` must not leak into the other lanes, because PDF-NULL is the real live state every one of them must keep rendering'
  },
  {
    project: 'dashboard',
    dir: 'dashboard',
    backend: 'dashboard',
    ports: { webEnv: 'CI_DASHBOARD_PORT', apiEnv: 'CI_DASHBOARD_MOCK_PORT', webDefault: 3500, apiDefault: 3501 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'Feature 012 Inbox: a PATCH must change what the next GET returns, which is what proves the list and the unread badge follow CONFIRMED server state'
  },
  {
    project: 'settings-dedupe',
    dir: 'dedupe',
    backend: 'settings-count',
    ports: { webEnv: 'CI_SETTINGS_COUNT_PORT', apiEnv: 'CI_SETTINGS_COUNT_MOCK_PORT', webDefault: 3600, apiDefault: 3601 },
    // Counts requests, so it must not measure a cache its own readiness probe warmed.
    readyPath: '/about',
    resetsBackendState: true,
    why: 'its backend COUNTS `/settings/site` reads, so any other lane sharing the process would add renders to the count under test'
  },
  {
    project: 'dashboard-media',
    dir: 'dashboard-media',
    backend: 'media',
    ports: { webEnv: 'CI_MEDIA_PORT', apiEnv: 'CI_MEDIA_MOCK_PORT', webDefault: 3700, apiDefault: 3701 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'mutable three ways at once — an upload adds, a delete removes or is refused when referenced, and a settings PATCH changes the next GET'
  },
  {
    project: 'project-detail-cache',
    dir: 'cache',
    backend: 'project-cache',
    ports: { webEnv: 'CI_PROJECT_CACHE_PORT', apiEnv: 'CI_PROJECT_CACHE_MOCK_PORT', webDefault: 3800, apiDefault: 3801 },
    // Must not prime either detail URL under test.
    readyPath: '/about',
    resetsBackendState: true,
    why: 'its upstream changes from an empty to a populated gallery WHILE the test runs, so a reset in a future test would race the publish transition this regression measures'
  },
  {
    project: 'dashboard-login',
    dir: 'dashboard-login',
    // The same backend SCRIPT as `dashboard`, deliberately in its OWN process: the `dashboard` lane
    // holds mutable Inbox state that its specs reset, and a mutable lane is serial only while it is
    // a single spec file. Putting the login specs in that directory made it two.
    backend: 'dashboard',
    ports: { webEnv: 'CI_DASHBOARD_LOGIN_PORT', apiEnv: 'CI_DASHBOARD_LOGIN_MOCK_PORT', webDefault: 3900, apiDefault: 3901 },
    readyPath: '/',
    resetsBackendState: false,
    why: 'a dedicated pair is what the other lanes do in this situation; these specs neither seed nor reset state, so they stay parallel'
  },
  {
    project: 'dashboard-articles',
    dir: 'dashboard-articles',
    backend: 'articles',
    ports: { webEnv: 'CI_ARTICLES_PORT', apiEnv: 'CI_ARTICLES_MOCK_PORT', webDefault: 4000, apiDefault: 4001 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'FE-2c authoring: mutable, and the only backend that can HOLD A RESPONSE OPEN (`delayMs`), which is what makes six of plan §14.9\'s ten criteria observable at all'
  },
  {
    project: 'dashboard-experiences',
    dir: 'dashboard-experiences',
    backend: 'experiences',
    ports: { webEnv: 'CI_EXPERIENCES_PORT', apiEnv: 'CI_EXPERIENCES_MOCK_PORT', webDefault: 4100, apiDefault: 4101 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'FE-3 module 1: mutable, and it is the only lane whose fixtures can prove the API ORDER is honoured — `EXP.endedLater` ranks differently under the contract\'s sort than under the `startDate desc` a client would naturally write, so a re-sorting Dashboard fails HERE instead of in Production'
  },
  {
    project: 'dashboard-skills',
    dir: 'dashboard-skills',
    backend: 'skills',
    ports: { webEnv: 'CI_SKILLS_PORT', apiEnv: 'CI_SKILLS_MOCK_PORT', webDefault: 4200, apiDefault: 4201 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'FE-3 module 2: the Skills collection and its future editor use mutable fixtures, and the lane must own exactly one resettable backend process pair'
  },
  {
    project: 'dashboard-testimonials',
    dir: 'dashboard-testimonials',
    backend: 'testimonials',
    ports: { webEnv: 'CI_TESTIMONIALS_PORT', apiEnv: 'CI_TESTIMONIALS_MOCK_PORT', webDefault: 4300, apiDefault: 4301 },
    readyPath: '/',
    resetsBackendState: true,
    why: 'FE-3 module 3: the Testimonials collection pins the SERVER order against mutable fixtures whose order values run deliberately out of sequence, which requires its own resettable backend process pair'
  }
] as const

/** Lane directories, excluding `contract`, which owns the flat root specs by exclusion. */
export const LANE_DIRS: readonly string[] = LANES
  .map(lane => lane.dir)
  .filter((dir): dir is string => dir !== null)

export function laneByProject(project: string): Lane | undefined {
  return LANES.find(lane => lane.project === project)
}

/**
 * How many lane process pairs may run CONCURRENTLY.
 *
 * A governed constant, not a derivation from `os.cpus()`, so a shard plan is reproducible and a
 * number in an evidence report means the same thing on two machines.
 *
 * WHAT FOUR IS, AND IS NOT. It is a bounded default, not an optimum: the measured points are the two
 * ENDPOINTS — one pair (a single-lane run) and ten pairs (the full suite, which put a 12-core machine
 * into swap at peak load 17.4) — plus four itself, whose reading is recorded in the campaign ledger.
 * Five through nine were NOT measured, so nothing here claims four is the largest workable value or
 * that a higher one would fail. If a future session wants a faster full suite, the honest move is to
 * take those readings rather than to raise this number and see. `E2E_MAX_LANES` overrides it for
 * exactly that kind of deliberate experiment.
 */
export const DEFAULT_MAX_CONCURRENT_LANES = 4

export function maxConcurrentLanes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.E2E_MAX_LANES
  if (raw === undefined) return DEFAULT_MAX_CONCURRENT_LANES
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`E2E_MAX_LANES must be a positive integer, received "${raw}".`)
  }
  return parsed
}

/**
 * The full suite as a list of shards, each a set of project names to run in one invocation.
 *
 * DERIVED from the registry in declaration order, never hand-maintained: an FE-3 module that adds a
 * lane is placed automatically, which is the whole point — a hand-written shard list is one more
 * place to forget, and forgetting it means a lane silently stops running.
 */
export function shardPlan(
  lanes: readonly Lane[] = LANES,
  maxLanes: number = maxConcurrentLanes()
): string[][] {
  const shards: string[][] = []
  for (let index = 0; index < lanes.length; index += maxLanes) {
    shards.push(lanes.slice(index, index + maxLanes).map(lane => lane.project))
  }
  return shards
}

/**
 * Which lanes a given invocation needs a server for.
 *
 * DERIVED FROM `--project`, because Playwright offers nothing better: `webServer` is top-level and
 * its documented options carry no project scoping, so the only way a run can avoid paying for lanes
 * it did not select is for the config to read the selection itself. An empty result means "no
 * `--project` was given", which correctly boots EVERY lane — a `--grep`-only or `--last-failed` run
 * may touch any lane, and starving it of servers would turn a filter into a false failure.
 *
 * Deliberately NOT an env var that names lanes. An env var could restrict the SERVERS without
 * restricting the TESTS, which is a footgun that fails as a connection timeout in a lane whose
 * server was never asked for. `E2E_ALL_LANE_SERVERS=1` is the one escape hatch, and it only ever
 * ADDS servers: it restores the pre-change behaviour of booting all of them, which is what the
 * negative control for this change needs.
 */
export function selectedProjects(argv: readonly string[] = process.argv): Set<string> {
  const selected = new Set<string>()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined) continue
    if (token.startsWith('--project=')) {
      selected.add(token.slice('--project='.length))
      continue
    }
    if (token !== '--project') continue
    // Playwright's `--project` is variadic: `--project a b` selects two. Consume until the next flag.
    for (let next = index + 1; next < argv.length; next += 1) {
      const value = argv[next]
      if (value === undefined || value.startsWith('-')) break
      selected.add(value)
      index = next
    }
  }
  return selected
}

/**
 * The lanes whose process pair an invocation must boot.
 *
 * Throws on a `--project` name with no lane record rather than booting nothing for it: Playwright
 * would then fail every test in that project with a connection timeout, which reads as a product
 * failure. Playwright validates project names against `projects` too, and both are derived from this
 * registry — so this is a guard on the derivation, not on the user.
 */
export function lanesToBoot(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  lanes: readonly Lane[] = LANES
): readonly Lane[] {
  if (env.E2E_ALL_LANE_SERVERS === '1') return lanes
  const selected = selectedProjects(argv)
  if (selected.size === 0) return lanes

  const known = new Set(lanes.map(lane => lane.project))
  const unknown = [...selected].filter(project => !known.has(project))
  if (unknown.length > 0) {
    throw new Error(
      `[e2e lanes] no lane record for project(s): ${unknown.join(', ')}. `
        + `Known projects: ${[...known].join(', ')}. Add a record to scripts/e2e/lanes.ts.`
    )
  }
  return lanes.filter(lane => selected.has(lane.project))
}
