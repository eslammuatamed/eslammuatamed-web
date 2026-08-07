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

/**
 * The SITE header/footer, not the page's own identity `<header>`.
 *
 * `page.locator('header')` is ambiguous here and that ambiguity is the point: the résumé's
 * identity block — the name, the positioning line, the contact row — is itself a `<header>`. Any
 * print rule or assertion written against the bare tag would also catch the résumé's own name.
 */
function siteHeader(page: import('@playwright/test').Page) {
  return page.locator('body header').filter({ has: page.locator('nav') }).first()
}

function siteFooter(page: import('@playwright/test').Page) {
  return page.locator('main ~ footer').first()
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

  // F-1 is CLOSED by web-013: the committed branded 1200×630 PNG is now the site-wide floor, so
  // every public route inherits one absolute, resolvable social image instead of none.
  test('inherits the branded social card as a single absolute og:image (F-1 closed)', async ({ page }) => {
    await open(page, EN)

    const image = page.locator('meta[property="og:image"]')
    await expect(image).toHaveCount(1)
    await expect(image).toHaveAttribute('content', /^https?:\/\/.+\/social-card-[0-9a-f]{8}\.png$/)
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

    await expect(siteHeader(page)).toBeHidden()
    await expect(siteFooter(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Print' })).toBeHidden()

    // The content survives.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Experience' })).toBeVisible()
  })

  test('prints Arabic in RTL with chrome hidden', async ({ page }) => {
    await open(page, AR)
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(siteHeader(page)).toBeHidden()
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

    await expect(siteHeader(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  })

  /**
   * THE ONE PRINT PROPERTY THIS SUITE CANNOT OBSERVE BY RENDERING, asserted directly.
   *
   * The impact-bullet marker is a `background-color` on an empty span. Chrome ships its print dialog
   * with "Background graphics" unchecked (Firefox and Safari likewise), and under that default the
   * browser paints no element background at all — so the marker survives real paper ONLY because of
   * `print-color-adjust: exact`.
   *
   * Nothing else here can catch its removal. `emulateMedia({ media: 'print' })` swaps the media query
   * and then rasterises like a screen render: backgrounds paint regardless, so every rendering
   * assertion in this file stays green whether the property is present or not. That is exactly how
   * the defect this fixes reached `db298e9` with a green suite and a commit message saying it was
   * fixed. The property IS readable from the computed style in print media, so this asserts the
   * declaration rather than its visual effect — the one form of check that discriminates.
   *
   * Proof that the underlying concern is real, not theoretical, is in
   * `scratchpad/evidence/resume-print-evidence.md`: rendered through `page.pdf({printBackground:false})`
   * with the property mutated back to `economy`, the sheet is pixel-identical to deleting the marker.
   */
  test('the impact-bullet marker is exempted from background suppression on paper', async ({ page }) => {
    await open(page, EN)
    await page.emulateMedia({ media: 'print' })

    const marker = page.locator('.resume-bullet').first()
    await expect(marker).toHaveCount(1)

    const painted = await marker.evaluate((el) => {
      const style = getComputedStyle(el)
      // The standard property is what resolves here; the `-webkit-` alias is declared alongside it in
      // the stylesheet for older engines but is not read back, and typing it is not worth a cast.
      return { adjust: style.printColorAdjust, background: style.backgroundColor }
    })

    expect(painted.adjust).toBe('exact')
    // A one-colour printed document: the marker is black ink, not the themed accent border token.
    expect(painted.background).toBe('rgb(0, 0, 0)')
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
    await expect(siteHeader(page)).toBeVisible()
  })
})

test.describe('Layout', () => {
  /**
   * The RÉSUMÉ CONTENT must not overflow, measured on `<main>` rather than on the document.
   *
   * The document overflows at 320 px on EVERY route in this build — `/` by 9 px and `/about`,
   * `/experience`, `/projects` and `/resume` by 2 px each — and the overflowing node is the global
   * header's trailing control cluster (language toggle + theme toggle + menu trigger), which this
   * slice does not touch. Asserting the document here would import a pre-existing site-wide chrome
   * defect into this slice's gate, where it would either fail for something the slice did not
   * cause or be silently loosened. It is recorded as finding F-5 instead.
   *
   * `<main>` is the boundary this slice actually owns, and it is held to zero overflow at the
   * narrowest width in the matrix.
   */
  test('the résumé content does not overflow on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await open(page, EN)

    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const limit = main.getBoundingClientRect().right
      const worst = Array.from(main.querySelectorAll('*'))
        .map(el => el.getBoundingClientRect().right)
        .reduce((a, b) => Math.max(a, b), 0)
      return { worst, limit, scroll: main.scrollWidth, client: main.clientWidth }
    })

    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client)
    expect(overflow.worst).toBeLessThanOrEqual(overflow.limit + 0.5)
  })

  test('the résumé content does not overflow in Arabic on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await open(page, AR)

    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main')!
      return { scroll: main.scrollWidth, client: main.clientWidth }
    })

    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client)
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
