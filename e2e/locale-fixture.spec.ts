import { expect, test } from '@playwright/test'

/**
 * THE CONTRACT FIXTURE MUST BE LOCALE-CORRECT — asserted on the rendered page, in both locales.
 *
 * This suite exists because of a defect that was invisible to every other spec here. The contract's
 * `/settings/site` response carried only schema-level property examples, which are LOCALE-BLIND, so
 * Prism replayed the same body for `?locale=en` and `?locale=ar`. The Arabic site therefore rendered
 * `Eslam Muatamed` as its `h1` while `html[lang="ar"]` bound the Arabic font stack to it — a Latin
 * string measured with Arabic font metrics. Nothing failed at the point of the mistake: the pages
 * were green, and the only symptom surfaced three steps downstream as a mobile CLS budget failing
 * on `/ar/resume`, where it read as a product regression in the résumé redesign.
 *
 * Every assertion below is therefore two-sided. Proving the Arabic page shows the Arabic name is not
 * enough — the English name reaching it must FAIL, because that is the exact state that used to
 * pass. `Eslam Muatamed` and `إسلام معتمد` are the canonical per-locale values of ONE governed
 * field (`SiteSettingsTranslation.siteName`), so neither is a string this repository owns; they are
 * quoted here as the contract's stated content, which is what makes a fixture regression visible.
 *
 * The résumé is the route under test because its `h1` IS the site name (positioning-strategy §8,
 * "Resume: headline = displayed title") — the shortest path from the settings contract to a
 * rendered heading, and the route whose layout-shift budget the defect broke.
 */

const EN_SITE_NAME = 'Eslam Muatamed'
const AR_SITE_NAME = 'إسلام معتمد'
const ARABIC_SCRIPT = /[؀-ۿ]/

const LOCALES = [
  { locale: 'en', path: '/resume', expected: EN_SITE_NAME, forbidden: AR_SITE_NAME },
  { locale: 'ar', path: '/ar/resume', expected: AR_SITE_NAME, forbidden: EN_SITE_NAME }
] as const

for (const { locale, path, expected, forbidden } of LOCALES) {
  test.describe(`localized settings fixture (${locale})`, () => {
    test(`${path} renders the ${locale} site name as its h1`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)

      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
      await expect(h1).toHaveText(expected)
    })

    // THE DISCRIMINATING HALF. Serving the other locale's example is a 200 with a plausible page, so
    // only an explicit negative can catch it. Without this, selecting the wrong named example is
    // once again a silent pass.
    test(`${path} is not served the other locale's example`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).not.toContainText(forbidden)
    })

    // Not `error.vue` wearing a heading. A page whose API read failed still returns 200 and still
    // has an `h1`, which is why the readiness gate in `ci-preview.mjs` asserts CONTENT rather than a
    // status code — and why asserting "an h1 exists" would prove nothing here either.
    test(`${path} rendered the résumé, not the outage state`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main')).not.toContainText(/error|خطأ/i)
      await expect(page.locator('[data-testid="resume-page"], .resume-page').first()).toBeAttached()
    })
  })
}

test.describe('the site name follows the resolved data, not the route', () => {
  /**
   * The `h1` must NOT be pinned to a language by markup. The governed professional title beneath it
   * legitimately stays English in both locales (positioning-strategy §3) and declares `lang="en"`
   * for that reason — but the site name is per-locale canonical content, so hardcoding a language on
   * it would make the Arabic page keep Latin metrics no matter what the API resolved. This asserts
   * the SCRIPT of the rendered text rather than any attribute, so it holds whatever the mechanism.
   */
  test('the Arabic résumé heading is in Arabic script', async ({ page }) => {
    await page.goto('/ar/resume', { waitUntil: 'domcontentloaded' })
    const heading = await page.getByRole('heading', { level: 1 }).innerText()
    expect(heading).toMatch(ARABIC_SCRIPT)
  })

  test('the English résumé heading is in Latin script', async ({ page }) => {
    await page.goto('/resume', { waitUntil: 'domcontentloaded' })
    const heading = await page.getByRole('heading', { level: 1 }).innerText()
    expect(heading).not.toMatch(ARABIC_SCRIPT)
  })
})
