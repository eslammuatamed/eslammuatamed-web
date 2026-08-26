import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectCspViolations, expectNoUnexpectedCspViolations } from '../csp-violations'
import { hydrated } from '../hydration'

/**
 * FE4-U2e2 — GTM ENABLED path: the gtm-settings lane serves `/settings/site` with a syntactically
 * valid, entirely FICTIONAL container id (GTM-TEST1234). The harness intercepts the loader request
 * itself, so no real analytics container is ever contacted — what is proven here is the LIFECYCLE:
 * one managed loader, after Nuxt ready, exactly once across SPA and locale navigations, executing
 * under the enforcing strict-dynamic CSP with no manual nonce and zero new violation classes.
 */

const GTM_LOADER = /www\.googletagmanager\.com\/gtm\.js/

test.describe('GTM enabled (published test container)', () => {
  test('initial SSR HTML contains ZERO GTM references of any kind', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
    const html = await res.text()

    // FE4-U2e2.1 boundary: GTM registration is client-only AND lazy, so nothing reaches the
    // server-rendered document — no bootstrap script, no loader element, no noscript iframe, and
    // (unlike pre-isolation U2e2) not even the module's preload hint. The loader exists only after
    // the public client mounts the async boundary and Nuxt becomes ready.
    expect(html).not.toMatch(/googletagmanager/i)
    expect(html).not.toMatch(/<noscript[\s>]/i)
  })

  test('first-party bundling is OFF at the built-artifact level', () => {
    // bundle:false must hold on the FINAL live instance. If bundling were active, the build emits
    // the downloaded gtm.js under /_scripts/assets/ and the loader would be same-origin instead of
    // third-party — observable in the artifact tree before any browser runs.
    expect(existsSync('.output/public/_scripts'), '.output/public/_scripts must not exist').toBe(false)
  })

  test('exactly one managed loader fires after hydration and survives navigation without duplication', async ({ page }) => {
    const gtmRequests: string[] = []
    const errors: string[] = []
    page.on('request', r => { if (GTM_LOADER.test(r.url())) gtmRequests.push(r.url()) })
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(e.message))
    await collectCspViolations(page)

    await page.route(GTM_LOADER, route =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body: 'window.dataLayer=window.dataLayer||[]; window.__gtmLoaderExecuted=true;'
      })
    )

    // Lane-fixture scope, not product behaviour: the scenario backend implements only the SSR
    // scenarios it exists for, so the CLIENT-side payload fetch of per-page SEO metadata on
    // navigated routes 404s. Answering it in-browser keeps the console-error assertion about GTM
    // and CSP rather than about this unit's fixture surface.
    await page.route(/\/api\/v1\/seo\/pages\//, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    )

    await page.goto('/')
    await hydrated(page)

    // The loader request fires only AFTER Vue has mounted (onNuxtReady), never during SSR or
    // before hydration completes.
    await page.waitForRequest(GTM_LOADER, { timeout: 10_000 })
    expect(gtmRequests.length).toBe(1)
    expect(gtmRequests[0]).toMatch(/^https:\/\/www\.googletagmanager\.com\//)

    // The module owns the element: exactly one third-party script tag, async, NO nonce attribute
    // (none is needed under strict-dynamic).
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(1)
    const attrs = await page.locator('script[src*="googletagmanager"]').first().evaluate(
      el => ({ nonce: el.getAttribute('nonce'), async: (el as HTMLScriptElement).async })
    )
    expect(attrs.nonce).toBeNull()
    expect(attrs.async).toBe(true)
    expect(await page.evaluate(() => (window as unknown as { __gtmLoaderExecuted?: boolean }).__gtmLoaderExecuted)).toBe(true)

    // Consent Mode v2 defaults queued BEFORE the container event, every signal denied.
    const consentDefault = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []
      return dl.find(entry => {
        const asArray = Array.from(Object.assign([], entry) as string[])
        return asArray[0] === 'consent' && asArray[1] === 'default'
      })
    })
    expect(consentDefault).toBeTruthy()
    const serialized = JSON.stringify(consentDefault)
    for (const signal of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      expect(serialized).toContain(`"${signal}":"denied"`)
    }
    expect(serialized).not.toContain('"granted"')

    // SPA navigation: no duplicate load, no second script element.
    await page.click('a[href="/projects"]')
    await page.waitForURL('**/projects')
    await hydrated(page)

    // Locale navigation via the footer toggle (its accessible label is the latin "AR"; the Arabic
    // name is only the title attribute): still no duplicate.
    await page.locator('footer a[href^="/ar"]').first().click()
    await page.waitForURL('**/ar**')
    await hydrated(page)
    await page.waitForTimeout(1000)

    expect(gtmRequests.length).toBe(1)
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(1)

    // Zero unexpected CSP violations; zero console errors beyond U2e1's known-benign set.
    await expectNoUnexpectedCspViolations(page)
    const cspConsole = errors.filter(e =>
      e.includes('violates the following Content Security Policy directive')
      || e.includes('Refused to evaluate')
    )
    // A NEW class here would mean the policy blocked something GTM needs — inspect, never widen.
    expect(cspConsole).toEqual([])
    expect(errors.filter(e => !cspConsole.includes(e))).toEqual([])
  })

  test('dashboard and auth shells register nothing even when Settings publishes a valid id', async ({ page }) => {
    const gtmRequests: string[] = []
    page.on('request', r => { if (GTM_LOADER.test(r.url())) gtmRequests.push(r.url()) })
    await collectCspViolations(page)

    // Direct loads — these shells never render the public lazy boundary regardless of Settings content.
    await page.goto('/dashboard/login')
    await hydrated(page)
    await page.waitForTimeout(1200)

    expect(gtmRequests).toEqual([])
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
    await expectNoUnexpectedCspViolations(page)
  })
})
