import { existsSync } from 'node:fs'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import type { Lane } from './scripts/e2e/lanes'
import { LANES, LANE_DIRS, lanesToBoot } from './scripts/e2e/lanes'

/**
 * End-to-end + accessibility harness (doc 18 §3, D18-3).
 *
 * The web repo's CI never boots the API — repositories test independently (doc 00 §3). Every e2e run
 * therefore targets the **committed** contract (`openapi/openapi.json`), and every lane below runs the
 * real `.output` build rather than the dev server, because SSR correctness, hydration and route rules
 * are precisely what these tests exist to protect.
 *
 * TEN LANES, ONE ORCHESTRATOR, ONE REGISTRY. Each lane is a Playwright project, a spec directory, a
 * backend and a port pair, and all four now come from ONE record in `scripts/e2e/lanes.ts` — which is
 * also where each lane's justification lives, next to the record it justifies. The two anchor lanes:
 *
 *   `contract`      — Prism serving the committed contract. The normal journey: routing, ordering,
 *                     filters, gallery, SEO, locale switching, navigation and axe. This is the
 *                     primary lane and Prism remains the primary contract mock. It is the only
 *                     project that selects by EXCLUSION, and its exclusion list is now GENERATED
 *                     from the registry — see the note on `testIgnore` below.
 *
 *   `ssr-scenarios` — a small deterministic Web-owned backend (`scripts/e2e/scenario-server.ts`)
 *                     serving ONLY the six states Prism cannot express, because Prism replays one
 *                     example for every slug and every locale: empty list, unknown slug, redirect-
 *                     resolved slug, unavailable API, empty gallery, and exact EN/AR differentiation.
 *
 * WHY THE SECOND LANE IS A SERVER AND NOT `page.route()`. Browser interception was tried and
 * disproved for these routes: a direct load is server-rendered so the API read happens inside Nitro
 * and never reaches the browser, and a client-side navigation fetches the pre-rendered
 * `_payload.json` instead (both measured: 0 requests intercepted). Intercepting `_payload.json` would
 * assert against Nuxt's serialization format rather than the application's behaviour, so the fixture
 * is moved to the process boundary below Nitro instead. No application code is involved either way.
 *
 * PROCESS ORCHESTRATION IS NOT DUPLICATED HERE. `scripts/ci-preview.mjs` starts the chosen backend
 * and the built Nitro server, gates readiness on BOTH ports actually accepting connections, and tears
 * both down on SIGINT/SIGTERM. Its header documents why that readiness gate matters: a page
 * server-rendered before the backend is listening renders its ERROR state, which silently changes
 * what the test asserts. The `--backend` flag swaps only the upstream; the lifecycle is shared.
 *
 * The lanes use DISJOINT PORTS so they can run in the same invocation without colliding.
 *
 * `webServer` IS SCOPED TO THE SELECTED LANES, AND HAD TO BE. Playwright's `webServer` is a top-level
 * array with no per-project option (its documentation exposes none), so before this every invocation
 * booted every lane: measured, `--project=dashboard-articles` — a run needing exactly ONE lane —
 * started all ten Nitro servers and passed 48/48 while doing it. `lanesToBoot()` narrows that to the
 * lanes named by `--project`, and boots all of them when none is named, because a `--grep`-only or
 * `--last-failed` run may touch any lane. `E2E_ALL_LANE_SERVERS=1` restores the old behaviour, which
 * is what the negative control for the change needs. Full rationale and the measurements are in
 * `scripts/e2e/lanes.ts`; `scripts/e2e-shards.mjs` is the bounded-concurrency full-suite runner built
 * on top of it.
 */

const port = (lane: Lane) => Number(process.env[lane.ports.webEnv] ?? lane.ports.webDefault)
const mockPort = (lane: Lane) => Number(process.env[lane.ports.apiEnv] ?? lane.ports.apiDefault)

// Fail with an actionable message instead of a connection-refused timeout 90 s later. `ci-preview.mjs`
// boots `.output/server/index.mjs` directly, so a missing build is a setup mistake, not a test failure.
if (!existsSync('.output/server/index.mjs')) {
  throw new Error(
    'e2e requires a production build: run `npm run build` before `npm run test:e2e` '
      + '(CI builds in the same job).'
  )
}

/**
 * Shared `webServer` policy. Never reuse a stray server: it may be running a stale build.
 *
 * `lane.readyPath` exists because the readiness probe is not free of side effects. Playwright GETs
 * this URL to decide the server is up, and `nuxt.config.ts` puts `swr: 60` on `/` — so probing the
 * default `/` RENDERS AND CACHES the home page before any test runs. The `settings-dedupe` lane then
 * measured that cache instead of the application: its outage test asserted against a healthy `/`
 * that had been rendered while the backend was still answering 200. Lanes that count requests or
 * measure a cold route point the probe at a route with no SWR rule; the rest keep `/`, which is the
 * cheapest liveness signal.
 */
function previewServer(lane: Lane) {
  const webPort = port(lane)
  return {
    command: `node scripts/ci-preview.mjs --backend ${lane.backend}`,
    url: `http://127.0.0.1:${webPort}${lane.readyPath}`,
    env: { CI_PREVIEW_PORT: String(webPort), CI_MOCK_PORT: String(mockPort(lane)) },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const
  }
}

/**
 * One Playwright project per lane.
 *
 * `contract`'s `testIgnore` is GENERATED from the registry's lane directories, and that is the point.
 * It used to be a hand-written list, and it is the one project that selects by EXCLUSION — so it
 * silently ADOPTED any lane directory nobody remembered to exclude, and it did: `testIgnore` listed
 * `dashboard/**`, which does not match `dashboard-media/**`, so the media specs ran a SECOND time
 * here against Prism, which serves a static example and holds no mutable state — 19 failures that
 * described the wrong backend rather than the product. Generating the list makes that class of
 * mistake unrepresentable rather than merely guarded.
 *
 * `fullyParallel: false` follows `resetsBackendState`, and is NOT what makes those lanes serial:
 * `workers` is a TOP-LEVEL option and cannot be set per project, and `fullyParallel: false` only
 * serialises tests WITHIN a file — so what actually serialises such a lane is being a SINGLE spec
 * file, which `scripts/e2e/lane-isolation.spec.mjs` asserts. This is a property of a shared mutable
 * backend, not a flake workaround: nothing is retried anywhere in this config.
 *
 * ONE CAVEAT, MEASURED. Playwright groups work by (file, repeatEachIndex), so `--repeat-each` splits
 * the repeat copies of one file across workers and they then race on that lane's mutable backend.
 * Observed: `--repeat-each=3 --workers=2` produced 10 dashboard failures, while the identical
 * `--repeat-each=3 --workers=1` produced 0 — the difference is interference, not product behaviour.
 * A repeat sweep over a mutable lane must therefore pass `--workers=1`; the normal `npm run test:e2e`
 * invocation is unaffected because each test runs once.
 */
const projects = LANES.map(lane => ({
  name: lane.project,
  ...(lane.dir === null
    // `contract` owns the flat specs at the root of `e2e/` and excludes every lane directory.
    ? { testIgnore: LANE_DIRS.map(dir => `${dir}/**`) }
    : { testMatch: `${lane.dir}/**/*.spec.ts` }),
  ...(lane.resetsBackendState ? { fullyParallel: false } : {}),
  use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${port(lane)}` }
}))

export default defineConfig({
  testDir: './e2e',
  // Deterministic by construction: no test may depend on another's state, and a flake must fail rather
  // than be retried into a false green. Doc 18 treats flaky tests as defects, not noise.
  //
  // The scenario lane needs no worker isolation and no reset hook, because it holds NO mutable state:
  // every scenario is selected purely from the request path, slug and locale, so one URL always means
  // one scenario no matter what else is in flight.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  // One desktop browser is enough for the behaviours under test (routing, locale, SSR, a11y). Viewport
  // -specific rendering is covered by the Lighthouse mobile profile and the manual visual matrix; adding
  // browser engines here would multiply run time without testing a different code path.
  projects,

  webServer: lanesToBoot().map(previewServer)
})
