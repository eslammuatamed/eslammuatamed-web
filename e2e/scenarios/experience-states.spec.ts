import { expect, test, type Page } from '@playwright/test'
import { SCENARIO_API } from './backend'

/**
 * Experience states Prism cannot express (008, D18-6).
 *
 * Prism always answers `/experiences` with a well-formed generated list, so the empty and error
 * states are invisible in the `contract` lane. They are proven here against the scenario backend,
 * where the locale is the scenario selector (see `scripts/e2e/scenario-server.ts`):
 *
 *   /experience     → 200 with zero experiences   → empty state
 *   /ar/experience  → RFC 7807 503                → error state, which is also where RTL matters most
 *
 * `_payload.json` is never intercepted: a direct load is server-rendered, so the API call happens
 * inside Nitro and never reaches the browser at all.
 */

const EN = '/experience'
const AR = '/ar/experience'

/** Console errors/warnings collected for the "no mixed frame" and hydration assertions. */
function collectConsole(page: Page): string[] {
  const messages: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') messages.push(message.text())
  })
  return messages
}

test.describe('Empty state (English, upstream returns zero experiences)', () => {
  test('the upstream really is empty — asserted at the source, not inferred', async ({ request }) => {
    const response = await request.get(`${SCENARIO_API}/experiences?locale=en`)
    expect(response.status()).toBe(200)
    expect((await response.json()).data).toEqual([])
  })

  test('renders real empty copy instead of a blank or broken timeline', async ({ page }) => {
    await page.goto(EN)

    // No fabricated entries, and no empty rail left behind. Scoped by the timeline's accessible
    // name: the breadcrumb trail is also an `<ol>` of list items and is expected to be there.
    await expect(page.getByRole('list', { name: /experience timeline/i })).toHaveCount(0)
    // Real localized copy, not an untranslated key.
    const main = page.locator('main')
    await expect(main).toContainText(/no roles published yet/i)
    await expect(main).not.toContainText('experience.emptyTitle')
  })

  test('offers a relevant onward path that is not Contact', async ({ page }) => {
    await page.goto(EN)

    const action = page.locator('main').getByRole('link', { name: /browse projects/i })
    await expect(action).toHaveAttribute('href', '/projects')
    // Contact is a later slice; its route does not exist and must not be linked.
    await expect(page.locator('main a[href$="/contact"]')).toHaveCount(0)
  })

  test('the page heading still renders, so the route is never a blank document', async ({ page }) => {
    await page.goto(EN)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('Error state (Arabic, upstream 503)', () => {
  test('the upstream really fails — asserted at the source', async ({ request }) => {
    const response = await request.get(`${SCENARIO_API}/experiences?locale=ar`)
    expect(response.status()).toBe(503)
  })

  test('renders localized, direction-correct error copy', async ({ page }) => {
    await page.goto(AR)

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('تعذّر تحميل الخبرة المهنية')
    // Never an untranslated key, and never English on an Arabic route.
    await expect(alert).not.toContainText('experience.errorTitle')
  })

  test('leaks no technical error text', async ({ page }) => {
    await page.goto(AR)

    const text = (await page.locator('main').innerText()).toLowerCase()
    for (const leak of ['503', 'fetch', 'http', 'api/v1', 'econn', 'stack', 'undefined']) {
      expect(text).not.toContain(leak)
    }
  })

  test('offers a retry action that re-requests rather than reloading the document', async ({ page }) => {
    await page.goto(AR)

    let apiCalls = 0
    page.on('request', (request) => {
      if (request.url().includes('/experiences')) apiCalls++
    })

    await page.getByRole('button').filter({ hasText: /إعادة|حاول/ }).first().click()
    // The retry re-fetches from the browser; it must not be a full navigation.
    await expect(page).toHaveURL(/\/ar\/experience$/)
    expect(apiCalls).toBeGreaterThan(0)
  })
})

test.describe('D03-13 — the locale transition is atomic', () => {
  test('AR → EN never paints a mixed-language frame and lands fully English', async ({ page }) => {
    const messages = collectConsole(page)
    await page.goto(AR)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: 'EN' }).click()

    await expect(page).toHaveURL(/\/experience$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    // The committed UI locale drives the chrome: after the transition settles, no Arabic chrome
    // string may remain alongside the English document.
    const nav = page.getByRole('navigation').first()
    await expect(nav).not.toContainText('المشاريع')

    expect(messages.filter(m => /hydration|mismatch/i.test(m))).toEqual([])
  })

  /**
   * The finding F-3 invariant, in the same form `locale-head.spec.ts` uses: the head reached by
   * SWITCHING must be identical to the head of a DIRECT load of the same URL. Comparing the two
   * beats hard-coding expected values — it covers canonical, og:locale, hreflang, lang and dir at
   * once, and cannot pass by asserting the wrong thing consistently.
   *
   * It lives here rather than in `locale-head.spec.ts` because that spec also asserts zero console
   * errors, and this lane serves `/ar/experience` as an intentional 503 so the RTL error state can
   * be proven. That one expected failure is tolerated here and nowhere else.
   */
  test('the switched head is identical to a direct load of the destination', async ({ page }) => {
    const read = () =>
      page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        canonical: Array.from(document.querySelectorAll('link[rel="canonical"]'), el => el.getAttribute('href')),
        ogLocale: Array.from(document.querySelectorAll('meta[property="og:locale"]'), el => el.getAttribute('content')),
        hreflang: Array.from(
          document.querySelectorAll('link[rel="alternate"][hreflang]'),
          el => `${el.getAttribute('hreflang')}=${el.getAttribute('href')}`
        ).sort()
      }))

    // Baseline: a direct, server-rendered load of the destination.
    await page.goto(EN)
    const expected = await read()
    // The baseline must itself be sane, or the comparison could pass on two identical wrongs.
    expect(expected.canonical).toHaveLength(1)
    expect(expected.ogLocale).toHaveLength(1)
    expect(expected.hreflang.length).toBeGreaterThan(0)

    // Now reach the same URL by switching in the browser.
    await page.goto(AR)
    await page.getByRole('group', { name: /language|لغة/i }).first().getByRole('link', { name: 'EN' }).click()
    // Anchored so it cannot also match `/ar/experience` — an unanchored guard would let the head be
    // read mid-transition and report a defect that is only a race in the test.
    await expect(page).toHaveURL(/\/experience$/)
    await expect(page).not.toHaveURL(/\/ar\//)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Professional experience')

    expect(await read()).toEqual(expected)
  })
})
