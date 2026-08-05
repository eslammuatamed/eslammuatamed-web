import { expect, test } from '@playwright/test'

/**
 * ONE VALUE, SEVERAL CONSUMERS — asserted across routes (positioning-strategy v2.0.0 §8).
 *
 * §8's rule is a cross-surface one: the hero, the résumé headline, the settings response and
 * `Person.jobTitle` all render the ONE governed tagline, and no surface hard-codes its own title. No
 * existing spec could catch a violation of it, because every suite here asserts a single route in
 * isolation — `/` and `/about` could drift apart and both files would stay green. This one compares
 * routes to each other, in both locales, which is the only place the rule is actually visible.
 *
 * Served by Prism from the committed contract, so the tagline below is the contract's value rather
 * than Production's. That is the point: the assertions are about AGREEMENT and about derivation from
 * the contract, never about a literal string this repository would then own a second copy of.
 */

/**
 * `/` and `/ar` carry `swr: 60` (nuxt.config `routeRules`), so a plain `page.goto('/')` may be served
 * a render made EARLIER IN THE LANE rather than one made now — and this bit, measured: the first run
 * of this spec read a cached `/` whose `Person.jobTitle` was the committed tier-3 fallback while
 * `/about` carried the contract tagline, so the two "disagreed" over a cache entry rather than over
 * anything the application does. Nitro keys the SWR cache on the FULL PATH INCLUDING THE QUERY STRING
 * (the same property `e2e/scenarios/unavailable-api.spec.ts` relies on), so a unique query renders
 * fresh. The route, the data and the components are identical; only the cache key differs.
 *
 * This is a test-isolation device, not a weakening: without it the assertion measures the cache, and
 * a genuine divergence between the two routes would be invisible behind a warm entry.
 */
const fresh = (path: string) => `${path}${path.includes('?') ? '&' : '?'}swr=${Date.now()}`

const ROUTES = [
  { locale: 'en', home: '/', about: '/about', resume: '/resume' },
  { locale: 'ar', home: '/ar', about: '/ar/about', resume: '/ar/resume' }
] as const

/** Every `Person` node the page emitted, from the flattened JSON-LD graph. */
async function people(page: import('@playwright/test').Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  return blocks
    .flatMap((block) => {
      const parsed = JSON.parse(block) as Record<string, unknown>
      const graph = parsed['@graph']
      return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [parsed]
    })
    .filter((node) => {
      const type = node['@type']
      return Array.isArray(type) ? type.includes('Person') : type === 'Person'
    })
}

async function content(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).first().getAttribute('content')
}

for (const { locale, home, about, resume } of ROUTES) {
  test.describe(`positioning consistency (${locale})`, () => {
    test('Person.jobTitle is identical on / and /about, and is single-line', async ({ page }) => {
      await page.goto(fresh(home), { waitUntil: 'domcontentloaded' })
      const onHome = await people(page)

      await page.goto(about, { waitUntil: 'domcontentloaded' })
      const onAbout = await people(page)

      // D22-8: About references the site-wide identity rather than declaring a second one.
      expect(onHome).toHaveLength(1)
      expect(onAbout).toHaveLength(1)

      const title = onHome[0]!.jobTitle as string
      expect(title).toBeTruthy()
      // The approved value is stored with a line break (§2); machine-read consumers flatten it.
      expect(title).not.toContain('\n')
      expect(onAbout[0]!.jobTitle).toBe(title)
    })

    test('the résumé headline is the contract tagline, not a string this repo owns', async ({ page }) => {
      await page.goto(fresh(home), { waitUntil: 'domcontentloaded' })
      const title = (await people(page))[0]!.jobTitle as string

      await page.goto(resume, { waitUntil: 'domcontentloaded' })

      // Same governed value, reached through the settings contract rather than copied into the page:
      // the h1 is the site name and the line under it is the tagline (§8, "Resume: headline =
      // displayed title"). Matched with the break collapsed, which is what HTML does to it anyway.
      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toBeVisible()
      await expect(page.locator('main')).toContainText(title)
    })

    // Both routes, because the failure had a different SOURCE on each and only one of them is
    // visible under an outage. The twitter pair is always filled from below — tier 2 (the CMS
    // `defaultMetaTitle`/`defaultMetaDescription`, via the layout) with a healthy API, tier 3 (the
    // committed defaults, via `app.vue`) without one — so a page that sets only `og:*` ships two
    // DISAGREEING previews of one URL rather than a missing tag. This lane runs against a live
    // backend, which is the state that exposes the tier-2 case on `/`.
    for (const [name, path] of [['/about', about], ['home', home]] as const) {
      test(`og and twitter previews of ${name} describe the same page`, async ({ page }) => {
        await page.goto(path === home ? fresh(home) : path, { waitUntil: 'domcontentloaded' })

        const [ogTitle, twitterTitle] = [await content(page, 'meta[property="og:title"]'), await content(page, 'meta[name="twitter:title"]')]
        const [ogDesc, twitterDesc] = [await content(page, 'meta[property="og:description"]'), await content(page, 'meta[name="twitter:description"]')]

        expect(ogTitle).toBeTruthy()
        expect(ogDesc).toBeTruthy()
        expect(twitterTitle).toBe(ogTitle)
        expect(twitterDesc).toBe(ogDesc)
      })
    }

    // §9 bans the superseded titles outright, and the locale dictionaries are gated on that list in
    // `i18n/governed-copy.spec.ts`. This checks the OTHER source the same strings could reach a page
    // from — the API response — so a stale CMS value is visible as a test failure rather than only
    // in production HTML.
    test('no banned §9 positioning string reaches the rendered page or its head', async ({ page }) => {
      for (const path of [fresh(home), about, resume]) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        const html = await page.content()

        expect(html, `${path} must not carry the superseded primary title`).not.toMatch(
          /(?<!Full-Stack )JavaScript Product Engineer/
        )
        expect(html, `${path} must not carry the retired qualifier`).not.toMatch(/frontend-led/i)
        expect(html, `${path} must not carry the superseded Arabic title`).not.toContain(
          'مهندس برمجيات للمنتجات'
        )
      }
    })
  })
}
