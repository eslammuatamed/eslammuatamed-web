import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end + accessibility harness (doc 18 §3, D18-3).
 *
 * The web repo's CI never boots the API — repositories test independently (doc 00 §3). Every e2e run
 * therefore targets the **committed** contract (`openapi/openapi.json`), and both lanes below run the
 * real `.output` build rather than the dev server, because SSR correctness, hydration and route rules
 * are precisely what these tests exist to protect.
 *
 * TWO LANES, ONE ORCHESTRATOR.
 *
 *   `contract`      — Prism serving the committed contract. The normal journey: routing, ordering,
 *                     filters, gallery, SEO, locale switching, navigation and axe. This is the
 *                     primary lane and Prism remains the primary contract mock.
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
 * The two lanes use DISJOINT PORTS so they can run in the same invocation without colliding.
 */
const CONTRACT_PORT = Number(process.env.CI_PREVIEW_PORT ?? 3000)
const CONTRACT_API_PORT = Number(process.env.CI_MOCK_PORT ?? 3001)
const SCENARIO_PORT = Number(process.env.CI_SCENARIO_PORT ?? 3100)
const SCENARIO_API_PORT = Number(process.env.CI_SCENARIO_MOCK_PORT ?? 3101)

// The About readiness lane. Its own ports because it is its own preview + backend pair: the settings
// variant it needs must not be visible to the other two lanes.
const READINESS_PORT = Number(process.env.CI_READINESS_PORT ?? 3200)
const READINESS_API_PORT = Number(process.env.CI_READINESS_MOCK_PORT ?? 3201)

// The résumé PDF lane (010). Its own preview + backend pair again: the populated `resumeAsset`
// must not be visible to the other lanes, because the PDF-NULL state is the real live state and is
// what every other lane must keep rendering. This backend also serves the PDF object itself, so the
// attachment headers are observable by a real browser.
const RESUME_PDF_PORT = Number(process.env.CI_RESUME_PDF_PORT ?? 3300)
const RESUME_PDF_API_PORT = Number(process.env.CI_RESUME_PDF_MOCK_PORT ?? 3301)

// The Dashboard Inbox lane (012). Its own preview + backend pair for a reason the other lanes do not
// have: this backend is MUTABLE (a PATCH changes what the next GET returns), which is required to
// prove that the list and the unread badge follow CONFIRMED server state. Its project therefore runs
// SERIALLY — see `fullyParallel: false` on the project below — while every other lane keeps running
// in parallel, because mutable state is confined to this process.
const DASHBOARD_PORT = Number(process.env.CI_DASHBOARD_PORT ?? 3500)
const DASHBOARD_API_PORT = Number(process.env.CI_DASHBOARD_MOCK_PORT ?? 3501)

// The settings-dedupe lane. Its own preview + backend pair again, because its backend COUNTS
// requests: any other lane sharing the process would add renders to the count under test.
const SETTINGS_COUNT_PORT = Number(process.env.CI_SETTINGS_COUNT_PORT ?? 3600)
const SETTINGS_COUNT_API_PORT = Number(process.env.CI_SETTINGS_COUNT_MOCK_PORT ?? 3601)

// The Media Library + Profile lane. Its own preview + backend pair for the same reason as the
// Dashboard Inbox: this backend is MUTABLE in three ways at once (upload adds, delete removes or is
// refused, settings PATCH changes the next GET), and none of that can be shared with a lane that
// asserts a fixed fixture set.
const MEDIA_PORT = Number(process.env.CI_MEDIA_PORT ?? 3700)
const MEDIA_API_PORT = Number(process.env.CI_MEDIA_MOCK_PORT ?? 3701)

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
 * `readyPath` exists because the readiness probe is not free of side effects. Playwright GETs this
 * URL to decide the server is up, and `nuxt.config.ts` puts `swr: 60` on `/` — so probing the
 * default `/` RENDERS AND CACHES the home page before any test runs. The `settings-dedupe` lane then
 * measured that cache instead of the application: its outage test asserted against a healthy `/`
 * that had been rendered while the backend was still answering 200. Lanes that count requests point
 * the probe at a route with no SWR rule; the rest keep `/`, which is the cheapest liveness signal.
 */
function previewServer(backend: string, webPort: number, apiPort: number, readyPath = '/') {
  return {
    command: `node scripts/ci-preview.mjs --backend ${backend}`,
    url: `http://127.0.0.1:${webPort}${readyPath}`,
    env: { CI_PREVIEW_PORT: String(webPort), CI_MOCK_PORT: String(apiPort) },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const
  }
}

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
  projects: [
    {
      name: 'contract',
      testIgnore: ['scenarios/**', 'readiness/**', 'resume-pdf/**', 'dashboard/**', 'dedupe/**'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${CONTRACT_PORT}` }
    },
    {
      name: 'ssr-scenarios',
      testMatch: 'scenarios/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SCENARIO_PORT}` }
    },
    {
      name: 'about-readiness',
      testMatch: 'readiness/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${READINESS_PORT}` }
    },
    {
      name: 'resume-pdf',
      testMatch: 'resume-pdf/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${RESUME_PDF_PORT}` }
    },
    {
      name: 'dashboard',
      testMatch: 'dashboard/**/*.spec.ts',
      // SERIAL, unlike every other project here. Its backend holds mutable state that each test
      // resets, so concurrent tests would reset each other's fixtures mid-assertion. `workers` is a
      // TOP-LEVEL option and cannot be set per project, and `fullyParallel: false` only serialises
      // tests within a FILE — so the lane is kept to a SINGLE spec file, which is what actually
      // makes it serial. This is a property of the shared mutable backend, not a flake workaround:
      // nothing is retried anywhere in this config.
      //
      // ONE CAVEAT, MEASURED. Playwright groups work by (file, repeatEachIndex), so `--repeat-each`
      // splits the repeat copies of this file across workers and they then race on the one mutable
      // backend. Observed: `--repeat-each=3 --workers=2` produced 10 dashboard failures, while the
      // identical `--repeat-each=3 --workers=1` produced 0 — the difference is interference, not
      // product behaviour. A repeat sweep over this project must therefore pass `--workers=1`;
      // the normal `npm run test:e2e` invocation is unaffected because each test runs once.
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${DASHBOARD_PORT}` }
    },
    {
      name: 'settings-dedupe',
      testMatch: 'dedupe/**/*.spec.ts',
      // SERIAL, for the same reason as `dashboard`: its backend holds a mutable counter that each
      // test resets, so concurrent tests would count each other's renders. `workers` is a TOP-LEVEL
      // option, so what actually makes this lane serial is keeping it to a SINGLE spec file.
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SETTINGS_COUNT_PORT}` }
    },
    {
      name: 'dashboard-media',
      testMatch: 'dashboard-media/**/*.spec.ts',
      // SERIAL, for the same reason as `dashboard` and `settings-dedupe`, and with the same caveat:
      // what actually makes this lane serial is keeping it to a SINGLE spec file, because `workers`
      // is a top-level option and `fullyParallel: false` only serialises tests within a file. A
      // second spec file here would run in a second worker and reset this backend's fixtures
      // mid-assertion. A repeat sweep over this project must pass `--workers=1`.
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${MEDIA_PORT}` }
    }
  ],

  webServer: [
    // Readiness probes `/about`, NOT `/` (INF-A). `/` carries `swr: 60` (nuxt.config.ts:85), so a
    // probe that lands before Prism is listening caches the API-unavailable render and Nitro serves
    // that stale entry to every subsequent `/` request for the rest of the lane — the whole contract
    // run then asserts against the error state. `/about` has no SWR rule, so probing it cannot poison
    // a cache. `settings-count` below already probes `/about` for the same reason.
    previewServer('prism', CONTRACT_PORT, CONTRACT_API_PORT, '/about'),
    previewServer('scenarios', SCENARIO_PORT, SCENARIO_API_PORT),
    previewServer('about-readiness', READINESS_PORT, READINESS_API_PORT),
    previewServer('resume-pdf', RESUME_PDF_PORT, RESUME_PDF_API_PORT),
    previewServer('dashboard', DASHBOARD_PORT, DASHBOARD_API_PORT),
    // `/about` carries no SWR rule, so probing it leaves every route this lane measures cold.
    previewServer('settings-count', SETTINGS_COUNT_PORT, SETTINGS_COUNT_API_PORT, '/about'),
    previewServer('media', MEDIA_PORT, MEDIA_API_PORT)
  ]
})
