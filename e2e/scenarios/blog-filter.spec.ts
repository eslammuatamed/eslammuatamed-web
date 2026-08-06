import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { CATEGORY } from '../../scripts/e2e/fixtures.ts'

/**
 * Blog index category filter (FR-PUB-040, WS E).
 *
 * The case this file exists for is the THIRD empty state. Category slugs are per-locale (D04-2) and
 * `SwitchLocalePathLink` carries the query string across a locale switch, so `/blog?category=<en-slug>`
 * becomes `/ar/blog?category=<en-slug>` — a category that does not exist in Arabic. The API answers an
 * unknown category with a well-formed EMPTY page, identical at the network level to "this topic has no
 * articles yet", so the two are distinguishable only from the category list the page already holds.
 * Without that distinction the Arabic index would claim the blog is empty, which is false.
 */

const filter = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: /Category|الموضوع/ })

/**
 * Wait until Vue has actually hydrated before driving an interactive control.
 *
 * These pages are server-rendered, so a chip is present and clickable in the DOM well before its
 * `@click` handler exists. Playwright's actionability checks are satisfied by the SSR markup, so a
 * click can land on a button that is not yet wired and the test fails intermittently — which is
 * exactly how this file failed before the wait was added. The signal is real rather than a sleep:
 * Vue sets `__vue_app__` on the container element when `mount()` completes.
 *
 * This is a TEST-ONLY concern for the chips, deliberately. Chips are `<button aria-pressed>` toggles
 * (the approved control), and a toggle genuinely requires JavaScript. The one control here that merely
 * NAVIGATES — "Clear filter" — is a real link instead, so it works with no JavaScript at all.
 */
async function hydrated(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return Boolean(root?.__vue_app__)
  })
}

test.describe('Blog category filter — English', () => {
  test('renders chips with "all" pressed, and the unfiltered empty state', async ({ page }) => {
    await page.goto('/blog')

    await expect(filter(page)).toBeVisible()
    await expect(filter(page).getByRole('button', { name: 'All topics' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('No articles yet')).toBeVisible()

    // Nothing to clear when nothing is filtered. The recovery is a LINK, not a button — it navigates,
    // so it must work before hydration and support middle-click.
    await expect(page.getByRole('link', { name: 'Clear filter' })).toHaveCount(0)
  })

  test('pressing a category writes its slug to the URL and reads back as pressed', async ({ page }) => {
    await page.goto('/blog')
    await hydrated(page)

    await filter(page).getByRole('button', { name: 'Scenario — empty topic' }).click()

    await expect(page).toHaveURL(new RegExp(`category=${CATEGORY.noMatches.en}`))
    await expect(filter(page).getByRole('button', { name: 'Scenario — empty topic' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect(filter(page).getByRole('button', { name: 'All topics' })).toHaveAttribute('aria-pressed', 'false')

    // The filtered empty state reads differently from "no posts yet" and offers recovery.
    await expect(page.getByText('No articles in this topic yet')).toBeVisible()
    await expect(page.getByText('No articles yet')).toHaveCount(0)

    // Back undoes the filter — the whole point of pushing rather than replacing.
    await page.goBack()
    await expect(page).toHaveURL(/\/blog$/)
    await expect(filter(page).getByRole('button', { name: 'All topics' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('clearing from the empty state is a real link to the unfiltered index', async ({ page }) => {
    await page.goto(`/blog?category=${CATEGORY.noMatches.en}`)

    const clear = page.getByRole('link', { name: 'Clear filter' })
    // The href is asserted BEFORE the click, and that is the point: a `@click` button has no href, so
    // it does nothing until Vue hydrates and it cannot be middle-clicked at all. Checking the href
    // proves the recovery exists in the server-rendered HTML, not just after hydration.
    await expect(clear).toHaveAttribute('href', '/blog')

    await clear.click()

    await expect(page).toHaveURL(/\/blog$/)
    await expect(page.getByText('No articles yet')).toBeVisible()
  })

  test('the filtered index has no accessibility violations', async ({ page }) => {
    await page.goto(`/blog?category=${CATEGORY.noMatches.en}`)
    // The UNFILTERED ruleset, matching the rest of the lane: a wcag-tag-filtered scan can report clean
    // while Lighthouse's broader accessibility category still finds something.
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})

test.describe('Blog category filter — Arabic and the cross-locale case', () => {
  test('renders the Arabic chips, RTL, with no English label leaking', async ({ page }) => {
    await page.goto('/ar/blog')

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(filter(page).getByRole('button', { name: 'كل الموضوعات' })).toHaveAttribute('aria-pressed', 'true')
    await expect(filter(page).getByRole('button', { name: 'سيناريو — موضوع فارغ' })).toBeVisible()
    await expect(filter(page).getByRole('button', { name: 'Scenario — empty topic' })).toHaveCount(0)
  })

  test('the ARABIC slug filters normally on the Arabic index', async ({ page }) => {
    await page.goto(`/ar/blog?category=${CATEGORY.noMatches.ar}`)

    // A slug that exists in this locale is an ordinary filtered-empty state, not the unknown one.
    await expect(page.getByText('لا مقالات في هذا الموضوع بعد')).toBeVisible()
    await expect(page.getByText('هذا الموضوع غير موجود بهذه اللغة')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'إزالة التصفية' })).toHaveAttribute('href', '/ar/blog')
  })

  test('an ENGLISH slug on the Arabic index says the topic does not exist here — not "no articles"', async ({ page }) => {
    // Exactly what a locale switch produces: the query string is carried across, the slug is not.
    await page.goto(`/ar/blog?category=${CATEGORY.noMatches.en}`)

    await expect(page.getByText('هذا الموضوع غير موجود بهذه اللغة')).toBeVisible()
    // The two claims this must NOT make: that the blog is empty, or that this topic merely has no posts.
    await expect(page.getByText('لا توجد مقالات بعد')).toHaveCount(0)
    await expect(page.getByText('لا مقالات في هذا الموضوع بعد')).toHaveCount(0)

    // No chip is pressed, because the active value is not one of them — the control must not claim the
    // list is unfiltered while a filter is in the URL.
    const pressed = await filter(page).getByRole('button').evaluateAll(nodes =>
      nodes.filter(node => node.getAttribute('aria-pressed') === 'true').length
    )
    expect(pressed).toBe(0)

    // The URL is NOT rewritten: silently clearing it would hide that the link does not carry over.
    await expect(page).toHaveURL(new RegExp(`category=${CATEGORY.noMatches.en}`))
  })

  test('the unknown-category state has no accessibility violations', async ({ page }) => {
    await page.goto(`/ar/blog?category=${CATEGORY.noMatches.en}`)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
