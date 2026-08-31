import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the committed Experiences browser lane (FE-3 module 1).
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY — the rule the Articles
 * harness states and the reason is identical: half these tests run with the dashboard in Arabic,
 * where matching on English text would fail for a reason unrelated to the behaviour under test.
 */

/**
 * The backend's control plane, on the SAME port `playwright.config.ts` starts the backend with.
 * Read from the env rather than derived from the app port, so overriding either cannot silently
 * point this at the wrong process.
 */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_EXPERIENCES_MOCK_PORT ?? 4101)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }

/** Fixture ids, mirroring `scripts/e2e/experiences-server.ts`'s `EXP`. */
export const EXP = {
  current: '00000000-0000-4000-e000-000000000001',
  past: '00000000-0000-4000-e000-000000000002',
  enOnly: '00000000-0000-4000-e000-000000000003',
  endedLater: '00000000-0000-4000-e000-000000000004',
  noSkills: '00000000-0000-4000-e000-000000000005',
  /** A well-formed UUID deliberately ABSENT from the fixtures — the editor's 404 case (`M1·U3`). */
  absent: '00000000-0000-4000-e000-0000000000ff'
} as const

/**
 * ⚠ THE ORDER THE API PRODUCES, and the whole reason this lane exists.
 *
 * `isCurrent` DESC, then `startDate` DESC, then `order` ASC, then `id`. Written out in full rather
 * than as "current first" because a sort that is wrong FURTHER DOWN still puts the current role at
 * the top — asserting only the head would pass against a real defect.
 *
 * Under a naive `startDate desc` this would begin `endedLater` (2026-03), which is exactly the bug
 * that shipped to the live site once.
 */
export const API_ORDER = [EXP.current, EXP.endedLater, EXP.past, EXP.enOnly, EXP.noSkills] as const

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Drive the backend into a scenario.
 *
 * `delayMs` is the one that matters: it holds every `/admin/experiences*` response open, which is
 * the ONLY condition under which a skeleton or an updating overlay is on screen long enough to be
 * asserted. Without it those assertions pass without the state ever having rendered.
 */
export async function setBackendState(
  page: Page,
  state: { mode?: 'ok' | 'empty' | 'error' | 'forbidden', delayMs?: number, failNextWrite?: boolean }
): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

/** Sign in through the real form, with the dashboard locale set BEFORE the first paint. */
export async function signIn(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

export const rows = (page: Page) => page.locator('[data-experience-row]')

/** The dashboard shell root. NOT `[dir]`, which resolves to `<html>` and lies (FE-2a finding). */
export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

/**
 * Wait until the list has settled into one of its four terminal surfaces.
 *
 * ⚠ WAITING FOR `aria-busy` TO BE ABSENT IS NOT ENOUGH, AND THE FAILURE IS SILENT.
 *
 * That was the first version, copied from the Articles harness, and it is VACUOUS before the
 * request starts: no element is busy yet either, so the wait returns immediately and the test reads
 * an empty page. It survived in the Articles lane because every assertion there goes through
 * Playwright's auto-retrying `expect(locator)`, which re-reads until it matches. It broke here the
 * moment a test did a ONE-SHOT read — `evaluateAll` to capture row ORDER, which cannot be expressed
 * as a retrying locator assertion and returned `[]` on the very first navigation of the run.
 *
 * So the barrier is POSITIVE first: wait until one of the four terminal states actually exists, and
 * only then require that nothing is still busy. An absence is not evidence of completion.
 */
export async function listSettled(page: Page): Promise<void> {
  await page.locator(
    '[data-experience-row], [data-experiences-empty], [data-experiences-failed], [data-experiences-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

/** No raw i18n key path may reach the screen in either language. */
export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text, 'a raw i18n key path reached the screen').not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}

/**
 * Wait until the EDITOR has settled into one of its terminal surfaces (`M1·U3`).
 *
 * POSITIVE FIRST, for the reason `listSettled` records at length: waiting only for `aria-busy` to
 * disappear is vacuous before the request starts, because nothing is busy yet either. So this waits
 * for the form or an unreadable surface to actually EXIST, and only then requires that nothing is
 * still busy.
 */
export async function editorSettled(page: Page): Promise<void> {
  await page.locator('[data-editor-actions], [data-editor-unreadable]').first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

/** The skill checkboxes currently ticked in the picker — the relation as the operator sees it. */
export async function selectedSkillIds(page: Page): Promise<string[]> {
  return page.locator('[data-technology][aria-checked=true]').evaluateAll(els =>
    els.map(el => el.getAttribute('data-technology') ?? '')
  )
}
