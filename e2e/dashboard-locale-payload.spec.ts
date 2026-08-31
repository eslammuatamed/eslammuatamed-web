import { expect, test } from '@playwright/test'

/**
 * A visitor's Dashboard language preference must NOT reach a public page's SSR payload.
 *
 * ## The defect this exists for, which was real and measured
 *
 * `app.vue` resolves the Nuxt UI locale pack for both worlds, so it reads the Dashboard application
 * locale on EVERY route — public ones included, and those DO server-render. Seeded from the cookie
 * on the server, the value landed in `__NUXT_DATA__`; `payloadExtraction: 'client'` (nuxt.config)
 * inlines that payload into the HTML; and `swr: 60` then caches that HTML and serves it to the NEXT
 * visitor. Measured on the built server before the fix: `/about` requested with
 * `Cookie: dashboard_locale=ar` serialized `'ar'` at the state slot, and with `en` it serialized
 * `'en'`. One visitor's preference, baked into a cached page for everyone.
 *
 * ## Why this test is shaped the way it is
 *
 * **It sends the cookie.** Asserting `'en'` on a request with no cookie passes against the broken
 * build too — the default and the leak look identical when nothing is set. Sending `ar` is what
 * makes the assertion able to fail.
 *
 * **It reads the RAW HTML, not the page.** The client re-seeds from the real cookie on the first
 * access after hydration, which is correct behaviour and would mask the defect entirely if this
 * asserted on a live page's state. The bytes the SERVER emitted are the thing under test.
 *
 * **It dereferences the payload slot.** Nuxt serializes state as a key→index map into a value
 * table, so the key's neighbourhood in the HTML shows only an integer. Grepping for `"ar"` near the
 * key finds nothing whichever way the bug goes.
 *
 * `/about` carries no `swr` rule, so this measures a live render rather than something a previous
 * request may have cached — the leak is asserted at its source.
 */
test('a public SSR payload never carries the visitor dashboard-locale preference', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'dashboard_locale', value: 'ar', url: baseURL as string }])

  const response = await page.goto('/about')
  expect(response?.status()).toBe(200)
  const html = await response!.text()

  const match = html.match(/__NUXT_DATA__[^>]*>(\[[\s\S]*?\])<\/script>/)
  expect(match, 'the SSR payload block must be present — otherwise this test proves nothing').not.toBeNull()

  const payload = JSON.parse(match![1] as string) as unknown[]
  const stateMap = payload.find(
    (entry): entry is Record<string, number> =>
      typeof entry === 'object' && entry !== null && '$sdashboard:locale' in entry
  )

  // Absent is the ideal outcome and passing outright; present-but-default is the current one and is
  // equally safe. Present-as-`ar` is the defect.
  if (stateMap === undefined) return

  expect(payload[stateMap['$sdashboard:locale'] as number]).toBe('en')
})
