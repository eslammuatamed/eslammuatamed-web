import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Projects journey coverage (web-005 P1) against the COMMITTED contract served by Prism.
 *
 * WHY THERE ARE NO `page.route()` FIXTURES HERE. The plan assumed Playwright request interception could
 * drive the scenarios Prism cannot express. It cannot, for these routes, and that was verified rather
 * than assumed:
 *   - a direct load is server-rendered, so the API call happens inside Nitro and never reaches the
 *     browser (`page.route` intercepted 0 requests);
 *   - a client-side navigation does not help either, because `/projects**` carries `swr: 60` route
 *     rules, so Nuxt fetches the rendered `_payload.json` instead of calling the API from the browser
 *     (again 0 intercepted).
 * Everything below is therefore what the contract mock can express honestly. The remaining scenarios
 * — empty list, unknown-slug 404, redirect-resolved slug, unavailable API, empty gallery, and exact
 * EN/AR content differences — needed a server-side scenario mock, which was raised as a decision
 * rather than smuggled in as a brittle `_payload.json` intercept. That decision was approved: they
 * now live in the `ssr-scenarios` project (`e2e/scenarios/**`), served by
 * `scripts/e2e/scenario-server.ts`. THIS file stays on Prism and stays the primary lane.
 *
 * Prism serves the same example for any slug, so assertions are STRUCTURAL: routing, locale, ordering,
 * semantics and presence — never authored copy, which would only be pinning the mock's own fixtures.
 */

/** The contract's example slug; Prism answers it for the index and the detail route alike. */
const SLUG = 'content-platform-api'

test.describe('F-P1 — hiring-manager journey (EN)', () => {
  test('land → projects index → case study → direct-email contact', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Projects' }).click()

    await expect(page).toHaveURL(/\/projects$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Every card is ONE accessible link target (the stretched-pseudo-element pattern, doc 21 §1).
    const entry = page.getByRole('article').first()
    await entry.getByRole('link').first().click()

    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG}$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // The journey ends in a direct-email action, never a link to the not-yet-built /contact route.
    const cta = page.getByRole('link', { name: /Email me/i })
    await expect(cta).toHaveAttribute('href', 'mailto:eslammuatemed@gmail.com')
    await expect(page.locator('main a[href="/contact"], aside a[href="/contact"]')).toHaveCount(0)
  })
})

test.describe('F-P1 — hiring-manager journey (AR, RTL)', () => {
  test('land → projects index → case study → direct-email contact', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.getByRole('navigation').first().getByRole('link', { name: 'المشاريع' }).click()
    await expect(page).toHaveURL(/\/ar\/projects$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.getByRole('article').first().getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/ar/projects/${SLUG}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

    await expect(page.getByRole('link', { name: /راسلني عبر البريد/ })).toHaveAttribute(
      'href',
      'mailto:eslammuatemed@gmail.com'
    )
  })
})

test.describe('Projects index', () => {
  test('renders the API order verbatim, without re-sorting', async ({ page }) => {
    await page.goto('/projects')

    const apiOrder = await page.evaluate(async () => {
      const res = await fetch('/api/v1/projects?locale=en')
      return res.ok ? (await res.json()).data.map((p: { slug: string }) => p.slug) : null
    }).catch(() => null)

    const rendered = await page.getByRole('article').evaluateAll(nodes =>
      nodes.map(n => n.querySelector('a')?.getAttribute('href')?.split('/').pop() ?? '')
    )
    expect(rendered.length).toBeGreaterThan(0)
    if (apiOrder) expect(rendered).toEqual(apiOrder)
  })

  test('technology filter round-trips through the URL and is keyboard reachable', async ({ page }) => {
    await page.goto('/projects')

    const filter = page.getByLabel('Technology')
    await expect(filter).toBeVisible()

    // Reachable by keyboard alone — no pointer-only affordance (doc 21). Tab from the top of the
    // document until the filter takes focus; a bounded walk, so a regression fails rather than hangs.
    await page.locator('body').press('Tab')
    let focusedFilter = false
    for (let i = 0; i < 40 && !focusedFilter; i += 1) {
      focusedFilter = await page.evaluate(() => document.activeElement?.id === 'projects-filter')
      if (!focusedFilter) await page.keyboard.press('Tab')
    }
    expect(focusedFilter).toBe(true)

    // A filtered view is linkable and restores from the URL.
    await page.goto('/projects?technology=019f89b5-3050-7161-af37-3e9a2cbf41ed')
    await expect(page).toHaveURL(/technology=/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('a filtered view canonicalizes to the unfiltered index', async ({ page }) => {
    await page.goto('/projects?technology=019f89b5-3050-7161-af37-3e9a2cbf41ed')
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toMatch(/\/projects$/)
  })

  test('exposes a breadcrumb trail whose last item is the current page', async ({ page }) => {
    await page.goto('/projects')
    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumb).toBeVisible()
    await expect(crumb.locator('[aria-current="page"]')).toHaveText('Projects')
  })
})

test.describe('Case study', () => {
  test('renders the structured FR-CNT-020 sections in order', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    const headings = await page.locator('article h2').allInnerTexts()

    // The eight FR-CNT-020 sections, in narrative order. The gallery heading legitimately follows
    // them inside the same <article>, so this pins the prefix rather than the whole list.
    expect(headings.slice(0, 8)).toEqual([
      'Overview',
      'The problem',
      'The solution',
      'My role',
      'Architecture',
      'Challenges',
      'Key features',
      'What I took away'
    ])
    expect(headings.slice(8)).toEqual(['Gallery'])
  })

  test('renders optional live and repository links safely when both exist', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    const live = page.getByRole('link', { name: 'Live product' })
    const repo = page.getByRole('link', { name: 'Repository' })
    await expect(live).toBeVisible()
    await expect(repo).toBeVisible()

    // AppLink's restored external handling: new tab + safe rel for http(s).
    for (const link of [live, repo]) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('renders a populated gallery with reserved dimensions and lazy loading', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    const figure = page.locator('figure').first()
    await expect(figure).toBeVisible()

    const img = figure.locator('img')
    // Explicit dimensions are what actually hold CLS at zero.
    await expect(img).toHaveAttribute('width', /\d+/)
    await expect(img).toHaveAttribute('height', /\d+/)
    await expect(img).toHaveAttribute('loading', 'lazy')
    // The srcset comes from the contract's own variants, not a runtime transformation (D23-15).
    expect(await img.getAttribute('srcset')).toContain('w')
    expect(await img.getAttribute('src')).not.toContain('/_ipx/')
  })

  test('emits CreativeWork and BreadcrumbList matching the visible trail', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    const graph = await page.locator('script[type="application/ld+json"]').first().textContent()
    const nodes = JSON.parse(graph!)['@graph'] as { '@type': string, itemListElement?: unknown[] }[]
    const types = nodes.map(n => n['@type'])
    expect(types).toContain('CreativeWork')
    expect(types).toContain('BreadcrumbList')

    const breadcrumb = nodes.find(n => n['@type'] === 'BreadcrumbList')!
    const visible = await page.getByRole('navigation', { name: 'Breadcrumb' }).locator('li').count()
    expect(breadcrumb.itemListElement).toHaveLength(visible)
  })
})

test.describe('F-P5 — locale switching', () => {
  test('a case study switches to its counterpart locale route', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    // The counterpart is resolved from the contract's `slugs` map, not by reusing this locale's slug.
    const alternate = await page.locator('link[rel="alternate"][hreflang="ar"]').getAttribute('href')
    expect(alternate).toContain('/ar/projects/')

    await page.goto(alternate!.replace(/^https?:\/\/[^/]+/, ''))
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the index keeps its route across locales', async ({ page }) => {
    await page.goto('/projects')
    const arHref = await page.locator('link[rel="alternate"][hreflang="ar"]').getAttribute('href')
    expect(arHref).toMatch(/\/ar\/projects$/)
  })
})

test.describe('Accessibility — WCAG 2.2 AA', () => {
  // The UNFILTERED ruleset on purpose: a wcag-tag-filtered scan reported /projects clean while
  // Lighthouse scored it 98, because Lighthouse's accessibility category runs a broader set. Filtering
  // here would reintroduce exactly the blind spot that let a heading-order defect reach CI.
  for (const route of ['/projects', '/ar/projects', `/projects/${SLUG}`, `/ar/projects/${SLUG}`]) {
    test(`${route} has no violations`, async ({ page }) => {
      await page.goto(route)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations.map(v => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
})
