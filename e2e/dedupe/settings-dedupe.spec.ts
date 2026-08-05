import { expect, test } from '@playwright/test'

/**
 * ONE public SSR render ⇒ exactly ONE `GET /settings/site`.
 *
 * Regression guard for a defect that shipped undetected because the only existing assertion for it
 * was mocked. `useSiteSettings()`, `useAboutContent()` and `useResumeData()` share the
 * `settings:site:{locale}` async-data key precisely so a render performs one request — but the shared
 * key alone does not dedupe during SSR (Nuxt's default `getCachedData` reads `nuxtApp.static.data`,
 * empty on a normal render), so every call site refetched. `/about` measured 2 requests before the
 * public layout began reading tier-2 metadata and 3 after. `app/utils/settings-cache.ts` supplies the
 * resolver that makes the documented invariant real.
 *
 * The count is read from the backend, not the browser: the read happens inside Nitro and never
 * reaches the page, so `page.route()` would observe nothing (measured — see `scenario-server.ts`).
 *
 * This file is the whole lane, which is what makes it serial: the backend counter is mutable state
 * and `workers` cannot be set per project. Same constraint, same remedy as the `dashboard` lane.
 */
const API = (path: string) => `http://127.0.0.1:${process.env.CI_SETTINGS_COUNT_MOCK_PORT ?? 3601}${path}`

async function resetCount(request: import('@playwright/test').APIRequestContext) {
  await request.get(API('/__settings-count/reset'))
}

async function readCount(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(API('/__settings-count'))
  return (await res.json()) as { count: number, urls: string[] }
}

// `/about` is the strongest case: it is the one route that reads settings through TWO different
// composables (`useAboutContent` on the route locale, the footer's `useSiteSettings` on the UI
// locale) as well as the public layout's tier-2 read.
for (const { path, locale } of [
  { path: '/about', locale: 'en' },
  { path: '/ar/about', locale: 'ar' }
]) {
  test(`${path} performs exactly one /settings/site request per SSR render`, async ({ page, request }) => {
    await resetCount(request)
    // `domcontentloaded`, not the default `load`: the request under test is issued INSIDE Nitro
    // while the document is rendered, so it is already counted once the document arrives. Waiting
    // for `load` would additionally wait on every sub-resource — including media this deliberately
    // minimal backend does not serve — and would measure the fixture, not the invariant.
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()

    const { count, urls } = await readCount(request)
    expect(count, `expected one request, got ${count}: ${urls.join(', ')}`).toBe(1)
    expect(urls[0]).toContain(`locale=${locale}`)
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
