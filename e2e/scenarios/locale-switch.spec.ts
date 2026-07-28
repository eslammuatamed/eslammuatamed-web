import type { ConsoleMessage, Page, Request } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { ARTICLE_SLUG, SLUG } from './backend.ts'

/**
 * D06-6 — EFFECTIVE LOCALE FOR PUBLIC CONTENT REQUESTS (finding F-1).
 *
 * A client-side locale switch used to render the localized 404 instead of the counterpart document.
 * The URL was right; the data read was not. Measured before the fix:
 *     GET /api/v1/projects/ssr-bilingual-ar?locale=en
 *     GET /api/v1/redirects/resolve?locale=en&path=/projects/ssr-bilingual-ar
 * i.e. the INCOMING slug with the OUTGOING language. Public slugs are per locale (D04-2), so that is
 * a legitimate contract 404 for content that exists.
 *
 * Cause: the branded `page-spread` transition (D03-13) defers the locale commit until the outgoing
 * page is off screen; the incoming page's `setup()` — and therefore `useApi()` — runs inside that
 * window. Fix: public reads take their locale from the ROUTE (`useRouteLocale()`), never from the
 * reactive UI locale.
 *
 * WHY THIS LANE IS THE ONLY PLACE IT CAN BE PROVEN. Prism answers any slug in any locale, so the
 * wrong-locale request SUCCEEDS against it and the bug is invisible. The scenario backend 404s a
 * per-locale slug asked for in the wrong locale — exactly as the real API does — which is what makes
 * a rendered page here positive proof that the correct locale was sent.
 *
 * Both per-locale-slug surfaces are covered: Projects and Blog carry the identical pattern, so
 * fixing and testing only one would leave the other unverified.
 */

/**
 * API calls the BROWSER made. SSR calls happen inside Nitro and never appear here.
 *
 * On these SWR routes a client-side navigation is payload-driven, so after the fix the browser makes
 * NO API call at all — Nitro renders the target route and the client reuses its payload. That is the
 * strongest available evidence, and it is why these tests assert on the ABSENCE of wrong-locale
 * traffic rather than on a call count: before the fix this recorder captured two requests, both
 * carrying the outgoing locale, because the client-side `useAsyncData` key disagreed with the key in
 * the payload and forced a refetch.
 */
function recordApiRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request: Request) => {
    if (request.url().includes('/api/v1/')) seen.push(request.url())
  })
  return seen
}

/** Vue's hydration-mismatch warnings, which are console-only and otherwise silent. */
function recordHydrationWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text()
    if (/hydration/i.test(text)) warnings.push(text)
  })
  return warnings
}

/** Click the language switcher for `code` and wait for the transition to settle. */
async function switchLocale(page: Page, code: 'EN' | 'AR'): Promise<void> {
  await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: code }).click()
}

test.describe('Direct SSR sends the route locale', () => {
  // These are proof, not smoke: the backend 404s a slug requested in the wrong locale, so a page that
  // renders its authored content at all could only have been fetched with the matching locale.
  test('an English route renders English content (locale=en was sent)', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.bilingual.en}`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('an Arabic route renders Arabic content (locale=ar was sent)', async ({ page }) => {
    const response = await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })
})

test.describe('Project locale switch', () => {
  test('EN → AR requests the Arabic slug with locale=ar and renders it', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)
    const requests = recordApiRequests(page)

    await switchLocale(page, 'AR')

    await expect(page).toHaveURL(new RegExp(`/ar/projects/${SLUG.bilingual.ar}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    // `dir` after a CLIENT-SIDE switch is finding F-3 — a separate, pre-existing defect in
    // `@nuxtjs/i18n`'s head handling that reproduces on the `contract` lane with unmodified data
    // code. Asserting it here would fail for a reason D06-6 does not own. Server-rendered `dir` IS
    // asserted, above and throughout the rest of this lane.

    // The regression assertion, stated positively AND negatively.
    // The regression assertion. The counterpart rendering at all proves Nitro asked in the right
    // language — the backend 404s a per-locale slug requested in the wrong one — and no browser
    // request may carry the OUTGOING locale, which is exactly what the defect used to emit.
    expect(
      requests.filter(url => url.includes('locale=en')),
      'no browser request may carry the outgoing locale'
    ).toEqual([])

    // A redirect lookup only happens after a 404 — its absence proves no 404 occurred.
    expect(requests.filter(url => url.includes('/redirects/resolve'))).toEqual([])
    await expect(page.getByText('الصفحة غير موجودة')).toHaveCount(0)
  })

  test('AR → EN requests the English slug with locale=en and renders it', async ({ page }) => {
    await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)
    const requests = recordApiRequests(page)

    await switchLocale(page, 'EN')

    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG.bilingual.en}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

    // The regression assertion. The counterpart rendering at all proves Nitro asked in the right
    // language — the backend 404s a per-locale slug requested in the wrong one — and no browser
    // request may carry the OUTGOING locale, which is exactly what the defect used to emit.
    expect(
      requests.filter(url => url.includes('locale=ar')),
      'no browser request may carry the outgoing locale'
    ).toEqual([])
    expect(requests.filter(url => url.includes('/redirects/resolve'))).toEqual([])
  })
})

test.describe('Blog locale switch — the same defect, the same fix', () => {
  test('EN → AR requests the Arabic article slug with locale=ar and renders it', async ({ page }) => {
    await page.goto(`/blog/${ARTICLE_SLUG.bilingual.en}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual article differentiation study')

    const requests = recordApiRequests(page)
    await switchLocale(page, 'AR')

    await expect(page).toHaveURL(new RegExp(`/ar/blog/${ARTICLE_SLUG.bilingual.ar}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز المقالات بين اللغتين')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

    expect(
      requests.filter(url => url.includes('locale=en')),
      'no browser request may carry the outgoing locale'
    ).toEqual([])
  })

  test('AR → EN requests the English article slug with locale=en and renders it', async ({ page }) => {
    await page.goto(`/ar/blog/${ARTICLE_SLUG.bilingual.ar}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز المقالات بين اللغتين')

    const requests = recordApiRequests(page)
    await switchLocale(page, 'EN')

    await expect(page).toHaveURL(new RegExp(`/blog/${ARTICLE_SLUG.bilingual.en}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual article differentiation study')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

    expect(
      requests.filter(url => url.includes('locale=ar')),
      'no browser request may carry the outgoing locale'
    ).toEqual([])
  })
})

test.describe('The fix does not weaken what surrounds it', () => {
  test('a genuinely missing localized slug still returns a localized 404', async ({ page }) => {
    // The fix must not turn "ask in the right locale" into "ask until something answers". An unknown
    // slug is still a real 404, in the locale of the route that asked for it.
    const english = await page.goto(`/projects/${SLUG.unknown.en}`)
    expect(english?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')

    const arabic = await page.goto(`/ar/projects/${SLUG.unknown.ar}`)
    expect(arabic?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('الصفحة غير موجودة')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('a 5xx is still never converted into a 404', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.upstreamFailure.en}`)

    expect(response?.status()).toBe(503)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Something went wrong')
  })

  test('the switch introduces no hydration mismatch', async ({ page }) => {
    // The `useAsyncData` key now carries the effective locale. If the key the server used and the key
    // the client recomputes ever disagreed, Nuxt would refetch and Vue would warn — this is the
    // assertion that the two resolve identically.
    const warnings = recordHydrationWarnings(page)

    await page.goto(`/projects/${SLUG.bilingual.en}`)
    await switchLocale(page, 'AR')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')

    expect(warnings).toEqual([])
  })

  test('persistent chrome flips in ONE step — the footer never leads the header', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)

    // The footer lives in the persistent `default` layout, so the page transition does NOT conceal
    // it. Its API-localized `availabilityStatus` must therefore commit with the rest of the chrome.
    //
    // This is a REGRESSION TEST for a real one: applying D06-6's route-resolved locale to
    // `useSiteSettings` made the footer flip at navigation while the header still flipped at the
    // D03-13 commit, producing a visible Arabic-footer/English-header frame. Measured as
    //   footerAR=false navAR=false → footerAR=TRUE navAR=FALSE → footerAR=true navAR=true
    // Page CONTENT stays on the route locale; only this chrome read follows the UI locale.
    await page.evaluate(() => {
      const samples: string[] = []
      ;(window as unknown as { __chrome: string[] }).__chrome = samples
      const record = () => {
        const footer = document.querySelector('footer')?.textContent ?? ''
        const nav = document.querySelector('nav')?.textContent ?? ''
        samples.push(`${/متاح لارتباطات/.test(footer)}|${/المشاريع/.test(nav)}`)
      }
      record()
      new MutationObserver(record).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })
    })

    await switchLocale(page, 'AR')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
    await expect(page.locator('footer')).toContainText('متاح لارتباطات استشارية مختارة')

    const samples = await page.evaluate(() => (window as unknown as { __chrome: string[] }).__chrome)
    expect(samples.length, 'the observer must have seen the switch happen').toBeGreaterThan(0)
    // Footer and header are either both English or both Arabic — never one of each.
    expect([...new Set(samples)].filter(state => state === 'true|false' || state === 'false|true')).toEqual([])
  })

  test('the D03-13 deferred locale commit still completes', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)
    // Located by position, not by accessible name: the nav's own label is localized too, so a
    // name-based locator stops matching the moment the switch succeeds.
    const header = page.getByRole('navigation').first()
    await expect(header).toContainText('Projects')

    await switchLocale(page, 'AR')

    // At rest, chrome and content are in the SAME language. That is the guarantee D06-6 must not have
    // broken: the fix reads the route for CONTENT while leaving the UI locale commit exactly where
    // D03-13 put it, so the two still converge.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
    await expect(header).toContainText('المشاريع')
    await expect(header).not.toContainText('Projects')

    // The frame-level guarantee — that no painted frame mixes the two — is not asserted here on
    // purpose. A MutationObserver sees DOM states, not painted frames, and during `out-in` the
    // incoming page is in the DOM while still concealed by the enter transition, so observing a
    // transiently mixed DOM is expected rather than a defect. That contract is unit-tested in
    // `app/utils/page-transition.spec.ts`, and no transition or locale-commit code was changed here:
    // `skipSettingLocaleOnNavigate` and `finalizePendingLocaleChange()` are untouched.
  })
})
