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

/**
 * Requests to the INTERNAL Markdown renderer, `/api/prose`.
 *
 * Deliberately a separate recorder from `recordApiRequests`, which filters on `/api/v1/` and therefore
 * could never see this route. That filter is why the suite above passed while the case-study bodies
 * were rendering in the wrong language: the only traffic that would have revealed it was invisible to
 * every assertion in this file.
 *
 * The count is the load-bearing signal. The defect's measured signature was ZERO prose requests on the
 * first locale switch — the renderer's `useAsyncData` key was a template literal evaluated once at
 * setup, so it never re-keyed, and the page's locale-independent `<section :key>` meant Vue patched the
 * component instead of remounting it. Asserting rendered text alone can pass on a warm cache; a
 * non-zero count is what proves the bodies were actually re-rendered for the incoming locale.
 */
function recordProseRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request: Request) => {
    // The POST body, not the URL: `/api/prose` takes the Markdown as its payload, so the body is the
    // only place the LANGUAGE of a render is observable. A count alone cannot distinguish "re-rendered
    // in Arabic" from "re-rendered in English again".
    if (request.url().includes('/api/prose')) seen.push(request.postData() ?? '')
  })
  return seen
}

/**
 * The eight FR-CNT-020 narrative sections, excluding the gallery and facts cards, which are also
 * `<section>`s inside the `<article>`.
 */
const NARRATIVE = [
  'article section',
  ':not([aria-labelledby="project-gallery-heading"])',
  ':not([aria-labelledby="project-facts-heading"])'
].join('')

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
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

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
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

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
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

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
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    expect(
      requests.filter(url => url.includes('locale=ar')),
      'no browser request may carry the outgoing locale'
    ).toEqual([])
  })
})

/**
 * STRUCTURED BODIES ON THE FIRST LOCALE SWITCH.
 *
 * The defect this describes was live in Production: on the FIRST EN→AR switch the title, the summary
 * and all eight UI section headings became Arabic while every Markdown body stayed English. Switching
 * away and back made it correct, which is why it survived review — and why every test here starts from
 * a genuinely fresh page.
 *
 * The tests above could not catch it. They assert the `<h1>`, which flipped correctly, and they assert
 * the ABSENCE of wrong-locale `/api/v1/` traffic — reasoning (correctly) that a payload-driven
 * client navigation makes no API call at all. The bodies were never asserted, and the renderer's own
 * `/api/prose` traffic was filtered out of the recorder. Both gaps are closed here.
 *
 * WHICH OF THESE ACTUALLY CATCHES THE DEFECT — measured, not assumed. The fix was reverted, the app
 * rebuilt, and this file re-run:
 *
 *   ✗ 'AR → EN → AR repeated switching'  → FAILS on the unfixed component. This is the regression test.
 *   ✓ 'a FRESH English load switched once' → PASSES on the unfixed component.
 *
 * The single-switch case does not reproduce here, and that is a property of the lane rather than of the
 * defect: `ci-preview.mjs` serves the build without Production's SWR route caching, so a client-side
 * switch fetches a freshly server-rendered payload for the target route. The frozen-key component finds
 * no entry under its stale key, fetches, and incidentally self-corrects. Production, with SWR in front
 * of the route, does not — it was observed there at 0 `/api/prose` calls with all eight bodies left in
 * English.
 *
 * So the single-switch test below is kept as a CONTRACT test (it states the required behaviour and would
 * catch a future regression that breaks the payload path) but it must not be read as the guard for this
 * defect. The guard is the repeated-switch test, plus the Production reproduction kept at
 * `scratchpad/evidence/m4-b/repro-locale-switch.mjs`, which exercises the real SWR path against the
 * deployed site and is the only check that reproduced the single-switch symptom.
 */
test.describe('Structured section bodies follow the switch', () => {
  /** English body fragments. Any of these on the Arabic page is the defect. */
  const EN_BODIES = [
    'Bilingual English overview paragraph.',
    'Bilingual English business problem paragraph.',
    'Bilingual English solution paragraph.',
    'Bilingual English role paragraph.',
    'Bilingual English architecture paragraph.',
    'Bilingual English challenges paragraph.',
    'Bilingual English features paragraph.',
    'Bilingual English lessons paragraph.'
  ]

  const AR_BODIES = [
    'ثنائي اللغة — فقرة النظرة العامة بالعربية.',
    'ثنائي اللغة — فقرة المشكلة التجارية بالعربية.',
    'ثنائي اللغة — فقرة الحل بالعربية.',
    'ثنائي اللغة — فقرة الدور بالعربية.',
    'ثنائي اللغة — فقرة البنية بالعربية.',
    'ثنائي اللغة — فقرة التحديات بالعربية.',
    'ثنائي اللغة — فقرة المزايا بالعربية.',
    'ثنائي اللغة — فقرة الدروس المستفادة بالعربية.'
  ]

  test('a FRESH English load switched once to Arabic renders Arabic bodies, and re-renders them', async ({
    page
  }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')

    // Recorded from AFTER the English page has settled, so the count belongs to the switch alone.
    const prose = recordProseRequests(page)
    await switchLocale(page, 'AR')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')

    // Every authored Arabic body is present...
    const bodies = page.locator(`${NARRATIVE} .content-prose`)
    await expect(bodies).toHaveCount(8)
    for (const text of AR_BODIES) {
      await expect(page.locator('main').getByText(text).first()).toBeVisible()
    }

    // ...and not one English body fragment survives anywhere on the page.
    for (const text of EN_BODIES) {
      await expect(page.getByText(text), `English body leaked after the switch: ${text}`).toHaveCount(0)
    }

    /**
     * On the request count: in PRODUCTION the diagnostic signal was stark — 0 `/api/prose` calls on the
     * first switch, 8 on every later one — because the frozen key left the client with no payload for
     * the incoming locale, forcing a client-side refetch once the component finally remounted.
     *
     * In this lane the correct expectation is ZERO, and asserting otherwise was wrong: these are SWR
     * routes, so a client-side switch is payload-driven — Nitro renders the target route and the prose
     * render happens inside it, where the browser cannot see it. With the key reactive, the client
     * finds the incoming locale's payload already present and makes no request at all. That is the
     * better outcome, not a weaker one.
     *
     * So the regression assertions are the content ones above, and they are sound here for the reason
     * Prism could never provide: this backend serves genuinely different EN and AR bodies, and every
     * test gets a fresh context, so there is no warm cache that could satisfy them accidentally.
     */
    /**
     * On the request COUNT: in PRODUCTION the diagnostic signal was stark — 0 `/api/prose` calls on the
     * first switch and 8 on every later one — because the frozen key left the client with no payload for
     * the incoming locale, forcing a refetch once the component eventually remounted.
     *
     * A non-zero count is nonetheless the wrong assertion in this lane. These are SWR routes, so a
     * client-side switch is payload-driven: Nitro renders the target route and the prose render happens
     * inside it, where the browser cannot observe it. With the key reactive the client finds the
     * incoming locale's payload already present and correctly issues no request at all.
     *
     * What holds either way — and is the real invariant — is the DIRECTION of any render that does
     * happen: a render triggered by switching to Arabic must never carry English source. This assertion
     * is therefore count-independent, and it is the one that cannot be satisfied by the defect.
     */
    for (const body of prose) {
      expect(body, 'a render triggered by the switch carried outgoing-locale source').not.toContain(
        'Bilingual English'
      )
    }
  })

  test('AR → EN → AR repeated switching stays correct in both directions', async ({ page }) => {
    await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')

    for (const round of [1, 2]) {
      await switchLocale(page, 'EN')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')
      for (const text of AR_BODIES) {
        await expect(page.getByText(text), `Arabic body survived into English, round ${round}`).toHaveCount(0)
      }
      await expect(page.locator('main').getByText(EN_BODIES[0] as string).first()).toBeVisible()

      await switchLocale(page, 'AR')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
      for (const text of EN_BODIES) {
        await expect(page.getByText(text), `English body survived into Arabic, round ${round}`).toHaveCount(0)
      }
      await expect(page.locator('main').getByText(AR_BODIES[0] as string).first()).toBeVisible()
    }
  })

  test('a slow outgoing-locale render cannot overwrite the incoming locale', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')

    /**
     * Slow BOTH the content read and the Markdown render, widening the window in which an outgoing
     * -locale response can still be in flight when the incoming one arrives.
     *
     * Interception alone would not be enough to make this meaningful: on these payload-driven routes
     * the browser may issue no prose request at all, so a test that only delayed `/api/prose` could
     * pass vacuously. Delaying the project read as well guarantees there is a real in-flight response
     * to lose the race, and the rapid double switch below guarantees two of them overlap.
     */
    for (const pattern of ['**/api/v1/projects/**', '**/api/prose']) {
      await page.route(pattern, async route => {
        await new Promise(resolve => setTimeout(resolve, 350))
        await route.continue()
      })
    }

    // Switch twice in quick succession, so the first transition is still resolving when the second
    // starts. If anything resolved by arrival order rather than by current identity, the earlier
    // response would land last and the page would end up in the wrong language.
    await switchLocale(page, 'AR')
    await switchLocale(page, 'EN')
    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG.bilingual.en}$`))

    // Settle well past both injected delays before judging the final state.
    await page.waitForTimeout(1500)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bilingual differentiation study')
    await expect(page.locator('main').getByText(EN_BODIES[0] as string).first()).toBeVisible()
    for (const text of AR_BODIES) {
      await expect(
        page.getByText(text),
        `a late outgoing-locale response overwrote the current locale: ${text}`
      ).toHaveCount(0)
    }
  })

  test('each section renders its localized heading exactly once', async ({ page }) => {
    // Defect 2 was the page's own `<h2>` plus a `## Overview` repeated inside the Markdown body. The
    // contract is that the LAYOUT owns section titles, so each label must appear once per section.
    for (const [route, labels] of [
      [`/projects/${SLUG.bilingual.en}`, ['Overview', 'The problem', 'My role', 'What I took away']],
      [`/ar/projects/${SLUG.bilingual.ar}`, ['نظرة عامة', 'المشكلة', 'دوري', 'ما تعلّمته']]
    ] as const) {
      await page.goto(route)
      const sections = page.locator(NARRATIVE)
      await expect(sections).toHaveCount(8)

      for (const label of labels) {
        await expect(
          sections.getByRole('heading', { name: label, exact: true }),
          `${label} must appear exactly once on ${route}`
        ).toHaveCount(1)
      }
    }
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
