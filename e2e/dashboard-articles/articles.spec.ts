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
    await expect(rows(page).first()).toBeVisible()
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
    await expect(rows(page).first()).toBeVisible()
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
    await expect(rows(page).first(), 'usable content must stay on screen during a refresh').toBeVisible()

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
    await expect(rows(page).first(), 'retry must actually recover').toBeVisible()
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

    const busy = page.locator('[aria-busy=true]').first()
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
    // By INDEX, not by name: the labels are Arabic here, and the property under test is the
    // OVERLAY's language rather than the option's. `DRAFT` is the second entry after `all`.
    await page.getByRole('option').nth(1).click()

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
      await expect(page.locator('[aria-busy=true]').first()).toBeVisible()

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
    const arabicSlug = page.locator('[data-article-row] span[dir=rtl]').first()
    await expect(arabicSlug).toBeVisible()
    expect(await arabicSlug.innerText()).toMatch(ARABIC)
  })
})
