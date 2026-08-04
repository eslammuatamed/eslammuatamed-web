import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { TECHNOLOGY } from './backend.ts'

/**
 * SCENARIO 4 — API UNAVAILABLE / UPSTREAM FAILURE, EXERCISED SERVER-SIDE.
 *
 * TWO DISTINCT FAILURE MODES, deliberately kept separate:
 *   - `TECHNOLOGY.unreachable` — the backend DESTROYS THE SOCKET without replying. Nitro's `$fetch`
 *     fails at the transport layer, exactly as it would against an upstream that is down. This is a
 *     genuine connection failure, not an error status dressed up as one.
 *   - `TECHNOLOGY.upstream503` — the backend answers RFC 7807 `503`. Same user-visible state, a
 *     different code path through `toApiError` (a parsed problem document rather than a synthesized
 *     transport error), and worth pinning separately because only one of them has a status at all.
 *
 * This is a SERVER-SIDE failure: the read happens inside Nitro during SSR, which is the whole reason
 * browser interception could not reach it. `/settings/site` and `/skills` stay healthy on purpose —
 * if the page shell failed too, the accessibility and recovery assertions below would be describing a
 * different page than the one under test.
 */

const UNREACHABLE = `/projects?technology=${TECHNOLOGY.unreachable}`
const UPSTREAM_503 = `/projects?technology=${TECHNOLOGY.upstream503}`

test.describe('Unavailable API — connection failure', () => {
  test('renders the localized error state server-side, and never a 404', async ({ page, request }) => {
    // Server-rendered, not hydrated-in: the error copy is already in the HTML Nitro produced.
    const raw = await request.get(UNREACHABLE)
    expect(raw.status()).toBe(200)
    expect(await raw.text()).toContain('Projects could not be loaded')

    const response = await page.goto(UNREACHABLE)
    // A failed data read is an error STATE on a working page, not a missing page. Turning it into a
    // 404 would deindex a live route over a transient outage.
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Selected work')

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert.getByText('Projects could not be loaded')).toBeVisible()
    await expect(page.getByText('Page not found')).toHaveCount(0)

    // The approved recovery action, inside the alert so assistive tech announces it with the failure.
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

    // No half-rendered list behind the error.
    await expect(page.getByRole('article')).toHaveCount(0)
  })

  test('no stale successful payload masks the error on a repeat visit', async ({ page }) => {
    // `/projects**` carries `swr: 60`, so a cached success is a real hazard here. Nitro keys the cache
    // on the full path INCLUDING the query string, and this URL has never rendered successfully — so
    // the second visit must fail exactly like the first. Asserted rather than argued.
    for (const attempt of [1, 2]) {
      await page.goto(UNREACHABLE)
      await expect(page.getByRole('alert'), `attempt ${attempt}`).toBeVisible()
      await expect(page.getByRole('article'), `attempt ${attempt}`).toHaveCount(0)
    }
  })

  test('the error state has no accessibility violations', async ({ page }) => {
    await page.goto(UNREACHABLE)
    await expect(page.getByRole('alert')).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  test('renders the Arabic error state, RTL, with the Arabic recovery action', async ({ page }) => {
    await page.goto(`/ar/projects?technology=${TECHNOLOGY.unreachable}`)

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const alert = page.getByRole('alert')
    await expect(alert.getByText('تعذّر تحميل المشاريع')).toBeVisible()
    await expect(alert.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible()
    await expect(page.getByText('Projects could not be loaded')).toHaveCount(0)
  })
})

test.describe('Unavailable API — RFC 7807 503 from the upstream', () => {
  test('reaches the same user-visible error state as a connection failure', async ({ page, request }) => {
    const raw = await request.get(UPSTREAM_503)
    expect(raw.status()).toBe(200)
    expect(await raw.text()).toContain('Projects could not be loaded')

    const response = await page.goto(UPSTREAM_503)
    expect(response?.status()).toBe(200)

    const alert = page.getByRole('alert')
    await expect(alert.getByText('Projects could not be loaded')).toBeVisible()
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByText('Page not found')).toHaveCount(0)
  })
})
