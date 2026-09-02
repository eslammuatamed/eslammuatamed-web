import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hydrated } from '../hydration'
import { API_ORDER, AVATAR, CREATED_ID, NARROW, OUT_OF_SEQUENCE_IDS, OUT_OF_SEQUENCE_ROWS, TESTIMONIAL, expectNoKeyPaths, listSettled, resetBackend, rows, setBackendState, shell, signIn } from './harness'

test.beforeEach(async ({ page }) => { await resetBackend(page) })

async function visit(page: Page): Promise<void> { await page.goto('/dashboard/testimonials'); await listSettled(page) }
async function openCreate(page: Page, baseURL: string): Promise<void> {
  await signIn(page, 'en', baseURL); await visit(page); await page.locator('[data-testimonials-create]').click()
  await expect(page.locator('[data-testimonial-overlay]')).toBeVisible(); await expect(page.locator('[data-testimonial-editor-ready]')).toBeVisible()
}
async function openEdit(page: Page, baseURL: string, id: string = TESTIMONIAL.featured): Promise<void> {
  await signIn(page, 'en', baseURL); await visit(page); await page.locator(`[data-testimonial-edit="${id}"]`).click()
  await expect(page.locator('[data-testimonial-overlay]')).toBeVisible(); await expect(page.locator('[data-editor-quote="en"]')).toBeVisible()
}

test.describe('the Testimonials collection', () => {
  test('renders the first server page in API order inside a UTable', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!); await visit(page)
    await expect(page.locator('[data-testimonials-table]')).toBeVisible()
    const ids = await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute('data-testimonial-row')))
    expect(ids.slice(0, API_ORDER.length)).toEqual([...API_ORDER])
    expect(ids).toHaveLength(12)
    await expect(page.locator('[data-testimonials-pagination]')).toBeVisible()
    await expect(page.locator(`[data-testimonial-avatar="${AVATAR.featured}"]`)).toBeVisible()
    await expect(page.locator(`[data-testimonial-row="${TESTIMONIAL.enOnly}"] [data-testimonial-translation="ar:missing"]`)).toBeVisible()
  })

  test('deep-links page two through the server, and back restores page one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)
    const pageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/testimonials') && url.searchParams.get('page') === '2' && url.searchParams.get('perPage') === '12'
    })
    await page.goto('/dashboard/testimonials?page=2')
    await pageTwo
    await listSettled(page)
    await expect(rows(page)).toHaveCount(1)
    await page.goBack()
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/testimonials$/)
    await expect(rows(page)).toHaveCount(12)
  })

  test('keeps page two visible when the delayed page-one response arrives late', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 1000 })
    const pageOne = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '1')
    await page.goto('/dashboard/testimonials')
    await pageOne
    await setBackendState(page, { delayMs: 0 })
    await page.goto('/dashboard/testimonials?page=2')
    await listSettled(page)
    await expect(rows(page)).toHaveCount(1)
  })

  test('keeps server ordering and loading, empty, error/retry, and forbidden local to the collection', async ({ page, baseURL }) => {
    await setBackendState(page, { testimonials: OUT_OF_SEQUENCE_ROWS }); await signIn(page, 'en', baseURL!); await visit(page)
    expect(await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute('data-testimonial-row')))).toEqual([...OUT_OF_SEQUENCE_IDS])
    await setBackendState(page, { delayMs: 2000 }); await page.reload(); await expect(page.locator('[aria-busy=true]')).toBeVisible(); await listSettled(page)
    await setBackendState(page, { mode: 'empty' }); await page.reload(); await listSettled(page); await expect(page.locator('[data-testimonials-empty]')).toBeVisible()
    await setBackendState(page, { mode: 'error' }); await page.reload(); await listSettled(page); await expect(page.locator('[data-testimonials-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' }); await page.locator('[data-testimonials-failed]').getByRole('button').click(); await listSettled(page); await expect(rows(page)).toHaveCount(OUT_OF_SEQUENCE_IDS.length)
    await setBackendState(page, { mode: 'forbidden' }); await page.reload(); await listSettled(page); await expect(page.locator('[data-testimonials-forbidden]')).toBeVisible()
  })
})

test.describe('create in the Testimonials slideover', () => {
  test('starts clean, preserves bilingual validation, selects an avatar, and refreshes the table', async ({ page, baseURL }) => {
    await openCreate(page, baseURL!)
    await page.locator('[data-editor-save]').click(); await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
    await page.getByRole('tab', { name: /Arabic/ }).click(); await page.locator('[data-editor-quote="ar"]').fill('عمل ممتاز من فريق رائع.')
    await page.locator('[data-editor-author="ar"]').fill('أمينة خالد'); await page.locator('[data-editor-role="ar"]').fill('مديرة المنتج')
    await page.locator('[data-picker-open]').click(); await page.locator(`[data-media-id="${AVATAR.replacement}"]`).click()
    await page.locator('[data-editor-save]').click(); await expect(page.locator('[data-testimonial-overlay]')).toBeHidden(); await listSettled(page)
    await expect(page.locator(`[data-testimonial-row="${CREATED_ID}"]`)).toBeVisible()
  })

  test('keeps a failed create open and focuses its mutation error', async ({ page, baseURL }) => {
    await openCreate(page, baseURL!); await page.locator('[data-editor-quote="en"]').fill('Save failure'); await page.locator('[data-editor-author="en"]').fill('Casey'); await page.locator('[data-editor-role="en"]').fill('COO')
    await setBackendState(page, { failNextWrite: true }); await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-save-error-container]')).toBeFocused(); await expect(page.locator('[data-testimonial-overlay]')).toBeVisible()
  })

  test('closes a clean slideover and restores focus to its trigger', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!); await visit(page); const create = page.locator('[data-testimonials-create]'); await create.click()
    await expect(page.locator('[data-testimonial-overlay]')).toBeVisible(); await page.locator('[data-testimonial-overlay-close]').click()
    await expect(page.locator('[data-testimonial-overlay]')).toBeHidden(); await expect(create).toBeFocused()
  })
})

test.describe('edit, avatar semantics, nested focus, and delete', () => {
  test('loads correctly; preserves untouched avatar and omitted translations; clears or changes avatar only when authored', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!); await expect(page.locator('[data-picker-filename]')).toContainText('avatar-alex.webp')
    let patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes(TESTIMONIAL.featured))
    await page.locator('[data-editor-order]').fill('7'); await page.locator('[data-editor-save]').click(); expect(JSON.parse((await patch).postData() ?? '{}')).not.toHaveProperty('avatarId')
    await page.locator(`[data-testimonial-edit="${TESTIMONIAL.featured}"]`).click(); await expect(page.locator('[data-picker-clear]')).toBeVisible()
    patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes(TESTIMONIAL.featured)); await page.locator('[data-picker-clear]').click(); await page.locator('[data-editor-save]').click(); expect(JSON.parse((await patch).postData() ?? '{}')).toHaveProperty('avatarId', null)
    await page.locator(`[data-testimonial-edit="${TESTIMONIAL.featured}"]`).click(); const picker = page.locator('[data-picker-open]'); await picker.click(); await page.locator(`[data-media-id="${AVATAR.replacement}"]`).click(); await expect(picker).toBeFocused()
    patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes(TESTIMONIAL.featured)); await page.locator('[data-editor-save]').click(); expect(JSON.parse((await patch).postData() ?? '{}')).toHaveProperty('avatarId', AVATAR.replacement)
  })

  test('maps a translation 422, does not discard dirty edits, and restores focus after confirmed close', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!); const edit = page.locator(`[data-testimonial-edit="${TESTIMONIAL.featured}"]`)
    await page.route(`**/api/v1/admin/testimonials/${TESTIMONIAL.featured}`, async route => route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Validation failed', status: 422, errors: [{ field: 'translations[1].quote', message: 'Arabic quote is invalid.' }] }) }))
    await page.locator('[data-editor-order]').fill('8'); await page.locator('[data-editor-save]').click(); await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible(); await page.unroute(`**/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    await page.locator('[data-editor-quote="ar"]').fill('غير محفوظ'); page.once('dialog', dialog => void dialog.dismiss()); await page.locator('[data-testimonial-overlay-close]').click(); await expect(page.locator('[data-testimonial-overlay]')).toBeVisible()
    page.once('dialog', dialog => void dialog.accept()); await page.locator('[data-testimonial-overlay-close]').click(); await expect(page.locator('[data-testimonial-overlay]')).toBeHidden(); await expect(edit).toBeFocused()
  })

  test('preserves delete confirmation, refreshes success, and leaves a row after failure', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!); await page.locator('[data-editor-delete]').click(); await expect(page.locator('[data-editor-delete-confirm]')).toBeVisible(); await page.locator('[data-editor-delete-confirm]').click(); await expect(page.locator('[data-testimonial-overlay]')).toBeHidden(); await listSettled(page); await expect(page.locator(`[data-testimonial-row="${TESTIMONIAL.featured}"]`)).toHaveCount(0)
    await page.locator(`[data-testimonial-edit="${TESTIMONIAL.hidden}"]`).click(); await page.locator('[data-editor-delete]').click(); await setBackendState(page, { failNextWrite: true }); await page.locator('[data-editor-delete-confirm]').click(); await expect(page.locator('[data-editor-delete-error]')).toBeVisible(); await expect(page.locator(`[data-testimonial-row="${TESTIMONIAL.hidden}"]`)).toBeVisible()
  })
})

test.describe('legacy Testimonials URLs and query-state intent', () => {
  test('redirects bookmarks into collection overlays and removes only its own query key on close', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!); await page.goto('/dashboard/testimonials/new'); await expect(page).toHaveURL(/\/dashboard\/testimonials\?create=1$/); await expect(page.locator('[data-testimonial-overlay]')).toBeVisible()
    await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`); await expect(page).toHaveURL(new RegExp(`/dashboard/testimonials\\?edit=${TESTIMONIAL.featured}$`)); await expect(page.locator('[data-editor-quote="en"]')).toBeVisible()
    await page.goto('/dashboard/testimonials?create=1&source=bookmark'); await page.locator('[data-testimonial-overlay-close]').click(); await expect(page.locator('[data-testimonial-overlay]')).toBeHidden(); const url = new URL(page.url()); expect(url.searchParams.get('create')).toBeNull(); expect(url.searchParams.get('source')).toBe('bookmark')
  })
})

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: table and open slideover are narrow, direction-safe, and axe-clean`, async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW); await signIn(page, locale, baseURL!); await visit(page); await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr'); await expectNoKeyPaths(page); await hydrated(page)
    expect((await new AxeBuilder({ page }).analyze()).violations, `${locale} table`).toEqual([])
    await page.locator('[data-testimonials-create]').click(); await page.getByRole('tab', { name: locale === 'ar' ? /Arabic|العربية/ : /English|الإنجليزية/ }).click(); await expect(page.locator(`[data-editor-quote="${locale}"]`)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect((await new AxeBuilder({ page }).analyze()).violations, `${locale} overlay`).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}
