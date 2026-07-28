import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { SCENARIO_API, SLUG } from './backend.ts'

/**
 * SCENARIO 2 — UNKNOWN PROJECT SLUG REACHING THE FINAL LOCALIZED 404.
 *
 * Prism answers its single example for ANY slug, so against the contract mock an unknown slug is a
 * 200 — the not-found path is unreachable there by construction.
 *
 * The route is two-step (`app/pages/projects/[slug].vue`): a 404 from the project read is not
 * terminal, because a renamed slug still resolves through the redirect table (D04-6). Only when the
 * resolver ALSO misses is this a real not-found. Both upstream answers are asserted directly, so the
 * test states what actually happened rather than inferring it from the final page.
 *
 * The last test is the one that matters most in production: a transient 5xx must never be published
 * as a 404, because that deindexes a live page.
 */

test.describe('Unknown project slug', () => {
  test('both upstream lookups miss before the 404 is raised', async ({ request }) => {
    const detail = await request.get(`${SCENARIO_API}/projects/${SLUG.unknown.en}?locale=en`)
    expect(detail.status()).toBe(404)

    const resolved = await request.get(
      `${SCENARIO_API}/redirects/resolve?locale=en&path=/projects/${SLUG.unknown.en}`
    )
    expect(resolved.status()).toBe(404)
    // The contract's own error shape, not an invented one.
    expect(resolved.headers()['content-type']).toContain('application/problem+json')
    expect(await resolved.json()).toMatchObject({ status: 404, title: 'Not Found' })
  })

  test('renders the English 404 page with a real 404 status', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.unknown.en}`)

    // The HTTP status matters independently of the pixels: a soft 404 rendered with status 200 keeps
    // the URL indexable.
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
    await expect(page.getByText('404')).toBeVisible()

    // Recovery paths (FR-PUB-004) survive the error state.
    await expect(page.getByRole('button', { name: 'Go home' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Browse the blog' })).toBeVisible()
  })

  test('renders the Arabic 404 page, RTL, with a real 404 status', async ({ page }) => {
    const response = await page.goto(`/ar/projects/${SLUG.unknown.ar}`)

    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('الصفحة غير موجودة')
    await expect(page.getByRole('button', { name: 'العودة إلى الرئيسية' })).toBeVisible()
  })

  test('the 404 page has no accessibility violations', async ({ page }) => {
    await page.goto(`/projects/${SLUG.unknown.en}`)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  test('a project 5xx is never converted into a 404', async ({ page, request }) => {
    const upstream = await request.get(`${SCENARIO_API}/projects/${SLUG.upstreamFailure.en}?locale=en`)
    expect(upstream.status()).toBe(503)

    const response = await page.goto(`/projects/${SLUG.upstreamFailure.en}`)

    // The real status is preserved end to end — this is `projectErrorParams`' entire purpose.
    expect(response?.status()).toBe(503)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Something went wrong')
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Page not found')
    await expect(page.getByText('404')).toHaveCount(0)
  })

  test('an Arabic project 5xx keeps its status and its locale', async ({ page }) => {
    const response = await page.goto(`/ar/projects/${SLUG.upstreamFailure.ar}`)

    expect(response?.status()).toBe(503)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('حدث خطأ ما')
  })
})
