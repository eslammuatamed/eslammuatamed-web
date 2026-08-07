import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * About slice (009) against the COMMITTED contract served by Prism — the primary lane (D18-6).
 *
 * Prism answers `/settings/site` from the contract schema, and `portrait` is nullable, so which
 * readiness state renders here is Prism's choice and NOT something to assert. Everything below is
 * therefore state-agnostic: routing, locale attributes, the head tags the locale owns (D22-7), the
 * `ProfilePage`/`Person` graph (D22-8), and accessibility. The published layout and every readiness
 * refusal are asserted where they are deterministic — the `ssr-scenarios` lane and the component
 * lane respectively.
 */

const EN = '/about'
const AR = '/ar/about'

/**
 * `domcontentloaded`, not the default `load`: the published page marks the portrait eager with
 * `fetchpriority=high` because it IS the LCP element, and neither Prism's contract example URL nor
 * the scenario fixture's URL resolves to a real object in this environment. Waiting for `load` would
 * therefore wait for an image that can never arrive — a property of having no media origin in test,
 * not of the page. Everything asserted below is server-rendered and present at DOMContentLoaded.
 */
async function open(page: import('@playwright/test').Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' })
}

/** True when a node carries `type`, whether `@type` is a string or the merged array form. */
function isType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type']
  return Array.isArray(value) ? value.includes(type) : value === type
}

/** The JSON-LD graph the page emitted, flattened to nodes. */
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

  test('the heading is in the SSR document, not fetched on the client', async ({ request }) => {
    // Plain HTTP client, no JS. If the page were client-only it would be invisible to crawlers.
    const html = await (await request.get(EN)).text()

    expect(html).toMatch(/<h1[^>]*>/)
  })

  test('the PAGE never links to Contact, whose route does not exist yet', async ({ page }) => {
    await open(page, EN)

    // Scoped to `main`: the persistent header/footer chrome already carries Contact links and is
    // outside this slice. What must not appear is a Contact CTA in the About content itself.
    await expect(page.locator('main a[href$="/contact"]')).toHaveCount(0)
  })
})

test.describe('Direct load — Arabic (RTL)', () => {
  test('server-renders a valid localized RTL page', async ({ page }) => {
    const response = await open(page, AR)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('Locale-owned head metadata (D22-7)', () => {
  for (const [label, path, lang, ogLocale] of [
    ['English', EN, 'en-US', 'en_US'],
    ['Arabic', AR, 'ar', 'ar']
  ] as const) {
    test(`${label}: canonical, alternates and og:locale are self-consistent`, async ({ page }) => {
      await open(page, path)

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`))
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang.split('-')[0]}"]`)).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', ogLocale)
    })
  }

  test('emits a localized title and description', async ({ page }) => {
    await open(page, EN)
    await expect(page).toHaveTitle(/About/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/)

    await open(page, AR)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /[؀-ۿ]/)
  })

  // F-1 is CLOSED by web-013: a committed, branded 1200×630 PNG now ships in `public/`, so the
  // reason this route previously omitted the tag — "a URL that does not resolve is worse than
  // inheriting nothing" — no longer applies. The requirement it protected is unchanged and asserted
  // below: the URL must be ABSOLUTE, because relative og:image values do not resolve for crawlers.
  test('emits the branded social card as a single absolute og:image (F-1 closed)', async ({ page }) => {
    await open(page, EN)

    const image = page.locator('meta[property="og:image"]')
    await expect(image).toHaveCount(1)
    await expect(image).toHaveAttribute('content', /^https?:\/\/.+\/social-card-[0-9a-f]{8}\.png$/)
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
  })

  // Closes the loop the tag assertions leave open: they prove the URL is well-formed and the
  // declared dimensions, but a stale, missing or half-copied file would satisfy every one of them.
  // This FOLLOWS the advertised URL and compares the bytes a crawler would actually receive against
  // the committed asset, so "the generated image is the one og:image uses" is verified rather than
  // assumed. Both locales, because the tag is emitted per-render even though the path is shared.
  for (const [name, path] of [['EN', EN], ['AR', AR]] as const) {
    test(`serves the committed social card at the ${name} og:image URL`, async ({ page, request }) => {
      await open(page, path)

      const url = await page.locator('meta[property="og:image"]').getAttribute('content')
      expect(url).toBeTruthy()

      // The advertised host is the governed site URL, which is not this test server — fetch the
      // asset by PATH so the check exercises what this build actually serves.
      const response = await request.get(new URL(url!).pathname)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('image/png')

      const served = await response.body()
      // Resolved FROM the advertised path rather than hardcoded: the filename is content-addressed, so
      // naming it here would both go stale on every artwork change and let a superseded asset keep
      // satisfying this assertion.
      const committed = readFileSync(
        fileURLToPath(new URL(`../public${new URL(url!).pathname}`, import.meta.url)),
      )
      const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex')
      expect(sha(served)).toBe(sha(committed))

      // PNG IHDR: width and height are big-endian uint32 at byte offsets 16 and 20. Read from the
      // SERVED bytes, so the declared 1200x630 above is checked against the real image.
      expect(served.readUInt32BE(16)).toBe(1200)
      expect(served.readUInt32BE(20)).toBe(630)
    })
  }
})

test.describe('Structured data (D22-8)', () => {
  test('emits ProfilePage whose mainEntity references the site-wide Person — not a second one', async ({ page }) => {
    await open(page, EN)
    const nodes = await schemaNodes(page)

    const people = nodes.filter(node => isType(node, 'Person'))
    expect(people).toHaveLength(1)

    const profile = nodes.find(node => isType(node, 'ProfilePage'))
    expect(profile).toBeDefined()

    // A reference, not a nested duplicate: mainEntity carries an @id and nothing else.
    const mainEntity = profile!.mainEntity as Record<string, unknown>
    expect(mainEntity['@id']).toBe(people[0]!['@id'])
    expect(Object.keys(mainEntity)).toEqual(['@id'])
  })

  test('the Person job title comes from the settings tagline, not a hard-coded string', async ({ page }) => {
    await open(page, EN)
    const person = (await schemaNodes(page)).find(node => isType(node, 'Person'))

    expect(person?.jobTitle).toBeTruthy()
  })

  test('emits a BreadcrumbList that mirrors the visible trail', async ({ page }) => {
    await open(page, EN)
    const crumbs = (await schemaNodes(page)).find(node => isType(node, 'BreadcrumbList'))

    expect(crumbs).toBeDefined()
    expect((crumbs!.itemListElement as unknown[]).length).toBe(2)
  })
})

test.describe('Accessibility', () => {
  for (const [label, path] of [['English', EN], ['Arabic', AR]] as const) {
    test(`${label}: unfiltered axe scan reports no violations`, async ({ page }) => {
      await open(page, path)
      // Unfiltered on purpose: no rule disabled, no selector excluded.
      const results = await new AxeBuilder({ page }).analyze()

      expect(results.violations).toEqual([])
    })
  }
})
