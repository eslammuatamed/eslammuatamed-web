import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  CATEGORY,
  CATEGORY_API_ORDER,
  NARROW,
  OUT_OF_SEQUENCE_CATEGORIES,
  OUT_OF_SEQUENCE_CATEGORY_IDS,
  OUT_OF_SEQUENCE_TAGS,
  OUT_OF_SEQUENCE_TAG_IDS,
  TAG,
  TAG_API_ORDER,
  categoryRows,
  expectNoKeyPaths,
  listSettled,
  recordApiRequests,
  resetBackend,
  setBackendState,
  shell,
  signIn,
  tagRows
} from './harness'

/**
 * The Taxonomy collections in a real browser (FE-3 Categories + Tags, `U2`).
 *
 * ⚠ ONE SPEC FILE, and that is an INVARIANT: this lane is `resetsBackendState: true`, which means a
 * dedicated process pair AND exactly one spec file (`scripts/e2e/lane-isolation.spec.mjs` asserts it).
 *
 * What this lane can prove that no unit test can: that BOTH sections render the API's order in a
 * real browser — including against fixtures whose names run out of sequence — and that the page
 * works entirely from the two LIST responses, because no detail read exists to fall back on.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('both collections render from their lists alone', () => {
  test('renders every returned row of BOTH sections in server order, unpaginated and unfiltered', async ({ page, baseURL }) => {
    const { detailRequests, listRequests, publicRequests } = await recordApiRequests(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)
    })

    // ⚠ FULL SEQUENCES, not just heads — a sort wrong further down still gets the first row right.
    const categoryIds = await categoryRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-category-row')))
    expect(categoryIds).toEqual([...CATEGORY_API_ORDER])
    const tagIds = await tagRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-tag-row')))
    expect(tagIds).toEqual([...TAG_API_ORDER])

    await expect(page.locator('[data-taxonomy-pagination]')).toHaveCount(0)
    await expect(page.locator('[data-taxonomy-filter]')).toHaveCount(0)

    // Exactly TWO api requests reached the wire: one list per entity. No {id} request of either
    // namespace occurred — this is the invariant a later editor must never break.
    expect(detailRequests, 'a detail GET left the page').toEqual([])
    const listPaths = listRequests.map((line) => {
      const [, rawUrl] = line.split(' ') as [string, string]
      return new URL(rawUrl).pathname
    }).sort()
    expect(listPaths).toEqual(['/api/v1/admin/categories', '/api/v1/admin/tags'])
    expect(publicRequests, 'the dashboard fetched a PUBLIC taxonomy endpoint').toEqual([])
  })

  for (const kind of ['categories', 'tags'] as const) {
    test(`keeps the SERVER ${kind} order when names run out of sequence`, async ({ page, baseURL }) => {
      const fixture = kind === 'categories'
        ? { categories: OUT_OF_SEQUENCE_CATEGORIES }
        : { tags: OUT_OF_SEQUENCE_TAGS }
      await setBackendState(page, fixture)
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)

      const expected = kind === 'categories' ? [...OUT_OF_SEQUENCE_CATEGORY_IDS] : [...OUT_OF_SEQUENCE_TAG_IDS]
      const locator = kind === 'categories' ? categoryRows(page) : tagRows(page)
      const attr = kind === 'categories' ? 'data-category-row' : 'data-tag-row'
      const ids = await locator.evaluateAll((els, a) => els.map(el => el.getAttribute(a)), attr)
      // Server array [C, A, B]; ANY sort by name or slug reads [Amal, Basim, Charl] and fails here.
      expect(ids).toEqual(expected)
    })
  }

  test('presents slugs and descriptions as stored data, per locale', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    // The English slug is shown verbatim beside the English name.
    await expect(page.locator('[data-taxonomy-name="' + CATEGORY.oldest + '"]')).toContainText('Systems')
    await expect(page.locator('[data-taxonomy-slug="' + CATEGORY.oldest + '"]')).toHaveText(/systems/)
    // The stored nullable description renders; rows without one show none.
    await expect(page.locator('[data-category-description="' + CATEGORY.oldest + '"]')).toBeVisible()
    await expect(page.locator('[data-category-description="' + CATEGORY.middle + '"]')).toHaveCount(0)
  })

  test('reports translation completeness without substituting a language', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    // Fully translated rows show both locales present.
    const full = page.locator('[data-category-row="' + CATEGORY.oldest + '"]')
    await expect(full.locator('[data-taxonomy-translation="en:present"]')).toBeVisible()
    await expect(full.locator('[data-taxonomy-translation="ar:present"]')).toBeVisible()

    // The en-only fixtures report their missing Arabic — never filled from English.
    const enCategory = page.locator('[data-category-row="' + CATEGORY.enOnly + '"]')
    await expect(enCategory.locator('[data-taxonomy-translation="en:present"]')).toBeVisible()
    await expect(enCategory.locator('[data-taxonomy-translation="ar:missing"]')).toBeVisible()

    const enTag = page.locator('[data-tag-row="' + TAG.enOnly + '"]')
    await expect(enTag.locator('[data-taxonomy-translation="en:present"]')).toBeVisible()
    await expect(enTag.locator('[data-taxonomy-translation="ar:missing"]')).toBeVisible()
  })
})

test.describe('the request states, made observable by delayMs', () => {
  test('shows content-shaped loading during held first requests, not empty lists', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/taxonomy')

    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-categories-empty]')).toHaveCount(0)
    await expect(page.locator('[data-tags-empty]')).toHaveCount(0)

    await listSettled(page)
    await expect(categoryRows(page).first()).toBeVisible()
    await expect(tagRows(page).first()).toBeVisible()
  })

  for (const kind of ['categories', 'tags'] as const) {
    const prefix = kind === 'categories' ? 'categories' : 'tags'

    test(`${kind}: deliberate empty state on a successful empty collection`, async ({ page, baseURL }) => {
      await signIn(page, 'en', baseURL!)
      await setBackendState(page, { mode: 'empty' })
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)

      await expect(page.locator(`[data-${prefix}-empty]`)).toBeVisible()
      await expect(page.locator(`[data-${prefix}-failed]`)).toHaveCount(0)
    })

    test(`${kind}: error rather than empty on failure, and ITS retry recovers only its own section`, async ({ page, baseURL }) => {
      await signIn(page, 'en', baseURL!)
      await setBackendState(page, { mode: 'error' })
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)

      await expect(page.locator(`[data-${prefix}-failed]`)).toBeVisible()
      await expect(page.locator(`[data-${prefix}-empty]`)).toHaveCount(0)

      await setBackendState(page, { mode: 'ok' })
      await hydrated(page)
      await page.locator(`[data-${prefix}-failed]`).getByRole('button').click()
      await listSettled(page)
      if (kind === 'categories') await expect(categoryRows(page)).toHaveCount(4)
      else await expect(tagRows(page)).toHaveCount(3)
    })
  }

  test('ONE section can fail while the OTHER stays fully usable — state is section-local', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)

    // Fail ONLY Tags at the browser boundary while the backend serves Categories normally.
    await page.route(/\/api\/v1\/admin\/tags/, route => route.abort())

    await page.goto('/dashboard/taxonomy')
    await categoryRows(page).first().waitFor({ timeout: 15_000 })
    await expect(page.locator('[data-tags-failed]')).toBeVisible()
    await expect(categoryRows(page)).toHaveCount(4)
    await expect(page.locator('[data-categories-failed]')).toHaveCount(0)
    await expect(page.locator('[data-tags-empty]')).toHaveCount(0)

    // Recover Tags through its OWN retry control; Categories is never reloaded.
    let categoriesRequests = 0
    const countCategories = (request: import('@playwright/test').Request): void => {
      if (request.url().includes('/api/v1/admin/categories')) categoriesRequests += 1
    }
    page.on('request', countCategories)
    const before = categoriesRequests
    await page.unroute(/\/api\/v1\/admin\/tags/)
    await page.locator('[data-tags-failed]').getByRole('button').click()
    await tagRows(page).first().waitFor({ timeout: 15_000 })
    await expect(tagRows(page)).toHaveCount(3)
    expect(categoriesRequests - before, 'recovering Tags reloaded Categories').toBe(0)
    await expect(page.locator('[data-tags-failed]')).toHaveCount(0)
  })

  test('answers a 403 as forbidden — neither an error nor an empty list, per section', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    for (const prefix of ['categories', 'tags']) {
      await expect(page.locator(`[data-${prefix}-forbidden]`)).toBeVisible()
      await expect(page.locator(`[data-${prefix}-failed]`)).toHaveCount(0)
      await expect(page.locator(`[data-${prefix}-empty]`)).toHaveCount(0)
    }
  })
})

test.describe('bilingual, at the narrowest supported width', () => {
  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: correct direction at 380px, no raw key paths, both server orders unchanged`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL!)
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)

      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoKeyPaths(page)

      const categoryIds = await categoryRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-category-row')))
      expect(categoryIds).toEqual([...CATEGORY_API_ORDER])
      const tagIds = await tagRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-tag-row')))
      expect(tagIds).toEqual([...TAG_API_ORDER])

      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(overflow.scrollWidth, `the taxonomy page overflows at ${NARROW.width}px in ${locale}`)
        .toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }
})

/* ── ACCESSIBILITY — focused, per locale, settled AND loading states ──────────────────────────── */

for (const locale of ['en', 'ar'] as const) {
  test.describe(`a11y · ${locale}`, () => {
    test(`${locale}: the settled Taxonomy page reports no axe violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/taxonomy')
      await hydrated(page)
      await listSettled(page)

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the LOADING state is axe-clean too`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await setBackendState(page, { delayMs: 3000 })
      await page.goto('/dashboard/taxonomy')
      await hydrated(page)
      await expect(page.locator('[aria-busy=true]').first()).toBeVisible()

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])

      await setBackendState(page, { delayMs: 0 })
    })
  })
}
