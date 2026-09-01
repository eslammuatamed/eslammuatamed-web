import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the Projects browser lane (R16 closure, SEO-U3c).
 *
 * Selection is by structure or fixture identity, never rendered copy — the same rule every FE-3
 * harness records, because half these tests run with the dashboard in Arabic.
 */

/** The backend control plane, on the port `playwright.config.ts` started it with. */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_PROJECTS_MOCK_PORT ?? 4501)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }

/** Fixture ids mirroring `scripts/e2e/projects-server.ts`. */
export const PRJ = {
  main: '00000000-0000-4000-a000-000000000001',
  enOnly: '00000000-0000-4000-a000-000000000002'
} as const

export const SKILL = {
  typescript: '00000000-0000-4000-b000-000000000001',
  nest: '00000000-0000-4000-b000-000000000002',
  postgres: '00000000-0000-4000-b000-000000000003'
} as const

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Drive the backend into a scenario. `delayMs` holds `/admin/*` responses open — the only
 * condition under which a skeleton is on screen long enough to be asserted.
 */
export async function setBackendState(
  page: Page,
  state: {
    mode?: 'ok' | 'empty' | 'error' | 'forbidden'
    delayMs?: number
    nextWriteErrors?: Array<{ field: string, message: string }>
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

/** The collection has reached one of its terminal surfaces, and nothing is still loading. */
export async function listSettled(page: Page): Promise<void> {
  // POSITIVE first (the Experiences harness records why an absence-only wait is vacuous).
  await expect(page.locator(
    '[data-project-row], [data-projects-empty], [data-projects-failed], [data-projects-forbidden]'
  )).not.toHaveCount(0)
  await expect(page.locator(BUSY)).toHaveCount(0, { timeout: 15_000 })
}

/** The editor has reached a form or an unreadable surface, and nothing is still loading. */
export async function editorSettled(page: Page): Promise<void> {
  await page.locator('[data-editor-save], [data-project-forbidden], [data-project-not-found]')
    .first().waitFor({ timeout: 15_000 })
  await expect(page.locator(BUSY)).toHaveCount(0, { timeout: 15_000 })
}

/** Open an existing project's editor from the collection, the way the operator does. */
export async function openEditor(page: Page, id: string): Promise<string[]> {
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.locator(`[data-project-edit="${id}"]`).click()
  await page.waitForURL(`**/dashboard/projects/${id}`)
  await editorSettled(page)
  return requests
}

/** The technology checkboxes currently ticked in the picker, as the operator sees them. */
export async function selectedTechnologyIds(page: Page): Promise<string[]> {
  return page.locator('[data-technology][aria-checked=true]').evaluateAll(els =>
    els.map(el => el.getAttribute('data-technology') ?? '')
  )
}

/** No raw i18n key path may reach the screen in either language. */
export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text, 'a raw i18n key path reached the screen').not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}
