import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { SLUG } from './backend.ts'

/**
 * SCENARIO 6 — EXACT, VISIBLY DIFFERENT EN/AR PROJECT CONTENT.
 *
 * This is the scenario Prism can least express: it replays ONE example whatever `?locale=` says, so
 * against the contract mock the English and Arabic pages are byte-identical in their content and an
 * Arabic page silently falling back to English would look completely correct.
 *
 * The fixtures therefore author both locales separately — title, summary, all eight FR-CNT-020
 * sections, technology labels, gallery caption and image `alt` — and the two `slugs` differ. The
 * decisive test is the negative one: the Arabic page must contain NONE of the English strings.
 */

const EN_STRINGS = [
  'Bilingual differentiation study',
  'This English summary has no Arabic words in it whatsoever.',
  'Bilingual English overview paragraph.',
  'Bilingual English lessons paragraph.',
  'English gallery caption'
]

const AR_STRINGS = [
  'دراسة تمايز اللغتين',
  'هذا الملخص العربي لا يحتوي على أي كلمة إنجليزية إطلاقًا.',
  'ثنائي اللغة — فقرة النظرة العامة بالعربية.',
  'ثنائي اللغة — فقرة الدروس المستفادة بالعربية.',
  'تعليق المعرض بالعربية'
]

/**
 * Assert the text is on the page, inside `<main>`.
 *
 * Scoped rather than page-wide because the title legitimately appears three times — in the route
 * announcer's live region, in the breadcrumb, and as the h1 — and a page-wide `getByText` is a strict
 * -mode violation rather than a pass. `.first()` inside main keeps the assertion about the CONTENT.
 */
function content(page: import('@playwright/test').Page, text: string) {
  return page.locator('main').getByText(text).first()
}

test.describe('EN/AR project differentiation', () => {
  test('the English page renders the authored English content', async ({ page }) => {
    const response = await page.goto(`/projects/${SLUG.bilingual.en}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    for (const text of EN_STRINGS) await expect(content(page, text)).toBeVisible()
    await expect(page.locator('figure img')).toHaveAttribute('alt', 'English alternative text')

    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumb.locator('[aria-current="page"]')).toHaveText('Bilingual differentiation study')
  })

  test('the Arabic page renders authored Arabic content and no English fallback', async ({ page, request }) => {
    // The negative assertion runs against the RAW SSR HTML as well as the DOM: a fallback that only
    // appeared in the server-rendered output would be invisible to a DOM-only check after hydration.
    const html = await (await request.get(`/ar/projects/${SLUG.bilingual.ar}`)).text()
    for (const text of EN_STRINGS) expect(html, `English fallback leaked into the Arabic SSR output`).not.toContain(text)

    const response = await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    for (const text of AR_STRINGS) await expect(content(page, text)).toBeVisible()
    // The negative direction stays page-wide on purpose: an English string anywhere — content, live
    // region, breadcrumb — is a fallback leak.
    for (const text of EN_STRINGS) await expect(page.getByText(text)).toHaveCount(0)

    await expect(page.locator('figure img')).toHaveAttribute('alt', 'نص بديل بالعربية')

    const crumb = page.getByRole('navigation', { name: 'مسار التنقّل' })
    await expect(crumb.locator('[aria-current="page"]')).toHaveText('دراسة تمايز اللغتين')
  })

  test('every section heading and body differs between the locales', async ({ page }) => {
    // The gallery is also a <section> inside the <article>; excluding it by its labelling id keeps
    // this about the eight FR-CNT-020 fields rather than silently counting nine.
    const narrative = 'article section:not([aria-labelledby="project-gallery-heading"])'

    await page.goto(`/projects/${SLUG.bilingual.en}`)
    const englishSections = await page.locator(narrative).allInnerTexts()

    await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)
    const arabicSections = await page.locator(narrative).allInnerTexts()

    // All eight, on both sides, pairwise different — not merely "the pages differ somewhere".
    expect(englishSections).toHaveLength(8)
    expect(arabicSections).toHaveLength(8)
    for (const [index, english] of englishSections.entries()) {
      expect(arabicSections[index], `section ${index} is identical across locales`).not.toBe(english)
    }
  })

  test('the technology list is localized and bidi-isolated', async ({ page }) => {
    await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)

    // <bdi> keeps a Latin identifier from being reordered against neighbouring RTL text. The labels
    // here are Arabic, but the isolation must be present regardless — it is a property of the markup,
    // not of the current content.
    const isolated = page.locator('article header bdi')
    await expect(isolated).toHaveCount(2)
    await expect(isolated.first()).toHaveText('نكست')

    await page.goto(`/projects/${SLUG.bilingual.en}`)
    await expect(page.locator('article header bdi').first()).toHaveText('Nuxt')
  })

  test('locale switching targets the equivalent localized slug, not this locale\'s slug', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)

    // hreflang is driven by the contract's `slugs` map (D22-3), so it must carry the AR slug.
    const alternate = await page.locator('link[rel="alternate"][hreflang="ar"]').getAttribute('href')
    expect(alternate).toContain(`/ar/projects/${SLUG.bilingual.ar}`)

    // And the visible control must agree with the metadata.
    const toArabic = page.getByRole('group', { name: /language/i }).first().getByRole('link', { name: 'AR' })
    await expect(toArabic).toHaveAttribute('href', `/ar/projects/${SLUG.bilingual.ar}`)

    await toArabic.click()
    await expect(page).toHaveURL(new RegExp(`/ar/projects/${SLUG.bilingual.ar}$`))

    // The reverse direction resolves to the English slug rather than a re-prefixed Arabic one.
    await page.goto(`/ar/projects/${SLUG.bilingual.ar}`)
    const toEnglish = page.getByRole('group', { name: /لغة|language/i }).first().getByRole('link', { name: 'EN' })
    await expect(toEnglish).toHaveAttribute('href', `/projects/${SLUG.bilingual.en}`)
  })

  /**
   * KNOWN DEFECT — awaiting an owner decision. Marked `test.fail()` so it is recorded rather than
   * hidden, and so it starts failing again the moment it is fixed without this note being updated.
   *
   * A CLIENT-SIDE locale switch renders the localized 404 instead of the counterpart project. The
   * URL is right; the DATA READ is not. Measured, not inferred — the browser sends:
   *     GET /api/v1/projects/ssr-bilingual-ar?locale=en
   *     GET /api/v1/redirects/resolve?locale=en&path=/projects/ssr-bilingual-ar
   * i.e. the Arabic slug with the ENGLISH locale, which is a legitimate 404 by contract.
   *
   * Cause: `skipSettingLocaleOnNavigate: true` (D03-14) defers the locale commit to the page
   * transition's `onBeforeEnter`, deliberately, to stop the outgoing page being repainted mirrored.
   * The incoming page's `setup()` — and therefore `useApi()`, which reads the CURRENT locale
   * (D10-6) — runs before that commit. The page then throws a fatal 404 before `useAsyncData`'s
   * `watch: [locale]` can re-run with the committed locale.
   *
   * It is invisible everywhere else, which is why it surfaced only now: Prism answers any slug in
   * any locale, and a direct load is server-rendered with the locale already correct. The same
   * pattern exists in `blog/[slug].vue`, so this is pre-existing and site-wide rather than a
   * Projects regression.
   *
   * Every candidate fix trades against an approved decision (D03-14, D10-6, or reading i18n's
   * `@internal` `__pendingLocale`), so it is raised as a decision instead of being chosen here.
   */
  test.fail('a client-side locale switch renders the counterpart project', async ({ page }) => {
    await page.goto(`/projects/${SLUG.bilingual.en}`)
    await page.getByRole('group', { name: /language/i }).first().getByRole('link', { name: 'AR' }).click()

    await expect(page).toHaveURL(new RegExp(`/ar/projects/${SLUG.bilingual.ar}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('دراسة تمايز اللغتين')
  })

  test('both localized pages have no accessibility violations', async ({ page }) => {
    for (const route of [`/projects/${SLUG.bilingual.en}`, `/ar/projects/${SLUG.bilingual.ar}`]) {
      await page.goto(route)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations.map(violation => `${violation.id}: ${violation.help}`), route).toEqual([])
    }
  })
})
