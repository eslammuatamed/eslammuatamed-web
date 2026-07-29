import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The PUBLISHED About page, in a real browser, in both locales — the `ssr-scenarios` lane.
 *
 * The scenario backend serves `/settings/site` with complete About prose and a portrait carrying a
 * per-locale alt, which is the one state Prism cannot express deterministically (its `portrait` is a
 * nullable field it fills at will). This is therefore the only place the portrait descriptor,
 * responsive variants, layout stability, RTL of the published layout, and the atomic locale
 * transition are actually observable.
 *
 * The readiness REFUSALS are not here, and deliberately so: `/settings/site` has no slug or query for
 * this backend to select a scenario on, and it must stay healthy for every other scenario's chrome,
 * so it can express only one variant per locale. Those refusals are pure render decisions and are
 * proven exhaustively in `app/pages/about.spec.ts` and `app/utils/about-readiness.spec.ts`.
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

/** Authored in `scripts/e2e/fixtures.ts`; deliberately different per locale. */
const ALT = {
  en: 'Eslam Muatamed, photographed against a plain wall',
  ar: 'إسلام معتمد، صورة أمام جدار سادة'
}

/** Mirrors `MEDIA_ORIGIN` + `PORTRAIT_ID` in `scripts/e2e/fixtures.ts`. */
const MEDIA_ORIGIN_RE = 'https://media.eslammuatamed.com/media/019f89b5-3050-7161-af37-0000000000f1'

/**
 * The portrait slot, as `AboutPortrait` declares it. Asserted verbatim rather than loosely so every
 * candidate list is proven to describe the SAME box — sizing one `<source>` against a different slot
 * than the `<img>` is a silent way to pick the wrong width.
 */
const SLOT_SIZES = '(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw'

test.describe('Published page — English', () => {
  test('renders the governed sections in order, from the SSR document', async ({ page, request }) => {
    await open(page, EN)

    const headings = page.getByRole('heading', { level: 2 })
    await expect(headings).toHaveCount(3)
    await expect(headings.nth(0)).toHaveText('Background')
    await expect(headings.nth(1)).toHaveText('How I approach engineering')
    await expect(headings.nth(2)).toHaveText('What I am working on now')

    // Server-rendered, not hydrated in: the prose must be in the raw HTML.
    const html = await (await request.get(EN)).text()
    expect(html).toContain('Most of my work is Vue and Nuxt.')
  })

  test('renders Markdown as semantic paragraphs through the single renderer', async ({ page }) => {
    await open(page, EN)

    const prose = page.locator('.content-prose').first()
    // The bio fixture has two paragraphs separated by a blank line.
    await expect(prose.locator('p')).toHaveCount(2)
    // The renderer escapes raw HTML (D19-5), so no markup can arrive from content.
    await expect(prose.locator('script')).toHaveCount(0)
  })

  test('renders the portrait with its localized alt, intrinsic size and responsive variants', async ({ page }) => {
    await open(page, EN)
    const portrait = page.getByRole('img', { name: ALT.en })

    await expect(portrait).toBeVisible()
    // width/height are what actually reserve the box and hold CLS at zero. They describe the widest
    // public WebP (D10-14), which for this source is the D20-20 terminal rendition.
    await expect(portrait).toHaveAttribute('width', '1086')
    await expect(portrait).toHaveAttribute('height', '1448')

    // The <img> fallback carries the WebP ladder, ascending, with truthful widths.
    const srcset = await portrait.getAttribute('srcset')
    expect(srcset).toBe(
      [
        `${MEDIA_ORIGIN_RE}/640-webp.webp 640w`,
        `${MEDIA_ORIGIN_RE}/1086-webp.webp 1086w`
      ].join(', ')
    )
    // Never a width the API cannot produce for a 1086px source.
    expect(srcset).not.toContain('1280')
    // The private master is never referenced.
    expect(srcset).not.toContain('master')
    await expect(portrait).toHaveAttribute('src', /1086-webp\.webp$/)
  })

  test('offers AVIF and WebP as separate typed sources, each well-formed', async ({ page }) => {
    await open(page, EN)

    // One <source> per format: a single mixed srcset would carry two entries at the same `w`
    // descriptor, which the UA cannot disambiguate by type.
    const avif = page.locator('picture source[type="image/avif"]')
    const webp = page.locator('picture source[type="image/webp"]')
    await expect(avif).toHaveCount(1)
    await expect(webp).toHaveCount(1)

    for (const [source, ext] of [[avif, 'avif'], [webp, 'webp']] as const) {
      const srcset = await source.getAttribute('srcset')
      expect(srcset).toBe(
        [
          `${MEDIA_ORIGIN_RE}/640-${ext}.${ext} 640w`,
          `${MEDIA_ORIGIN_RE}/1086-${ext}.${ext} 1086w`
        ].join(', ')
      )
      // Ascending, deduplicated, and describing the same slot as the <img>.
      await expect(source).toHaveAttribute('sizes', SLOT_SIZES)
    }
  })

  test('backs the transparent portrait with a token surface, not a BlurHash colour', async ({ page }) => {
    await open(page, EN)
    const portrait = page.getByRole('img', { name: ALT.en })

    // The muddy BlurHash average (#4d3433 for this cutout) must not be the permanent backdrop, and no
    // inline backgroundColor should be set at all — the surface is a class-driven token.
    const inlineStyle = (await portrait.getAttribute('style')) ?? ''
    expect(inlineStyle).not.toMatch(/background/i)
    await expect(portrait).toHaveClass(/bg-elevated/)

    // Resolved to a real, opaque colour in the light theme.
    const bg = await portrait.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('transparent')
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('does not shift layout once the portrait resolves', async ({ page }) => {
    await open(page, EN)
    const shift = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        let total = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number, hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) total += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => resolve(total), 1200)
      })
    })

    expect(shift).toBeLessThan(0.1)
  })

  test('offers onward navigation and still no Contact link', async ({ page }) => {
    await open(page, EN)

    await expect(page.locator('main a[href$="/experience"]').first()).toBeVisible()
    await expect(page.locator('main a[href$="/contact"]')).toHaveCount(0)
  })
})

test.describe('Published page — Arabic (RTL)', () => {
  test('renders the Arabic sections and the Arabic portrait alt', async ({ page }) => {
    await open(page, AR)

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 2 }).nth(0)).toHaveText('خلفيتي')
    await expect(page.getByRole('img', { name: ALT.ar })).toBeVisible()
  })

  test('never borrows the English alt on the Arabic route (D10-6)', async ({ page }) => {
    await open(page, AR)

    await expect(page.getByRole('img', { name: ALT.en })).toHaveCount(0)
  })

  test('renders Arabic prose, never the English fixture text', async ({ page }) => {
    await open(page, AR)
    const body = await page.locator('main').innerText()

    expect(body).toContain('معظم عملي بـ Vue وNuxt.')
    expect(body).not.toContain('Most of my work is Vue and Nuxt.')
  })
})

test.describe('Locale transition is atomic', () => {
  for (const [label, from, toLang, toDir, toOg, expectedAlt] of [
    ['EN → AR', EN, 'ar', 'rtl', 'ar', ALT.ar],
    ['AR → EN', AR, 'en-US', 'ltr', 'en_US', ALT.en]
  ] as const) {
    test(`${label}: route, content, portrait alt and head commit together`, async ({ page }) => {
      await open(page, from)
      // The switcher is the real user path; a direct goto would prove nothing about the transition.
      // Same selector `locale-switch.spec.ts` already proves: the switcher is a labelled group of
      // per-locale links, not a bare link whose name is the language word.
      await page.getByRole('group', { name: /language|لغة/i }).first()
        .getByRole('link', { name: from === EN ? 'AR' : 'EN' }).click()
      await page.waitForURL(from === EN ? /\/ar\/about$/ : /\/about$/)

      const html = page.locator('html')
      await expect(html).toHaveAttribute('lang', toLang)
      await expect(html).toHaveAttribute('dir', toDir)
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', toOg)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        from === EN ? /\/ar\/about$/ : /(?<!\/ar)\/about$/
      )
      // Content and the portrait alt moved in the same commit as the head — no mixed-language frame.
      await expect(page.getByRole('img', { name: expectedAlt })).toBeVisible()
    })
  }

  test('leaves no stale metadata after a client-side navigation into About', async ({ page }) => {
    await open(page, '/experience')
    await page.locator('a[href$="/about"]').first().click()
    await page.waitForURL(/\/about$/)

    await expect(page).toHaveTitle(/About/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about$/)
  })
})

test.describe('Accessibility — published layout', () => {
  for (const [label, path] of [['English', EN], ['Arabic', AR]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${label} ${scheme}: unfiltered axe scan reports no violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await open(page, path)
        const results = await new AxeBuilder({ page }).analyze()

        expect(results.violations).toEqual([])
      })
    }
  }

  test('the portrait is exposed as meaningful content, never decorative', async ({ page }) => {
    await open(page, EN)
    const portrait = page.getByRole('img', { name: ALT.en })

    // An empty or absent accessible name would mean the readiness gate let a decorative portrait
    // satisfy a slot the contract defines as content.
    await expect(portrait).toHaveAttribute('alt', /\S/)
    await expect(portrait).not.toHaveAttribute('aria-hidden', 'true')
  })
})
