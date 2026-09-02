import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  ARABIC,
  DESKTOP,
  NARROW,
  articlesNavLink,
  expectNoKeyPaths,
  listSettled,
  resetBackend,
  rows,
  setBackendState,
  shell,
  signIn
} from './harness'

/**
 * The Articles collection, in a real browser, in both languages (FE-2c; plan §14.9 criteria 1, 2,
 * 6, 7, 8, 9, 10).
 *
 * ── THIS LANE CARRIES THE F-1 PROOF THAT WAS OWED ───────────────────────────────────────────────
 * `d5d493b` rewired `UiContentSkeleton`, `UiDataLoadingOverlay` and `UiStateError` to translate
 * through `useSurfaceI18n()`, and the ledger recorded plainly that the proof was NOT yet written:
 * no dashboard surface rendered those components, so F-1 stood at unit and lint level only. Articles
 * is the first surface that renders all three, so the browser assertions below are what actually
 * closes it.
 *
 * They are written to fail against the pre-F-1 code specifically: each one asserts the loading,
 * updating or error copy is ARABIC SCRIPT on a cold Arabic dashboard. Before F-1 those components
 * resolved the ROUTE locale, which is always `en` on an unprefixed `/dashboard/**` route (D04-7),
 * so they rendered English `Loading` / `Updating` / `Try again` — silently, with every other gate
 * green. Asserting merely that "a skeleton appeared" would pass against the defect.
 *
 * ── WHY EVERY LOADING ASSERTION SETS `delayMs` FIRST ────────────────────────────────────────────
 * These states exist only while a request is in flight. Against an instant backend the assertion
 * races the response and passes without the state ever having rendered — a green test proving
 * nothing. `scripts/e2e/articles-server.spec.ts` negative-controls that the hold is real.
 */

/**
 * The revalidation overlay, addressed unambiguously.
 *
 * FOUR things on this page answer to `role="status"`: the skeleton, the stale-refresh notice, this
 * overlay, and — the one that actually bit — Nuxt's own route announcer, an EMPTY
 * `<span role="status" aria-live="polite">` that the framework renders on every page. A
 * `.first()` match landed on that announcer and the assertion compared the overlay's language
 * against an empty string.
 *
 * Only `UiDataLoadingOverlay` carries `aria-live="polite"` AND `aria-busy="true"` together: the
 * announcer has no `aria-busy`, the skeleton has no `aria-live`, and the stale notice has neither.
 * Both attributes are therefore load-bearing in this selector, not belt-and-braces.
 */
const UPDATING = (page: import('@playwright/test').Page) =>
  page.locator('[role=status][aria-live="polite"][aria-busy="true"]')

function waitForArticlesRequest(
  page: import('@playwright/test').Page,
  expected: Record<string, string | null>
) {
  return page.waitForRequest(request => {
    if (request.method() !== 'GET') return false
    const url = new URL(request.url())
    if (url.pathname !== '/api/v1/admin/articles') return false
    return Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value)
  })
}

async function submitTitleSearch(page: import('@playwright/test').Page, q: string) {
  const request = waitForArticlesRequest(page, { q })
  await page.locator('[data-articles-search]').fill(q)
  await page.locator('[data-articles-search]').press('Enter')
  await request
  await listSettled(page)
}

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
  await page.setViewportSize(DESKTOP)
})

test.describe('reachability and the list', () => {
  test('Articles is reachable from the visible Dashboard navigation', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    const link = articlesNavLink(page)
    await expect(link, 'the nav must offer Articles, not just the route').toBeVisible()
    await link.click()
    await page.waitForURL('**/dashboard/articles')
    await listSettled(page)
    await expect(page.locator('[data-articles-table]')).toBeVisible()
    await expect(rows(page)).not.toHaveCount(0)
  })

  test('the status filter narrows the list and returns to page 1', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles?page=2')
    await hydrated(page)
    await listSettled(page)
    expect(new URL(page.url()).searchParams.get('page')).toBe('2')

    // The real Reka listbox, driven as an operator would — the interaction a unit test cannot make.
    await page.locator('[data-articles-status]').click()
    await page.getByRole('option', { name: 'Archived', exact: true }).click()

    // WAIT FOR THE URL, do not merely settle the list. `listSettled` asserts that nothing is
    // `aria-busy`, which is already true in the instant between the click and the router starting —
    // so it returns immediately and the address is read before the navigation happened. Measured:
    // the list was correctly filtered on screen while `page.url()` still had no `status`.
    await page.waitForURL(/[?&]status=ARCHIVED/)
    await listSettled(page)

    const query = new URL(page.url()).searchParams
    expect(query.get('status'), 'the filter must reach the address').toBe('ARCHIVED')
    expect(query.get('page'), 'a filter change returns to page 1 — in ONE navigation').toBeNull()
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator('[data-article-status="ARCHIVED"]')).toBeVisible()
  })

  test('pagination reaches a real second page with different rows', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)
    const firstPageTitles = await page.locator('[data-article-title]').allInnerTexts()

    await page.goto('/dashboard/articles?page=2')
    await hydrated(page)
    await listSettled(page)
    const secondPageTitles = await page.locator('[data-article-title]').allInnerTexts()

    expect(secondPageTitles.length).toBeGreaterThan(0)
    expect(secondPageTitles, 'page 2 must not repeat page 1').not.toEqual(firstPageTitles)
  })
})

test.describe('U5G — server-side article title search', () => {
  test('renders an explicit, keyboard-submittable search control', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await expect(page.locator('[data-articles-search]')).toBeVisible()
    await expect(page.locator('[data-articles-search-form]')).toBeVisible()
    await expect(page.locator('[data-articles-search]')).toHaveAttribute('dir', 'auto')
  })

  test('sends an English q and renders the server result without local filtering', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await submitTitleSearch(page, 'listed article 19')

    const query = new URL(page.url()).searchParams
    expect(query.get('q')).toBe('listed article 19')
    await expect(page.locator('[data-article-title]')).toHaveText(['Listed article 19'])
  })

  test('sends Arabic q across authored locales and renders the Arabic server result', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await submitTitleSearch(page, 'مقالة مدرجة 19')

    await expect(page.locator('[data-article-title]')).toHaveText(['مقالة مدرجة 19'])
  })

  test('search resets page once, preserves status, and sends both query parameters', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles?page=2&status=PUBLISHED')
    await hydrated(page)
    await listSettled(page)

    const request = waitForArticlesRequest(page, { q: 'listed', status: 'PUBLISHED', page: '1' })
    await page.locator('[data-articles-search]').fill(' listed ')
    await page.locator('[data-articles-search]').press('Enter')
    await request
    await listSettled(page)

    const query = new URL(page.url()).searchParams
    expect(query.get('q')).toBe('listed')
    expect(query.get('status')).toBe('PUBLISHED')
    expect(query.get('page')).toBeNull()
  })

  test('status and pagination preserve q', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles?q=listed')
    await hydrated(page)
    await listSettled(page)

    const statusRequest = waitForArticlesRequest(page, { q: 'listed', status: 'PUBLISHED', page: '1' })
    await page.locator('[data-articles-status]').click()
    await page.getByRole('option', { name: 'Published', exact: true }).click()
    await statusRequest
    await listSettled(page)
    expect(new URL(page.url()).searchParams.get('q')).toBe('listed')

    await page.goto('/dashboard/articles?q=listed')
    await hydrated(page)
    await listSettled(page)
    await expect(page.locator('[data-articles-count]')).toContainText('25')
    await page.locator('[data-articles-pagination]').getByRole('button', { name: 'Page 2', exact: true }).click()
    await page.waitForURL(/[?&]page=2/)
    await listSettled(page)
    expect(new URL(page.url()).searchParams.get('q')).toBe('listed')
    expect(new URL(page.url()).searchParams.get('page')).toBe('2')
  })

  test('clearing removes q, returns to page 1, and makes an unfiltered request', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles?q=listed&page=2')
    await hydrated(page)
    await listSettled(page)

    const request = waitForArticlesRequest(page, { q: null, page: '1' })
    await page.locator('[data-articles-search-clear]').click()
    await request
    await listSettled(page)
    const query = new URL(page.url()).searchParams
    expect(query.get('q')).toBeNull()
    expect(query.get('page')).toBeNull()
  })

  test('deep links and browser history restore the committed q without leaving Articles', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    const deepLinkRequest = waitForArticlesRequest(page, { q: 'listed', page: '2' })
    await page.goto('/dashboard/articles?q=listed&page=2')
    await deepLinkRequest
    await hydrated(page)
    await listSettled(page)
    await expect(page.locator('[data-articles-search]')).toHaveValue('listed')

    await submitTitleSearch(page, 'listed article 19')
    await page.goBack()
    await page.waitForURL(/q=listed&page=2/)
    await expect(page.locator('[data-articles-search]')).toHaveValue('listed')
    await page.goForward()
    await page.waitForURL(/q=listed(?:%20|\+)article(?:%20|\+)19/)
    await expect(page.locator('[data-articles-search]')).toHaveValue('listed article 19')
    expect(new URL(page.url()).pathname).toBe('/dashboard/articles')
  })

  test('a slow old-q response cannot overwrite the newer result', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { delayMs: 1200 })
    const oldRequest = waitForArticlesRequest(page, { q: 'listed' })
    const oldResponse = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/admin/articles' && url.searchParams.get('q') === 'listed'
    })
    await page.goto('/dashboard/articles?q=listed')
    await oldRequest
    await hydrated(page)

    await setBackendState(page, { delayMs: 0 })
    await submitTitleSearch(page, 'listed article 19')
    await expect(page.locator('[data-article-title]')).toHaveText(['Listed article 19'])
    await oldResponse
    await expect(page.locator('[data-article-title]')).toHaveText(['Listed article 19'])
  })

  test('a no-match search is empty, while failure retry preserves q, status and page', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles?q=does-not-exist')
    await hydrated(page)
    await listSettled(page)
    await expect(page.locator('[data-articles-empty]')).toBeVisible()
    await expect(rows(page)).toHaveCount(0)

    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/articles?q=listed&status=PUBLISHED&page=2')
    await hydrated(page)
    await expect(page.locator('[data-articles-failed]')).toBeVisible()

    await setBackendState(page, { mode: 'ok' })
    const retryRequest = waitForArticlesRequest(page, { q: 'listed', status: 'PUBLISHED', page: '2' })
    await page.locator('[data-articles-failed] button').click()
    await retryRequest
    await listSettled(page)
    expect(new URL(page.url()).pathname).toBe('/dashboard/articles')
  })
})

test.describe('§14.9 criteria 1, 2 and 6 — the request-state contract, in a real browser', () => {
  test('a first load shows a skeleton and NO empty state, then the rows', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    // While the request is genuinely open.
    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(rows(page), 'no rows before the data resolves').toHaveCount(0)
    await expect(
      page.locator('[data-articles-empty]'),
      'an empty state must never flash before the first response'
    ).toHaveCount(0)

    await listSettled(page)
    await expect(rows(page)).not.toHaveCount(0)
  })

  test('a refresh KEEPS the rows visible instead of reverting to a skeleton', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)
    const before = await rows(page).count()
    expect(before).toBeGreaterThan(0)

    // Hold the next response open, then provoke a real revalidation of the SAME view.
    await setBackendState(page, { delayMs: 2000 })
    await page.locator('[data-articles-status]').click()
    await page.getByRole('option', { name: 'Published', exact: true }).click()

    // The defining assertion: content stays on screen WHILE the next request is in flight.
    await expect(UPDATING(page), 'an updating treatment must be shown').toBeVisible()
    await expect(rows(page), 'usable content must stay on screen during a refresh').not.toHaveCount(0)

    await setBackendState(page, { delayMs: 0 })
    await listSettled(page)
  })

  test('an error with no data offers retry, and the retry recovers', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    await expect(page.locator('[data-articles-failed]')).toBeVisible()
    await expect(rows(page)).toHaveCount(0)

    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-articles-failed] button').click()
    await listSettled(page)
    await expect(rows(page), 'retry must actually recover').not.toHaveCount(0)
  })

  test('a successful but empty result is an explicit empty state, not an error', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)

    await expect(page.locator('[data-articles-empty]')).toBeVisible()
    await expect(page.locator('[data-articles-failed]')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(0)
  })

  test('a 403 is neither an error nor an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    await expect(page.locator('[data-articles-forbidden]')).toBeVisible()
    await expect(page.locator('[data-articles-failed]')).toHaveCount(0)
    await expect(page.locator('[data-articles-empty]')).toHaveCount(0)
  })
})

/**
 * ── F-1, CLOSED HERE ────────────────────────────────────────────────────────────────────────────
 *
 * Each test plants the Arabic preference BEFORE the first paint and then asserts the 007 loading
 * system's own copy is Arabic script. Against the pre-F-1 components every one of these fails with
 * English text, which is exactly the silent defect F-1 fixed.
 */
test.describe('F-1 — the loading system speaks the DASHBOARD language, proven in the browser', () => {
  test('the SKELETON announces itself in Arabic on a cold Arabic dashboard', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL as string)
    await setBackendState(page, { delayMs: 2500 })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    const busy = page.locator('[aria-busy=true][aria-label]')
    await expect(busy).toBeVisible()

    // The accessible name is the skeleton's whole message — it is what a screen reader announces.
    const label = await busy.getAttribute('aria-label')
    expect(label, 'the skeleton must carry an accessible name').toBeTruthy()
    expect(label, 'the loading announcement must be ARABIC inside an Arabic dashboard').toMatch(ARABIC)
    expect(label, 'and must not be a raw key path').not.toMatch(/^state\./)

    await setBackendState(page, { delayMs: 0 })
  })

  test('the shared error component\'s OWN retry label is Arabic', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL as string)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    const failed = page.locator('[data-articles-failed]')
    await expect(failed).toBeVisible()

    // The RETRY LABEL, specifically, and not the message beside it. The message is supplied by the
    // page (`dashboard.articles.errorTitle`, resolved through `useDashboardI18n`), so asserting on
    // it would prove only that the PAGE is bilingual. The retry label resolves through
    // `useSurfaceI18n()` INSIDE `UiStateError`, which is the ownership boundary F-1 moved.
    expect(
      await failed.locator('button').innerText(),
      'the shared component must resolve its own copy against the DASHBOARD locale'
    ).toMatch(ARABIC)
  })

  test('the UPDATING overlay is Arabic while a refresh is in flight', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)

    await setBackendState(page, { delayMs: 2500 })
    await page.locator('[data-articles-status]').click()
    await page.getByRole('option', { name: 'مسودة', exact: true }).click()

    const overlay = UPDATING(page)
    await expect(overlay).toBeVisible()
    expect(
      await overlay.innerText(),
      'the updating treatment must speak the dashboard language, not the route locale'
    ).toMatch(ARABIC)

    await setBackendState(page, { delayMs: 0 })
    await listSettled(page)
  })

  /**
   * NOT an F-1 assertion, and labelled so deliberately.
   *
   * `UiRequestState`'s empty slot is caller-owned by design — there is no shared component behind
   * it — so this copy comes from the page's own `useDashboardI18n`. It proves the page is
   * bilingual, which is worth proving, but it would pass unchanged against the pre-F-1 code. An
   * earlier revision filed it under F-1; the negative control showed that was wrong.
   */
  test('[not F-1] the EMPTY state is Arabic, and the shell stays RTL throughout', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL as string)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expect(shell(page)).toHaveAttribute('lang', 'ar')
    expect(await page.locator('[data-articles-empty]').innerText()).toMatch(ARABIC)
    await expectNoKeyPaths(page)
  })

  test('an English dashboard is NOT Arabic — the control that makes the others meaningful', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/articles')
    await hydrated(page)

    const failed = page.locator('[data-articles-failed]')
    await expect(failed).toBeVisible()
    // Without this, a component hard-coded to Arabic would satisfy every assertion above.
    expect(
      await failed.locator('button').innerText(),
      'an English dashboard must render English'
    ).not.toMatch(ARABIC)
    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
  })
})

test.describe('accessibility, direction and 380px', () => {
  for (const locale of ['en', 'ar'] as const) {
    const expectedDir = locale === 'ar' ? 'rtl' : 'ltr'

    test(`${locale}: the shell renders ${expectedDir} on a cold load and shows no key paths`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/articles')
      await hydrated(page)
      await listSettled(page)

      await expect(shell(page)).toHaveAttribute('dir', expectedDir)
      await expect(shell(page)).toHaveAttribute('lang', locale)
      await expectNoKeyPaths(page)
    })

    test(`${locale}: does not overflow horizontally at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/articles')
      await hydrated(page)
      await listSettled(page)

      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `the document overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })

    test(`${locale}: unfiltered axe scan reports no violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/articles')
      await hydrated(page)
      await listSettled(page)

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the LOADING state is axe-clean too, not only the settled one`, async ({ page, baseURL }) => {
      // A skeleton is a live region that most a11y suites never scan, because it is gone by the
      // time the scan runs. Holding the response is what makes it scannable.
      await signIn(page, locale, baseURL as string)
      await setBackendState(page, { delayMs: 3000 })
      await page.goto('/dashboard/articles')
      await hydrated(page)
      await expect(page.locator('[aria-busy=true][aria-label]')).toBeVisible()

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])

      await setBackendState(page, { delayMs: 0 })
    })
  }

  test('an Arabic title renders inside an English dashboard without forcing the shell RTL', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await page.goto('/dashboard/articles')
    await hydrated(page)
    await listSettled(page)

    // Field content direction is independent of chrome direction — the OD-11 contract.
    await expect(shell(page), 'the shell stays LTR').toHaveAttribute('dir', 'ltr')
    const arabicSlugs = page.locator('[data-articles-table] code[dir=rtl]')
    await expect(arabicSlugs).not.toHaveCount(0)
    expect((await arabicSlugs.allInnerTexts()).join(' ')).toMatch(ARABIC)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE EDITOR — §14.9 criteria 3, 4 and 5, plus the §14.1 multilingual contract
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

const DRAFT_ID = '00000000-0000-4000-a000-000000000002'
const PUBLISHED_BOTH_ID = '00000000-0000-4000-a000-000000000001'
const EN_ONLY_ID = '00000000-0000-4000-a000-000000000003'
/** The Arabic slug fixture `articles-server.ts` already owns, so a collision can be provoked. */
const TAKEN_AR = 'الهندسة-المعمارية-المعيارية'

const tab = (page: import('@playwright/test').Page, locale: 'en' | 'ar') =>
  page.locator('[data-editor-tabs]').getByRole('tab').nth(locale === 'en' ? 0 : 1)

async function openEditor(
  page: import('@playwright/test').Page,
  baseURL: string,
  path: string,
  locale: 'en' | 'ar' = 'en'
): Promise<void> {
  await signIn(page, locale, baseURL)
  await page.goto(path)
  await hydrated(page)
}

test.describe('§14.9 criterion 3 — the editor never shows blank fields before the entity resolves', () => {
  test('renders a loading state, not an empty form, while the article is in flight', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL as string)
    await setBackendState(page, { delayMs: 2500 })
    await page.goto(`/dashboard/articles/${DRAFT_ID}`)
    await hydrated(page)

    await expect(page.locator('[data-editor-loading]')).toBeVisible()
    // THE ASSERTION THAT MATTERS. A blank editable field here invites the operator to type over
    // content that has not arrived, and then to save nothing over something real.
    await expect(page.locator('[data-editor-title="en"]'), 'no editable title before data lands').toHaveCount(0)
    await expect(page.locator('[data-editor-body="en"]')).toHaveCount(0)
    await expect(page.locator('[data-editor-save]'), 'and no save control to press').toHaveCount(0)

    await setBackendState(page, { delayMs: 0 })
    await expect(page.locator('[data-editor-title="en"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-editor-title="en"]')).toHaveValue(/Draft/)
  })

  test('an absent article says so, rather than offering an empty form', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, '/dashboard/articles/00000000-0000-4000-a000-0000000000ff')
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-title="en"]')).toHaveCount(0)
  })
})

test.describe('§14.1 — multilingual authoring', () => {
  test('shared fields appear ONCE, outside the tabs', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    // Article-level fields are not per-locale, so exactly one control each.
    await expect(page.locator('[data-editor-status]')).toHaveCount(1)
    await expect(page.locator('[data-editor-category]')).toHaveCount(1)
    await expect(page.locator('[data-editor-publish-at]')).toHaveCount(1)
    // Translated fields exist per locale.
    await expect(page.locator('[data-editor-title="en"]')).toHaveCount(1)
    await expect(page.locator('[data-editor-title="ar"]')).toHaveCount(1)
  })

  test('switching tabs PRESERVES unsaved edits in both languages', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)

    await page.locator('[data-editor-title="en"]').fill('English edit in flight')
    await tab(page, 'ar').click()
    await page.locator('[data-editor-title="ar"]').fill('تعديل عربي')
    await tab(page, 'en').click()

    await expect(
      page.locator('[data-editor-title="en"]'),
      'the English edit survived a round trip through the Arabic tab'
    ).toHaveValue('English edit in flight')

    await tab(page, 'ar').click()
    await expect(page.locator('[data-editor-title="ar"]')).toHaveValue('تعديل عربي')
  })

  test('the tabs are REAL ARIA tabs, reachable and operable from the keyboard', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    const tabs = page.locator('[data-editor-tabs]').getByRole('tab')
    await expect(tabs).toHaveCount(2)

    await tab(page, 'en').click()
    await expect(tab(page, 'en')).toHaveAttribute('aria-selected', 'true')
    // Arrow-key navigation is the tab pattern's contract, not a nicety.
    await page.keyboard.press('ArrowRight')
    await expect(tab(page, 'ar')).toHaveAttribute('aria-selected', 'true')
  })

  test('MIXED DIRECTION in one form — fields own content direction while panels keep chrome direction', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    await expect(page.locator('[data-editor-panel="en"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-editor-panel="ar"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-editor-title="en"]')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('[data-editor-title="ar"]')).toHaveAttribute('dir', 'rtl')
  })

  test('the completeness indicator reads the real translation state', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${EN_ONLY_ID}`)
    await expect(page.locator('[data-editor-tab-fill="en:complete"]')).toBeVisible()
    // This fixture has no Arabic at all, and the badge must say so rather than look complete.
    await expect(page.locator('[data-editor-tab-fill="ar:empty"]')).toBeVisible()
  })

  test('the DASHBOARD locale seeds the initial tab (OD-9)', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`, 'ar')
    await expect(
      tab(page, 'ar'),
      'an Arabic dashboard opens on the Arabic tab'
    ).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('§14.9 criterion 4 — saving', () => {
  test('the submitting state belongs to the ACTION, and a double click sends ONE request', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    await page.locator('[data-editor-title="en"]').fill('A new heading')

    let writes = 0
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/admin/articles/')) writes += 1
    })

    // The write is HELD OPEN — the only condition under which a duplicate-submission guard is
    // actually exercised. Against an instant backend the second click lands after the first has
    // resolved and the test passes whether or not the guard exists.
    await setBackendState(page, { delayMs: 1500 })
    const save = page.locator('[data-editor-save]')
    await save.click()

    // Loading is on the action, not on a page-blocking screen: the rest of the form stays live.
    await expect(save).toBeDisabled()
    await expect(page.locator('[data-editor-title="en"]'), 'the form context is preserved').toBeVisible()

    await save.click({ force: true }).catch(() => undefined)
    await expect(save).toBeEnabled({ timeout: 15_000 })

    expect(writes, 'a held save must not be submitted twice').toBe(1)
    await expect(page.locator('[data-editor-save-state="saved"]')).toBeVisible()
    await setBackendState(page, { delayMs: 0 })
  })

  test('a failed save keeps the operator\'s input on screen', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    await page.locator('[data-editor-title="en"]').fill('Words worth keeping')
    await setBackendState(page, { failNextWrite: true })

    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-save-error]')).toBeVisible()
    // Discarding edits it cannot prove were stored is the one outcome a content editor must
    // never produce.
    await expect(page.locator('[data-editor-title="en"]')).toHaveValue('Words worth keeping')
  })

  test('creating an article lands on its own URL and stops being a create form', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, '/dashboard/articles/new')

    await page.locator('[data-editor-category]').click()
    await page.getByRole('option').first().click()
    await page.locator('[data-editor-title="en"]').fill('A brand new article')
    await page.locator('[data-editor-slug="en"]').fill('a-brand-new-article')
    await page.locator('[data-editor-excerpt="en"]').fill('An excerpt.')
    await page.locator('[data-editor-body="en"]').fill('# Body\n\nText.')

    await page.locator('[data-editor-save]').click()
    await page.waitForURL(/\/dashboard\/articles\/[0-9a-f-]{36}$/)
    await expect(page.locator('[data-editor-title="en"]')).toHaveValue('A brand new article')
    // A delete control only exists once there is something to delete.
    await expect(page.locator('[data-editor-delete]')).toBeVisible()
  })
})

/**
 * THE MAPPING TEST §14.1 CALLS THE DISCRIMINATING ONE.
 *
 * Writes send `translations` as an ARRAY and the API answers `translations[N].slug`. The error is
 * seeded in the INACTIVE locale on purpose: a hidden tab must never swallow it, and an
 * implementation that assumed a fixed locale order would put an Arabic collision on the English tab
 * — against a field that looks fine, with nothing the operator could act on.
 */
test.describe('§14.1 — a validation error in an INACTIVE locale tab', () => {
  test('surfaces on the ARABIC tab, marks that tab invalid, and activates it', async ({ page, baseURL }) => {
    // Opened in ENGLISH, so Arabic is the inactive tab when the error arrives.
    await openEditor(page, baseURL as string, '/dashboard/articles/new', 'en')

    await page.locator('[data-editor-category]').click()
    await page.getByRole('option').first().click()

    await page.locator('[data-editor-title="en"]').fill('Fine in English')
    await page.locator('[data-editor-slug="en"]').fill('fine-in-english')
    await page.locator('[data-editor-excerpt="en"]').fill('e')
    await page.locator('[data-editor-body="en"]').fill('b')

    // Arabic is complete but its slug is already taken — a REAL 422 from the store.
    await tab(page, 'ar').click()
    await page.locator('[data-editor-title="ar"]').fill('عنوان')
    await page.locator('[data-editor-slug="ar"]').fill(TAKEN_AR)
    await page.locator('[data-editor-excerpt="ar"]').fill('مقتطف')
    await page.locator('[data-editor-body="ar"]').fill('نص')

    // Back to English, so the offending locale is genuinely hidden at submit time.
    await tab(page, 'en').click()
    await expect(tab(page, 'en')).toHaveAttribute('aria-selected', 'true')

    await page.locator('[data-editor-save]').click()

    // The summary names the LANGUAGE, so the problem is discoverable without opening tabs.
    const summary = page.locator('[data-editor-error-summary]')
    await expect(summary).toBeVisible()

    // The Arabic tab is marked invalid — and the English one is NOT.
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(
      page.locator('[data-editor-tab-invalid="en"]'),
      'the English tab is fine and must not be blamed'
    ).toHaveCount(0)

    // And the operator is taken to it.
    await expect(tab(page, 'ar')).toHaveAttribute('aria-selected', 'true')
    // The message is attached to the Arabic SLUG field, not to some other input.
    await expect(page.locator('[data-editor-slug="ar"]')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-editor-slug="en"]')).not.toHaveAttribute('aria-invalid', 'true')
  })

  /**
   * THE CASE THAT ACTUALLY DISCRIMINATES THE ORDERING, and it is reachable in the product.
   *
   * The test above sends BOTH locales, and `articlePayloadLocales` emits them in canonical order —
   * so `translations[1]` is Arabic under a correct implementation AND under one that assumed the
   * canonical order. It proves the wiring, not the ordering.
   *
   * An ARABIC-ONLY article is the discriminating shape: the payload carries one entry, so the API
   * answers `translations[0].slug`, and index 0 is ARABIC. An implementation that resolved indices
   * against the canonical locale list would attach that to the ENGLISH slug — a field the operator
   * left deliberately empty, with the real problem invisible on the other tab.
   */
  test('an ARABIC-ONLY article maps translations[0] to ARABIC, not to English', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, '/dashboard/articles/new', 'en')

    await page.locator('[data-editor-category]').click()
    await page.getByRole('option').first().click()

    // English is left entirely empty — so the payload has exactly ONE translation, the Arabic one.
    await tab(page, 'ar').click()
    await page.locator('[data-editor-title="ar"]').fill('عنوان عربي فقط')
    await page.locator('[data-editor-slug="ar"]').fill(TAKEN_AR)
    await page.locator('[data-editor-excerpt="ar"]').fill('مقتطف')
    await page.locator('[data-editor-body="ar"]').fill('نص')

    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
    await expect(page.locator('[data-editor-slug="ar"]')).toHaveAttribute('aria-invalid', 'true')
    await expect(
      page.locator('[data-editor-slug="en"]'),
      'the English slug was never written and must not be blamed'
    ).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-tab-invalid="en"]')).toHaveCount(0)
  })
})

test.describe('§14.9 criterion 5 — destructive action', () => {
  test('needs a deliberate confirmation, and its loading is action-local', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)

    // One click does not delete.
    await page.locator('[data-editor-delete]').click()
    await expect(page.locator('[data-editor-delete-confirm]')).toBeVisible()
    await expect(page.locator('[data-editor-title="en"]'), 'the form is still live').toBeVisible()

    // Backing out leaves the article alone.
    await page.locator('[data-editor-delete-cancel]').click()
    await expect(page.locator('[data-editor-delete-confirm]')).toHaveCount(0)

    await page.locator('[data-editor-delete]').click()
    await page.locator('[data-editor-delete-confirm]').click()
    await page.waitForURL('**/dashboard/articles')
    await listSettled(page)
    // The row is really gone.
    await expect(page.locator(`[data-article-row="${DRAFT_ID}"]`)).toHaveCount(0)
  })
})

test.describe('OD-8 — the unsaved-changes guard', () => {
  test('challenges an in-app navigation away from unsaved work, and honours the answer', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    await page.locator('[data-editor-title="en"]').fill('Something not yet saved')

    // DISMISS: the operator stays, and the edit is still there.
    page.once('dialog', dialog => void dialog.dismiss())
    await page.locator('[data-editor-back]').click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/articles/${DRAFT_ID}$`))
    await expect(page.locator('[data-editor-title="en"]')).toHaveValue('Something not yet saved')

    // ACCEPT: the operator leaves.
    page.once('dialog', dialog => void dialog.accept())
    await page.locator('[data-editor-back]').click()
    await page.waitForURL('**/dashboard/articles')
  })

  test('does NOT challenge a clean form — the guard must not cry wolf', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)

    let asked = false
    page.on('dialog', (dialog) => { asked = true; void dialog.accept() })
    await page.locator('[data-editor-back]').click()
    await page.waitForURL('**/dashboard/articles')

    expect(asked, 'an untouched form must navigate without a prompt').toBe(false)
  })

  test('does NOT challenge the redirect it performs itself after a successful save', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, '/dashboard/articles/new')

    await page.locator('[data-editor-category]').click()
    await page.getByRole('option').first().click()
    await page.locator('[data-editor-title="en"]').fill('Saved then redirected')
    await page.locator('[data-editor-slug="en"]').fill('saved-then-redirected')
    await page.locator('[data-editor-excerpt="en"]').fill('e')
    await page.locator('[data-editor-body="en"]').fill('b')

    let asked = false
    page.on('dialog', (dialog) => { asked = true; void dialog.accept() })
    await page.locator('[data-editor-save]').click()
    await page.waitForURL(/\/dashboard\/articles\/[0-9a-f-]{36}$/)

    // Challenging the operator on the redirect they just earned is the guard firing on exactly the
    // case it exists to allow.
    expect(asked, 'the post-save redirect must not be challenged').toBe(false)
  })
})

test.describe('§14.2 — the contextual public action', () => {
  test('offers View on site for a published article, at the LOCALE-AWARE route', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${PUBLISHED_BOTH_ID}`, 'en')
    const link = page.locator('[data-editor-view-public]')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/blog/a-modular-monolith-in-practice')

    // Switching to the Arabic tab points it at the ARABIC public route, not the English one.
    await tab(page, 'ar').click()
    await expect(link).toHaveAttribute('href', /^\/ar\/blog\//)
  })

  test('offers PREVIEW for a draft, and no public link', async ({ page, baseURL }) => {
    await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`)
    await expect(page.locator('[data-editor-view-public]')).toHaveCount(0)
    await expect(page.locator('[data-editor-preview]')).toBeVisible()
  })

  test('offers NEITHER for a published article in a language it does not have', async ({ page, baseURL }) => {
    // PUBLISHED, but English-only. `GET /articles/{slug}` resolves per locale, so the Arabic route
    // would 404 — and §14.2 forbids linking an operator to a 404.
    await openEditor(page, baseURL as string, `/dashboard/articles/${EN_ONLY_ID}`, 'en')
    await expect(page.locator('[data-editor-view-public]')).toBeVisible()

    await tab(page, 'ar').click()
    await expect(
      page.locator('[data-editor-view-public]'),
      'no public link for a language the article does not have'
    ).toHaveCount(0)
  })
})

test.describe('the editor in both languages, at 380px, with axe', () => {
  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: unfiltered axe scan reports no violations`, async ({ page, baseURL }) => {
      await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`, locale)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: does not overflow horizontally at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`, locale)
      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `the editor overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })

    test(`${locale}: the primary actions stay reachable, and no key path shows`, async ({ page, baseURL }) => {
      await openEditor(page, baseURL as string, `/dashboard/articles/${DRAFT_ID}`, locale)
      // Sticky, so Save is in reach from anywhere in a long article rather than only after
      // scrolling past a 16-row body field. Scrolled by the DOCUMENT rather than to a named panel:
      // in Arabic the initial tab is Arabic, so the English panel is hidden and cannot be scrolled
      // to at all — the earlier version of this test timed out on exactly that.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await expect(page.locator('[data-editor-save]')).toBeInViewport()
      await expectNoKeyPaths(page)
    })
  }
})
