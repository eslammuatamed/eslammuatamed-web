import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Harness foundation (005 Phase 1, doc 18 §3 / D18-3).
 *
 * This suite proves the e2e + accessibility infrastructure itself — Prism serving the committed
 * contract, the built Nitro server rendering against it, locale routing, and the axe integration —
 * against routes that ALREADY EXIST on `dev`. It deliberately asserts nothing about Projects, so that
 * a harness problem and a Projects problem can never be confused for one another.
 *
 * It is not a substitute for the full Projects scenarios (Phase 8); those are release-blocking in their
 * own right.
 */
test.describe('e2e harness foundation', () => {
  test('serves the English home page server-rendered with lang/dir correct', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    // Proves the contract mock actually answered: the nameplate renders API-derived settings, so a
    // page rendered before Prism was ready would show the API-unavailable state instead.
    await expect(page.locator('h1')).toBeVisible()
  })

  test('serves the Arabic home page with RTL direction', async ({ page }) => {
    const response = await page.goto('/ar')
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('axe integration reports no WCAG 2.2 AA violations on the English home page', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    // Print the rule ids before asserting — a bare length assertion tells you nothing on failure.
    expect(
      results.violations.map(violation => `${violation.id}: ${violation.help}`)
    ).toEqual([])
  })
})
