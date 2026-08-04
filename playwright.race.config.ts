import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

/**
 * Real-API async-ordering lane for the Dashboard Inbox (Feature 012).
 *
 * SEPARATE FROM `playwright.config.ts` ON PURPOSE. Every lane there targets a MOCK — Prism serving
 * the committed contract, or a small Web-owned scenario server — because the web repo's CI never
 * boots the API (doc 00 §3). This lane is the opposite by design: it drives the REAL NestJS API
 * against a REAL disposable PostgreSQL database, because the behaviour under test is the ordering
 * between a real mutation and the real list reads that race it. A mock cannot prove that; it can only
 * replay whatever ordering the fixture author already assumed.
 *
 * WHY BROWSER INTERCEPTION WORKS HERE AND NOT FOR PUBLIC ROUTES. `playwright.config.ts` records that
 * `page.route()` was tried and disproved for public pages: those are server-rendered, so the API read
 * happens inside Nitro and never reaches the browser. `/dashboard/**` is `ssr: false` (doc 06 D06-1),
 * so its reads are issued BY the browser and are interceptable. The interception only DELAYS a real
 * request and then lets it continue to the real API — it never fabricates a response, so the database
 * still moves and the assertions are about genuine server state.
 *
 * This lane is not part of the normal `test:e2e` invocation: it needs an API and a database, which
 * the standard lanes deliberately do not have.
 *
 * IT LIVES IN `e2e-race/`, NOT `e2e/`, ON PURPOSE. `playwright.config.ts` globs `./e2e`, so a race
 * spec placed there is collected by the mock lanes too — where it has no API and no database, and
 * fails for reasons that have nothing to do with the code under test. A sibling directory keeps the
 * two harnesses disjoint without editing the shared config.
 */
const WEB_PORT = Number(process.env.RACE_WEB_PORT ?? 3400)
const API_BASE = process.env.RACE_API_BASE ?? 'http://127.0.0.1:3401/api/v1'

if (!existsSync('.output/server/index.mjs')) {
  throw new Error('the race lane requires a production build: run `npm run build` first')
}
if (!process.env.RACE_DB) {
  throw new Error('the race lane requires RACE_DB — the disposable database it asserts against')
}

export default defineConfig({
  testDir: './e2e-race',
  // Ordering must be deterministic, not won by luck: one worker, no retries. A retry would let a
  // flaky pass hide a real ordering bug, which is the entire failure mode this lane exists to catch.
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    // Deliberately NOT headless:false — this lane asserts state and request order, not pixels.
    headless: true
  },
  projects: [{ name: 'dashboard-race', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${WEB_PORT}`,
    // Never reuse: a stray server may be running a stale build, which would silently test old code.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NUXT_PUBLIC_SITE_URL: 'https://example.com',
      NUXT_PUBLIC_API_BASE: API_BASE,
      NITRO_PORT: String(WEB_PORT),
      PORT: String(WEB_PORT)
    }
  }
})
