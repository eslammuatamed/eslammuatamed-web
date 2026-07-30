import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Résumé states Prism cannot express (010), against the deterministic scenario backend.
 *
 * This lane serves `resumeAsset: null` — **the real live state** — so the honest PDF-unavailable
 * rendering is proven against the state production is actually in, not a hypothetical one. It also
 * inherits the backend's Experience selector: EN answers with zero experiences and AR answers 503,
 * which gives the empty and error states in a real browser without any new fixture.
 *
 *   /resume      → resumeAsset null, experiences [], skills healthy
 *   /ar/resume   → resumeAsset null, experiences 503, skills healthy
 */

const EN = '/resume'
const AR = '/ar/resume'

async function open(page: import('@playwright/test').Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' })
}

test.describe('PDF unavailable — the real live state', () => {
  test('renders the honest notice and offers no download', async ({ page }) => {
    await open(page, EN)

    await expect(page.getByTestId('resume-pdf-unavailable')).toBeVisible()
    await expect(page.getByRole('link', { name: /download/i })).toHaveCount(0)
  })

  test('keeps the print action available without a PDF', async ({ page }) => {
    await open(page, EN)
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  })

  test('does not hide the résumé itself', async ({ page }) => {
    await open(page, EN)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible()
  })

  // The specific leaks the honest state must not produce.
  test('exposes no asset id, no technical vocabulary and no Contact link', async ({ page }) => {
    await open(page, EN)
    const main = await page.locator('main').innerText()

    expect(main.toLowerCase()).not.toContain('resumeassetid')
    expect(main.toLowerCase()).not.toContain('null')
    await expect(page.locator('main a[href*="/contact"]')).toHaveCount(0)
  })

  test('creates no broken anchor in place of the download', async ({ page }) => {
    await open(page, EN)

    const hrefs = await page.locator('main a').evaluateAll(nodes =>
      nodes.map(n => (n as HTMLAnchorElement).getAttribute('href'))
    )
    for (const href of hrefs) {
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
    }
  })

  test('renders the Arabic unavailable copy on the Arabic route', async ({ page }) => {
    await open(page, AR)

    const notice = page.getByTestId('resume-pdf-unavailable')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('نسخة PDF غير متاحة بعد')
  })

  test('has no axe violations in the unavailable state', async ({ page }) => {
    await open(page, EN)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('Experience empty (EN)', () => {
  test('renders the localized empty copy without blanking the page', async ({ page }) => {
    await open(page, EN)

    await expect(page.getByText('No roles are published yet.')).toBeVisible()
    // Skills is healthy and must still render — one empty section is not an empty résumé.
    await expect(page.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('has no axe violations with an empty section', async ({ page }) => {
    await open(page, EN)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('Experience error (AR, 503)', () => {
  test('renders the Arabic error copy in an alert and leaks no technical detail', async ({ page }) => {
    await open(page, AR)

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('تعذّر تحميل الخبرة المهنية')

    const text = await alert.innerText()
    for (const leak of ['503', 'fetch', 'Error', 'upstream']) {
      expect(text).not.toContain(leak)
    }
  })

  test('degrades only the failed section — Skills and identity survive', async ({ page }) => {
    await open(page, AR)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'المهارات' })).toBeVisible()
  })

  test('keeps the page RTL in the error state', async ({ page }) => {
    await open(page, AR)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('has no axe violations in the RTL error state', async ({ page }) => {
    await open(page, AR)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('Locale transition', () => {
  /**
   * The atomic switch (D03-13 + D06-6). Crossing EN→AR must change the route, the document
   * attributes, the canonical AND the page content together — a stale fragment of any of them is
   * finding F-3 recurring.
   */
  test('EN → AR flips route, attributes, canonical and content together', async ({ page }) => {
    await open(page, EN)
    await expect(page.getByText('No roles are published yet.')).toBeVisible()

    await page.getByRole('link', { name: 'العربية' }).first().click()

    await expect(page).toHaveURL(/\/ar\/resume$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ar\/resume$/)
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ar')

    // No English UI copy survives the switch.
    await expect(page.getByText('No roles are published yet.')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: 'المهارات' })).toBeVisible()
  })

  test('AR → EN flips back with no stale Arabic content or metadata', async ({ page }) => {
    await open(page, AR)
    await page.getByRole('link', { name: 'English' }).first().click()

    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/resume$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible()
  })

  /**
   * Settings must not be requested twice during a locale transition. The page read and the chrome
   * read share the `settings:site:{locale}` key namespace precisely so they dedupe; a regression
   * there is invisible on screen and shows up only as a duplicate request.
   */
  test('issues no duplicate settings request while switching locale', async ({ page }) => {
    const settingsRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/settings/site')) settingsRequests.push(request.url())
    })

    await open(page, EN)
    await page.getByRole('link', { name: 'العربية' }).first().click()
    await expect(page).toHaveURL(/\/ar\/resume$/)

    // At most one browser-side settings read per locale — never two for the same one.
    const arabic = settingsRequests.filter(url => url.includes('locale=ar'))
    expect(arabic.length).toBeLessThanOrEqual(1)
  })
})
