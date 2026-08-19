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
