import type { ConsoleMessage, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { ARTICLE_SLUG, SLUG } from './backend.ts'

/**
 * F-3 — LOCALE-OWNED HEAD STATE AFTER A CLIENT-SIDE SWITCH.
 *
 * THE INVARIANT, stated once: a client-side locale switch must leave the document in exactly the
 * state a DIRECT LOAD of the destination produces. Server-rendered output is known-correct in both
 * locales (asserted throughout this lane), so using it as the baseline means these tests never
 * hard-code an expected canonical or `og:locale` — they compare the two paths to the same URL and
 * fail on any divergence. That covers `dir`, `lang`, canonical, `og:locale` and hreflang in one rule,
 * and it keeps working if the correct values ever change.
 *
 * Duplicate tags are caught for free: every head value is collected as an ARRAY, so a second
 * canonical or a second `og:locale` fails the length assertion rather than silently winning.
 *
 * Covers both per-locale-slug surfaces (Project and Blog detail) plus the Projects index, which was
 * previously an evidence gap.
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

/** Vue hydration-mismatch warnings and fatal console errors — both are otherwise silent. */
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

/**
 * Record chrome and content language together across the switch, so a mixed-language DOM state is
 * caught rather than argued about. Header nav and the persistent footer are both sampled: the footer
 * lives outside the page transition, which is what made F-4 possible.
 */
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

async function assertChromeNeverMixed(page: Page): Promise<void> {
  const samples = await page.evaluate(() => (window as unknown as { __chrome: string[] }).__chrome)
  expect(samples.length, 'the observer must have seen the switch happen').toBeGreaterThan(0)
  // D03-13 commits the chrome in one step, so header and footer are never in different languages.
  expect(samples.filter(state => state === 'true|false' || state === 'false|true')).toEqual([])
}

const CASES = [
  {
    name: 'Project detail EN → AR',
    from: `/projects/${SLUG.bilingual.en}`,
    to: `/ar/projects/${SLUG.bilingual.ar}`,
    click: 'AR' as const,
    heading: 'دراسة تمايز اللغتين',
    documentNavigation: true
  },
  {
    name: 'Project detail AR → EN',
    from: `/ar/projects/${SLUG.bilingual.ar}`,
    to: `/projects/${SLUG.bilingual.en}`,
    click: 'EN' as const,
    heading: 'Bilingual differentiation study',
    documentNavigation: true
  },
  {
    name: 'Blog detail EN → AR',
    from: `/blog/${ARTICLE_SLUG.bilingual.en}`,
    to: `/ar/blog/${ARTICLE_SLUG.bilingual.ar}`,
    click: 'AR' as const,
    heading: 'دراسة تمايز المقالات بين اللغتين',
    documentNavigation: false
  },
  {
    name: 'Blog detail AR → EN',
    from: `/ar/blog/${ARTICLE_SLUG.bilingual.ar}`,
    to: `/blog/${ARTICLE_SLUG.bilingual.en}`,
    click: 'EN' as const,
    heading: 'Bilingual article differentiation study',
    documentNavigation: false
  },
  {
    name: 'Projects index EN → AR',
    from: '/projects',
    to: '/ar/projects',
    click: 'AR' as const,
    heading: 'أعمال مختارة',
    documentNavigation: false
  },
  {
    name: 'Projects index AR → EN',
    from: '/ar/projects',
    to: '/projects',
    click: 'EN' as const,
    heading: 'Selected work',
    documentNavigation: false
  }
  // Experience (008) is deliberately NOT listed here. This spec asserts zero console errors, and the
  // scenario backend serves `/ar/experience` as an intentional 503 so the RTL error state can be
  // proven — that 503 is a console error by design. The same head invariant is asserted for
  // `/experience` in `experience-states.spec.ts`, which tolerates that one expected failure.
]

for (const { name, from, to, click, heading, documentNavigation } of CASES) {
  test(`${name} — switched head state matches a direct load`, async ({ page }) => {
    // 1. Baseline: what a direct, server-rendered load of the DESTINATION produces.
    await page.goto(to)
    const expected = await headState(page)

    // The baseline itself must be sane, or the comparison below could pass on two identical wrongs.
    expect(expected.canonical, `${to} must emit exactly one canonical`).toHaveLength(1)
    expect(expected.ogLocale, `${to} must emit exactly one og:locale`).toHaveLength(1)
    expect(expected.hreflang.length, `${to} must emit hreflang alternates`).toBeGreaterThan(0)

    // 2. Now reach the same URL by switching locale in the browser.
    const consoleLog = recordConsole(page)
    await page.goto(from)
    if (documentNavigation) {
      await page.evaluate(() => { (window as unknown as { __beforeLocaleSwitch?: boolean }).__beforeLocaleSwitch = true })
    } else {
      await watchChrome(page)
    }
    await switchLocale(page, click)

    await expect(page).toHaveURL(new RegExp(`${to.replace(/[/]/g, '\\/')}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)

    // 3. The invariant.
    expect(await headState(page)).toEqual(expected)

    if (documentNavigation) {
      expect(await page.evaluate(() => (window as unknown as { __beforeLocaleSwitch?: boolean }).__beforeLocaleSwitch))
        .toBeUndefined()
    } else {
      await assertChromeNeverMixed(page)
    }
    expect(consoleLog.hydration, 'hydration warnings').toEqual([])
    expect(consoleLog.errors, 'fatal console errors').toEqual([])
  })
}
