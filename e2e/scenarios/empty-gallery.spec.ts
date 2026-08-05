import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { SLUG } from './backend.ts'

/**
 * SCENARIO 5 — PROJECT DETAIL WITH AN EMPTY GALLERY.
 *
 * Prism always replays the contract's populated example, so the empty branch is unreachable there —
 * yet it is the NORMAL state today, because no seeded project has media attached.
 *
 * The requirement is an absence, and absences are easy to assert vacuously. So each test pins the
 * absence against something positive that must still be there: the eight FR-CNT-020 sections, the
 * heading hierarchy, the breadcrumbs and the contact CTA. If the page failed to render at all, every
 * "should not exist" assertion below would pass while the positive ones failed.
 */

// The facts card heading leads the run: it is inside the <article> and precedes the narrative in DOM
// order. The eight FR-CNT-020 sections follow; 'Gallery' is what a populated project would add.
// Uppercase because these are RENDERED texts and the facts heading wears the `.kicker` treatment —
// the Arabic list below keeps its authored casing, since `.kicker` drops the transform for Arabic.
const EN_SECTIONS = [
  'AT A GLANCE',
  'Overview',
  'The problem',
  'The solution',
  'My role',
  'Architecture',
  'Challenges',
  'Key features',
  'What I took away'
]

test.describe('Project detail with an empty gallery — English', () => {
  test('renders the case study with no gallery region and no image shell', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.emptyGallery.en}`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Project without gallery media')

    // The gallery is omitted ENTIRELY — not an empty carousel shell, not a heading over nothing.
    await expect(page.locator('#project-gallery-heading')).toHaveCount(0)
    // `exact` matters: the default is a case-insensitive SUBSTRING match, which the h1 "Project
    // without gallery media" satisfies — the assertion would fail on the title, not on a gallery.
    await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toHaveCount(0)
    await expect(page.locator('section[aria-labelledby="project-gallery-heading"]')).toHaveCount(0)
    await expect(page.locator('article figure')).toHaveCount(0)
    // No broken image: an `<img>` with no source would still occupy layout and announce as an image.
    await expect(page.locator('article img')).toHaveCount(0)
  })

  test('the rest of FR-CNT-020 remains visible, in order, with correct heading levels', async ({ page }) => {
    await page.goto(`/projects/${SLUG.emptyGallery.en}`)

    // The facts card plus the eight sections and nothing after them — with a populated gallery this
    // list ends with 'Gallery', so the shorter list IS the assertion that the region was dropped
    // cleanly.
    expect(await page.locator('article h2').allInnerTexts()).toEqual(EN_SECTIONS)

    // Each section still has its body; a heading with no prose would be the other way to fail this.
    await expect(page.getByText('Empty gallery overview paragraph.')).toBeVisible()
    await expect(page.getByText('Empty gallery lessons paragraph.')).toBeVisible()

    // Exactly one h1, so the h2 run above is a real hierarchy rather than a flattened one.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('the surrounding page furniture is unaffected', async ({ page }) => {
    await page.goto(`/projects/${SLUG.emptyGallery.en}`)

    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumb).toBeVisible()
    await expect(crumb.locator('[aria-current="page"]')).toHaveText('Project without gallery media')

    await expect(page.getByRole('link', { name: 'Live product' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Email me/i })).toHaveAttribute(
      'href',
      'mailto:eslammuatemed@gmail.com'
    )
  })

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(`/projects/${SLUG.emptyGallery.en}`)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})

test.describe('Project detail with an empty gallery — Arabic', () => {
  test('renders RTL with the Arabic sections and no gallery region', async ({ page }) => {
    const response = await page.goto(`/ar/projects/${SLUG.emptyGallery.ar}`)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('مشروع بلا وسائط في المعرض')

    expect(await page.locator('article h2').allInnerTexts()).toEqual([
      'لمحة سريعة',
      'نظرة عامة',
      'المشكلة',
      'الحل',
      'دوري',
      'المعمارية',
      'التحدّيات',
      'أبرز الميزات',
      'ما تعلّمته'
    ])

    await expect(page.locator('article figure')).toHaveCount(0)
    await expect(page.locator('article img')).toHaveCount(0)
  })

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(`/ar/projects/${SLUG.emptyGallery.ar}`)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
