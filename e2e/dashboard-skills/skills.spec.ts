import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  API_ORDER,
  NARROW,
  SKILL,
  expectNoKeyPaths,
  listSettled,
  resetBackend,
  rows,
  setBackendState,
  shell,
  signIn
} from './harness'

/** One spec file: this mutable backend lane is intentionally single-worker. */
test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

async function visit(page: Page): Promise<void> {
  await page.goto('/dashboard/skills')
  await listSettled(page)
}

async function openCreate(page: Page, baseURL: string): Promise<void> {
  await signIn(page, 'en', baseURL)
  await visit(page)
  await page.locator('[data-skills-create]').click()
  await expect(page.locator('[data-skill-overlay]')).toBeVisible()
  await expect(page.locator('[data-skill-editor-ready]')).toBeVisible()
}

async function openEdit(page: Page, baseURL: string, id: string = SKILL.typescript): Promise<void> {
  await signIn(page, 'en', baseURL)
  await visit(page)
  await page.locator(`[data-skill-edit="${id}"]`).click()
  await expect(page.locator('[data-skill-overlay]')).toBeVisible()
  await expect(page.locator('[data-editor-slug]')).toBeVisible()
}

test.describe('the Skills collection', () => {
  test('renders the first server page in API order inside a UTable', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page)
    await expect(page.locator('[data-skills-table]')).toBeVisible()
    expect((await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute('data-skill-row')))).slice(0, API_ORDER.length))
      .toEqual([...API_ORDER])
    await expect(rows(page)).toHaveCount(12)
    await expect(page.locator('[data-skills-pagination], [data-skills-filter]')).toHaveCount(2)
    await expect(page.locator(`[data-skill-brand-color="${SKILL.nest}"]`)).toHaveText('brand-token-nest')
    await expect(page.locator(`[data-skill-row="${SKILL.delivery}"] [data-skill-translation="ar:missing"]`)).toBeVisible()
  })

  test('owns page and group in the URL and sends their server query values', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page)
    const pageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/skills') && url.searchParams.get('page') === '2' && url.searchParams.get('perPage') === '12'
    })
    await page.goto('/dashboard/skills?page=2')
    await pageTwo
    await listSettled(page)
    await expect(rows(page)).toHaveCount(12)

    const frontend = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/skills') && url.searchParams.get('page') === '1' && url.searchParams.get('group') === 'FRONTEND'
    })
    await page.locator('[data-skills-group]').click()
    await page.getByRole('option', { name: 'Frontend', exact: true }).click()
    await frontend
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/skills\?group=FRONTEND$/)
    await expect(rows(page)).toHaveCount(12)
    await expect(page.locator(`[data-skill-row="${SKILL.vue}"]`)).toBeVisible()
  })

  test('restores deep-linked group pages, preserves the group across page changes, and handles history', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    const backendPageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/skills')
        && url.searchParams.get('page') === '2'
        && url.searchParams.get('perPage') === '12'
        && url.searchParams.get('group') === 'BACKEND'
    })
    await page.goto('/dashboard/skills?group=BACKEND&page=2')
    await backendPageTwo
    await listSettled(page)
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator('[data-skill-group]').getByText('Backend')).toBeVisible()

    const pageOne = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/skills')
        && url.searchParams.get('page') === '1'
        && url.searchParams.get('group') === 'BACKEND'
    })
    await page.locator('[data-skills-pagination]').getByRole('button', { name: 'Page 1', exact: true }).click()
    await pageOne
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/skills\?group=BACKEND$/)
    await expect(rows(page)).toHaveCount(12)

    await page.goBack()
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/skills\?group=BACKEND&page=2$/)
    await expect(rows(page)).toHaveCount(1)
    await page.goForward()
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/skills\?group=BACKEND$/)
  })

  test('keeps loading, empty, error/retry, and forbidden states local to the collection', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/skills')
    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(page.locator('[data-skills-empty]')).toHaveCount(0)
    await listSettled(page)

    await setBackendState(page, { mode: 'empty' })
    await page.reload()
    await listSettled(page)
    await expect(page.locator('[data-skills-empty]')).toBeVisible()

    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettled(page)
    await expect(page.locator('[data-skills-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-skills-failed]').getByRole('button').click()
    await listSettled(page)
    await expect(rows(page)).toHaveCount(12)

    await setBackendState(page, { mode: 'forbidden' })
    await page.reload()
    await listSettled(page)
    await expect(page.locator('[data-skills-forbidden]')).toBeVisible()
    await expect(page.locator('[data-skills-failed], [data-skills-empty]')).toHaveCount(0)
  })

  test('keeps a filtered page through retry and clamps it after its only final-page row is deleted', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills?group=BACKEND&page=2')
    await listSettled(page)
    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await listSettled(page)
    await expect(page.locator('[data-skills-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    const retry = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/skills') && url.searchParams.get('group') === 'BACKEND' && url.searchParams.get('page') === '2'
    })
    await page.locator('[data-skills-failed]').getByRole('button').click()
    await retry
    await listSettled(page)
    const finalPageId = await rows(page).first().getAttribute('data-skill-row')
    await page.locator(`[data-skill-edit="${finalPageId}"]`).click()
    await expect(page.locator('[data-editor-delete]')).toBeVisible()
    await page.locator('[data-editor-delete]').click()
    await page.locator('[data-editor-delete-confirm]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await expect(page).toHaveURL(/\/dashboard\/skills\?group=BACKEND$/)
    await listSettled(page)
    await expect(rows(page)).toHaveCount(12)
  })
})

test.describe('create in the Skills slideover', () => {
  test('starts clean, retains Arabic-first authoring, validates, and refreshes the table after create', async ({ page, baseURL }) => {
    await openCreate(page, baseURL!)
    await expect(page.locator('[data-editor-save-state="idle"]')).toHaveCount(1)
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()

    await page.getByRole('tab', { name: /Arabic/ }).click()
    await page.locator('[data-editor-label="ar"]').fill('مهارة عربية')
    await page.locator('[data-editor-slug]').fill('arabic-first-skill')
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await listSettled(page)
    await expect(page.locator('[data-skill-label="00000000-0000-4000-f100-900000000001"]')).toHaveText('مهارة عربية')
  })

  test('keeps a failed create open and moves focus to its error', async ({ page, baseURL }) => {
    await openCreate(page, baseURL!)
    await page.locator('[data-editor-slug]').fill('save-failure-skill')
    await page.locator('[data-editor-label="en"]').fill('Save failure')
    await setBackendState(page, { failNextWrite: true })
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-save-error-container]')).toBeFocused()
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()
  })

  test('closes a clean create slideover and restores focus to its trigger', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page)
    const create = page.locator('[data-skills-create]')
    await create.click()
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()
    await page.locator('[data-skill-overlay-close]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await expect(create).toBeFocused()
  })
})

test.describe('edit and delete in the Skills slideover', () => {
  test('loads the correct entity, omits slug from PATCH, maps a translation 422, and refreshes the row', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    await expect(page.locator('[data-editor-slug]')).toHaveValue('typescript')
    await expect(page.locator('[data-editor-label="en"]')).toHaveValue('TypeScript')
    await page.getByRole('tab', { name: /Arabic/ }).click()
    await expect(page.locator('[data-editor-label="ar"]')).toHaveValue('تايب سكربت')
    await page.getByRole('tab', { name: /English/ }).click()
    await page.locator('[data-editor-label="en"]').fill('TypeScript edited')
    const patch = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/skills/${SKILL.typescript}`)
    )
    await page.locator('[data-editor-save]').click()
    expect(JSON.parse((await patch).postData() ?? '{}')).not.toHaveProperty('slug')
    await listSettled(page)
    await expect(page.locator(`[data-skill-label="${SKILL.typescript}"]`)).toHaveText('TypeScript edited')

    await page.locator(`[data-skill-edit="${SKILL.typescript}"]`).click()
    await expect(page.locator('[data-editor-slug]')).toBeVisible()
    await page.locator('[data-editor-label="en"]').fill('')
    await page.route(`**/api/v1/admin/skills/${SKILL.typescript}`, async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/problems/validation',
          title: 'Validation failed',
          status: 422,
          errors: [{ field: 'translations[0].label', message: 'Arabic label is invalid.' }]
        })
      })
    })
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-panel="ar"]')).toBeVisible()
    await page.unroute(`**/api/v1/admin/skills/${SKILL.typescript}`)
  })

  test('requires confirmation before delete, refreshes success, and leaves a linked row after conflict', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!, SKILL.nest)
    await page.locator('[data-editor-delete]').click()
    await expect(page.locator('[data-editor-delete-confirm]')).toBeVisible()
    await page.locator('[data-editor-delete-confirm]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await listSettled(page)
    await expect(page.locator(`[data-skill-row="${SKILL.nest}"]`)).toHaveCount(0)

    await page.locator(`[data-skill-edit="${SKILL.typescript}"]`).click()
    await expect(page.locator('[data-editor-delete]')).toBeVisible()
    await page.locator('[data-editor-delete]').click()
    await page.locator('[data-editor-delete-confirm]').click()
    await expect(page.locator('[data-editor-delete-error]')).toBeVisible()
    await expect(page.locator(`[data-skill-row="${SKILL.typescript}"]`)).toBeVisible()
  })

  test('does not discard dirty edits and restores focus after confirmed close', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await visit(page)
    const edit = page.locator(`[data-skill-edit="${SKILL.typescript}"]`)
    await edit.click()
    await expect(page.locator('[data-editor-label="en"]')).toBeVisible()
    await page.locator('[data-editor-label="en"]').fill('Unsaved type')
    page.once('dialog', dialog => void dialog.dismiss())
    await page.locator('[data-skill-overlay-close]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()
    page.once('dialog', dialog => void dialog.accept())
    await page.locator('[data-skill-overlay-close]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await expect(edit).toBeFocused()
  })
})

test.describe('legacy Skills URLs and query-state intent', () => {
  test('redirects authenticated create and edit bookmarks into their collection overlays', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills/new')
    await expect(page).toHaveURL(/\/dashboard\/skills\?create=1$/)
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()

    await page.goto(`/dashboard/skills/${SKILL.typescript}`)
    await expect(page).toHaveURL(new RegExp(`/dashboard/skills\\?edit=${SKILL.typescript}$`))
    await expect(page.locator('[data-editor-slug]')).toHaveValue('typescript')
  })

  test('opens from query state and removes only its own key on close', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills?create=1&source=bookmark')
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()
    await page.locator('[data-skill-overlay-close]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeHidden()
    await expect(page).toHaveURL(/\/dashboard\/skills\?source=bookmark$/)
    const url = new URL(page.url())
    expect(url.searchParams.get('create')).toBeNull()
    expect(url.searchParams.get('source')).toBe('bookmark')
  })
})

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: table and open slideover are RTL-safe, responsive, and axe-clean`, async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, locale, baseURL!)
    await visit(page)
    await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('[data-skills-table]')).toBeVisible()
    await expectNoKeyPaths(page)
    await hydrated(page)
    let results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, `${locale} Skills table`).toEqual([])

    await page.locator('[data-skills-create]').click()
    await expect(page.locator('[data-skill-overlay]')).toBeVisible()
    await page.getByRole('tab', { name: locale === 'ar' ? /Arabic|العربية/ : /English|الإنجليزية/ }).click()
    await expect(page.locator('[data-editor-slug]')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator(`[data-editor-label="${locale}"]`)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, `${locale} Skills slideover`).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
