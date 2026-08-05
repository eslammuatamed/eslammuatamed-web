import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { TECHNOLOGY } from './backend.ts'

/**
 * The empty-state panel itself — the INNERMOST element that holds both the empty copy and its
 * recovery button.
 *
 * Scoped structurally rather than by class, and innermost rather than by index, because the filter
 * control offers a "Clear filter" button too. Asserting on whichever one happens to come first in
 * the DOM would silently start testing the wrong control the moment the layout changes.
 */
function emptyStatePanel(page: Page, copy: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(copy) })
    .filter({ has: page.getByRole('button') })
    .last()
}

/**
 * SCENARIO 1 — EMPTY PROJECTS LIST (web-005 spec §, FR-PUB-030 empty state).
 *
 * Prism cannot express this: it replays the contract's example, which always has projects in it. The
 * scenario backend answers `GET /projects` with a well-formed, zero-item page instead.
 *
 * The distinction the page draws — "no projects at all" vs "no projects match this filter" — is the
 * part most likely to regress silently, so both branches are covered, including the recovery action
 * that only exists on the filtered branch.
 */

test.describe('Empty projects list — English', () => {
  test('renders the localized empty state server-side, with no project cards', async ({ page, request }) => {
    // Assert on the RAW SSR RESPONSE first. Checking the live DOM alone would also pass if the empty
    // state only appeared after hydration, which is precisely the SSR bug this lane exists to catch.
    const html = await (await request.get('/projects')).text()
    expect(html).toContain('No case studies yet')

    const response = await page.goto('/projects')
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Selected work')
    await expect(page.getByText('No case studies yet')).toBeVisible()
    await expect(page.getByText('Work is being written up.', { exact: false })).toBeVisible()

    // No cards, and no pagination inviting the visitor into a second empty page.
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: /pagination/i })).toHaveCount(0)

    // An empty list is NOT an error, so the filter must stay usable rather than be disabled.
    const filter = page.getByRole('group', { name: 'Technology' })
    await expect(filter).toBeVisible()
    for (const chip of await filter.getByRole('button').all()) await expect(chip).toBeEnabled()

    // The unfiltered empty state has nothing to clear, so it must not offer a clear action. The
    // filter's own former clear BUTTON is gone — "All" is now a chip and is simply the pressed one —
    // so this asserts the empty state adds none of its own.
    await expect(page.getByRole('button', { name: 'Clear filter' })).toHaveCount(0)
    await expect(filter.getByRole('button', { name: 'All technologies' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the filtered empty state reads differently and offers a working recovery action', async ({ page }) => {
    await page.goto(`/projects?technology=${TECHNOLOGY.noMatches}`)

    await expect(page.getByText('No projects use this technology')).toBeVisible()
    await expect(page.getByText('No case studies yet')).toHaveCount(0)
    await expect(page.getByRole('article')).toHaveCount(0)

    // ONE "Clear filter" button now, not two. The filter's own clear button existed because a select
    // had no way to express "all" as an option; with chips, "All" IS an option and the pressed state
    // says which one is active. The in-context recovery inside the empty state stays, and the count is
    // still pinned so a refactor cannot silently drop it — it is the path a visitor who just hit this
    // state will actually use.
    await expect(page.getByRole('button', { name: 'Clear filter' })).toHaveCount(1)

    // The filter-side recovery is the "All" chip, and it is genuinely unpressed here — otherwise the
    // control would be claiming the list is unfiltered while the empty state says it is filtered.
    const filter = page.getByRole('group', { name: 'Technology' })
    await expect(filter.getByRole('button', { name: 'All technologies' })).toHaveAttribute('aria-pressed', 'false')

    // Recovery: clearing from within the empty state must return to the unfiltered index, not merely
    // reset a widget.
    await emptyStatePanel(page, 'No projects use this technology')
      .getByRole('button', { name: 'Clear filter' })
      .click()
    await expect(page).toHaveURL(/\/projects$/)
    await expect(page.getByText('No case studies yet')).toBeVisible()
  })

  test('the empty state has no accessibility violations', async ({ page }) => {
    await page.goto('/projects')
    // The UNFILTERED ruleset, matching the contract lane: a wcag-tag-filtered scan reported /projects
    // clean while Lighthouse scored it 98, because Lighthouse runs a broader set.
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})

test.describe('Empty projects list — Arabic', () => {
  test('renders the Arabic empty state, RTL, with no English fallback', async ({ page, request }) => {
    const html = await (await request.get('/ar/projects')).text()
    expect(html).toContain('لا توجد دراسات حالة بعد')

    const response = await page.goto('/ar/projects')
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await expect(page.getByText('لا توجد دراسات حالة بعد')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(0)
    // The English copy for the same state must not leak onto the Arabic page.
    await expect(page.getByText('No case studies yet')).toHaveCount(0)
  })

  test('the Arabic filtered empty state offers the Arabic recovery action', async ({ page }) => {
    await page.goto(`/ar/projects?technology=${TECHNOLOGY.noMatches}`)

    await expect(page.getByText('لا مشاريع تستخدم هذه التقنية')).toBeVisible()
    await emptyStatePanel(page, 'لا مشاريع تستخدم هذه التقنية')
      .getByRole('button', { name: 'إزالة التصفية' })
      .click()
    await expect(page).toHaveURL(/\/ar\/projects$/)
    await expect(page.getByText('لا توجد دراسات حالة بعد')).toBeVisible()
  })

  test('the Arabic empty state has no accessibility violations', async ({ page }) => {
    await page.goto('/ar/projects')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
