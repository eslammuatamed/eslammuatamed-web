import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hydrated } from '../hydration'

/**
 * `/dashboard/login` — FE-2b.
 *
 * OD-11 makes this page load-bearing in a way no other dashboard route is: it is reachable BEFORE a
 * session exists, so it inherits nothing from the authenticated shell. If its language control, its
 * localization or its direction are wrong, an Arabic-reading operator meets an English sign-in page
 * with no way out — and every other bilingual guarantee in the dashboard is unreachable behind it.
 *
 * ## Why the Arabic cases are COLD LOADS and never a post-load toggle
 *
 * Ledger discriminating-test #1. A test that loads in English, clicks the switcher and then asserts
 * Arabic passes against a build that ignores the stored preference at boot entirely — the toggle
 * sets the ref either way. The defect that actually reaches an operator is the first paint, so the
 * preference is seeded as a cookie before `goto` and never touched afterwards.
 *
 * ## Why selection is structural
 *
 * Per `harness.ts`: a copy edit must never turn this suite red. Controls resolve through
 * `autocomplete` tokens, `type`, `data-slot` and roles. The two places rendered copy IS read are
 * the ones where the copy is the thing under test — and even there the assertion is on the SHAPE of
 * the string (Arabic script present, not a raw `auth.*` key path, different from English) rather
 * than on the words, so translators can work without breaking the gate while a MISSING translation
 * still fails.
 *
 * `/dashboard/**` is `ssr:false` (D06-1), so every interaction waits on `hydrated()` first: the
 * markup exists before the handlers do, and a click that lands early silently does nothing.
 */

const LOCALE_COOKIE = 'dashboard_locale'
const NARROW = { width: 380, height: 780 }

/** The narrowest governed width in doc 21's matrix. */
async function openLogin(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await hydrated(page)
}

const passwordInput = (page: Page) => page.locator('input[autocomplete="current-password"]')

/**
 * The visibility toggle. `UInput` renders its `#trailing` slot into `[data-slot="trailing"]`, so
 * this selects the control by the component's own structure rather than by icon or label.
 */
const toggle = (page: Page) => page.locator('[data-slot="trailing"] button')

test.describe('password visibility control', () => {
  test('flips the field type, keeps the typed value, and renames itself', async ({ page, baseURL }) => {
    await openLogin(page, 'en', baseURL as string)

    const field = passwordInput(page)
    await field.fill('e2e-password-1234')

    // Masked is the default, and asserting it is what makes the flip below meaningful: a control
    // that starts revealed would satisfy a "becomes text" assertion without ever toggling.
    await expect(field).toHaveAttribute('type', 'password')
    const hidden = toggle(page)
    await expect(hidden).toHaveAttribute('aria-pressed', 'false')
    const showLabel = await hidden.getAttribute('aria-label')

    await hidden.click()

    // `autocomplete` is the field's stable identity and does NOT change with `type`, so the same
    // locator follows the field across the flip. Asserting the masked selector is gone is what
    // proves the reveal happened rather than a second field appearing beside the first.
    await expect(field).toHaveAttribute('type', 'text')
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(field, 'exactly one password field, not a revealed duplicate').toHaveCount(1)

    // The value survives. This is the assertion that would fail if the control re-rendered the
    // field instead of mutating it — and losing a half-typed password is the actual user harm.
    await expect(field).toHaveValue('e2e-password-1234')

    const shown = toggle(page)
    await expect(shown).toHaveAttribute('aria-pressed', 'true')
    const hideLabel = await shown.getAttribute('aria-label')

    // A control whose accessible name does not change is a control a screen-reader user cannot
    // read the state of. `aria-pressed` alone is not enough, and neither assertion implies the other.
    expect(showLabel).toBeTruthy()
    expect(hideLabel).toBeTruthy()
    expect(hideLabel).not.toBe(showLabel)

    await shown.click()
    await expect(field, 'the field re-masks when the control is pressed again').toHaveAttribute('type', 'password')
  })

  test('the toggle is localized on a cold Arabic load', async ({ page, baseURL }) => {
    await openLogin(page, 'ar', baseURL as string)

    const label = await toggle(page).getAttribute('aria-label')
    expect(label, 'the toggle must carry an accessible name').toBeTruthy()

    // The three ways this can be wrong, each asserted separately because each has a different cause:
    // a missing key renders the path, a missing Arabic value falls back to English, and a hardcoded
    // string ignores the locale entirely. Only the first is visible to the naked eye.
    expect(label).not.toMatch(/^auth\./)
    expect(label, 'the Arabic label must actually be Arabic').toMatch(/[؀-ۿ]/)

    // And it must differ from the English one — otherwise "contains Arabic" could pass on a page
    // that happens to render an Arabic brand string while the control stays English.
    await page.context().clearCookies()
    await openLogin(page, 'en', baseURL as string)
    expect(await toggle(page).getAttribute('aria-label')).not.toBe(label)
  })
})

test.describe('bilingual composition', () => {
  for (const locale of ['en', 'ar'] as const) {
    const expectedDir = locale === 'ar' ? 'rtl' : 'ltr'

    test(`${locale}: the shell renders ${expectedDir} on a cold load`, async ({ page, baseURL }) => {
      await openLogin(page, locale, baseURL as string)

      const shell = page.locator('[data-shell="dashboard"]')
      await expect(shell).toHaveAttribute('dir', expectedDir)
      await expect(shell).toHaveAttribute('lang', locale)

      // No raw key paths anywhere in the rendered chrome. This failure is otherwise silent — an
      // untranslated surface renders a plausible-looking dotted string, not an error.
      const text = await page.locator('main').innerText()
      expect(text).not.toMatch(/\b(auth|dashboard|a11y)\.[a-zA-Z]/)
    })

    test(`${locale}: does not overflow horizontally at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await openLogin(page, locale, baseURL as string)

      // The viewport is asserted, not assumed: a `setViewportSize` that silently failed would make
      // every overflow assertion below pass for the wrong reason.
      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `document overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })

    test(`${locale}: unfiltered axe scan reports no violations`, async ({ page, baseURL }) => {
      await openLogin(page, locale, baseURL as string)
      // Unfiltered on purpose: no rule disabled, no selector excluded.
      const results = await new AxeBuilder({ page }).analyze()

      expect(results.violations).toEqual([])
    })
  }
})

test('an authentication failure announces itself and takes focus', async ({ page, baseURL }) => {
  await openLogin(page, 'en', baseURL as string)

  await page.locator('input[type="email"]').fill('owner@example.com')
  await passwordInput(page).fill('wrong-password')
  await page.locator('button[type="submit"]').click()

  const alert = page.locator('[role="alert"]')
  await expect(alert).toBeVisible()

  // Visible is not enough. A keyboard or screen-reader user who submits and is left focused on the
  // submit button is never told why sign-in failed, and `role=alert` alone does not move focus.
  const alertIsFocused = await page.evaluate(() => {
    const el = document.querySelector('[role="alert"]')
    return el !== null && (el === document.activeElement || el.contains(document.activeElement))
  })
  expect(alertIsFocused, 'the error container must receive focus').toBe(true)

  // And the failure must not have navigated away — a redirect would mean the 401 was mishandled.
  expect(new URL(page.url()).pathname).toBe('/dashboard/login')
})
