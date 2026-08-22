import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the committed Testimonials browser lane (FE-3 module 3, `T·U2`).
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY — the rule the Experiences
 * harness states and the reason is identical: half these tests run with the dashboard in Arabic,
 * where matching on English text would fail for a reason unrelated to the behaviour under test.
 */

/**
 * The backend's control plane, on the SAME port `playwright.config.ts` starts the backend with.
 * Read from the env rather than derived from the app port, so overriding either cannot silently
 * point this at the wrong process.
 */
const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_TESTIMONIALS_MOCK_PORT ?? 4301)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }

/** Fixture ids, mirroring `scripts/e2e/testimonials-server.ts`'s `TESTIMONIAL_IDS`. */
export const TESTIMONIAL = {
  featured: '00000000-0000-4000-a300-000000000001',
  hidden: '00000000-0000-4000-a300-000000000002',
  enOnly: '00000000-0000-4000-a300-000000000003',
  noAvatar: '00000000-0000-4000-a300-000000000004',
  absent: '00000000-0000-4000-a300-0000000000ff'
} as const

/** The first id the instrument's create path mints (`900000000000 + sequence 1`). */
export const CREATED_ID = '00000000-0000-4000-a300-900000000001'

/** The seed's avatar references, mirroring the instrument's `AVATAR_IDS`. */
export const AVATAR = {
  featured: '00000000-0000-4000-b300-000000000001',
  hidden: '00000000-0000-4000-b300-000000000002',
  replacement: '00000000-0000-4000-b300-000000000003'
} as const

/**
 * ⚠ THE ORDER THE API RETURNS — the seed array verbatim.
 *
 * The seed's `order` values (0…3) happen to ascend WITH the array, so this alone cannot distinguish
 * "render what came back" from "sort by `order`". That discrimination is the job of the
 * OUT-OF-SEQUENCE fixture below, which exists precisely so a client-side sort fails loudly.
 */
export const API_ORDER = [
  TESTIMONIAL.featured,
  TESTIMONIAL.hidden,
  TESTIMONIAL.enOnly,
  TESTIMONIAL.noAvatar
] as const

/**
 * A deliberately DISCRIMINATING fixture: the server array runs C→A→B while its `order` values run
 * 40 → 10 → 30. Rendering the received order reads [C, A, B]; ANY client-side sort by `order`
 * reads [B, A, C] and fails. Author names are distinct single tokens so a rendered-sequence
 * assertion can never be satisfied by coincidence.
 */
export interface OutOfSequenceRow {
  id: string
  avatarId: null
  order: number
  isVisible: boolean
  translations: Record<string, { quote: string, authorName: string, authorRole: string }>
}

const row = (id: string, order: number, name: string): OutOfSequenceRow => ({
  id,
  avatarId: null,
  order,
  isVisible: true,
  translations: { en: { quote: `${name} quote`, authorName: name, authorRole: 'Client' } }
})

export const OUT_OF_SEQUENCE_ROWS: OutOfSequenceRow[] = [
  row('00000000-0000-4000-a300-0000000000c1', 40, 'Charl'),
  row('00000000-0000-4000-a300-0000000000a1', 10, 'Amal'),
  row('00000000-0000-4000-a300-0000000000b1', 30, 'Basim')
]
export const OUT_OF_SEQUENCE_IDS = OUT_OF_SEQUENCE_ROWS.map(item => item.id)

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

/**
 * Drive the backend into a scenario.
 *
 * `delayMs` holds every `/admin/testimonials*` response open, which is the ONLY condition under
 * which the skeleton is on screen long enough to be asserted; `testimonials` REPLACES the whole
 * fixture set, which is how the out-of-sequence order state is produced without touching the
 * instrument.
 */
export async function setBackendState(
  page: Page,
  state: {
    mode?: 'ok' | 'empty' | 'error' | 'forbidden'
    delayMs?: number
    failNextWrite?: boolean
    testimonials?: OutOfSequenceRow[]
  }
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

export const rows = (page: Page) => page.locator('[data-testimonial-row]')
export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

/**
 * Wait until the list has settled into one of its four terminal surfaces.
 *
 * POSITIVE FIRST, for the reason the Experiences harness records at length: waiting only for
 * `aria-busy` to disappear is vacuous before the request starts, because nothing is busy yet either.
 */
export async function listSettled(page: Page): Promise<void> {
  await page.locator(
    '[data-testimonial-row], [data-testimonials-empty], [data-testimonials-failed], [data-testimonials-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

/** No raw i18n key path may reach the screen in either language. */
export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text, 'a raw i18n key path reached the screen').not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}

/**
 * Wait until the EDITOR has settled into one of its terminal surfaces (`T·U3`).
 *
 * POSITIVE FIRST, for the reason `listSettled` records: waiting only for `aria-busy` to disappear is
 * vacuous before the request starts, because nothing is busy yet either. So this waits for the form
 * or an unreadable surface to actually EXIST, and only then requires that nothing is still busy.
 */
export async function editorSettled(page: Page): Promise<void> {
  await page.locator('[data-testimonial-editor-ready], [data-editor-unreadable]').first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}
