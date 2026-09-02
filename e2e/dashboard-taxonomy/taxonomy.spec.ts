import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  CATEGORY,
  CATEGORY_API_ORDER,
  CREATED_CATEGORY_ID,
  CREATED_TAG_ID,
  fillField,
  NARROW,
  overlay,
  overlaySettled,
  recordApiRequests,
  resetBackend,
  setBackendState,
  shell,
  signIn,
  categoryRows,
  tagRows,
  listSettledFor,
  expectNoKeyPaths,
  TAG,
  TAG_API_ORDER
} from './harness'

/**
 * This remains the mutable `dashboard-taxonomy` lane's ONE spec file. U4 deliberately keeps the
 * process/fixture ownership while changing the product journeys: Categories and Tags now each own
 * a route, and Taxonomy is only the authenticated legacy redirect.
 */
test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

async function visit(page: import('@playwright/test').Page, kind: 'categories' | 'tags') {
  await page.goto(`/dashboard/${kind}`)
  await listSettledFor(page, kind)
}

test.describe('legacy Taxonomy navigation', () => {
  test('an authenticated legacy bookmark replaces itself with Categories', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/taxonomy')
    await expect(page).toHaveURL(/\/dashboard\/categories$/)
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(12)
    await expect(tagRows(page)).toHaveCount(0)
  })
})

test.describe('Categories route', () => {
  test('owns its table and list request, preserving server order without Tag rows or list reads', async ({ page, baseURL }) => {
    const { detailRequests, listRequests, publicRequests } = await recordApiRequests(page, async () => {
      await signIn(page, 'en', baseURL!)
      await visit(page, 'categories')
    })

    await expect(page.locator('[data-categories-table]')).toBeVisible()
    const ids = await categoryRows(page).evaluateAll(rows => rows.map(row => row.getAttribute('data-category-row')))
    expect(ids.slice(0, CATEGORY_API_ORDER.length)).toEqual([...CATEGORY_API_ORDER])
    await expect(tagRows(page)).toHaveCount(0)
    await expect(page.locator('[data-categories-pagination]')).toBeVisible()
    expect(detailRequests).toEqual([])
    expect(listRequests.map(line => new URL(line.split(' ')[1]!).pathname)).toEqual(['/api/v1/admin/categories'])
    expect(new URL(listRequests[0]!.split(' ')[1]!).searchParams.toString()).toBe('page=1&perPage=12')
    expect(publicRequests).toEqual([])
  })

  test('owns page in the URL, requests page two, and restores page one through history', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'categories')
    const pageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/categories') && url.searchParams.get('page') === '2' && url.searchParams.get('perPage') === '12'
    })
    await page.goto('/dashboard/categories?page=2')
    await pageTwo
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(1)
    await page.goBack()
    await listSettledFor(page, 'categories')
    await expect(page).toHaveURL(/\/dashboard\/categories$/)
    await expect(categoryRows(page)).toHaveCount(12)
  })

  test('keeps page two visible after a delayed page-one response', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 1000 })
    const pageOne = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '1')
    await page.goto('/dashboard/categories')
    await pageOne
    await setBackendState(page, { delayMs: 0 })
    await page.goto('/dashboard/categories?page=2')
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(1)
  })

  test('clamps an out-of-range Category deep link from server metadata', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/categories?page=999')
    await expect(page).toHaveURL(/\/dashboard\/categories\?page=2$/)
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(1)
  })

  test('keeps loading, empty, error/retry, and forbidden state local to Categories', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/categories')
    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(page.locator('[data-categories-empty]')).toHaveCount(0)
    await listSettledFor(page, 'categories')

    await setBackendState(page, { mode: 'empty' })
    await page.reload()
    await listSettledFor(page, 'categories')
    await expect(page.locator('[data-categories-empty]')).toBeVisible()

    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettledFor(page, 'categories')
    await expect(page.locator('[data-categories-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-categories-failed]').getByRole('button').click()
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(12)

    await setBackendState(page, { mode: 'forbidden' })
    await page.reload()
    await listSettledFor(page, 'categories')
    await expect(page.locator('[data-categories-forbidden]')).toBeVisible()
    await expect(page.locator('[data-categories-failed], [data-categories-empty]')).toHaveCount(0)
  })

  test('retries the current Category page instead of reverting to page one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/categories?page=2')
    await listSettledFor(page, 'categories')
    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettledFor(page, 'categories')
    await expect(page.locator('[data-categories-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-categories-failed]').getByRole('button').click()
    await listSettledFor(page, 'categories')
    await expect(page).toHaveURL(/\/dashboard\/categories\?page=2$/)
    await expect(categoryRows(page)).toHaveCount(1)
  })

  test('creates, blocks empty validation, and restores focus after a clean close', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'categories')
    const create = page.locator('[data-taxonomy-create="categories"]')
    await create.click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.errorSummary)).toBeVisible()

    await fillField(page, 'name', 'ar', 'واجهات')
    await fillField(page, 'slug', 'ar', 'interfaces-ar')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettledFor(page, 'categories')
    await expect(page.locator(`[data-category-row="${CREATED_CATEGORY_ID}"]`)).toBeVisible()

    await create.click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.close).click()
    await expect(create).toBeFocused()
  })

  test('edits from the list row without a detail GET, refreshes, and maps a 422 to Arabic', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'categories')
    const detailGets: string[] = []
    page.on('request', request => {
      if (request.method() === 'GET' && /\/api\/v1\/admin\/categories\/.+/.test(request.url())) detailGets.push(request.url())
    })
    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.field('name', 'en')).fill('Systems rewritten')
    const patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes(CATEGORY.oldest))
    await page.locator(overlay.save).click()
    expect(JSON.parse((await patch).postData() ?? '{}').translations).toEqual([{ locale: 'en', name: 'Systems rewritten', slug: 'systems' }])
    await listSettledFor(page, 'categories')
    await expect(page.locator(`[data-category-row="${CATEGORY.oldest}"] [data-taxonomy-name]`)).toContainText('Systems rewritten')
    expect(detailGets).toEqual([])

    await page.locator(`[data-taxonomy-edit="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await fillField(page, 'slug', 'ar', 'interface-ar')
    const conflict = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes(CATEGORY.oldest))
    await page.locator(overlay.save).click()
    expect((await conflict).status()).toBe(422)
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
  })

  test('confirms delete, removes an unreferenced Category, and keeps a 409-referenced row', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'categories')
    await page.locator(`[data-taxonomy-delete="${CATEGORY.enOnly}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()
    await expect(page.locator(overlay.root('categories'))).toBeHidden()
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(12)

    await setBackendState(page, { articleReferencedCategoryIds: [CATEGORY.oldest] })
    await page.reload()
    await listSettledFor(page, 'categories')
    await page.locator(`[data-taxonomy-delete="${CATEGORY.oldest}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()
    await expect(page.locator(overlay.deleteError)).toBeVisible()
    await expect(page.locator(`[data-category-row="${CATEGORY.oldest}"]`)).toBeVisible()
  })

  test('clamps Category page two after deleting its final row', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/categories?page=2')
    await listSettledFor(page, 'categories')
    const id = await categoryRows(page).first().getAttribute('data-category-row')
    expect(id).toBeTruthy()
    await page.locator(`[data-taxonomy-delete="${id}"]`).click()
    await overlaySettled(page, 'categories')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()
    await expect(page).toHaveURL(/\/dashboard\/categories$/)
    await listSettledFor(page, 'categories')
    await expect(categoryRows(page)).toHaveCount(12)
  })
})

test.describe('Tags route', () => {
  test('owns its table and list request, preserving server order without Category rows or list reads', async ({ page, baseURL }) => {
    const { detailRequests, listRequests, publicRequests } = await recordApiRequests(page, async () => {
      await signIn(page, 'en', baseURL!)
      await visit(page, 'tags')
    })
    await expect(page.locator('[data-tags-table]')).toBeVisible()
    const ids = await tagRows(page).evaluateAll(rows => rows.map(row => row.getAttribute('data-tag-row')))
    expect(ids.slice(0, TAG_API_ORDER.length)).toEqual([...TAG_API_ORDER])
    await expect(categoryRows(page)).toHaveCount(0)
    expect(detailRequests).toEqual([])
    expect(listRequests.map(line => new URL(line.split(' ')[1]!).pathname)).toEqual(['/api/v1/admin/tags'])
    expect(new URL(listRequests[0]!.split(' ')[1]!).searchParams.toString()).toBe('page=1&perPage=12')
    expect(publicRequests).toEqual([])
  })

  test('owns page in the URL, requests page two, and restores page one through history', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'tags')
    const pageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/tags') && url.searchParams.get('page') === '2' && url.searchParams.get('perPage') === '12'
    })
    await page.goto('/dashboard/tags?page=2')
    await pageTwo
    await listSettledFor(page, 'tags')
    await expect(tagRows(page)).toHaveCount(1)
    await page.goBack()
    await listSettledFor(page, 'tags')
    await expect(page).toHaveURL(/\/dashboard\/tags$/)
    await expect(tagRows(page)).toHaveCount(12)
  })

  test('keeps page two visible after a delayed page-one response', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 1000 })
    const pageOne = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '1')
    await page.goto('/dashboard/tags')
    await pageOne
    await setBackendState(page, { delayMs: 0 })
    await page.goto('/dashboard/tags?page=2')
    await listSettledFor(page, 'tags')
    await expect(tagRows(page)).toHaveCount(1)
  })

  test('clamps an out-of-range Tag deep link from server metadata', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/tags?page=999')
    await expect(page).toHaveURL(/\/dashboard\/tags\?page=2$/)
    await listSettledFor(page, 'tags')
    await expect(tagRows(page)).toHaveCount(1)
  })

  test('keeps empty, error/retry, and forbidden state local to Tags', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'empty' })
    await visit(page, 'tags')
    await expect(page.locator('[data-tags-empty]')).toBeVisible()
    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettledFor(page, 'tags')
    await expect(page.locator('[data-tags-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-tags-failed]').getByRole('button').click()
    await listSettledFor(page, 'tags')
    await expect(tagRows(page)).toHaveCount(12)
    await setBackendState(page, { mode: 'forbidden' })
    await page.reload()
    await listSettledFor(page, 'tags')
    await expect(page.locator('[data-tags-forbidden]')).toBeVisible()
  })

  test('retries the current Tag page instead of reverting to page one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/tags?page=2')
    await listSettledFor(page, 'tags')
    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettledFor(page, 'tags')
    await expect(page.locator('[data-tags-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-tags-failed]').getByRole('button').click()
    await listSettledFor(page, 'tags')
    await expect(page).toHaveURL(/\/dashboard\/tags\?page=2$/)
    await expect(tagRows(page)).toHaveCount(1)
  })

  test('creates, validates an empty form, and edits with no detail GET before refreshing', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'tags')
    await page.locator('[data-taxonomy-create="tags"]').click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.save).click()
    await expect(page.locator(overlay.errorSummary)).toBeVisible()
    await fillField(page, 'name', 'ar', 'اختبار جديد')
    await fillField(page, 'slug', 'ar', 'new-tag-ar')
    await page.locator(overlay.save).click()
    await listSettledFor(page, 'tags')
    await expect(page.locator(`[data-tag-row="${CREATED_TAG_ID}"]`)).toBeVisible()

    const detailGets: string[] = []
    page.on('request', request => {
      if (request.method() === 'GET' && /\/api\/v1\/admin\/tags\/.+/.test(request.url())) detailGets.push(request.url())
    })
    await page.locator(`[data-taxonomy-edit="${TAG.oldest}"]`).click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.field('name', 'en')).fill('NestJS rewritten')
    const patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes(TAG.oldest))
    await page.locator(overlay.save).click()
    expect(JSON.parse((await patch).postData() ?? '{}').translations).toEqual([{ locale: 'en', name: 'NestJS rewritten', slug: 'nestjs' }])
    await listSettledFor(page, 'tags')
    await expect(page.locator(`[data-tag-row="${TAG.oldest}"]`)).toContainText('NestJS rewritten')
    expect(detailGets).toEqual([])
  })

  test('maps a Tag slug conflict to English and confirms deletions have no fabricated 409 branch', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page, 'tags')
    await page.locator(`[data-taxonomy-edit="${TAG.oldest}"]`).click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.field('slug', 'en')).fill('vue')
    const conflict = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes(TAG.oldest))
    await page.locator(overlay.save).click()
    expect((await conflict).status()).toBe(422)
    await expect(page.locator('[data-editor-tab-invalid="en"]')).toBeVisible()
    page.once('dialog', dialog => void dialog.accept())
    await page.locator(overlay.close).click()

    for (const id of [TAG.oldest, TAG.enOnly, TAG.middle]) {
      await page.locator(`[data-taxonomy-delete="${id}"]`).click()
      await overlaySettled(page, 'tags')
      await page.locator(overlay.delete).click()
      await page.locator(overlay.deleteConfirm).click()
      await expect(page.locator(overlay.root('tags'))).toBeHidden()
      await listSettledFor(page, 'tags')
    }
    await expect(tagRows(page)).toHaveCount(10)
    await expect(page.locator('[data-tags-empty]')).toHaveCount(0)
  })

  test('clamps Tag page two after deleting its final row', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/tags?page=2')
    await listSettledFor(page, 'tags')
    const id = await tagRows(page).first().getAttribute('data-tag-row')
    expect(id).toBeTruthy()
    await page.locator(`[data-taxonomy-delete="${id}"]`).click()
    await overlaySettled(page, 'tags')
    await page.locator(overlay.delete).click()
    await page.locator(overlay.deleteConfirm).click()
    await expect(page).toHaveURL(/\/dashboard\/tags$/)
    await listSettledFor(page, 'tags')
    await expect(tagRows(page)).toHaveCount(12)
  })
})

for (const [kind, rowSelector] of [['categories', '[data-category-row]'], ['tags', '[data-tag-row]']] as const) {
  for (const locale of ['en', 'ar'] as const) {
    test(`${kind}: ${locale} route and open overlay are RTL-safe and axe-clean at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL!)
      await visit(page, kind)
      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expect(page.locator(rowSelector)).toHaveCount(12)
      await expectNoKeyPaths(page)
      await hydrated(page)
      let results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, `${kind} ${locale} settled route`).toEqual([])

      await page.locator(`[data-taxonomy-create="${kind}"]`).click()
      await overlaySettled(page, kind)
      await fillField(page, 'name', 'ar', 'اتجاه')
      await expect(page.locator('[data-taxonomy-field="name:ar"]')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-taxonomy-field="name:en"]')).toHaveAttribute('dir', 'ltr')
      results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, `${kind} ${locale} create overlay`).toEqual([])
      const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }
}
