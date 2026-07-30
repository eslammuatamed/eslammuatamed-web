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

// Fail with an actionable message instead of a connection-refused timeout 90 s later. `ci-preview.mjs`
// boots `.output/server/index.mjs` directly, so a missing build is a setup mistake, not a test failure.
if (!existsSync('.output/server/index.mjs')) {
  throw new Error(
    'e2e requires a production build: run `npm run build` before `npm run test:e2e` '
      + '(CI builds in the same job).'
  )
}

/** Shared `webServer` policy. Never reuse a stray server: it may be running a stale build. */
function previewServer(backend: string, webPort: number, apiPort: number) {
  return {
    command: `node scripts/ci-preview.mjs --backend ${backend}`,
    url: `http://127.0.0.1:${webPort}`,
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
      testIgnore: ['scenarios/**', 'readiness/**', 'resume-pdf/**'],
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
    }
  ],

  webServer: [
    previewServer('prism', CONTRACT_PORT, CONTRACT_API_PORT),
    previewServer('scenarios', SCENARIO_PORT, SCENARIO_API_PORT),
    previewServer('about-readiness', READINESS_PORT, READINESS_API_PORT),
    previewServer('resume-pdf', RESUME_PDF_PORT, RESUME_PDF_API_PORT)
  ]
})
