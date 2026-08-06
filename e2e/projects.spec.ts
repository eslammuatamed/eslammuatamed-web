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
    await expect(cta).toHaveAttribute('href', 'mailto:contact@eslammuatamed.com')
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
      'mailto:contact@eslammuatamed.com'
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

  // Grouping (D10-19) put a heading INSIDE the chip row, and the row is a horizontal scroller below
  // `sm` with no `flex-wrap`. A full-width heading only starts a new line where wrapping is on, so on
  // a phone the headings would otherwise sit inline between chips in the scroller — the desktop
  // viewport every other test here uses cannot see that.
  test('groups the technology chips onto their own lines on a phone, without a horizontal scroller', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/projects')

    const filter = page.getByRole('group', { name: 'Technology' })
    await expect(filter).toBeVisible()

    const headings = filter.locator('span')
    const headingCount = await headings.count()
    // Guard: with no heading rendered this test would pass while proving nothing.
    expect(headingCount).toBeGreaterThan(0)

    // The row must not scroll sideways: a grouped filter that needs horizontal panning hides options.
    const overflow = await filter.evaluate(el => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    // Every heading starts its own line — nothing shares its vertical band to the left or right.
    for (let index = 0; index < headingCount; index += 1) {
      const heading = headings.nth(index)
      const box = await heading.boundingBox()
      expect(box).not.toBeNull()
      const chipsBesideIt = await filter.getByRole('button').evaluateAll(
        (els, top: number) => els.filter(el => Math.abs(el.getBoundingClientRect().top - top) < 4).length,
        box!.y
      )
      expect(chipsBesideIt).toBe(0)
    }
  })

  test('technology filter round-trips through the URL and is keyboard reachable', async ({ page }) => {
    await page.goto('/projects')

    // The filter is a labelled GROUP of `<button aria-pressed>` chips, not a select. Asserting the
    // group by its accessible name is what proves the visible label is actually wired to the control.
    const filter = page.getByRole('group', { name: 'Technology' })
    await expect(filter).toBeVisible()

    // "All" is a real chip and is pressed while nothing is filtered — the unfiltered state has its own
    // visible, pressable control rather than being the absence of one.
    await expect(filter.getByRole('button', { name: 'All technologies' })).toHaveAttribute('aria-pressed', 'true')

    // Reachable by keyboard alone — no pointer-only affordance (doc 21). Tab from the top of the
    // document until focus lands INSIDE the group; a bounded walk, so a regression fails rather than
    // hangs. Focus lands on a chip, not the group: the group is a labelling wrapper, and each chip is
    // its own tab stop (the deliberate consequence of `aria-pressed` toggles over a radiogroup).
    await page.locator('body').press('Tab')
    let focusedChip = false
    for (let i = 0; i < 40 && !focusedChip; i += 1) {
      focusedChip = await page.evaluate(() =>
        document.activeElement?.closest('#projects-filter') !== null
        && document.activeElement?.tagName === 'BUTTON'
      )
      if (!focusedChip) await page.keyboard.press('Tab')
    }
    expect(focusedChip).toBe(true)

    // A filtered view is linkable and restores from the URL. The uuid form is used here on purpose:
    // it is the BACKWARD-COMPATIBLE form (D10-17), so this is the regression test for a link shared
    // before the slug contract landed.
    await page.goto('/projects?technology=019f89b5-3050-7161-af37-3e9a2cbf41ed')
    await expect(page).toHaveURL(/technology=/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('pressing a technology chip writes its SLUG to the URL and presses that chip', async ({ page }) => {
    await page.goto('/projects')

    const filter = page.getByRole('group', { name: 'Technology' })
    // The first non-"All" chip — Prism serves the contract's own skills list, so the label is the
    // mock's, but the VALUE written to the URL is the assertion that matters and it must be a slug.
    const chip = filter.getByRole('button').nth(1)
    const label = (await chip.textContent())?.trim()
    await chip.click()

    // A slug, never a uuid and never a localized label: the URL must not change meaning with the
    // language, and a uuid in a freshly written URL would mean the contract adoption regressed.
    await expect(page).toHaveURL(/[?&]technology=[a-z0-9]+(-[a-z0-9]+)*(&|$)/)
    await expect(page).not.toHaveURL(/technology=[0-9a-f]{8}-[0-9a-f]{4}-/)

    // The pressed state follows the URL, so a reload or a shared link shows the same control state.
    await expect(filter.getByRole('button', { name: label! })).toHaveAttribute('aria-pressed', 'true')
    await expect(filter.getByRole('button', { name: 'All technologies' })).toHaveAttribute('aria-pressed', 'false')

    // Back returns to the unfiltered index AND to the unfiltered control state.
    await page.goBack()
    await expect(page).toHaveURL(/\/projects$/)
    await expect(filter.getByRole('button', { name: 'All technologies' })).toHaveAttribute('aria-pressed', 'true')
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

    // The facts card leads: it is the at-a-glance summary and it precedes the narrative in DOM order
    // at every width, sticky desktop column or not. Then the eight FR-CNT-020 sections in narrative
    // order, then the gallery — the whole h2 run, pinned exactly, so an extra or missing heading
    // fails here rather than only in the axe pass.
    //
    // 'AT A GLANCE' is uppercase because `allInnerTexts` reports RENDERED text and the facts heading
    // wears the `.kicker` treatment — the deliberate visual split between a card label and the
    // narrative headings it introduces. The Arabic page keeps its authored casing: `.kicker` drops
    // `text-transform` under `html[lang="ar"]`, since Arabic has no case.
    expect(headings).toEqual([
      'AT A GLANCE',
      'Overview',
      'The problem',
      'The solution',
      'My role',
      'Architecture',
      'Challenges',
      'Key features',
      'What I took away',
      'Gallery'
    ])

    // One h1 on the page. The closing CTA used to carry `text-h1` display type, which read as a
    // second headline; it is an h2 in a compact card now.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('summarizes the contract facts once, in the facts card, and keeps it out of the flow on mobile', async ({ page }) => {
    await page.goto(`/projects/${SLUG}`)

    const facts = page.locator('article section[aria-labelledby="project-facts-heading"]')
    await expect(facts).toBeVisible()

    // Stated ONCE. The year and the technology list used to sit in the <header> as well; two copies of
    // the same fact on one screen is what this change removed.
    await expect(facts.getByRole('term')).toHaveText(['Year', 'Stack', 'Links'])
    await expect(page.locator('article header bdi')).toHaveCount(0)

    // Sticky is a DESKTOP affordance only — on a small viewport a pinned card steals reading space,
    // so the card must be a normal block in the flow. Computed style is the assertion because the
    // behaviour is CSS-only (breakpoint-scoped utilities, no JS).
    const position = () => facts.evaluate(node => getComputedStyle(node).position)

    await page.setViewportSize({ width: 1280, height: 900 })
    expect(await position()).toBe('sticky')

    await page.setViewportSize({ width: 390, height: 844 })
    expect(await position()).toBe('static')
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
