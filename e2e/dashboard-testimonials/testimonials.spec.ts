import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  API_ORDER,
  AVATAR,
  CREATED_ID,
  NARROW,
  OUT_OF_SEQUENCE_IDS,
  OUT_OF_SEQUENCE_ROWS,
  TESTIMONIAL,
  editorSettled,
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   `T·U3` — THE EDITOR, in the same lane and the SAME SPEC FILE.

   This lane is `resetsBackendState: true`, which serialises it only while it is ONE spec file —
   so the editor's browser coverage joins this file rather than starting a second one. Selection is
   by structure (`[data-editor-*]`), never by rendered copy.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

test.describe('the editor — create', () => {
  async function openNew(page: import('@playwright/test').Page, baseURL: string): Promise<void> {
    await signIn(page, 'en', baseURL)
    await page.goto('/dashboard/testimonials/new')
    await editorSettled(page)
  }

  test('creates Arabic-first', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
    await page.locator('[data-editor-quote="ar"]').fill('عمل ممتاز من فريق رائع.')
    await page.locator('[data-editor-author="ar"]').fill('أمينة خالد')
    await page.locator('[data-editor-role="ar"]').fill('مديرة المنتج')
    await page.locator('[data-editor-save]').click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/testimonials/${CREATED_ID}$`))
  })

  test('creates English-first', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    await page.locator('[data-editor-quote="en"]').fill('Outstanding delivery under pressure.')
    await page.locator('[data-editor-author="en"]').fill('Casey Jones')
    await page.locator('[data-editor-role="en"]').fill('COO, Acme')
    await page.locator('[data-editor-save]').click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/testimonials/${CREATED_ID}$`))
  })

  test('blocks a zero-translation save client-side — nothing reaches the wire', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    // ⚠ DISCRIMINATING BY CONSTRUCTION. The API also rejects an empty translations array with a
    // 422, so asserting only "a summary appears" would pass on the server's backstop alone and
    // prove nothing about the frontend's OD-14 guard. The invariant is that NO request is sent.
    const createRequests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/v1/admin/testimonials')) {
        createRequests.push(request.url())
      }
    })

    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard\/testimonials\/new$/)
    expect(createRequests, 'an unguarded save reached the API').toEqual([])
  })

  for (const attempt of [
    { label: 'negative', value: '-1' },
    { label: 'fractional', value: '2.75' }
  ]) {
    test(`blocks an ${attempt.label} order from ever reaching the wire`, async ({ page, baseURL }) => {
      await openNew(page, baseURL!)
      await page.locator('[data-editor-quote="en"]').fill('Valid quote.')
      await page.locator('[data-editor-author="en"]').fill('Casey Jones')
      await page.locator('[data-editor-role="en"]').fill('COO, Acme')
      await page.locator('[data-editor-order]').fill(attempt.value)

      const sentOrders: number[] = []
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes('/api/v1/admin/testimonials')) {
          sentOrders.push(JSON.parse(request.postData() ?? '{}').order)
        }
      })

      await page.locator('[data-editor-save]').click()
      // Two defenses stand between the operator and the wire: the control's own floor/step clamps
      // what the FORM can hold, and the Zod refinement blocks anything else client-side. Which one
      // fires is irrelevant to the contract — assert the INVARIANT: the save either lands with an
      // in-contract order, or is blocked outright with nothing sent.
      const outcome = await Promise.race([
        page.waitForURL(new RegExp(`/dashboard/testimonials/${CREATED_ID}$`)).then(() => 'saved'),
        page.locator('[data-editor-error-summary]').waitFor().then(() => 'blocked')
      ])
      expect(['saved', 'blocked']).toContain(outcome)
      for (const order of sentOrders) {
        expect(Number.isInteger(order), `${attempt.label} order ${order} left the form`).toBe(true)
        expect(order, `${attempt.label} order ${order} reached the API`).toBeGreaterThanOrEqual(0)
      }
    })
  }

  test('maps an intercepted translations[i].locale 422 onto the SENT array\'s locale tab', async ({ page, baseURL }) => {
    await openNew(page, baseURL!)
    // Both locales authored, English sent first: index 1 of the sent array is ARABIC. Inactive
    // tab panels stay mounted but HIDDEN, so each locale is filled under its own tab.
    for (const locale of ['en', 'ar'] as const) {
      if (locale !== 'en') {
        await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
      }
      await page.locator(`[data-editor-quote="${locale}"]`).fill(`Quote ${locale}.`)
      await page.locator(`[data-editor-author="${locale}"]`).fill(`Author ${locale}`)
      await page.locator(`[data-editor-role="${locale}"]`).fill(`Role ${locale}`)
    }
    await page.route('**/api/v1/admin/testimonials', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/problems/validation',
          title: 'Validation failed',
          status: 422,
          errors: [{ field: 'translations[1].locale', message: 'locale must be a two-letter lowercase locale.' }]
        })
      })
    })
    await page.locator('[data-editor-save]').click()
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-panel="ar"]')).toBeVisible()
    await page.unroute('**/api/v1/admin/testimonials')
  })
})

test.describe('the editor — edit', () => {
  async function openEdit(page: import('@playwright/test').Page, baseURL: string): Promise<void> {
    await signIn(page, 'en', baseURL)
    await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`)
    await editorSettled(page)
  }

  test('loads both existing translations correctly', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    await expect(page.locator('[data-editor-quote="en"]')).toHaveValue('The team turned a difficult brief into a dependable product.')
    await expect(page.locator('[data-editor-author="en"]')).toHaveValue('Alex Morgan')
    await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
    await expect(page.locator('[data-editor-quote="ar"]')).toHaveValue('حوّل الفريق متطلبات معقدة إلى منتج يمكن الاعتماد عليه.')
    await expect(page.locator('[data-editor-author="ar"]')).toHaveValue('أليكس مورغان')
  })

  test('OMITS avatarId from PATCH when untouched — the linked asset is preserved by omission', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    // The picker resolved the stored avatar, proving the read side; nothing touches it below.
    await expect(page.locator('[data-picker-filename]')).toContainText('avatar-alex.webp')

    const patchPromise = page.waitForRequest(
      request => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    )
    await page.locator('[data-editor-order]').fill('7')
    await page.locator('[data-editor-save]').click()
    const body = JSON.parse((await patchPromise).postData() ?? '{}')
    expect(body).not.toHaveProperty('avatarId')
  })

  test('an explicit clear sends avatarId null; choosing another asset sends its id', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)

    let patchPromise = page.waitForRequest(
      request => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    )
    await page.locator('[data-picker-clear]').click()
    await page.locator('[data-editor-save]').click()
    expect(JSON.parse((await patchPromise).postData() ?? '{}')).toHaveProperty('avatarId', null)

    // Replace: pick the spare asset from the library dialog and save — the new id travels.
    await page.locator('[data-picker-open]').click()
    await page.locator(`[data-media-id="${AVATAR.replacement}"]`).click()
    patchPromise = page.waitForRequest(
      request => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    )
    await page.locator('[data-editor-save]').click()
    expect(JSON.parse((await patchPromise).postData() ?? '{}'))
      .toHaveProperty('avatarId', AVATAR.replacement)
  })

  test('upsert changes only the supplied locale — the other survives untouched', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    const patchPromise = page.waitForRequest(
      request => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    )
    await page.locator('[data-editor-quote="en"]').fill('Edited English quote.')
    await page.locator('[data-editor-save]').click()
    const body = JSON.parse((await patchPromise).postData() ?? '{}')
    expect(body.translations.map((entry: { locale: string }) => entry.locale).sort()).toEqual(['ar', 'en'])

    // Reload through the real backend: the edited English arrived AND the untouched Arabic is
    // byte-identical to what was loaded.
    await page.reload()
    await editorSettled(page)
    await expect(page.locator('[data-editor-quote="en"]')).toHaveValue('Edited English quote.')
    await expect(page.locator('[data-editor-author="ar"]')).toHaveValue('أليكس مورغان')
    await expect(page.locator('[data-editor-quote="ar"]')).toHaveValue('حوّل الفريق متطلبات معقدة إلى منتج يمكن الاعتماد عليه.')
  })

  test('clearing a locale in the form NEVER clears it server-side — omission is not replace-all', async ({ page, baseURL }) => {
    await openEdit(page, baseURL!)
    const patchPromise = page.waitForRequest(
      request => request.method() === 'PATCH' && request.url().includes(`/api/v1/admin/testimonials/${TESTIMONIAL.featured}`)
    )
    // The Arabic panel is hidden until its tab is active.
    await page.locator('[data-editor-tabs] button').filter({ hasText: 'Arabic' }).click()
    await page.locator('[data-editor-quote="ar"]').fill('')
    await page.locator('[data-editor-author="ar"]').fill('')
    await page.locator('[data-editor-role="ar"]').fill('')
    await page.locator('[data-editor-save]').click()
    const body = JSON.parse((await patchPromise).postData() ?? '{}')
    // Upsert semantics: the incomplete locale drops out of the sent array instead of being wiped.
    expect(body.translations.map((entry: { locale: string }) => entry.locale)).toEqual(['en'])

    await page.reload()
    await editorSettled(page)
    await expect(page.locator('[data-editor-quote="ar"]')).toHaveValue('حوّل الفريق متطلبات معقدة إلى منتج يمكن الاعتماد عليه.')
  })

  test('deletes with confirmation and lands back on the collection without the row', async ({ page, baseURL }) => {
    // openEdit loads the FEATURED fixture; that is the row this test deletes.
    await openEdit(page, baseURL!)
    await page.locator('[data-editor-delete]').click()
    await page.locator('[data-editor-delete-confirm]').click()
    await expect(page).toHaveURL(/\/dashboard\/testimonials$/)
    await listSettled(page)
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator(`[data-testimonial-row="${TESTIMONIAL.featured}"]`)).toHaveCount(0)
  })

  test('renders the established not-found and failed-load states', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/testimonials/not-a-uuid')
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-unreadable]')).toContainText('does not exist')

    await setBackendState(page, { mode: 'error' })
    await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`)
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-unreadable]')).toContainText('could not be loaded')
  })

  test('shows content-shaped loading while the detail read is held', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`)
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await setBackendState(page, { delayMs: 0 })
    await editorSettled(page)
    await expect(page.locator('[data-testimonial-editor-ready]')).toBeVisible()
  })
})

/* ── T·U3 accessibility — focused, per locale, settled AND loading editor states ──────────────── */

for (const locale of ['en', 'ar'] as const) {
  test.describe(`editor a11y · ${locale}`, () => {
    test(`${locale}: the EDITOR reports no axe violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`)
      await hydrated(page)
      await editorSettled(page)

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the EDITOR does not overflow at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL as string)
      // COLD load with the preference planted before first paint, mirroring the bilingual suite.
      await page.goto(`/dashboard/testimonials/${TESTIMONIAL.featured}`)
      await hydrated(page)
      await editorSettled(page)

      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      await expect(shell(page)).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoKeyPaths(page)
      // Field direction is INDEPENDENT of chrome direction.
      await expect(page.locator('[data-editor-panel="ar"]')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-editor-panel="en"]')).toHaveAttribute('dir', 'ltr')

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `the editor overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  })
}
