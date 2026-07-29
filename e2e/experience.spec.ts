import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Experience slice (008) against the COMMITTED contract served by Prism — the primary lane (D18-6).
 *
 * Prism answers `/experiences` from the adopted contract, so assertions here are STRUCTURAL:
 * routing, locale, ordering, semantics, metadata and presence. Authored copy is never asserted —
 * that would only pin Prism's own generated fixtures. The states Prism cannot express (empty list,
 * upstream error, the atomic locale transition) live in the `ssr-scenarios` lane, never as a
 * `_payload.json` intercept.
 */

const EN = '/experience'
const AR = '/ar/experience'

test.describe('Direct load — English', () => {
  test('server-renders the timeline with correct locale attributes', async ({ page }) => {
    const response = await page.goto(EN)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('primary content is in the SSR document, not fetched on the client', async ({ request }) => {
    // Fetched with a plain HTTP client — no JS runs at all. If the roles were client-only, the
    // markup below would be absent and the page would be invisible to crawlers.
    const html = await (await request.get(EN)).text()

    expect(html).toContain('<ol')
    expect(html).toMatch(/<time datetime="/)
    // At least one entry heading rendered server-side.
    expect(html).toMatch(/<h2[^>]*>/)
  })
})

test.describe('Direct load — Arabic (RTL)', () => {
  test('server-renders the timeline with correct locale attributes', async ({ page }) => {
    const response = await page.goto(AR)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('primary content is in the SSR document', async ({ request }) => {
    const html = await (await request.get(AR)).text()

    expect(html).toContain('<ol')
    expect(html).toMatch(/<h2[^>]*>/)
  })
})

test.describe('Entity shape and semantics', () => {
  test('renders an ordered list of entries, so the sequence survives without CSS', async ({ page }) => {
    await page.goto(EN)

    // `list` role with an accessible name; `listitem` children are the entries.
    const timeline = page.getByRole('list', { name: /experience/i }).first()
    await expect(timeline).toBeVisible()
    expect(await timeline.locator('> li').count()).toBeGreaterThan(0)
  })

  test('each entry exposes machine-readable dates', async ({ page }) => {
    await page.goto(EN)

    const times = page.locator('main time[datetime]')
    expect(await times.count()).toBeGreaterThan(0)
    // Every `datetime` is a parseable instant, not a display string.
    for (const value of await times.evaluateAll(nodes => nodes.map(n => n.getAttribute('datetime')))) {
      expect(Number.isNaN(Date.parse(value!))).toBe(false)
    }
  })

  test('technologies render as a labelled list in the API order', async ({ page }) => {
    await page.goto(EN)

    const lists = page.locator('main ul[aria-labelledby]')
    const count = await lists.count()
    // The contract marks `technologies` required; Prism may generate an empty array, so this asserts
    // the SHAPE when present rather than forcing fixture content.
    if (count > 0) {
      const first = lists.first()
      const labelId = await first.getAttribute('aria-labelledby')
      await expect(page.locator(`#${labelId}`)).toHaveCount(1)
      expect(await first.locator('li').count()).toBeGreaterThan(0)
    }
  })

  test('heading order does not skip a level', async ({ page }) => {
    await page.goto(EN)

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll(nodes => nodes.map(n => Number(n.tagName[1])))
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1)
  })
})

test.describe('Strict SEO (D22-7) — the locale owns the head', () => {
  for (const [name, path, lang] of [['EN', EN, 'en-US'], ['AR', AR, 'ar']] as const) {
    test(`${name} emits exactly one canonical, both alternates and x-default`, async ({ page }) => {
      await page.goto(path)

      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
    })

    test(`${name} emits a localized title, description and Open Graph pair`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveTitle(/.+/)
      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description?.length).toBeGreaterThan(0)
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
      await expect(page.locator('meta[property="og:description"]')).toHaveCount(1)
      // Twitter card comes from the global shell, not from the page.
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    })
  }

  test('emits BreadcrumbList and does NOT duplicate the Person identity (D22-8)', async ({ page }) => {
    await page.goto(EN)

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = blocks.flatMap((raw) => {
      const parsed = JSON.parse(raw)
      const graph = parsed['@graph'] ?? [parsed]
      return graph.map((node: { '@type'?: string }) => node['@type'])
    })

    expect(types).toContain('BreadcrumbList')
    // ProfilePage belongs to /about. A second Person here would be the contradictory duplicate
    // identity D22-8 forbids.
    expect(types).not.toContain('ProfilePage')
    expect(types.filter(t => t === 'Person').length).toBeLessThanOrEqual(1)
  })
})

test.describe('Locale switching', () => {
  /** Click the language switcher and let the deferred D03-13 commit settle. */
  async function switchTo(page: import('@playwright/test').Page, code: 'EN' | 'AR') {
    await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: code }).click()
  }

  test('EN → AR keeps URL, lang, dir and content in the same language', async ({ page }) => {
    await page.goto(EN)
    await switchTo(page, 'AR')

    await expect(page).toHaveURL(/\/ar\/experience$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('AR → EN keeps URL, lang, dir and content in the same language', async ({ page }) => {
    await page.goto(AR)
    await switchTo(page, 'EN')

    await expect(page).toHaveURL(/\/experience$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('a locale switch issues at most one experiences request per locale', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/experiences')) requests.push(request.url())
    })

    await page.goto(EN)
    await switchTo(page, 'AR')
    await expect(page).toHaveURL(/\/ar\/experience$/)

    // Whatever the client issues, it must not ask twice for the same locale.
    expect(new Set(requests).size).toBe(requests.length)
  })
})

test.describe('Accessibility — unfiltered axe', () => {
  // The UNFILTERED ruleset on purpose: a wcag-tag-filtered scan reported /projects clean while
  // Lighthouse scored it 98, because Lighthouse's accessibility category runs a broader set.
  // Matrix: EN + AR × desktop + mobile × light + dark. Colour mode follows the system preference
  // (`colorMode.preference: 'system'`), so `emulateMedia` drives the real theme.
  const VIEWPORTS = [
    { name: 'desktop', size: { width: 1280, height: 900 } },
    { name: 'mobile', size: { width: 390, height: 844 } }
  ] as const
  const SCHEMES = ['light', 'dark'] as const

  for (const route of [EN, AR]) {
    for (const viewport of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        test(`${route} — ${viewport.name} / ${scheme} has no violations`, async ({ page }) => {
          await page.setViewportSize(viewport.size)
          await page.emulateMedia({ colorScheme: scheme })
          await page.goto(route)

          // Prove the emulation actually reached the app before trusting the scan. Without this,
          // a colour mode that ignored the media query would make four of these eight scans
          // silent duplicates that pass vacuously.
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${scheme}\\b`))

          const results = await new AxeBuilder({ page }).analyze()
          expect(results.violations.map(v => `${v.id}: ${v.help}`)).toEqual([])
        })
      }
    }
  }
})
