import { expect, test } from '@playwright/test'
import { collectCspViolations, expectNoUnexpectedCspViolations, expectNoUnexpectedConsoleErrors, parseDirective, parseNonce } from './csp-violations'
import { hydrated } from './hydration'

/**
 * FE4-U2e1 — the enforcing-Strict-CSP proof for the REAL production build.
 *
 * Every assertion here runs against `.output` served by Nitro (the contract lane's webServer), with
 * Prism answering the API on the fixture origin. This is the file that proves the ecosystem CSP
 * foundation end to end: header emitted and enforcing, framework scripts nonced by nuxt-security,
 * hydration intact, SWR responses cache header+body as ONE consistent unit, head contracts
 * (JSON-LD / canonical / hreflang) untouched, dashboard shell booting, zero unexpected violations,
 * and — because GTM is a LATER unit — zero analytics traffic of any kind.
 *
 * NONCE SEMANTICS ARE ASSERTED HONESTLY. A fresh uncached render gets a fresh nonce per response;
 * an SWR-cached response replays ITS OWN header+HTML pair unchanged for the TTL window. The second
 * behaviour is the documented cost of caching under nonce-CSP (the whole cached document is one
 * unit), not a bug this suite is allowed to "fix" by weakening caching.
 */

const MEDIA_ORIGIN = 'https://media.eslammuatamed.com'

async function fetchDocument(url: string): Promise<{ headers: Headers; html: string }> {
  const res = await fetch(url)
  expect(res.status).toBe(200)
  return { headers: res.headers, html: await res.text() }
}

test.describe('CSP foundation — headers & policy', () => {
  test('every public document ships an ENFORCING Content-Security-Policy', async ({ baseURL }) => {
    for (const path of ['/', '/about', '/projects', '/blog', '/ar']) {
      const { headers } = await fetchDocument(`${baseURL}${path}`)
      const csp = headers.get('content-security-policy')
      expect(csp, path).toBeTruthy()
      // Enforcing, not Report-Only. get() is case-insensitive; a Report-Only deployment would
      // return null here because the enforcing header name would be absent.
      expect(csp, path).toContain('nonce-')
    }
  })

  test('the declared directive set survives rendering', async ({ baseURL }) => {
    const { headers } = await fetchDocument(`${baseURL}/about`)
    const csp = headers.get('content-security-policy')!

    expect(parseDirective(csp, 'default-src')).toEqual(["'self'"])

    const script = parseDirective(csp, 'script-src')!
    expect(script).toContain("'strict-dynamic'")
    expect(script.join(' ')).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(script).not.toContain("'unsafe-inline'")
    expect(script).not.toContain("'unsafe-eval'")
    expect(script.join(' ')).not.toContain('*')

    expect(parseDirective(csp, 'style-src')).toEqual(["'self'", "'unsafe-inline'"])
    expect(parseDirective(csp, 'font-src')).toEqual(["'self'"])
    expect(parseDirective(csp, 'object-src')).toEqual(["'none'"])
    expect(parseDirective(csp, 'base-uri')).toEqual(["'none'"])
    expect(parseDirective(csp, 'frame-ancestors')).toEqual(["'none'"])
    expect(parseDirective(csp, 'form-action')).toEqual(["'self'"])
    expect(parseDirective(csp, 'script-src-attr')).toEqual(["'none'"])

    const img = parseDirective(csp, 'img-src')!
    expect(img).toContain("'self'")
    expect(img).toContain('data:')
    expect(img).toContain(MEDIA_ORIGIN)

    const connect = parseDirective(csp, 'connect-src')!
    expect(connect).toContain("'self'")
    expect(connect.join(' ')).not.toMatch(/googletagmanager|google-analytics/i)
  })

  test('no analytics origin appears in any served document or header', async ({ baseURL }) => {
    for (const path of ['/', '/projects']) {
      const { headers, html } = await fetchDocument(`${baseURL}${path}`)
      const csp = headers.get('content-security-policy')!
      expect(`${csp}\n${html}`).not.toMatch(/googletagmanager|google-analytics|GTM-/i)
    }
  })
})

test.describe('CSP foundation — nonces', () => {
  test('every EXECUTABLE script tag carries the response nonce', async ({ baseURL }) => {
    const { headers, html } = await fetchDocument(`${baseURL}/`)
    const nonce = parseNonce(headers.get('content-security-policy')!)
    expect(nonce).toBeTruthy()

    const tags = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1])
    expect(tags.length).toBeGreaterThan(0)

    // CSP's script-src governs EXECUTABLE scripts only. Data blocks (`application/json`,
    // `application/ld+json`) are inert to the parser regardless of a nonce attribute; i18n's
    // locale-payload block legitimately omits one.
    const DATA_TYPES = ['application/json', 'application/ld+json']
    const executable = tags.filter(attrs => {
      const type = /type="([^"]*)"/.exec(attrs ?? '')?.[1]
      return type === undefined || !DATA_TYPES.includes(type)
    })
    for (const attrs of executable) {
      expect(attrs ?? '', `executable script tag: ${(attrs ?? '').slice(0, 80)}`).toContain(`nonce="${nonce}"`)
    }
  })

  test('Nuxt hydration payload and JSON-LD survive as first-class nonced elements', async ({ baseURL }) => {
    const { headers, html } = await fetchDocument(`${baseURL}/`)
    const nonce = parseNonce(headers.get('content-security-policy')!)!

    const tags = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0])

    const payloadTag = tags.find(tag => tag.includes('id="__NUXT_DATA__"'))
    expect(payloadTag, '__NUXT_DATA__ script tag present').toBeTruthy()
    // Attribute order is emitter-specific; assert membership, not sequence.
    expect(payloadTag!).toContain(`nonce="${nonce}"`)
    expect(payloadTag!).toContain('application/json')

    const ldJsonTags = tags.filter(tag => tag.includes('application/ld+json'))
    expect(ldJsonTags.length).toBeGreaterThan(0)
    for (const tag of ldJsonTags) {
      expect(tag).toContain(`nonce="${nonce}"`)
      expect(tag).toContain('type="application/ld+json"')
    }
  })

  test('two fresh uncached renders receive DIFFERENT nonces', async ({ baseURL }) => {
    // `/about` has no SWR route rule, so both renders are live.
    const first = await fetchDocument(`${baseURL}/about`)
    const second = await fetchDocument(`${baseURL}/about`)
    const nonceA = parseNonce(first.headers.get('content-security-policy')!)
    const nonceB = parseNonce(second.headers.get('content-security-policy')!)
    expect(nonceA).toBeTruthy()
    expect(nonceB).toBeTruthy()
    expect(nonceA).not.toBe(nonceB)
  })

  test('an SWR cache hit replays header+HTML as ONE consistent unit', async ({ baseURL }) => {
    // First hit warms Nitro's SWR cache for `/`; second is served from it.
    await fetchDocument(`${baseURL}/`)
    const warm = await fetchDocument(`${baseURL}/`)
    const headerNonce = parseNonce(warm.headers.get('content-security-policy')!)
    const bodyNonces = [...warm.html.matchAll(/nonce="([^"]+)"/g)].map(m => m[1])
    expect(bodyNonces.length).toBeGreaterThan(0)
    expect([...new Set(bodyNonces)]).toEqual([headerNonce])
  })
})

test.describe('CSP foundation — head contracts survive', () => {
  test('canonical and strictSeo hreflang alternates remain on public documents', async ({ baseURL }) => {
    const { html } = await fetchDocument(`${baseURL}/ar`)
    expect(html).toMatch(/<link[^>]*rel="canonical"/)
    expect(html).toMatch(/hreflang="x-default"/)
    expect(html).toMatch(/hreflang="en"/)
    expect(html).toMatch(/hreflang="ar"/)
  })
})

test.describe('CSP foundation — real browser journeys', () => {
  test('home hydrates and interacts with ZERO violations', async ({ page }) => {
    const errors: string[] = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(e.message))
    await collectCspViolations(page)

    await page.goto('/')
    await hydrated(page)
    await expectNoUnexpectedCspViolations(page)
    expectNoUnexpectedConsoleErrors(errors)
  })

  test('client-side navigation across public routes stays violation-free', async ({ page }) => {
    await collectCspViolations(page)
    await page.goto('/')
    await hydrated(page)

    await page.click('a[href="/projects"]')
    await page.waitForURL('**/projects')
    await hydrated(page)

    await page.click('a[href="/about"]')
    await page.waitForURL('**/about')
    await hydrated(page)

    await expectNoUnexpectedCspViolations(page)
  })

  test('the Arabic home hydrates cleanly under the same policy', async ({ page }) => {
    await collectCspViolations(page)
    await page.goto('/ar')
    await hydrated(page)
    expect(await page.getAttribute('html', 'dir')).toBe('rtl')
    await expectNoUnexpectedCspViolations(page)
  })

  test('a representative SWR list route hydrates after a client navigation', async ({ page }) => {
    await collectCspViolations(page)
    await page.goto('/blog')
    await hydrated(page)
    await page.goto('/projects')
    await hydrated(page)
    await expectNoUnexpectedCspViolations(page)
  })

  test('the dashboard SPA shell boots with no bootstrap violation', async ({ page }) => {
    const errors: string[] = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(e.message))
    await collectCspViolations(page)

    await page.goto('/dashboard')
    await hydrated(page)
    await expectNoUnexpectedCspViolations(page)
    expectNoUnexpectedConsoleErrors(errors)
  })

  test('the auth/login shell renders and hydrates with no bootstrap violation', async ({ page }) => {
    const errors: string[] = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(e.message))
    await collectCspViolations(page)

    await page.goto('/dashboard/login')
    await hydrated(page)
    // The auth shell's own layout — not the public one — must be the document that booted.
    expect(page.url()).toContain('/dashboard/login')
    await expectNoUnexpectedCspViolations(page)
    expectNoUnexpectedConsoleErrors(errors)
  })

  test('no analytics request is ever made', async ({ page }) => {
    const urls: string[] = []
    page.on('request', r => urls.push(r.url()))
    await collectCspViolations(page)
    await page.goto('/')
    await hydrated(page)
    await page.waitForTimeout(1000)
    expect(urls.filter(u => /googletagmanager|google-analytics|gtm/i.test(u))).toEqual([])
  })
})
