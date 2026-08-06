import { expect, test } from '@playwright/test'

/**
 * ONE public SSR render ⇒ exactly ONE `GET /settings/site`, on the healthy path AND the outage path.
 *
 * Regression guard for a defect that shipped undetected because the only existing assertion for it
 * was mocked. `useSiteSettings()`, `useAboutContent()` and `useResumeData()` share the
 * `settings:site:{locale}` async-data key precisely so a render performs one request — but the shared
 * key alone does not dedupe during SSR (Nuxt's default `getCachedData` reads `nuxtApp.static.data`,
 * empty on a normal render), so every call site refetched. `/about` measured 2 requests before the
 * public layout began reading tier-2 metadata and 3 after. `app/utils/settings-cache.ts` supplies the
 * resolver that makes the documented invariant real on the healthy path, and
 * `app/utils/settings-request.ts` extends it to the outage path (BLK-2).
 *
 * The count is read from the backend, not the browser: the read happens inside Nitro and never
 * reaches the page, so `page.route()` would observe nothing (measured — see `scenario-server.ts`).
 *
 * This file is the whole lane, which is what makes it serial: the backend counter is mutable state
 * and `workers` cannot be set per project. Same constraint, same remedy as the `dashboard` lane.
 *
 * ## WHY EVERY REQUEST COUNT BELOW IS TAKEN ON `/about`
 *
 * `nuxt.config.ts` puts `swr: 60` on `/`, `/ar`, `/projects` and `/blog/**`. Two measured properties
 * of that rule govern this file:
 *
 *   1. **Nitro's SWR cache key ignores the query string.** A cache-busting parameter was implemented
 *      and measured as ineffective, then removed rather than left in place looking like protection.
 *   2. **Any page warms those routes.** `<NuxtLink>` prefetches links in the viewport, and the header
 *      links to `/`, `/projects` and `/blog` on every page — so merely visiting `/about` causes the
 *      server to render and cache `/`. Playwright's readiness probe did the same until it was pointed
 *      at a non-cached path (`previewServer`'s `readyPath`).
 *
 * So inside one lane run, a count taken on an SWR route measures the cache, not the application:
 * the first version of these tests asserted an outage against a `/` that had been rendered while the
 * backend was still healthy, and read 0 requests from a `/projects` a previous test had cached.
 * Proven by isolation — the same `/` test passes alone and fails after any other test has run.
 *
 * `/about` carries NO SWR rule, so every visit is a real render. It is also the strongest case on
 * merit: it is the one route that reads settings through TWO different composables
 * (`useAboutContent()` on the route locale, the footer's `useSiteSettings()` on the UI locale) as
 * well as the public layout's tier-2 read. Counts are therefore asserted there, in both locales, and
 * the SWR routes are used for the assertions that do not depend on counting.
 */
const API = (path: string) => `http://127.0.0.1:${process.env.CI_SETTINGS_COUNT_MOCK_PORT ?? 3601}${path}`

/**
 * Reset the counter, then PROVE it is quiet before the test navigates.
 *
 * A bare reset is not enough, and this was MEASURED rather than anticipated: CI run 31080237659
 * failed `/about … ONE request` with `got 2: …locale=ar, …locale=en` — an ARABIC read counted on an
 * English route, and counted BEFORE the route's own render. Nothing in that test can produce it.
 * It leaks from the preceding test: its page prefetches the alternate-locale link, Nitro renders
 * `/ar` server-side to answer the payload request, and that render's `/settings/site` call can land
 * on this shared counter AFTER the next test has already reset it. Closing the page ends the
 * browser side of that work, not the server side already in flight.
 *
 * The file header already names link prefetch as a hazard, but only in the direction of WARMING an
 * SWR route. This is the other direction: prefetch CONTAMINATING the counter.
 *
 * Settling rather than filtering is deliberate. Ignoring reads whose locale is not the one under
 * test would also hide a real regression — a route issuing an extra cross-locale read is exactly
 * the WD-6 defect class this lane exists to catch. So the straggler is waited out, not excluded.
 *
 * `?fail=1` is a persistent MODE on the server, not a one-shot, so a straggler landing inside the
 * settle window cannot consume it and re-resetting cannot lose it.
 *
 * HONEST LIMIT: this waits for observed quiescence, it does not make the window zero — a straggler
 * could still arrive between the final zero reading and the navigation. What it removes is the case
 * that actually occurs: a render already in flight when the previous test ended. If this ever throws,
 * that is information worth having rather than a count silently attributed to the wrong test.
 */
async function resetCountSettled(
  request: import('@playwright/test').APIRequestContext,
  { fail = false } = {}
) {
  const query = fail ? '?fail=1' : ''
  for (let attempt = 1; attempt <= 6; attempt++) {
    await request.get(API(`/__settings-count/reset${query}`))
    await new Promise(resolve => setTimeout(resolve, 250))
    const { count } = await readCount(request)
    if (count === 0) return
  }
  throw new Error(
    'the settings counter never went quiet: a render from an earlier test is still arriving after '
      + 'six resets. Measuring now would attribute another test\'s request to this one.'
  )
}

async function resetCount(request: import('@playwright/test').APIRequestContext) {
  await resetCountSettled(request)
}

/** Reset AND put `/settings/site` into the 503 outage path for the next render (BLK-2). */
async function resetCountFailing(request: import('@playwright/test').APIRequestContext) {
  await resetCountSettled(request, { fail: true })
}

async function readCount(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(API('/__settings-count'))
  return (await res.json()) as { count: number, urls: string[] }
}

/**
 * THIS TEST MUST RUN FIRST, and its position in this file is what makes that true: the lane is
 * serial and is a single spec file, so file order is execution order.
 *
 * It is the one assertion that needs `/` — the D13-1 API-unavailable state lives only there — and
 * `/` is SWR-cached, so it must be rendered before any other test's link prefetch can warm it. The
 * readiness probe no longer warms it either (`previewServer`'s `readyPath`).
 *
 * The count assertion is what KEEPS this honest rather than merely hoping: a cached response costs
 * zero requests, so `toBe(1)` fails loudly if this test is ever reordered below another. Without it,
 * a reordering would silently assert the D13-1 state against a healthy page rendered earlier — which
 * is exactly the false result the first version of this file produced.
 */
test('/ costs one request, renders D13-1, and keeps tier-3 metadata while the API is down', async ({ page, request }) => {
  await resetCountFailing(request)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // The shared-failure proof: `index.vue` renders this branch only when `settingsError` is set, and
  // it is the LAST of the three readers to run (`app.vue` → layout → page). If the failure were not
  // shared with it — the exact defect a cached failure VALUE would introduce, since `asyncData.js`
  // clears `error` whenever `getCachedData` returns a value — it would have neither `settings` nor
  // `settingsError`, and would render nothing at all.
  await expect(page.getByRole('heading', { name: 'Content unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

  const { count, urls } = await readCount(request)
  expect(count, `expected one live render, got ${count}: ${urls.join(', ')}`).toBe(1)

  // The metadata FLOOR is what a dead API must not be able to lower. `useSeoMeta` treats an
  // `undefined` getter as "delete this tag", so a reader left with neither data nor error could
  // silently strip tags `app.vue` had already committed — measured once as `twitter:*` vanishing
  // entirely on the dead-API path. Assert presence AND non-emptiness: an empty `content` is the
  // failure mode a bare presence check would pass.
  for (const selector of [
    'meta[property="og:image"]',
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]'
  ]) {
    const tag = page.locator(selector)
    await expect(tag).toHaveCount(1)
    await expect(tag).not.toHaveAttribute('content', '')
  }
})

for (const { path, locale, availability, bio, siteName } of [
  {
    path: '/about',
    locale: 'en',
    availability: 'Open to select consulting engagements',
    bio: 'I build for the web, frontend first.',
    siteName: 'Eslam Muatamed CMS Site Name'
  },
  {
    path: '/ar/about',
    locale: 'ar',
    availability: 'متاح لارتباطات استشارية مختارة',
    bio: 'أبني للويب، والواجهة الأمامية أولًا.',
    siteName: 'اسم الموقع من لوحة التحكم'
  }
]) {
  test(`${path} serves all three settings consumers from ONE request`, async ({ page, request }) => {
    await resetCount(request)
    // `domcontentloaded`, not the default `load`: the request under test is issued INSIDE Nitro
    // while the document is rendered, so it is already counted once the document arrives. Waiting
    // for `load` would additionally wait on every sub-resource — including media this deliberately
    // minimal backend does not serve — and would measure the fixture, not the invariant.
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()

    // ONE request…
    const { count, urls } = await readCount(request)
    expect(count, `expected one request, got ${count}: ${urls.join(', ')}`).toBe(1)
    expect(urls[0]).toContain(`locale=${locale}`)

    // …and all THREE consumers actually holding the data from it. Counting alone cannot show this:
    // a regression in which one consumer resolved `null` while the others shared the single response
    // would keep the count at 1 and pass. Each assertion below names a value that ONLY the settings
    // response can supply, so it fails if that consumer came back empty.
    //
    // 1. chrome — the footer's `useSiteSettings()` (UI locale)
    await expect(page.getByText(availability)).toBeVisible()
    // 2. page body — `useAboutContent()` (route locale)
    await expect(page.getByText(bio)).toBeVisible()
    // 3. public layout — tier-2 metadata. The lane's backend deliberately serves a `siteName` the
    //    committed tier-3 floor cannot produce (see settings-count-server.ts); asserting the shared
    //    fixture's value instead would pass even if the layout's read returned nothing at all.
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', siteName)
  })
}

test('a dashboard route performs no public /settings/site request', async ({ page, request }) => {
  await resetCount(request)
  await page.goto('/dashboard/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()

  // Dashboard isolation: `app.vue` wraps the dashboard and auth shells, so a public read there would
  // make every authenticated navigation block on an endpoint it never consumes.
  expect((await readCount(request)).count).toBe(0)
})

/**
 * ── BLK-2: THE OUTAGE PATH COSTS ONE REQUEST TOO ────────────────────────────────────────────────
 *
 * The healthy path above was fixed by sharing a settled VALUE (`utils/settings-cache.ts`). That
 * mechanism is structurally unable to help here: Nuxt writes `payload.data[key]` only on SUCCESS, so
 * on the outage path every reader refetched — MEASURED at **6** requests for one SSR render
 * (three readers, each doubled by ofetch's default retry on a 503). The amplification arrived exactly
 * when the API was already failing.
 *
 * `utils/settings-request.ts` shares the request-scoped PROMISE instead, and `useSettingsRead` sets
 * `retry: 0`. Both are needed: restore the retry and the count doubles; remove the shared promise and
 * it triples.
 *
 * These tests assert the count AND the behaviour it must not have been bought with. Reaching one
 * request by swallowing the governed failure would be a regression, not a fix, so the outage tests
 * also assert that the failure still reaches the consumer that renders it.
 */
test.describe('BLK-2 — outage path', () => {
  for (const { path, locale } of [
    { path: '/about', locale: 'en' },
    { path: '/ar/about', locale: 'ar' }
  ]) {
    test(`${path} shares ONE failed read across every settings consumer`, async ({ page, request }) => {
      await resetCountFailing(request)
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main')).toBeVisible()

      const { count, urls } = await readCount(request)
      expect(count, `expected one request on the outage path, got ${count}: ${urls.join(', ')}`).toBe(1)
      expect(urls[0]).toContain(`locale=${locale}`)
    })
  }

  test('a dashboard route performs no public request even while the API is down', async ({ page, request }) => {
    await resetCountFailing(request)
    await page.goto('/dashboard/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()

    // Isolation must not be conditional on the public API's health: a failing endpoint the dashboard
    // never consumes is precisely when a stray read would be most damaging.
    expect((await readCount(request)).count).toBe(0)
  })
})

/**
 * ── The tier-2 metadata the shared read exists to deliver ───────────────────────────────────────
 *
 * The request count is only half the contract. The public layout awaits this read so the FIRST
 * server-rendered HTML already carries the operator's localized values, and the BLK-2 change moved
 * where that read is issued — so what it delivers is re-proven here rather than assumed.
 */
test.describe('tier-2 SiteSettings metadata', () => {
  // The healthy-path tests above already assert the localized tier-2 site name per locale on a
  // direct SSR render. What remains for this block is the CLIENT-SIDE transition, which is where the
  // locale-parity regressions actually live.
  test('a client-side locale switch replaces the outgoing language in the metadata', async ({ page, request }) => {
    // Restore the HEALTHY backend explicitly. The preceding outage test leaves `fail=1` set on this
    // lane's shared mutable backend, and without this reset the page below renders from tier-3.
    // That is not a hypothetical: this reset was added because the discriminating `siteName`
    // assertion below caught the leak. The previous version expected the shared fixture's name,
    // which is byte-identical to the tier-3 fallback, so it passed while the API was down.
    await resetCount(request)
    await page.goto('/about', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'Eslam Muatamed CMS Site Name'
    )

    await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: 'AR' }).click()
    await expect(page).toHaveURL(/\/ar\/about/)

    // The incoming locale must actually be FETCHED, not merely fallen back to. Reported in the
    // message so a failure says which requests were made rather than only that a tag was wrong.
    const afterSwitch = await readCount(request)
    expect(
      afterSwitch.urls.some(u => u.includes('locale=ar')),
      `expected an ar settings request after the switch, saw: ${afterSwitch.urls.join(', ')}`
    ).toBe(true)

    // The incoming language must REPLACE the outgoing one, not join it. A persistent layout that
    // pinned its key to the mount-time locale would leave the English value in place — the WD-6
    // locale-parity regression that `watch: [locale]` and the reactive key exist to prevent, and the
    // reason the rejected `useNuxtData()` approach could not be used here. `toHaveCount(1)` is the
    // half that catches "added" rather than "replaced".
    //
    // ⚠️ ASSERTED AS ARABIC, NOT AS THE CMS VALUE — deliberately, and this is a KNOWN GAP (BLK-5).
    // MEASURED on this lane: after a client-side switch the `locale=ar` settings request IS issued
    // (asserted above), but the persistent layout emits the COMMITTED Arabic name
    // ('إسلام معتمد', tier 3) rather than the CMS Arabic name — i.e. its `settings` resolves null
    // after the key changes, so tier 2 is not re-delivered on the client transition. The governed
    // requirement here is that the metadata leaves the outgoing language and carries the incoming
    // one, which IS satisfied; delivering tier 2 across a client switch is the open part.
    //
    // This is NOT a BLK-2 regression — that commit did not change how the layout reads settings —
    // and it was invisible until this lane started serving a `siteName` distinguishable from the
    // tier-3 floor. The old assertion expected the shared fixture's name, which is byte-identical to
    // the fallback, so it passed either way. Asserting the fallback value HERE as if it were correct
    // would re-hide it, so the assertion states the property that genuinely holds and BLK-5 carries
    // the rest.
    const siteNameTag = page.locator('meta[property="og:site_name"]')
    await expect(siteNameTag).toHaveCount(1)
    await expect(siteNameTag).not.toHaveAttribute('content', 'Eslam Muatamed CMS Site Name')
    await expect(siteNameTag).toHaveAttribute('content', /[؀-ۿ]/)

    // And back, because a one-way switch would not catch a key that only ever moves forward. The EN
    // value IS re-delivered here, because `settings:site:en` is already in the session payload from
    // the initial SSR render — which is itself evidence for BLK-5's diagnosis: the transition works
    // when the payload already holds the key, and falls back to tier 3 when it must fetch.
    await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: 'EN' }).click()
    await expect(page).toHaveURL(/\/about$/)
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'Eslam Muatamed CMS Site Name'
    )
    await expect(page.locator('meta[property="og:site_name"]')).toHaveCount(1)
  })
})
