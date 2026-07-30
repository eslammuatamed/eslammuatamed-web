import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Résumé slice (010) against the COMMITTED contract served by Prism — the primary lane (D18-6).
 *
 * `resumeAsset` is nullable in the contract, so WHICH PDF state Prism chooses is Prism's business
 * and is never asserted here. Both states are asserted where they are deterministic: PDF-null in
 * the `ssr-scenarios` lane (the real live state) and PDF-populated in the `resume-pdf` lane. What
 * this lane owns is everything state-agnostic — routing, SSR, navigation, locale attributes, the
 * head tags the locale owns (D22-7), the schema graph (D22-8), print media, and accessibility.
 */

const EN = '/resume'
const AR = '/ar/resume'

async function open(page: import('@playwright/test').Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' })
}

function isType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type']
  return Array.isArray(value) ? value.includes(type) : value === type
}

async function schemaNodes(page: import('@playwright/test').Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  return blocks.flatMap((block) => {
    const parsed = JSON.parse(block) as Record<string, unknown>
    const graph = parsed['@graph']
    return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [parsed]
  })
}

test.describe('Direct load — English', () => {
  test('server-renders a valid localized page', async ({ page }) => {
    const response = await open(page, EN)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  // The résumé must be in the initial HTML: a recruiter's crawler does not run JavaScript, and
  // FR-PUB-023 is worthless if the content only exists after hydration.
  test('the résumé content is in the SSR document, not fetched on the client', async ({ request }) => {
    const html = await (await request.get(EN)).text()

    expect(html).toMatch(/<h1[^>]*>/)
    expect(html).toContain('Experience')
    expect(html).toContain('Skills')
    // Ordered list: reverse-chronological order must survive with CSS and JS both off.
    expect(html).toMatch(/<ol[^>]*>/)
  })
})

test.describe('Direct load — Arabic', () => {
  test('server-renders RTL with the Arabic document attributes', async ({ page }) => {
    const response = await open(page, AR)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('renders no English UI copy on the Arabic route', async ({ page }) => {
    await open(page, AR)
    const main = page.locator('main')

    // Section headings are UI copy, so they must be Arabic here. Contract DATA (company names,
    // technology labels) is legitimately Latin and is not asserted against.
    await expect(main.getByRole('heading', { level: 2, name: 'الخبرة المهنية' })).toBeVisible()
    await expect(main.getByRole('heading', { level: 2, name: 'المهارات' })).toBeVisible()
    await expect(main.getByRole('heading', { level: 2, name: 'Experience' })).toHaveCount(0)
  })
})

test.describe('Navigation (FR-PUB-023 — one click from navigation)', () => {
  test('the header Résumé link resolves instead of 404ing', async ({ page }) => {
    await open(page, '/')

    const link = page.locator('header').getByRole('link', { name: 'Résumé' })
    await expect(link).toBeVisible()

    await link.click()
    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the Arabic header links to the Arabic route', async ({ page }) => {
    await open(page, '/ar')

    const link = page.locator('header').getByRole('link', { name: 'السيرة الذاتية' })
    await link.click()
    await expect(page).toHaveURL(/\/ar\/resume$/)
  })
})

test.describe('Head and structured data', () => {
  test('the locale owns canonical, hreflang and og:locale (D22-7)', async ({ page }) => {
    await open(page, EN)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/resume$/)
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute('href', /\/ar\/resume$/)
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US')
  })

  test('emits a localized title, description and OG/Twitter pair', async ({ page }) => {
    await open(page, EN)

    await expect(page).toHaveTitle(/Résumé/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /résumé/i)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Résumé/)
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /Résumé/)
  })

  // F-1 stays open: no branded social-image fallback exists, and a URL that does not resolve is
  // worse than inheriting nothing.
  test('emits no og:image', async ({ page }) => {
    await open(page, EN)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0)
  })

  // D22-8: ProfilePage belongs to /about. A second one here would be a duplicate identity.
  test('emits BreadcrumbList and does NOT duplicate ProfilePage or Person', async ({ page }) => {
    await open(page, EN)
    const nodes = await schemaNodes(page)

    expect(nodes.filter(node => isType(node, 'BreadcrumbList'))).toHaveLength(1)
    expect(nodes.filter(node => isType(node, 'ProfilePage'))).toHaveLength(0)
    // The site-wide Person is emitted globally exactly once and referenced by @id.
    expect(nodes.filter(node => isType(node, 'Person')).length).toBeLessThanOrEqual(1)
  })
})

test.describe('Print media', () => {
  test('hides chrome and both action controls, keeping the résumé itself', async ({ page }) => {
    await open(page, EN)
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator('header')).toBeHidden()
    await expect(page.locator('footer')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Print' })).toBeHidden()

    // The content survives.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Experience' })).toBeVisible()
  })

  test('prints Arabic in RTL with chrome hidden', async ({ page }) => {
    await open(page, AR)
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('header')).toBeHidden()
    await expect(page.getByRole('heading', { level: 2, name: 'الخبرة المهنية' })).toBeVisible()
  })

  test('does not overflow the sheet horizontally at A4 or Letter widths', async ({ page }) => {
    await open(page, EN)
    await page.emulateMedia({ media: 'print' })

    // 794px ≈ A4 at 96dpi, 816px ≈ US Letter. Neither may produce a horizontal scroll.
    for (const width of [794, 816]) {
      await page.setViewportSize({ width, height: 1123 })
      const overflows = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false)
    }
  })

  // Restoring screen media must bring the controls back — the print rules are media-scoped, not a
  // one-way state change.
  test('restores the screen controls when print media ends', async ({ page }) => {
    await open(page, EN)
    await page.emulateMedia({ media: 'print' })
    await page.emulateMedia({ media: 'screen' })

    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  })

  /**
   * The print stylesheet hides the global header and footer, which this page does not own. Those
   * rules are gated on `body:has(.resume-page)` precisely so they cannot survive a client-side
   * navigation away — this asserts that gate, because without it printing any other page after
   * visiting the résumé would silently lose its chrome.
   */
  test('its print rules do not leak onto another route after navigating away', async ({ page }) => {
    await open(page, EN)
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page).toHaveURL(/\/$/)

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('header')).toBeVisible()
  })
})

test.describe('Layout', () => {
  test('does not overflow horizontally on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await open(page, EN)

    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })

  test('has no dead links', async ({ page }) => {
    await open(page, EN)

    const hrefs = await page.locator('main a').evaluateAll(nodes =>
      nodes.map(node => (node as HTMLAnchorElement).getAttribute('href'))
    )
    for (const href of hrefs) {
      expect(href, 'an anchor with no href is a dead link').toBeTruthy()
      expect(href).not.toBe('#')
    }
  })
})

test.describe('Accessibility', () => {
  // Unfiltered: no disabled rules, no excluded regions (doc 21, D18-3).
  for (const [name, path] of [['English', EN], ['Arabic', AR]] as const) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await open(page, path)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${name} has no axe violations on a phone viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await open(page, path)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test('heading order is h1 then h2, never skipping a level', async ({ page }) => {
    await open(page, EN)
    const levels = await page.locator('main :is(h1,h2,h3)').evaluateAll(nodes =>
      nodes.map(node => Number(node.tagName.slice(1)))
    )

    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1)
    }
  })

  test('dates are machine-readable <time datetime> elements', async ({ page }) => {
    await open(page, EN)
    const times = page.locator('main time')

    expect(await times.count()).toBeGreaterThan(0)
    for (const value of await times.evaluateAll(nodes => nodes.map(n => n.getAttribute('datetime')))) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}/)
    }
  })
})
