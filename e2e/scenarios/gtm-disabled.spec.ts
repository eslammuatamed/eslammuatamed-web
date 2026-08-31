import { expect, test } from '@playwright/test'
import { collectCspViolations, expectNoUnexpectedCspViolations, parseDirective } from '../csp-violations'
import { hydrated } from '../hydration'

/**
 * FE4-U2e2 — GTM DISABLED path (the real live state): the ssr-scenarios lane serves
 * `/settings/site` with `gtmContainerId: null`, so NOTHING may load. This is the proof that the
 * capability ships default-off and that a Settings outage/null fallback degrades to exactly the
 * pre-U2e2 application.
 *
 * The GTM-ENABLED twin lives in `e2e/gtm/gtm-enabled.spec.ts` against the gtm-settings lane.
 */

test.describe('GTM disabled (null container id)', () => {
  test('public documents carry no GTM loader in SSR markup', async ({ request }) => {
    for (const path of ['/', '/about']) {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      const html = await res.text()
      expect(html, path).not.toMatch(/googletagmanager/i)
      expect(html, path).not.toMatch(/<noscript[\s>]/i)
    }
  })

  test('a hydrated public session makes zero GTM requests with zero new violations', async ({ page }) => {
    const urls: string[] = []
    page.on('request', r => urls.push(r.url()))
    await collectCspViolations(page)

    await page.goto('/')
    await hydrated(page)
    await page.waitForTimeout(1500) // onNuxtReady has certainly fired

    expect(urls.filter(u => /googletagmanager|gtm\.js/i.test(u))).toEqual([])
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
    await expectNoUnexpectedCspViolations(page)
  })

  test('the enforcing CSP is untouched — no GTM origins were added', async ({ request }) => {
    const res = await request.get('/about')
    const csp = res.headers()['content-security-policy']!
    expect(parseDirective(csp, 'script-src')).not.toBeNull()
    expect(csp).not.toMatch(/googletagmanager|google-analytics/i)
    expect(parseDirective(csp, 'frame-src')).toBeNull()
  })

  test('dashboard and auth shells stay GTM-free', async ({ page }) => {
    const urls: string[] = []
    page.on('request', r => urls.push(r.url()))
    await collectCspViolations(page)

    await page.goto('/dashboard/login')
    await hydrated(page)
    await page.waitForTimeout(1000)

    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
    expect(urls.filter(u => /googletagmanager|gtm\.js/i.test(u))).toEqual([])
    await expectNoUnexpectedCspViolations(page)
  })
})
