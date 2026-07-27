import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end + accessibility harness (doc 18 §3, D18-3).
 *
 * The web repo's CI never boots the API — repositories test independently (doc 00 §3). Every e2e run
 * therefore targets the **committed** contract (`openapi/openapi.json`) served by Prism, exactly like
 * the Lighthouse gate.
 *
 * PROCESS ORCHESTRATION IS NOT DUPLICATED HERE. `scripts/ci-preview.mjs` already starts Prism and the
 * built Nitro server, gates readiness on BOTH ports actually accepting connections, and tears both down
 * on SIGINT/SIGTERM. Its header documents why that readiness gate matters: a page server-rendered before
 * Prism is listening renders its ERROR state, which silently changes what the test asserts. Reusing the
 * script keeps one source of truth for preview orchestration and means the e2e suite and the performance
 * gate measure the same artifact the deploy ships.
 *
 * The suite runs against the real `.output` build rather than the dev server, because SSR correctness,
 * hydration and route rules are precisely what these tests exist to protect.
 */
const PORT = Number(process.env.CI_PREVIEW_PORT ?? 3000)
const BASE_URL = `http://127.0.0.1:${PORT}`

// Fail with an actionable message instead of a connection-refused timeout 90 s later. `ci-preview.mjs`
// boots `.output/server/index.mjs` directly, so a missing build is a setup mistake, not a test failure.
if (!existsSync('.output/server/index.mjs')) {
  throw new Error(
    'e2e requires a production build: run `npm run build` before `npm run test:e2e` '
      + '(CI builds in the same job).'
  )
}

export default defineConfig({
  testDir: './e2e',
  // Deterministic by construction: no test may depend on another's state, and a flake must fail rather
  // than be retried into a false green. Doc 18 treats flaky tests as defects, not noise.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  // One desktop project is enough for the behaviours under test (routing, locale, SSR, a11y). Viewport
  // -specific rendering is covered by the Lighthouse mobile profile and the manual visual matrix; adding
  // browser engines here would multiply run time without testing a different code path.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'node scripts/ci-preview.mjs',
    url: BASE_URL,
    // Never reuse a stray server: it may be running a stale build, which turns a real regression green.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
})
