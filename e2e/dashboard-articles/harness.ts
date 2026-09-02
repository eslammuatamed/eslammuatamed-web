import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the committed Articles browser lane (FE-2c).
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY. Every locator resolves
 * through a role, a `data-*` hook or a fixture id that `scripts/e2e/articles-server.ts` defines. A
 * copy edit must never turn this suite red — and in a BILINGUAL lane that is not a nicety: half
 * these tests run with the dashboard in Arabic, where matching on English text would fail for a
 * reason that has nothing to do with the behaviour under test.
 */

/**
 * The backend's control plane, on the SAME port `playwright.config.ts` starts the backend with.
 * Read from the env rather than derived from the app port: deriving it would silently point at the
 * wrong process the moment either port is overridden.
 */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_ARTICLES_MOCK_PORT ?? 4001)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }
export const DESKTOP = { width: 1280, height: 900 }

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Drive the backend into a scenario.
 *
 * `delayMs` is the one that matters: it holds every `/admin/articles*` response open for that long,
 * which is the ONLY condition under which a skeleton, an updating overlay or a submitting button is
 * on screen long enough to be asserted. Without it those assertions pass without the state ever
 * having rendered.
 */
export async function setBackendState(
  page: Page,
  state: {
    mode?: 'ok' | 'empty' | 'error' | 'forbidden'
    delayMs?: number
    failNextWrite?: boolean
    categories?: unknown[]
    tags?: unknown[]
    failVocabularyPage?: number | null
  }
): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

/**
 * Sign in through the real form, with the dashboard locale set BEFORE the first paint.
 *
 * The cookie is planted before any navigation on purpose: a post-load toggle would prove only that
 * the switcher works, while the property under test is that a stored Arabic preference is honoured
 * at BOOT (the first of the five discriminating tests doc 18 §3 requires). `/dashboard/**` is
 * `ssr: false`, so "cold" here means the client's first render.
 */
export async function signIn(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

/** The desktop sidebar's navigation-landmark link to Articles — structural, not copy-based. */
export function articlesNavLink(page: Page) {
  return page.locator('aside').getByRole('navigation').locator('a[href="/dashboard/articles"]')
}

export const rows = (page: Page) => page.locator('[data-article-row]')

/** The dashboard shell root. NOT `[dir]`, which resolves to `<html>` and lies (FE-2a finding). */
export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

/** Wait until the list has settled into rows, an empty state or an error state. */
export async function listSettled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

/** Does the page contain Arabic script anywhere in the given element's text? */
export const ARABIC = /[؀-ۿ]/

/** No raw i18n key path may reach the screen in either language. */
export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text, 'a raw i18n key path reached the screen').not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}
