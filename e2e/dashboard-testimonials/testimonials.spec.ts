import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  API_ORDER,
  AVATAR,
  NARROW,
  OUT_OF_SEQUENCE_IDS,
  OUT_OF_SEQUENCE_ROWS,
  TESTIMONIAL,
  expectNoKeyPaths,
  listSettled,
  resetBackend,
  rows,
  setBackendState,
  shell,
  signIn
} from './harness'

/**
 * The Testimonials collection in a real browser (FE-3 module 3, `T·U2`).
 *
 * ⚠ ONE SPEC FILE, and that is an INVARIANT rather than a preference. This lane is
 * `resetsBackendState: true`, which means a dedicated process pair AND exactly one spec file:
 * `workers` is a top-level Playwright option and `fullyParallel: false` only serialises tests
 * WITHIN a file, so a second file would land on a second worker and the two would reset each
 * other's fixtures mid-assertion. `scripts/e2e/lane-isolation.spec.mjs` asserts this.
 *
 * What this lane can prove that no unit test can: that the ORDER the operator actually sees is the
 * API's — including against fixtures whose `order` values run out of sequence, where any client-side
 * sort would reverse the rows and fail here instead of in Production.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('the collection', () => {
  test('renders every returned testimonial in the server order, unpaginated and unfiltered', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    // ⚠ THE FULL SEQUENCE, not just the head — a sort that is wrong further down still gets the
    // first row right, so the whole order is pinned.
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-testimonial-row')))
    expect(ids).toEqual([...API_ORDER])
    expect(ids).toHaveLength(4)
    await expect(page.locator('[data-testimonials-pagination]')).toHaveCount(0)
    await expect(page.locator('[data-testimonials-filter]')).toHaveCount(0)
  })

  test('keeps the SERVER order when order values run out of sequence', async ({ page, baseURL }) => {
    // Replace the seed with the discriminating fixture BEFORE the page requests it.
    await setBackendState(page, { testimonials: OUT_OF_SEQUENCE_ROWS })
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    // Received order [C, A, B]. Sorting by `order` (10/30/40) would read [B, A, C]; either way this
    // assertion names the defect instead of passing by coincidence with a monotonic seed.
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-testimonial-row')))
    expect(ids).toEqual([...OUT_OF_SEQUENCE_IDS])
  })

  test('presents visibility, order and the nullable avatar from the stored record alone', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    // Exactly one hidden row — read off `isVisible`, never re-derived.
    await expect(page.locator(`[data-testimonial-row="${TESTIMONIAL.hidden}"] [data-testimonial-visible="false"]`)).toBeVisible()
    for (const id of [TESTIMONIAL.featured, TESTIMONIAL.enOnly, TESTIMONIAL.noAvatar]) {
      await expect(page.locator(`[data-testimonial-row="${id}"] [data-testimonial-visible="true"]`)).toBeVisible()
    }

    // Order values are DATA on the row; they imply no sorting policy.
    await expect(page.locator(`[data-testimonial-order="${TESTIMONIAL.featured}"]`)).toHaveText('0')
    await expect(page.locator(`[data-testimonial-order="${TESTIMONIAL.noAvatar}"]`)).toHaveText('3')

    // `avatarId` nullable: linked ids are shown as data, nulls as their own state — never an image
    // fetch invented from an id the list does not resolve.
    await expect(page.locator(`[data-testimonial-avatar="${AVATAR.featured}"]`)).toBeVisible()
    await expect(page.locator(`[data-testimonial-avatar="none"]`).first()).toBeVisible()
  })

  test('reports an English-only testimonial as missing its Arabic, without substituting it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    const row = page.locator(`[data-testimonial-row="${TESTIMONIAL.enOnly}"]`)
    await expect(row.locator('[data-testimonial-translation="en:present"]')).toBeVisible()
    await expect(row.locator('[data-testimonial-translation="ar:missing"]')).toBeVisible()
    // Fully translated rows show both locales present.
    const featured = page.locator(`[data-testimonial-row="${TESTIMONIAL.featured}"]`)
    await expect(featured.locator('[data-testimonial-translation="en:present"]')).toBeVisible()
    await expect(featured.locator('[data-testimonial-translation="ar:present"]')).toBeVisible()
  })
})

test.describe('the request states, made observable by delayMs', () => {
  test('shows content-shaped loading during a held first request, not an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/testimonials')

    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-testimonials-empty]')).toHaveCount(0)

    await listSettled(page)
    await expect(rows(page).first()).toBeVisible()
  })

  test('shows the deliberate empty state for a successful empty collection', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    await expect(page.locator('[data-testimonials-empty]')).toBeVisible()
    await expect(page.locator('[data-testimonials-failed]')).toHaveCount(0)
  })

  test('shows error rather than empty on transport failure, and retry recovers', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    await expect(page.locator('[data-testimonials-failed]')).toBeVisible()
    await expect(page.locator('[data-testimonials-empty]')).toHaveCount(0)

    // Retry against a recovered backend lands on real rows — the control works, not merely exists.
    await setBackendState(page, { mode: 'ok' })
    await hydrated(page)
    await page.locator('[data-testimonials-failed]').getByRole('button').click()
    await listSettled(page)
    await expect(rows(page)).toHaveCount(4)
  })

  test('answers a 403 as forbidden — neither an error nor an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    await expect(page.locator('[data-testimonials-forbidden]')).toBeVisible()
    await expect(page.locator('[data-testimonials-failed]')).toHaveCount(0)
    await expect(page.locator('[data-testimonials-empty]')).toHaveCount(0)
  })

  test('the collection reads only the admin endpoint — no public testimonials request leaks in', async ({ page, baseURL }) => {
    const publicRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/testimonials')) publicRequests.push(request.url())
    })

    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials')
    await listSettled(page)

    expect(publicRequests, 'the dashboard collection fetched the PUBLIC testimonials endpoint').toEqual([])
  })
})

test.describe('bilingual, at the narrowest supported width', () => {
  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: correct direction at 380px, no raw key paths, server order unchanged`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      // The preference is planted BEFORE the first navigation: the property under test is that a
      // stored preference is honoured at BOOT.
      await signIn(page, locale, baseURL!)
      await page.goto('/dashboard/testimonials')
      await listSettled(page)

      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoKeyPaths(page)

      // The order is a SERVER property and must not change with the chrome language.
      const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-testimonial-row')))
      expect(ids).toEqual([...API_ORDER])

      // Assert the viewport actually applied before measuring against it.
      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `the collection overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }
})

/* ── ACCESSIBILITY — focused, per locale, settled AND loading states ──────────────────────────── */

for (const locale of ['en', 'ar'] as const) {
  test.describe(`a11y · ${locale}`, () => {
    test(`${locale}: the collection reports no axe violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/testimonials')
      await hydrated(page)
      await listSettled(page)

      // Unfiltered: no rule disabled, no selector excluded.
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the collection's LOADING state is axe-clean too`, async ({ page, baseURL }) => {
      // A skeleton is a live region most a11y suites never scan, because it is gone by the time the
      // scan runs. Holding the response is what makes it scannable at all.
      await signIn(page, locale, baseURL as string)
      await setBackendState(page, { delayMs: 3000 })
      await page.goto('/dashboard/testimonials')
      await hydrated(page)
      await expect(page.locator('[aria-busy=true]').first()).toBeVisible()

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])

      await setBackendState(page, { delayMs: 0 })
    })
  })
}
