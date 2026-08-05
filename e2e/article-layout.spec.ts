import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Article reading layout (015) against the COMMITTED contract served by Prism.
 *
 * WHAT THIS PROTECTS. `/blog/{slug}` is a reading surface, and the property that makes it one is
 * geometric: ONE centred column at the governed measure (doc 03 §3 — 65–75 characters, both
 * scripts), which does not grow on a wide screen. Before 015 the header and the body disagreed —
 * the h1 and the meta ran the full 1216px container while `.content-prose` capped itself at its own
 * `68ch`, leaving 468px (EN) / 672px (AR) of dead space on the end side at ≥1280px.
 *
 * WHY THE ASSERTIONS ARE GEOMETRIC AND NOT TEXTUAL. Prism replays the contract's example body, which
 * is a 32-character stub — there is no multi-line paragraph to count characters from, and pinning
 * the mock's own copy would test the fixture rather than the page. The character band is therefore
 * held by the token (`--measure-prose`, calibrated in `app/assets/css/main.css` from the measured
 * average character advance of each body face); what this file proves is that the token is actually
 * in force, that ONE element owns it, and that it survives in both scripts.
 *
 * SYMMETRY IS CHECKED AGAINST THE VIEWPORT, not against `left`/`right`, so the same assertion reads
 * identically in LTR and RTL — a column that is centred is centred in either direction, and a
 * regression that start-aligns it fails in both locales rather than only in one.
 *
 * THE EN/AR WIDTH ASSERTION IS NOT COSMETIC. The measure is rebound per script (`32em` Latin /
 * `28em` Arabic) because a single value cannot land both scripts inside 65–75 characters. If that
 * rebinding is ever dropped, the two locales collapse to the same width and this file fails — which
 * is the only signal that the Arabic reading measure is still real.
 */

/**
 * Prism answers any slug with the contract example, so these are the real routes, not fixtures.
 *
 * `column` is the EXACT expected width, and it is exact on purpose — see `MAX_COLUMN_PX` below for
 * why the loose bound alone is not enough. `--measure-prose` is `32em` (Latin) / `28em` (Arabic) and
 * the reading size is `--text-body-lg` (1.125rem = 18px), so 32 × 18 = 576 and 28 × 18 = 504. Unlike
 * `ch`, `em` does not depend on the loaded font's glyph metrics, so these are deterministic integers
 * rather than something that shifts if a webfont is slow or substituted.
 */
const ROUTE = {
  en: { path: '/blog/staying-inside-performance-budget-nuxt', column: 576 },
  ar: { path: '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt', column: 504 }
}

/**
 * The stated upper bound for the reading column at ANY viewport. 640px is deliberately loose enough
 * that a legitimate token adjustment inside the governed band does not fail the gate, and tight
 * enough that the pre-015 behaviour (748px prose in a 1216px container) cannot pass.
 *
 * THE BOUND AND THE EXACT WIDTH DO DIFFERENT JOBS, which is why both are asserted. The bound catches
 * an UNBOUNDED column. The exact width catches a MISRESOLVED one — and that is the failure mode that
 * would otherwise ship silently. `--measure-prose` is in `em`, so it only produces the intended
 * character count when the reading font-size is on the SAME element that carries the max-width. Move
 * `text-body-lg` down onto a child and `em` resolves at the 16px UI size instead: the column becomes
 * 512px/448px — still bounded, still centred, still symmetric, still narrower in AR than EN — so
 * every other assertion in this file keeps passing while the measure quietly falls out of the
 * governed 65–75 character band. Only the exact number notices.
 */
const MAX_COLUMN_PX = 640

/** Geometry of the reading column, the page heading and the viewport, in one browser round-trip. */
async function readColumn(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const prose = document.querySelector('.content-prose')
    const h1 = document.querySelector('article h1')
    if (!prose || !h1) throw new Error('article body or heading missing')
    const pr = prose.getBoundingClientRect()
    const hr = h1.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    return {
      vw,
      column: Math.round(pr.width),
      // Distance from each viewport edge — direction-agnostic, so LTR and RTL assert the same thing.
      gapStart: Math.round(pr.x),
      gapEnd: Math.round(vw - pr.x - pr.width),
      headingWidth: Math.round(hr.width),
      headingStart: Math.round(hr.x)
    }
  })
}

for (const [locale, { path, column }] of Object.entries(ROUTE)) {
  test.describe(`Article reading column (${locale})`, () => {
    test('is bounded and centred, and does not grow with the viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(path)
      const atDesktop = await readColumn(page)

      await page.setViewportSize({ width: 1920, height: 900 })
      const atWide = await readColumn(page)

      // Bounded: the defect being fixed is a column that keeps growing with the container.
      expect(atWide.column).toBeGreaterThan(0)
      expect(atWide.column).toBeLessThanOrEqual(MAX_COLUMN_PX)

      // Resolved against the right font-size. A mismatch here means `em` was computed somewhere
      // other than the element carrying the reading size, and the character band is wrong even
      // though the column still looks fixed. Re-tuning the token SHOULD have to change this number —
      // that is the point of stating it.
      expect(atWide.column).toBe(column)
      expect(atDesktop.column).toBe(column)

      // 640px more viewport buys the reader NO extra line length. This is the regression that a
      // container-width body would fail.
      expect(atWide.column).toBe(atDesktop.column)

      // Centred, not start-aligned: the dead space is symmetric or it is not a reading surface.
      expect(Math.abs(atWide.gapStart - atWide.gapEnd)).toBeLessThanOrEqual(2)
      expect(Math.abs(atDesktop.gapStart - atDesktop.gapEnd)).toBeLessThanOrEqual(2)

      // ONE measure: the title sits in the same column as the text it introduces. Pre-015 the h1 was
      // 1216px over a 748px body.
      expect(atWide.headingWidth).toBe(atWide.column)
      expect(atWide.headingStart).toBe(atWide.gapStart)
    })

    test('fills the small viewport without overflowing it', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto(path)
      const atMobile = await readColumn(page)

      // On a phone the measure is not the constraint — the viewport is. The column must use what is
      // there (minus the container gutter) and must not push past the edge in either direction.
      expect(atMobile.column).toBeLessThanOrEqual(atMobile.vw)
      expect(atMobile.gapStart).toBeGreaterThanOrEqual(0)
      expect(atMobile.gapEnd).toBeGreaterThanOrEqual(0)
      expect(atMobile.column).toBeGreaterThan(atMobile.vw * 0.8)
    })

    test('keeps the authored heading hierarchy and its anchor ids', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(path)

      // The page title is the document's own h1 and is inside the article landmark.
      await expect(page.locator('article > header h1')).toBeVisible()

      // Authored headings keep the renderer's anchor ids — the article body is content, and
      // restyling it must never cost the ids that deep links and a future TOC depend on.
      const anchored = page.locator('.content-prose :is(h1, h2, h3, h4)[id]')
      expect(await anchored.count()).toBeGreaterThan(0)
      for (const id of await anchored.evaluateAll(nodes => nodes.map(n => n.id))) {
        expect(id).toMatch(/^user-content-/)
      }
    })

    // The header was restructured, not merely re-widthed — a kicker paragraph now precedes the h1, a
    // standfirst follows it and the byline sits behind a rule. That is exactly the kind of change
    // that costs contrast or heading order without anyone noticing, so it is scanned, on the surface
    // that changed, in both locales. Every sibling spec in this suite carries the same scan.
    test('has no accessibility violations', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(path)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('the reading measure is calibrated per script, not shared', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })

  await page.goto(ROUTE.en.path)
  const en = await readColumn(page)

  await page.goto(ROUTE.ar.path)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const ar = await readColumn(page)

  // Arabic sets more characters per unit width than Latin in these two body faces, so an Arabic
  // column that equals the Latin one is an Arabic column that runs long. Equality here means the
  // per-script rebinding was lost.
  expect(ar.column).toBeLessThan(en.column)
  expect(ar.column).toBeLessThanOrEqual(MAX_COLUMN_PX)
  expect(Math.abs(ar.gapStart - ar.gapEnd)).toBeLessThanOrEqual(2)
})
