import { expect, test } from '@playwright/test'
import {
  API_ORDER,
  EXP,
  NARROW,
  expectNoKeyPaths,
  listSettled,
  resetBackend,
  rows,
  setBackendState,
  shell,
  signIn
} from './harness'

/**
 * The Experiences collection in a real browser (FE-3 module 1, `M1·U2`).
 *
 * ⚠ ONE SPEC FILE, and that is an INVARIANT rather than a preference. This lane is
 * `resetsBackendState: true`, which means a dedicated process pair AND exactly one spec file:
 * `workers` is a top-level Playwright option and `fullyParallel: false` only serialises tests
 * WITHIN a file, so a second file would land on a second worker and the two would reset each
 * other's fixtures mid-assertion. `scripts/e2e/lane-isolation.spec.mjs` asserts this.
 *
 * What this lane can prove that no unit test can: that the ORDER the operator actually sees is the
 * API's, through a real Nitro render and a real HTTP response.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('the collection', () => {
  test('renders every role in the API order, current-role-first', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    /**
     * ⚠ THE FULL SEQUENCE, not just the head.
     *
     * A `startDate desc` sort — the natural way to write a CV list, and the one that shipped an
     * ended role above the current one to the live site — produces `endedLater` first here. A test
     * that only asserted "the current role is first" would still pass against a sort that is wrong
     * further down, so the whole order is pinned.
     */
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-experience-row')))
    expect(ids).toEqual([...API_ORDER])
  })

  test('marks the current role, and only that one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator(`[data-experience-current="${EXP.current}"]`)).toBeVisible()
    await expect(page.locator(`[data-experience-current="${EXP.endedLater}"]`)).toHaveCount(0)
  })

  test('reports an English-only role as missing its Arabic, without substituting it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    const row = page.locator(`[data-experience-row="${EXP.enOnly}"]`)
    await expect(row.locator('[data-experience-translation="en:present"]')).toBeVisible()
    await expect(row.locator('[data-experience-translation="ar:missing"]')).toBeVisible()
  })

  test('states each role\'s linked skill count, including zero', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    // `current` holds three skills; `noSkills` holds none — so "cleared" stays distinguishable
    // from "never had any" on the surface the operator reads.
    await expect(page.locator(`[data-experience-row="${EXP.current}"] [data-experience-skills="3"]`)).toBeVisible()
    await expect(page.locator(`[data-experience-row="${EXP.noSkills}"] [data-experience-skills="0"]`)).toBeVisible()
  })
})

test.describe('the request states, made observable by delayMs', () => {
  /**
   * The skeleton is only on screen while a request is genuinely in flight. Without `delayMs` the
   * response returns before the first paint and this assertion passes without the state ever
   * having rendered — which is the whole reason a mutable, latency-controllable backend exists.
   */
  test('shows a skeleton on a first load, not an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/experiences')

    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)

    await listSettled(page)
    await expect(rows(page).first()).toBeVisible()
  })

  test('shows the deliberate empty state, with its own create action', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-empty]')).toBeVisible()
    await expect(page.locator('[data-experiences-failed]')).toHaveCount(0)
  })

  test('shows an error with a retry when the first load fails', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-failed]')).toBeVisible()
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)
  })

  test('answers a 403 as forbidden — neither an error nor an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-forbidden]')).toBeVisible()
    await expect(page.locator('[data-experiences-failed]')).toHaveCount(0)
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)
  })

  /**
   * ⚠ §10.3 rule 2's KEEP branch is NOT REACHABLE IN A BROWSER FOR THIS MODULE, and that is a
   * consequence of the contract rather than a gap in this lane.
   *
   * "A failed REFRESH keeps the rows" requires a SECOND request for the same view. The Articles
   * lane can produce one, because Articles has a status filter and pagination — real in-page
   * controls that re-request. `GET /admin/experiences` takes ZERO query parameters, so this page
   * has no control that issues a second load, and the only other route to one is a full navigation,
   * which is a FIRST load with nothing underneath it (already covered above as the error case).
   *
   * A test that reloaded the page and then asserted the error state would LOOK like it proved the
   * keep branch while actually re-proving the clear branch under a misleading name. The property is
   * proven where it is genuinely observable — `useAdminExperiences.spec.ts`, "KEEPS the rows when a
   * refresh fails after a successful load".
   */
})

test.describe('bilingual, at the narrowest supported width', () => {
  test('renders Arabic chrome RTL on a COLD load, with no raw key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    // The preference is planted BEFORE the first navigation: a post-load toggle would prove only
    // that the switcher works, while the property under test is that a stored preference is
    // honoured at BOOT.
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expectNoKeyPaths(page)
    // The order is a SERVER property and must not change with the chrome language.
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-experience-row')))
    expect(ids).toEqual([...API_ORDER])
  })

  test('renders English chrome LTR with no raw key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
    await expectNoKeyPaths(page)
  })
})
