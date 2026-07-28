import type { Request } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { SCENARIO_API, SLUG } from './backend.ts'

/**
 * The URLs of every redirect that led to `request`, oldest first.
 *
 * A raw `redirectedFrom()?.redirectedFrom()` chain reads as `null` at one depth and `undefined` at
 * the next, which makes "no loop" easy to assert wrongly. Collapsing the chain to a list means the
 * assertion is a length, and a loop shows up as the actual hops rather than a falsy value.
 */
function redirectChain(request: Request | undefined | null): string[] {
  const urls: string[] = []
  for (let hop = request?.redirectedFrom(); hop; hop = hop.redirectedFrom()) urls.unshift(hop.url())
  return urls
}

/**
 * SCENARIO 3 — OLD PROJECT SLUG RESOLVING THROUGH THE REDIRECT ENDPOINT TO THE CANONICAL SLUG.
 *
 * Unreachable against Prism twice over: Prism never 404s a project slug, so the redirect branch is
 * never entered, and it would answer the resolver with the contract's fixed example regardless.
 *
 * The branch under test (`app/pages/projects/[slug].vue`): project read 404 → resolver 200 → 301 to
 * the localized canonical path. The destination is per locale, because the resolver is locale-scoped
 * (D10-6) — an English redirect landing on the Arabic slug would be a real defect and is asserted
 * against directly.
 */

test.describe('Redirect-resolved project slug', () => {
  test('the old slug 404s and the resolver answers with the canonical path', async ({ request }) => {
    const detail = await request.get(`${SCENARIO_API}/projects/${SLUG.renamed.en}?locale=en`)
    expect(detail.status()).toBe(404)

    const resolved = await request.get(
      `${SCENARIO_API}/redirects/resolve?locale=en&path=/projects/${SLUG.renamed.en}`
    )
    expect(resolved.status()).toBe(200)
    expect(await resolved.json()).toEqual({ data: { toPath: `/projects/${SLUG.canonical.en}` } })
  })

  test('navigating the old English slug lands on the canonical project', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.renamed.en}`)

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG.canonical.en}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Canonical scenario project')

    // EXACTLY ONE HOP. More than one would mean the canonical slug itself redirected — the loop this
    // scenario exists to rule out.
    const chain = redirectChain(response?.request())
    expect(chain).toHaveLength(1)
    expect(chain[0]).toContain(SLUG.renamed.en)

    // A renamed URL is permanently superseded, so the status must be 301, not a temporary 302.
    const firstHop = response!.request().redirectedFrom()!
    expect((await firstHop.response())?.status()).toBe(301)
  })

  test('navigating the old Arabic slug lands on the Arabic canonical project', async ({ page }) => {
    const response = await page.goto(`/ar/projects/${SLUG.renamed.ar}`)

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/ar/projects/${SLUG.canonical.ar}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشروع السيناريو الأساسي')

    const chain = redirectChain(response?.request())
    expect(chain).toHaveLength(1)
    expect(chain[0]).toContain(SLUG.renamed.ar)
  })

  test('the canonical slug is served directly and never redirects again', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.canonical.en}`)

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG.canonical.en}$`))
    // No redirect at all: the destination is a terminal URL, which is what makes the chain above safe.
    expect(redirectChain(response?.request())).toEqual([])
  })
})
