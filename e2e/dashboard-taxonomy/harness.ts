import process from 'node:process'
import { expect, type Page } from '@playwright/test'

/**
 * Shared helpers for the committed Taxonomy browser lane (FE-3 Categories + Tags, `U2`).
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY — the rule the
 * Experiences/Testimonials harnesses state: half these tests run with the dashboard in Arabic,
 * where matching on English text would fail for a reason unrelated to the behaviour under test.
 */

const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_TAXONOMY_MOCK_PORT ?? 4401)}`

export const LOCALE_COOKIE = 'dashboard_locale'
export const NARROW = { width: 380, height: 780 }

/** Fixture ids, mirroring `scripts/e2e/taxonomy-server.ts`'s CATEGORY_IDS / TAG_IDS. */
export const CATEGORY = {
  oldest: '00000000-0000-4000-a100-000000000001',
  described: '00000000-0000-4000-a100-000000000003',
  middle: '00000000-0000-4000-a100-000000000002',
  enOnly: '00000000-0000-4000-a100-000000000004',
  absent: '00000000-0000-4000-a100-0000000000ff'
} as const

export const TAG = {
  oldest: '00000000-0000-4000-a200-000000000001',
  enOnly: '00000000-0000-4000-a200-000000000003',
  middle: '00000000-0000-4000-a200-000000000002',
  absent: '00000000-0000-4000-a200-0000000000ff'
} as const

/** The seed arrays VERBATIM — deliberately NOT alphabetical (Systems, Interface, Delivery, Field notes). */
export const CATEGORY_API_ORDER = [
  CATEGORY.oldest,
  CATEGORY.described,
  CATEGORY.middle,
  CATEGORY.enOnly
] as const

export const TAG_API_ORDER = [
  TAG.oldest,
  TAG.enOnly,
  TAG.middle
] as const

interface SeedTranslation {
  name: string
  slug: string
  description?: string | null
}

export interface OutOfSequenceRow {
  id: string
  translations: Record<string, SeedTranslation>
}

const row = (id: string, name: string, slug: string): OutOfSequenceRow => ({
  id,
  translations: { en: { name, slug } }
})

/**
 * Deliberately DISCRIMINATING fixtures per kind: the server array runs C→A→B while ANY plausible
 * client sort — by name or by slug — reads [Amal, Basim, Charl]. Rendering the received order reads
 * [C, A, B]; any re-ordering fails loudly instead of passing by coincidence with a tidy seed.
 */
export const OUT_OF_SEQUENCE_CATEGORIES: OutOfSequenceRow[] = [
  row('00000000-0000-4000-a100-0000000000c1', 'Charl', 'charl'),
  row('00000000-0000-4000-a100-0000000000a1', 'Amal', 'amal'),
  row('00000000-0000-4000-a100-0000000000b1', 'Basim', 'basim')
]
export const OUT_OF_SEQUENCE_CATEGORY_IDS = OUT_OF_SEQUENCE_CATEGORIES.map(item => item.id)

export const OUT_OF_SEQUENCE_TAGS: OutOfSequenceRow[] = [
  row('00000000-0000-4000-a200-0000000000c1', 'Charl-tag', 'charl-tag'),
  row('00000000-0000-4000-a200-0000000000a1', 'Amal-tag', 'amal-tag'),
  row('00000000-0000-4000-a200-0000000000b1', 'Basim-tag', 'basim-tag')
]
export const OUT_OF_SEQUENCE_TAG_IDS = OUT_OF_SEQUENCE_TAGS.map(item => item.id)

export async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

export async function setBackendState(
  page: Page,
  state: {
    mode?: 'ok' | 'empty' | 'error' | 'forbidden'
    delayMs?: number
    categories?: OutOfSequenceRow[]
    tags?: OutOfSequenceRow[]
    articleReferencedCategoryIds?: string[]
  }
): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

/** The first ids the instrument's create path mints per kind (`100000000000 + sequence 1`). */
export const CREATED_CATEGORY_ID = '00000000-0000-4000-a900-100000000001'
export const CREATED_TAG_ID = '00000000-0000-4000-a910-100000000001'

export const overlay = {
  root: (kind: 'categories' | 'tags') => `[data-taxonomy-overlay-kind="${kind}"]`,
  title: '[data-taxonomy-overlay-title]',
  close: '[data-taxonomy-overlay-close]',
  save: '[data-editor-save]',
  delete: '[data-editor-delete]',
  deleteConfirm: '[data-editor-delete-confirm]',
  errorSummary: '[data-taxonomy-overlay-error-summary]',
  saveError: '[data-taxonomy-overlay-error]',
  deleteError: '[data-taxonomy-overlay-delete-error]',
  tab: (locale: 'en' | 'ar') => `${'[data-editor-tabs] button'}[data-value=${locale}], [data-editor-tabs] button:has-text("${locale === 'ar' ? 'العربية' : 'English'}")`,
  // UInput/UTextarea forward fall-through attrs ONTO the control element itself.
  field: (name: string, locale: string) => `[data-taxonomy-field="${name}:${locale}"]`
}

/** Wait until the overlay is OPEN and interactive. */
/**
 * Switch the overlay to a locale tab. Tab labels are bilingual, so select by POSITION.
 *
 * Retried because the click can land while the slideover's open transition / focus scope is still
 * settling and get swallowed — a silent no-op that leaves the previous tab selected.
 */
export async function clickTab(page: Page, locale: 'en' | 'ar'): Promise<void> {
  const index = locale === 'ar' ? 1 : 0
  const tab = page.locator('[data-editor-tabs] button').nth(index)
  await expect(async () => {
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  }).toPass({ timeout: 15_000 })
}

/**
 * Activate the field's locale TAB, then fill the field VISIBLY.
 *
 * A non-active panel stays MOUNTED but hidden (`unmount-on-hide=false`), and a forced fill on a
 * hidden input mutates nothing in the form state — so activation is not optional, it is the only
 * way a fill reaches Vue. Tab-switching realism is preserved because this goes through the real
 * tab control (with its retry), never around it.
 */
export async function fillField(
  page: Page,
  name: string,
  locale: 'en' | 'ar',
  value: string
): Promise<void> {
  await clickTab(page, locale)
  const locator = page.locator(`[data-taxonomy-field="${name}:${locale}"]`)
  await expect(locator).toBeVisible({ timeout: 15_000 })
  await locator.fill(value)
}

export async function overlaySettled(page: Page, kind: 'categories' | 'tags'): Promise<void> {
  // The slideover CONTENT carries role=dialog + data-state; our kind marker sits on the header
  // inside it, so the dialog is located by containment.
  const dialog = page.locator('[role="dialog"][data-state="open"]', {
    has: page.locator(`[data-taxonomy-overlay-kind="${kind}"]`)
  })
  await dialog.locator(overlay.title).waitFor({ timeout: 15_000 })
  // data-state flips before Reka's entrance transition + initial focus pass finish; a tab click
  // landing in that window gets swallowed when focus re-selects the first tab afterwards.
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(250)
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

export async function signIn(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

export const categoryRows = (page: Page) => page.locator('[data-category-row]')
export const tagRows = (page: Page) => page.locator('[data-tag-row]')
export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

/**
 * Wait until BOTH sections have settled into one of their terminal surfaces.
 *
 * POSITIVE FIRST: waiting only for `aria-busy` to disappear is vacuous before any request starts.
 * Each section settles independently; a selector that exists in EITHER section satisfies its half.
 */
export async function listSettled(page: Page): Promise<void> {
  await page.locator(
    '[data-category-row], [data-categories-empty], [data-categories-failed], [data-categories-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await page.locator(
    '[data-tag-row], [data-tags-empty], [data-tags-failed], [data-tags-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

/** No raw i18n key path may reach the screen in either language. */
export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text, 'a raw i18n key path reached the screen').not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}

/**
 * ⚠ THE LOAD-BEARING INVARIANT (`U2`): neither entity has a detail read, so the page must render
 * BOTH sections entirely from the two LIST responses.
 *
 * Counted at the BROWSER level, not asserted in a component: every request to `/admin/categories*`
 * or `/admin/tags*` is recorded while `navigate` runs, and the caller asserts the recorded shape.
 * Public-namespace requests are captured too, so lane tests can prove no public endpoint leaks.
 */
export async function recordApiRequests(
  page: Page,
  navigate: () => Promise<void>
): Promise<{ detailRequests: string[], listRequests: string[], publicRequests: string[] }> {
  const detailRequests: string[] = []
  const listRequests: string[] = []
  const publicRequests: string[] = []

  const onRequest = (request: import('@playwright/test').Request): void => {
    const url = request.url()
    if (!url.includes('/api/v1/')) return
    const categoriesMatch = /\/api\/v1\/admin\/categories(\/[^?]*)?/.exec(url)
    const tagsMatch = /\/api\/v1\/admin\/tags(\/[^?]*)?/.exec(url)
    const matched = categoriesMatch ?? tagsMatch
    if (!matched) {
      if (/\/api\/v1\/(categories|tags)\b/.test(url)) publicRequests.push(url)
      return
    }
    if ((matched[1] ?? '') !== '') detailRequests.push(`${request.method()} ${url}`)
    else listRequests.push(`${request.method()} ${url}`)
  }
  page.on('request', onRequest)

  try {
    await navigate()
  } finally {
    page.off('request', onRequest)
  }

  return { detailRequests, listRequests, publicRequests }
}
