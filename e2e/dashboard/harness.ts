import process from 'node:process'
import { expect, type Page } from '@playwright/test'
import { MSG } from '../../scripts/e2e/dashboard-server'

/**
 * Shared helpers for the committed Dashboard Inbox browser lane (Feature 012).
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY. Every locator below
 * resolves through a role, a semantic element, a URL, or a fixture id/subject string that this
 * repo's own `scripts/e2e/dashboard-server.ts` defines. A copy edit must never turn this suite red,
 * because a copy edit is not a behavioural regression.
 */

/**
 * The backend's control plane, on the SAME port `playwright.config.ts` starts the backend with.
 * Read from the env rather than derived from the app port: deriving it would silently point at the
 * wrong process the moment either port is overridden.
 */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_DASHBOARD_MOCK_PORT ?? 3501)}`

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Seed a SINGLE-PAGE fixture set.
 *
 * Order-sensitive specs (focus restoration, Back/Forward) must not have their subject row paged out
 * from under them: marking a message read moves it behind the unread ones, and with a full 12-row
 * page that pushes it onto page 2 where there is no node left to restore focus to. That is correct
 * product behaviour, so the FIXTURE has to be the thing that stays small.
 */
export async function seedSinglePage(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: { messages: SINGLE_PAGE } })
  expect(res.ok(), 'single-page seed must succeed').toBe(true)
}

export const SINGLE_PAGE = [
  { id: MSG.emailOnly, name: 'Email Only', email: 'emailonly@example.com', phone: null, subject: 'Email only enquiry', body: 'Email only body', isRead: false, isArchived: false },
  { id: MSG.phoneOnly, name: 'Phone Only', email: null, phone: '+201002785408', subject: 'Phone only enquiry', body: 'Phone only body', isRead: false, isArchived: false },
  { id: MSG.both, name: 'Both Methods', email: 'both@example.com', phone: '+201112223334', subject: 'Both methods enquiry', body: 'Both methods body', isRead: false, isArchived: false },
  { id: MSG.archivedOne, name: 'Archived One', email: 'arch1@example.com', phone: null, subject: 'Archived subject 1', body: 'Archived body 1', isRead: true, isArchived: true }
]

export async function setBackendState(
  page: Page,
  state: { mode?: 'ok' | 'empty' | 'error' | 'forbidden', failNextPatch?: boolean }
): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

export const DESKTOP = { width: 1280, height: 900 }
/** 390 px is the narrowest governed width in doc 21's matrix that still shows the card list. */
export const MOBILE = { width: 390, height: 844 }

/**
 * Sign in through the real form.
 *
 * Deliberately NOT a cookie-injection shortcut: the login form is itself governed surface
 * (`UForm` + Zod), and every reload in this lane exercises the silent-refresh path (D11-1) exactly
 * as production does.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

/** The sidebar/drawer link to Messages — structural, not copy-based. */
export function messagesNavLink(page: Page) {
  return page.locator('a[href="/dashboard/messages"]')
}

/**
 * The unread badge. Zero renders as NO badge at all, so this returns null rather than "0" — the
 * distinction the spec asserts.
 */
export async function unreadBadge(page: Page): Promise<string | null> {
  const el = messagesNavLink(page).locator('span').filter({ hasText: /^\d+\+?$/ })
  return (await el.count()) === 0 ? null : ((await el.first().textContent())?.trim() ?? null)
}

/** Desktop row openers, in rendered order. */
export function tableOpeners(page: Page) {
  return page.locator('table tbody tr td:nth-child(3) button')
}

/** Mobile card openers, in rendered order. `UCard` renders `as="article"`. */
export function cardOpeners(page: Page) {
  return page.locator('article button').first()
}

export function slideover(page: Page) {
  return page.locator('[role=dialog]')
}

/** Wait until the list surface has settled into rows, an empty state, or an error state. */
export async function listSettled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined)
}

export const query = (page: Page) => new URL(page.url()).searchParams

/** The mobile drawer trigger — the first header control, hidden from `lg` up. */
export function drawerTrigger(page: Page) {
  return page.locator('header button').first()
}

/**
 * Poll for focus, because restoration deliberately waits for the overlay to leave the DOM before
 * claiming it (the overlay performs its own restoration last, and would otherwise win).
 */
export async function focusedText(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.textContent?.trim() ?? null)
}
