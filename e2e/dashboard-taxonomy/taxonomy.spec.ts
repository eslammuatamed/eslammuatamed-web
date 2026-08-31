import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  CREATED_CATEGORY_ID,
  CREATED_TAG_ID,
  fillField,
  overlay,
  overlaySettled,
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   `U3b` — CREATE / EDIT / DELETE OVERLAYS, on this route. No detail read exists; every edit starts
   from the clicked row. Still ONE spec file, because the lane stays `resetsBackendState: true`.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

test.describe('U3b · the category overlay', () => {
  test('create opens empty; an ARABIC-FIRST create succeeds end-to-end', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    const writes: string[] = []
    page.on('request', (request) => {
      if (/\/api\/v1\/admin\/categories/.test(request.url()) && request.method() !== 'GET') {
        writes.push(request.method())
      }
    })

    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator('[data-editor-tabs] button').nth(1).click() // Arabic tab
    await fillField(page, 'name', 'ar', 'واجهات')
    await fillField(page, 'slug', 'ar', 'interfaces-ar')
    await page.locator(overlay.save).click()

    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettled(page)
    const ids = await categoryRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-category-row')))
    expect(ids).toHaveLength(5)
    expect(ids.at(-1)).toBe(CREATED_CATEGORY_ID) // server order: appended last
    expect(writes).toEqual(['POST'])
  })

  test('an ENGLISH-FIRST create succeeds symmetrically', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)
    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Craft')
    await page.locator(overlay.field('slug', 'en')).fill('craft')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettled(page)
    await expect(page.locator(`[data-category-row="${CREATED_CATEGORY_ID}"]`)).toBeVisible()
  })

  test('zero usable translations -> save blocked client-side with ZERO write requests', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)
    const writes: string[] = []
    page.on('request', (request) => {
      if (/\/api\/v1\/admin\/categories/.test(request.url()) && request.method() !== 'GET') writes.push(request.url())
    })
    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.save).click()
    await expect(page.locator('[data-taxonomy-overlay-error-summary]')).toBeVisible()
    await expect(page.locator(`${overlay.root('categories')} ${overlay.title}`)).toBeVisible()
    expect(writes, 'an unguarded save reached the API').toEqual([])
  })

  test('EDIT opens from the clicked row with ZERO detail GETs and PATCHes only what changed', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    const apiRequests: string[] = []
    const listener = (request: import('@playwright/test').Request): void => {
      if (/\/api\/v1\/admin\/(categories|tags)/.test(request.url())) {
        apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`)
      }
    }

    // ⚠ THE INVARIANT: opening EDIT must issue ZERO detail GETs.
    page.on('request', listener)
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')

    await expect(page.locator(overlay.field('name', 'en'))).toHaveValue('Systems')
    await expect(page.locator(overlay.field('name', 'ar'))).toHaveValue('أنظمة')

    await page.locator(overlay.field('name', 'en')).fill('Systems rewritten')
    const patchPromise = page.waitForRequest(
      (request) => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/categories/${CATEGORY.oldest}`)
    )
    await page.locator(overlay.save).click()
    const body = JSON.parse((await patchPromise).postData() ?? '{}')
    page.off('request', listener)

    // ⚠ UPSERT ON THE WIRE: only the changed locale; untouched Arabic omitted entirely;
    // unchanged description key omitted within the emitted item.
    expect(body.translations).toHaveLength(1)
    expect(body.translations[0]).toEqual({ locale: 'en', name: 'Systems rewritten', slug: 'systems' })
    expect(JSON.stringify(body)).not.toContain('أنظمة')

    await listSettled(page)
    expect(apiRequests.filter((line) => line.startsWith('GET ') && /\/(categories|tags)\//.test(line))).toEqual([])
  })

  test('untouched locale PRESERVES after refresh while the edited locale shows new content', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Systems rewritten')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettled(page)

    const row = page.locator(`[data-category-row="${CATEGORY.oldest}"]`)
    await expect(row.locator('[data-taxonomy-name]')).toContainText('Systems rewritten')
    // Arabic badge still PRESENT — omission preserved it.
    await expect(row.locator('[data-taxonomy-translation="ar:present"]')).toBeVisible()
  })

  test('description: explicit clear sends null on PATCH; an untouched description is omitted', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    // CLEAR: empty the stored English description and save — `null` must travel.
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('description', 'en')).fill('')
    const clearPatch = page.waitForRequest(
      (request) => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/categories/${CATEGORY.oldest}`)
    )
    await page.locator(overlay.save).click()
    const cleared = JSON.parse((await clearPatch).postData() ?? '{}')
    expect(cleared.translations[0]).toHaveProperty('description', null)

    await listSettled(page)

    // UNTOUCHED description: renaming Arabic emits the ar locale WITHOUT any description key,
    // because the value did not change from the initialized row.
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await fillField(page, 'name', 'ar', 'أنظمة جديدة')
    const touchPatch = page.waitForRequest(
      (request) => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/categories/${CATEGORY.oldest}`)
    )
    await page.locator(overlay.save).click()
    const touched = JSON.parse((await touchPatch).postData() ?? '{}')
    expect(touched.translations[0].locale).toBe('ar')
    expect(touched.translations[0]).not.toHaveProperty('description')
  })

  test('a slug conflict 422 activates the ARABIC tab of the sent order', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    // Author ONLY Arabic on the oldest category, colliding with another row's Arabic slug.
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await fillField(page, 'slug', 'ar', 'interface-ar') // held by CATEGORY.described

    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/admin/categories/${CATEGORY.oldest}`)
    )
    await page.locator(overlay.save).click()
    expect((await responsePromise).status()).toBe(422)

    // The SENT array was Arabic-only, so index 0 IS Arabic — the overlay must show THAT tab.
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator(`${overlay.root('categories')} ${overlay.title}`)).toBeVisible()
  })

  test('delete succeeds for an unreferenced category and removes the row after confirmation', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    await page.locator(`[data-taxonomy-delete="${CATEGORY.enOnly}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()

    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettled(page)
    await expect(categoryRows(page)).toHaveCount(3)
  })

  test('the DOCUMENTED article-reference 409 surfaces localized and the entity remains', async ({ page, baseURL }) => {
    await setBackendState(page, { articleReferencedCategoryIds: [CATEGORY.oldest] })
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    await page.locator(`[data-taxonomy-delete="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()

    await expect(page.locator('[data-taxonomy-overlay-delete-error]')).toBeVisible()
    await listSettled(page)
    await expect(categoryRows(page)).toHaveCount(4) // NOT deleted
  })
})

test.describe('U3b · the tag overlay', () => {
  test('create opens; ARABIC-FIRST then ENGLISH-FIRST creates both succeed', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    await page.locator('[data-taxonomy-create="tags"]').click()
    await overlaySettled(page, 'tags')
    await page.locator('[data-editor-tabs] button').nth(1).click()
    await fillField(page, 'name', 'ar', 'اختبار-جديد')
    await fillField(page, 'slug', 'ar', 'new-tag-ar')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.root('tags'))).toBeHidden()
    await listSettled(page)
    await expect(page.locator(`[data-tag-row="${CREATED_TAG_ID}"]`)).toBeVisible()

    // Second create (sequence 2), English-first.
    await page.locator('[data-taxonomy-create="tags"]').click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.field('name', 'en')).fill('Fresh')
    await page.locator(overlay.field('slug', 'en')).fill('fresh')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.root('tags'))).toBeHidden()
    await listSettled(page)
    await expect(tagRows(page)).toHaveCount(5)
  })

  test('zero usable translations -> blocked with zero write requests', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)
    const writes: string[] = []
    page.on('request', (request) => {
      if (/\/api\/v1\/admin\/tags/.test(request.url()) && request.method() !== 'GET') writes.push(request.url())
    })
    await page.locator('[data-taxonomy-create="tags"]').click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.save).click()
    await expect(page.locator('[data-taxonomy-overlay-error-summary]')).toBeVisible()
    expect(writes).toEqual([])
  })

  test('EDIT initializes from the row with ZERO detail GETs; one-locale PATCH upserts correctly', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    const detailGets: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'GET' && /\/api\/v1\/admin\/tags\/.+/.test(request.url())) detailGets.push(request.url())
    })

    await page.locator(`[data-taxonomy-edit="${TAG.oldest}"]`).click()
    await overlaySettled(page, 'tags')
    await expect(page.locator(overlay.field('name', 'en'))).toHaveValue('NestJS')
    await expect(page.locator(overlay.field('name', 'ar'))).toHaveValue('نيست')

    await page.locator(overlay.field('name', 'en')).fill('NestJS rewritten')
    const patchPromise = page.waitForRequest(
      (request) => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/tags/${TAG.oldest}`)
    )
    await page.locator(overlay.save).click()
    const body = JSON.parse((await patchPromise).postData() ?? '{}')
    expect(body.translations).toEqual([{ locale: 'en', name: 'NestJS rewritten', slug: 'nestjs' }])
    await listSettled(page)
    expect(detailGets, 'a detail GET fired during tag editing').toEqual([])

    // Untouched Arabic preserved after refresh.
    const row = page.locator(`[data-tag-row="${TAG.oldest}"]`)
    await expect(row.locator('[data-taxonomy-name]')).toContainText('NestJS rewritten')
    await expect(row.locator('[data-taxonomy-translation="ar:present"]')).toBeVisible()
  })

  test('a slug-conflict 422 resolves to the correct tab; NO fabricated relation-409 exists for tags', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    await page.locator(`[data-taxonomy-edit="${TAG.oldest}"]`).click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.field('slug', 'en')).fill('vue') // held by TAG.enOnly

    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/admin/tags/${TAG.oldest}`)
    )
    await page.locator(overlay.save).click()
    expect((await responsePromise).status()).toBe(422)
    await expect(page.locator('[data-editor-tab-invalid="en"]')).toBeVisible()

    // The overlay stays open on the 422 (dirty form); discard it before the delete sweep.
    page.once('dialog', (dialog) => void dialog.accept())
    await page.locator(overlay.close).click()
    await expect(page.locator(overlay.root('tags'))).toBeHidden()
    await listSettled(page)

    // Delete EVERY seeded tag: all answer 204. No 409 branch may exist to fall into.
    const expectedCounts = [2, 1, 0]
    for (const [index, id] of [TAG.oldest, TAG.enOnly, TAG.middle].entries()) {
      await page.locator(`[data-taxonomy-delete="${id}"]`).click()
      await overlaySettled(page, 'tags')
      await page.locator(overlay.delete).click()
      await page.locator(overlay.deleteConfirm).click()
      await expect(page.locator(overlay.root('tags'))).toBeHidden()
      await listSettled(page)
      await expect(tagRows(page)).toHaveCount(expectedCounts[index]!)
      if (index < 2) {
        // Let the slideover's exit transition finish so it cannot intercept the next row's click.
        await page.waitForTimeout(250)
      }
    }
    await expect(page.locator('[data-tags-empty]')).toBeVisible()
  })
})

test.describe('U3b · shared overlay behavior', () => {
  test('closing a DIRTY overlay asks; closing a CLEAN one does not; collection stays usable either way', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Unsaved work')

    let asked = false
    page.once('dialog', (dialog) => { asked = true; void dialog.dismiss() }) // stay open
    await page.locator(overlay.close).click()
    await expect(page.locator(`${overlay.root('categories')} ${overlay.title}`)).toBeVisible()
    expect(asked, 'a dirty overlay closed without asking').toBe(true)

    // Discard this time: confirm, overlay closes, collection intact underneath.
    page.once('dialog', (dialog) => void dialog.accept())
    await page.locator(overlay.close).click()
    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await expect(categoryRows(page)).toHaveCount(4)
  })

  test('after a mutation refresh BOTH sections still render SERVER order — no local re-sort', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)

    // Create via the UI, forcing a section refresh.
    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Aaa-first-alphabetically')
    await page.locator(overlay.field('slug', 'en')).fill('aaa')
    await page.locator(overlay.save).click()
    await listSettled(page)

    // The created row sits LAST (createdAt asc), even though its name sorts FIRST alphabetically.
    const ids = await categoryRows(page).evaluateAll(els => els.map(el => el.getAttribute('data-category-row')))
    expect(ids.at(-1)).toBe(CREATED_CATEGORY_ID)
    expect(ids.slice(0, 4)).toEqual([...CATEGORY_API_ORDER])
  })

  test('no PUBLIC taxonomy endpoint leaks during create/edit/delete flows', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await listSettled(page)
    const leaks: string[] = []
    page.on('request', (request) => {
      if (/\/api\/v1\/(categories|tags)\b/.test(request.url())) leaks.push(request.url())
    })
    await page.locator('[data-taxonomy-create="categories"]').click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Leak probe')
    await page.locator(overlay.field('slug', 'en')).fill('leak-probe')
    await page.locator(overlay.save).click()
    await listSettled(page)
    expect(leaks).toEqual([])
  })

  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: overlays are usable at 380px with correct field direction`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL!)
      await page.goto('/dashboard/taxonomy')
      await listSettled(page)

      await page.locator('[data-taxonomy-create="categories"]').click()
      await overlaySettled(page, 'categories')

      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoKeyPaths(page)

      // Field direction is independent of chrome direction; the panel itself follows the shell.
      await fillField(page, 'name', 'ar', 'اتجاه')
      await expect(page.locator('[data-editor-panel="ar"]')).not.toHaveAttribute('dir')
      await expect(page.locator('[data-editor-panel="en"]')).not.toHaveAttribute('dir')
      await expect(page.locator('[data-taxonomy-field="name:ar"]')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-taxonomy-field="name:en"]')).toHaveAttribute('dir', 'ltr')

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(overflow.scrollWidth, `taxonomy overlay overflows at 380px in ${locale}`)
        .toBeLessThanOrEqual(overflow.clientWidth + 1)

      // Actions reachable inside the narrow slideover.
      await expect(page.locator(overlay.save)).toBeVisible()
      await page.locator(overlay.close).click()
    })
  }

  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: the OPEN overlay is axe-clean (create and edit states)`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/taxonomy')
      await hydrated(page)
      await listSettled(page)

      // CREATE state.
      await page.locator('[data-taxonomy-create="categories"]').click()
      await overlaySettled(page, 'categories')
      await hydrated(page)
      let results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, `${locale} create overlay`).toEqual([])

      // EDIT state (same overlay, populated).
      await page.locator(overlay.close).click()
      await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
      await overlaySettled(page, 'categories')
      results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, `${locale} edit overlay`).toEqual([])

      // TAG create state.
      await page.locator(overlay.close).click()
      await page.locator('[data-taxonomy-create="tags"]').click()
      await overlaySettled(page, 'tags')
      results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, `${locale} tag overlay`).toEqual([])
    })
  }
})
