import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * `/about` in its REAL current API state, in a real browser — the `about-readiness` lane.
 *
 * The live contract returns `portraitAssetId: null` and `portrait: null` with every governed About
 * field populated, so this is what the route actually serves today. Component coverage proves the
 * decision; only this lane proves the rendered document, its head, and its structured data.
 *
 * The lane is a SEPARATE preview + backend pair on its own ports (`ci-preview.mjs --backend
 * about-readiness`). The settings variant is pinned per PROCESS, never per request, so
 * `/settings/site` stays published and healthy for every other scenario and no unrelated test
 * becomes scenario-dependent. Nothing here intercepts `_payload.json`, patches runtime code, or
 * touches the API contract.
 */

const EN = '/about'
const AR = '/ar/about'

/**
 * `domcontentloaded`: consistent with the other About lanes. Nothing asserted below depends on a
 * subresource — in this state the page emits no portrait at all, which is itself under test.
 */
async function open(page: import('@playwright/test').Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' })
}

/** Every JSON-LD node the page emitted, flattened. */
async function schemaNodes(page: import('@playwright/test').Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  return blocks.flatMap((block) => {
    const parsed = JSON.parse(block) as Record<string, unknown>
    const graph = parsed['@graph']
    return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [parsed]
  })
}

function isType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type']
  return Array.isArray(value) ? value.includes(type) : value === type
}

/** Authored EN/AR readiness copy, asserted verbatim so a missing translation cannot pass. */
const READINESS = {
  en: {
    title: 'This page is still being finished',
    body: 'The written sections are ready, but this page is not published until it is complete. In the meantime, my experience and projects cover the same work in more depth.'
  },
  ar: {
    title: 'هذه الصفحة قيد الإنجاز',
    body: 'المحتوى المكتوب جاهز، لكنني أنتظر اكتمال الصفحة قبل عرضها كاملة. في الوقت الحالي، يمكنك الاطّلاع على خبرتي ومشاريعي لمزيد من التفاصيل عن عملي.'
  }
}

/** Governed prose seeded into this lane's fixtures — must NOT appear while unpublished. */
const GOVERNED_PROSE = {
  en: 'Most of my work is Vue and Nuxt.',
  ar: 'معظم عملي بـ Vue وNuxt.'
}

/**
 * The approved public tagline (positioning-strategy v1.1.0 §2/§3), seeded by API `254f6cd0` and
 * carried verbatim by this lane's fixtures. `Person.jobTitle` derives from it (D22-8), so asserting
 * the exact string here is what proves the identity is API-owned and not hard-coded anywhere.
 */
const APPROVED_TAGLINE = {
  en: 'JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js',
  ar: 'مهندس برمجيات للمنتجات — متخصص في هندسة الواجهات الأمامية باستخدام Vue.js وNuxt.js'
}

/** Superseded titles; their reappearance anywhere is a regression. */
const SUPERSEDED_TITLES = ['Frontend Engineer — Vue.js & Nuxt.js', 'مهندس واجهات أمامية — Vue.js و Nuxt.js']

const CASES = [
  { label: 'English', path: EN, locale: 'en' as const, lang: 'en-US', dir: 'ltr', og: 'en_US' },
  { label: 'Arabic', path: AR, locale: 'ar' as const, lang: 'ar', dir: 'rtl', og: 'ar' }
]

for (const { label, path, locale, lang, dir, og } of CASES) {
  test.describe(`Portrait-null readiness — ${label}`, () => {
    test('the direct route returns 200 with correct lang and dir', async ({ page }) => {
      const response = await open(page, path)

      expect(response?.status()).toBe(200)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('html')).toHaveAttribute('dir', dir)
    })

    test('the readiness title and body render, server-side', async ({ page, request }) => {
      await open(page, path)
      const body = await page.locator('main').innerText()

      expect(body).toContain(READINESS[locale].title)
      expect(body).toContain(READINESS[locale].body)

      // Present without JS: the state must be in the SSR document, not hydrated in.
      const html = await (await request.get(path)).text()
      expect(html).toContain(READINESS[locale].title)
    })

    test('the governed About prose does NOT render', async ({ page, request }) => {
      await open(page, path)

      // Not rendered, not in the page body, not hidden somewhere within it.
      await expect(page.locator('.content-prose')).toHaveCount(0)
      const main = await page.locator('main').innerText()
      expect(main).not.toContain(GOVERNED_PROSE[locale])

      // Not in the server-rendered BODY either — the check that matters for a crawler reading markup.
      const html = await (await request.get(path)).text()
      const body = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? ''
      expect(body).not.toContain(GOVERNED_PROSE[locale])

      // FINDING F-2, pinned deliberately rather than asserted away. The prose IS present exactly once
      // in the Nuxt hydration payload, because `/settings/site` is one object and the persistent
      // footer chrome serializes it on every route — `/experience` carries it identically and shipped
      // before this slice, so this is pre-existing behaviour of the shared settings read, not
      // something `/about` introduces. It is never rendered. Pinning the count means a change in
      // either direction shows up here instead of silently; removing it is a separate cross-route
      // change with its own decision.
      expect(html.split(GOVERNED_PROSE[locale]).length - 1).toBe(1)
    })

    test('no portrait image and no broken media URL are emitted', async ({ page, request }) => {
      await open(page, path)

      // No <img> anywhere in the page content — the readiness state has no portrait to show.
      await expect(page.locator('main img')).toHaveCount(0)

      const html = await (await request.get(path)).text()
      // Not even as a preload, srcset, or inline style: an unresolvable media URL must not ship.
      expect(html).not.toContain('media.eslammuatamed.com')
      expect(html).not.toMatch(/-webp\.webp/)
    })

    test('structured data carries no portrait properties', async ({ page }) => {
      await open(page, path)
      const nodes = await schemaNodes(page)

      const person = nodes.find(node => isType(node, 'Person'))
      expect(person).toBeDefined()
      // `image` must be absent rather than null/empty: an unpublished portrait is not an image.
      expect(person).not.toHaveProperty('image')

      const profile = nodes.find(node => isType(node, 'ProfilePage'))
      expect(profile).toBeDefined()
      expect(profile).not.toHaveProperty('image')
      expect(profile).not.toHaveProperty('primaryImageOfPage')

      // No ImageObject anywhere in the graph traceable to the portrait.
      expect(JSON.stringify(nodes)).not.toContain('media.eslammuatamed.com')
    })

    test('Person.jobTitle is the approved tagline, sourced from the API', async ({ page }) => {
      await open(page, path)
      const person = (await schemaNodes(page)).find(node => isType(node, 'Person'))

      // Exactly the governed string — not a Web constant, not an About-specific title.
      expect(person?.jobTitle).toBe(APPROVED_TAGLINE[locale])
      for (const stale of SUPERSEDED_TITLES) {
        expect(JSON.stringify(person)).not.toContain(stale)
      }
    })

    test('exactly one Person exists and ProfilePage.mainEntity references its @id', async ({ page }) => {
      await open(page, path)
      const nodes = await schemaNodes(page)

      const people = nodes.filter(node => isType(node, 'Person'))
      expect(people).toHaveLength(1)

      const profile = nodes.find(node => isType(node, 'ProfilePage'))!
      const mainEntity = profile.mainEntity as Record<string, unknown>
      expect(mainEntity['@id']).toBe(people[0]!['@id'])
      expect(Object.keys(mainEntity)).toEqual(['@id'])
      // The reference must resolve — a dangling @id reads as correct and is not.
      expect(nodes.some(node => node['@id'] === mainEntity['@id'])).toBe(true)
    })

    test('no Contact link exists and only implemented actions appear', async ({ page }) => {
      await open(page, path)

      await expect(page.locator('main a[href$="/contact"]')).toHaveCount(0)
      await expect(page.locator('main a[href$="/resume"]')).toHaveCount(0)

      // The two onward actions that do exist.
      await expect(page.locator(`main a[href$="${locale === 'ar' ? '/ar' : ''}/experience"]`)).toHaveCount(1)
      await expect(page.locator(`main a[href$="${locale === 'ar' ? '/ar' : ''}/projects"]`)).toHaveCount(1)
    })

    test('canonical, hreflang, og:locale, title and description are correct', async ({ page }) => {
      await open(page, path)

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`))
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1)
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', og)
      await expect(page).toHaveTitle(locale === 'ar' ? /نبذة عني/ : /About/)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        locale === 'ar' ? /[؀-ۿ]/ : /.{20,}/
      )
      // Still no og:image while no branded fallback exists (finding F-1).
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(0)
    })

    test('unfiltered axe scan reports no violations', async ({ page }) => {
      await open(page, path)
      const results = await new AxeBuilder({ page }).analyze()

      expect(results.violations).toEqual([])
    })
  })
}

test.describe('Portrait-null readiness — locale transition', () => {
  for (const [label, from, toLocale, toLang, toDir, toOg] of [
    ['EN → AR', EN, 'ar', 'ar', 'rtl', 'ar'],
    ['AR → EN', AR, 'en', 'en-US', 'ltr', 'en_US']
  ] as const) {
    test(`${label}: route, content and head commit together with no stale prose`, async ({ page }) => {
      await open(page, from)
      await page.getByRole('group', { name: /language|لغة/i }).first()
        .getByRole('link', { name: toLocale === 'ar' ? 'AR' : 'EN' }).click()
      await page.waitForURL(from === EN ? /\/ar\/about$/ : /(?<!\/ar)\/about$/)

      const html = page.locator('html')
      await expect(html).toHaveAttribute('lang', toLang)
      await expect(html).toHaveAttribute('dir', toDir)
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', toOg)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        from === EN ? /\/ar\/about$/ : /(?<!\/ar)\/about$/
      )

      // The incoming locale's readiness copy, and none of the outgoing locale's.
      const body = await page.locator('main').innerText()
      expect(body).toContain(READINESS[toLocale].title)
      expect(body).not.toContain(READINESS[toLocale === 'ar' ? 'en' : 'ar'].title)
      // Still unpublished after the transition: no prose, no portrait leaked in either direction.
      await expect(page.locator('.content-prose')).toHaveCount(0)
      await expect(page.locator('main img')).toHaveCount(0)
    })
  }

  test('introduces no duplicate settings request', async ({ page }) => {
    // The page read and the footer chrome read share the `settings:site:{locale}` key namespace, so
    // a single locale must produce exactly ONE upstream settings call, not one per consumer.
    const calls: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/settings/site')) calls.push(url)
    })

    await open(page, EN)
    await page.waitForLoadState('networkidle')

    // SSR performs the read inside Nitro, so the browser should see none at all on a direct load.
    // Either way, what must never happen is the same locale being fetched twice from the client.
    const enCalls = calls.filter(url => url.includes('locale=en'))
    expect(enCalls.length).toBeLessThanOrEqual(1)
  })
})
