import type { ConsoleMessage, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { expectNoUnexpectedConsoleErrors } from './csp-violations'
import { hydrated } from './hydration'

/**
 * D22-7 locale-owned head state on the routes the SCENARIO lane does not serve.
 *
 * `e2e/scenarios/locale-head.spec.ts` covers Project detail, Blog detail and the Projects index,
 * where per-locale slugs make the assertion sharpest. This file completes the set on Prism: the Blog
 * index and Home. Both are index routes with no per-locale slug, which is exactly why they belong
 * here — F-3 spared index routes, so these guard the half that was already working and must stay so.
 *
 * Same invariant: a client-side locale switch must leave the document in the state a DIRECT LOAD of
 * the destination produces — `lang`, `dir`, canonical, `og:locale` and hreflang together, each
 * collected as an array so a duplicate tag fails instead of silently winning.
 */

interface HeadState {
  lang: string
  dir: string
  canonical: string[]
  ogLocale: string[]
  hreflang: string[]
}

async function headState(page: Page): Promise<HeadState> {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    // `Array.from`, not a spread: the e2e tsconfig ships `DOM` without `DOM.Iterable`, and widening
    // the lib to make a test convenience compile would change what the whole suite type-checks against.
    canonical: Array.from(document.querySelectorAll('link[rel="canonical"]'), el => el.getAttribute('href') ?? ''),
    ogLocale: Array.from(document.querySelectorAll('meta[property="og:locale"]'), el => el.getAttribute('content') ?? ''),
    hreflang: Array.from(
      document.querySelectorAll('link[rel="alternate"][hreflang]'),
      el => `${el.getAttribute('hreflang')}=${el.getAttribute('href')}`
    ).sort()
  }))
}

function recordConsole(page: Page): { hydration: string[], errors: string[] } {
  const hydration: string[] = []
  const errors: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text()
    if (/hydration/i.test(text)) hydration.push(text)
    else if (message.type() === 'error') errors.push(text)
  })
  page.on('pageerror', error => errors.push(String(error)))
  return { hydration, errors }
}

async function switchLocale(page: Page, code: 'EN' | 'AR'): Promise<void> {
  await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: code }).click()
}

/** Chrome and the persistent footer must never be observed in different languages (D03-13, F-4). */
async function watchChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: string[] = []
    ;(window as unknown as { __chrome: string[] }).__chrome = samples
    const arabic = /[؀-ۿ]/
    const record = () => {
      const nav = document.querySelector('nav')?.textContent ?? ''
      const footer = document.querySelector('footer')?.textContent ?? ''
      if (nav && footer) samples.push(`${arabic.test(nav)}|${arabic.test(footer)}`)
    }
    record()
    new MutationObserver(record).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
}

const CASES = [
  { name: 'Blog index EN → AR', from: '/blog', to: '/ar/blog', click: 'AR' as const },
  { name: 'Blog index AR → EN', from: '/ar/blog', to: '/blog', click: 'EN' as const },
  { name: 'Home EN → AR', from: '/', to: '/ar', click: 'AR' as const },
  { name: 'Home AR → EN', from: '/ar', to: '/', click: 'EN' as const }
]

for (const { name, from, to, click } of CASES) {
  test(`${name} — switched head state matches a direct load`, async ({ page }) => {
    await page.goto(to)
    const expected = await headState(page)
    expect(expected.canonical, `${to} must emit exactly one canonical`).toHaveLength(1)
    expect(expected.ogLocale, `${to} must emit exactly one og:locale`).toHaveLength(1)
    expect(expected.hreflang.length, `${to} must emit hreflang alternates`).toBeGreaterThan(0)

    const consoleLog = recordConsole(page)
    await page.goto(from)
    await hydrated(page)
    await watchChrome(page)
    await switchLocale(page, click)

    // `/` needs an exact match or it also matches `/ar`.
    await expect(page).toHaveURL(new RegExp(`${to === '/' ? '' : to.replace(/[/]/g, '\\/')}$`))
    // Home renders two level-1 headings; `.first()` keeps this about the switch, not about that.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    // SETTLE GATE. The URL changes at navigation, but D03-13 defers the locale commit until the
    // outgoing page is concealed — and the head follows the commit, not the URL. Comparing before
    // that would read a half-switched document and report an application defect that is really a
    // race in the test. Waiting on `lang` makes the remaining four values a real assertion.
    await expect(page.locator('html')).toHaveAttribute('lang', expected.lang)

    expect(await headState(page)).toEqual(expected)

    const samples = await page.evaluate(() => (window as unknown as { __chrome: string[] }).__chrome)
    expect(samples.length, 'the observer must have seen the switch happen').toBeGreaterThan(0)
    expect(samples.filter(state => state === 'true|false' || state === 'false|true')).toEqual([])

    expect(consoleLog.hydration, 'hydration warnings').toEqual([])
    expectNoUnexpectedConsoleErrors(consoleLog.errors)
  })
}
