import { expect, test } from '@playwright/test'
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

/** One spec file: this future lane resets one mutable backend and must remain single-worker. */
test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('the collection', () => {
  test('renders the complete unpaginated response in API order', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills')
    await listSettled(page)
    expect(await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute('data-skill-row'))))
      .toEqual([...API_ORDER])
    await expect(page.locator('[data-skills-pagination]')).toHaveCount(0)
    await expect(page.locator('[data-skills-filter]')).toHaveCount(0)
  })

  test('keeps one-locale completeness visible', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills')
    await listSettled(page)
    const row = page.locator(`[data-skill-row="${SKILL.delivery}"]`)
    await expect(row.locator('[data-skill-translation="en:present"]')).toBeVisible()
    await expect(row.locator('[data-skill-translation="ar:missing"]')).toBeVisible()
  })

  test('shows contract-legal fractional/negative order and non-hex color', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills')
    await listSettled(page)
    await expect(page.locator(`[data-skill-order="${SKILL.vue}"]`)).toHaveText('1.5')
    await expect(page.locator(`[data-skill-order="${SKILL.nest}"]`)).toHaveText('-2')
    await expect(page.locator(`[data-skill-brand-color="${SKILL.nest}"]`)).toHaveText('brand-token-nest')
  })
})

test.describe('loading, empty, error and loaded are observable', () => {
  test('shows loading during a held first request', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/skills')
    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(page.locator('[data-skills-empty]')).toHaveCount(0)
    await listSettled(page)
    await expect(rows(page).first()).toBeVisible()
  })

  test('shows the empty state only for a successful empty collection', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/skills')
    await listSettled(page)
    await expect(page.locator('[data-skills-empty]')).toBeVisible()
    await expect(page.locator('[data-skills-failed]')).toHaveCount(0)
  })

  test('shows error rather than empty on transport failure', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/skills')
    await listSettled(page)
    await expect(page.locator('[data-skills-failed]')).toBeVisible()
    await expect(page.locator('[data-skills-empty]')).toHaveCount(0)
  })

  test('shows forbidden on its own terms', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/skills')
    await listSettled(page)
    await expect(page.locator('[data-skills-forbidden]')).toBeVisible()
    await expect(page.locator('[data-skills-failed]')).toHaveCount(0)
  })
})

test.describe('bilingual narrow viewport', () => {
  for (const locale of ['en', 'ar'] as const) {
    test(`${locale} chrome has the correct direction and no raw keys`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL!)
      await page.goto('/dashboard/skills')
      await listSettled(page)
      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoKeyPaths(page)
    })
  }
})

test.describe('the editor', () => {
  async function openNew(page: import('@playwright/test').Page, baseURL: string): Promise<void> {
    await signIn(page, 'en', baseURL)
    await page.goto('/dashboard/skills/new')
    await expect(page.locator('[data-skill-editor-ready]')).toBeVisible()
  }

  async function openEdit(page: import('@playwright/test').Page, baseURL: string): Promise<void> {
    await signIn(page, 'en', baseURL)
    await page.goto(`/dashboard/skills/${SKILL.typescript}`)
    await expect(page.locator('[data-skill-editor-ready]')).toBeVisible()
  }

  test('creates Arabic-first with English empty', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    await page.locator('[data-editor-slug]').fill('arabic-first-skill')
    await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
    await page.locator('[data-editor-label="ar"]').fill('مهارة عربية')
    await page.locator('[data-editor-save]').click()
    await expect(page).toHaveURL(/\/dashboard\/skills\/00000000-0000-4000-f100-900000000001$/)
  })

  test('creates English-first with Arabic empty', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    await page.locator('[data-editor-slug]').fill('english-first-skill')
    await page.locator('[data-editor-label="en"]').fill('English-first skill')
    await page.locator('[data-editor-save]').click()
    await expect(page).toHaveURL(/\/dashboard\/skills\/00000000-0000-4000-f100-900000000001$/)
  })

  test('blocks a zero-translation save', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    await page.locator('[data-editor-slug]').fill('no-translation-skill')
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard\/skills\/new$/)
  })

  test('loads both existing translations for edit', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    await expect(page.locator('[data-editor-slug]')).toHaveValue('typescript')
    await expect(page.locator('[data-editor-label="en"]')).toHaveValue('TypeScript')
    await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
    await expect(page.locator('[data-editor-label="ar"]')).toHaveValue('تايب سكربت')
  })

  test('PATCH never sends slug', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    await page.locator('[data-editor-label="en"]').fill('TypeScript edited')
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/skills/${SKILL.typescript}`)
    )
    await page.locator('[data-editor-save]').click()
    const request = await requestPromise
    expect(JSON.parse(request.postData() ?? '{}')).not.toHaveProperty('slug')
  })

  test('brandColor clear sends explicit null', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    await page.locator('[data-editor-brand-color-clear]').click()
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/skills/${SKILL.typescript}`)
    )
    await page.locator('[data-editor-save]').click()
    const request = await requestPromise
    expect(JSON.parse(request.postData() ?? '{}')).toHaveProperty('brandColor', null)
  })

  test('maps a translation 422 to the locale in the sent array', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
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

  test('renders the established not-found and failed-load states', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/skills/not-a-uuid')
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-unreadable]')).toContainText('does not exist')

    await setBackendState(page, { mode: 'error' })
    await page.goto(`/dashboard/skills/${SKILL.typescript}`)
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-unreadable]')).toContainText('could not be loaded')
  })
})
