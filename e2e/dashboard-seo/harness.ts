import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the Static Page SEO browser lane (FE4-U1e).
 *
 * Selection is by structure or fixture identity, never rendered copy — half these tests run with
 * the dashboard in Arabic.
 */

/** The backend control plane, on the port `playwright.config.ts` started it with. */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_SEO_MOCK_PORT ?? 4601)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }

/** Fixture ids mirroring `scripts/e2e/page-seo-server.ts`. */
export const OG = {
  hero: '00000000-0000-4000-b100-000000000001',
  spare: '00000000-0000-4000-b100-000000000002',
  pdf: '00000000-0000-4000-b100-0000000000f1'
} as const

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Drive the backend into a scenario. `delayMs` holds `/admin/*` responses open — the only
 * condition under which a skeleton is on screen long enough to be asserted; `nextPatch422` makes
 * exactly ONE admin PATCH answer that validation failure (one-shot, cleared by reset).
 */
export async function setBackendState(
  page: Page,
  state: {
    mode?: 'ok' | 'error' | 'forbidden'
    delayMs?: number
    failNextWrite?: boolean
    nextPatch422?: Array<{ field: string, message: string }>
    /** Full per-page override (the server's seed shape); used to mutate server state mid-test. */
    pages?: Record<string, unknown>
  }
): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

/** Sign in through the real form, dashboard locale planted before the first paint. */
export async function signIn(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

const BUSY = '[aria-busy=true]'

/** The surface has reached one of its terminal states, and nothing is still loading. */
export async function seoSettled(page: Page): Promise<void> {
  await page.locator(
    '[data-seo-editor], [data-seo-empty], [data-seo-failed], [data-seo-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await expect(page.locator(BUSY)).toHaveCount(0, { timeout: 15_000 })
}

/**
 * Every request the page has made so far, as {method, path}. Pathnames only — query strings are
 * asserted separately where they matter (the public endpoint's locale parameter).
 */
export function trackRequests(page: Page): Array<{ method: string, path: string }> {
  const calls: Array<{ method: string, path: string }> = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin === new URL(page.url()).origin || request.url().includes('/api/v1/')) {
      calls.push({ method: request.method(), path: new URL(request.url()).pathname })
    }
  })
  return calls
}

// ⚠ `data-seo-field` lands directly ON the control element — UInput renders <input>, UTextarea
// renders <textarea> — so NO tag qualifier may appear in this selector.
const FIELD = (locale: 'en' | 'ar', field: string) =>
  `[data-editor-panel="${locale}"] [data-seo-field="${field}"]`

export const seoInput = (page: Page, locale: 'en' | 'ar', field: string) =>
  page.locator(FIELD(locale, field))

export async function selectPage(page: Page, key: string): Promise<void> {
  await page.locator(`[data-seo-page-select="${key}"]`).click()
  await page.locator(`[data-seo-page-select="${key}"][aria-selected="true"]`).waitFor({ timeout: 10_000 })
  // The keyed editor remounts per page; wait for WHICHEVER locale panel is active to be
  // interactive (OD-9 seeds the tab from the dashboard application locale — it may be either).
  await page.locator('[data-seo-editor] [data-editor-panel]:visible').first().waitFor({ timeout: 10_000 })
}

/**
 * Activate a locale tab STRUCTURALLY: the tab that controls the given locale's panel (linked by
 * `aria-controls` → panel id), never rendered copy. Inactive panels stay mounted but hidden, so
 * editing a locale REQUIRES its tab to be active first.
 */
export async function openLocaleTab(page: Page, locale: 'en' | 'ar'): Promise<void> {
  // Tab ORDER is structural: PAGE_SEO_LOCALES renders [en, ar] deterministically.
  const index = locale === 'en' ? 0 : 1
  await page.locator('[data-editor-tabs] [role="tab"]').nth(index).click()
  await page.locator(`[data-editor-panel="${locale}"]`).waitFor({ state: 'visible', timeout: 10_000 })
}
