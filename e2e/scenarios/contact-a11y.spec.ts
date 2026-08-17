import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'

/**
 * Unfiltered WCAG 2.2 AA sweep for `/contact` (011): locale × viewport × theme, plus the two states
 * a static page crawl never reaches — the validation state and the success state.
 *
 * "Unfiltered" is the point: no rule is disabled and no selector is excluded, so a regression
 * anywhere on the page fails here rather than being scoped away. Violations are printed by rule id
 * before the assertion, because a bare length check tells you nothing on failure.
 *
 * The success state matters most: it REPLACES the form, so it is a distinct DOM that no amount of
 * auditing the idle page would ever see.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 }
] as const

const THEMES = ['dark', 'light'] as const
const ROUTES = [
  { label: 'EN', path: '/contact' },
  { label: 'AR', path: '/ar/contact' }
] as const

async function applyTheme(page: import('@playwright/test').Page, theme: string) {
  await page.evaluate((value) => {
    localStorage.setItem('nuxt-color-mode', value)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(value)
    document.documentElement.style.colorScheme = value
  }, theme)
}

async function violations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags([...TAGS]).analyze()
  // Include the offending node and its measured ratio: a rule id alone does not say WHICH element
  // failed, and on a page with many text colours that is the whole diagnosis.
  return results.violations.flatMap(v =>
    v.nodes.map(n => `${v.id} @ ${n.target.join(' ')} — ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 160)}`)
  )
}

async function fillValid(page: import('@playwright/test').Page) {
  await page.fill('#contact-name', 'Alex Morgan')
  await page.fill('#contact-subject', 'Project inquiry')
  await page.fill('#contact-email', 'alex@example.com')
  await page.fill('#contact-body', 'A real enquiry written in the accessibility lane.')
}

const submit = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /send message|إرسال الرسالة/i }).click()

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`idle — ${route.label} ${viewport.label} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(route.path)
        await applyTheme(page, theme)
        expect(await violations(page)).toEqual([])
      })
    }
  }

  // Error text, the shared contact-method alert and every `aria-describedby` association only exist
  // once validation has run.
  test(`validation state — ${route.label}`, async ({ page }) => {
    await page.goto(route.path)
    // Without this the assertion is NON-DISCRIMINATING: a pre-hydration submit falls through to the
    // browser's native POST, and the form is still visible afterwards — so the test would pass for
    // the wrong reason. It must be Vue's validation keeping the form up, not an unwired button.
    await hydrated(page)
    await submit(page)
    await expect(page.locator('form')).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  // The success state replaces the form entirely — a different DOM with its own focus target.
  test(`success state — ${route.label}`, async ({ page }) => {
    await page.goto(route.path)
    // MEASURED failure this waited for (campaign 026 Phase 6). Two consecutive local full-suite runs
    // each failed exactly one of this test's two locale instances — AR in one run, EN in the next —
    // both at the 15 s timeout with `form` count 1. The captured DOM named the cause: `Name*` was
    // EMPTY and `[invalid]` while Subject, Email and Message all held their values, i.e. only the
    // FIRST fill after `goto` was lost, landing before Vue attached its reactive model. Validation
    // then correctly blocked submit, so the form never gave way to the success state. The product
    // was right; the harness was racing it.
    await hydrated(page)
    await fillValid(page)
    await submit(page)
    await expect(page.locator('form')).toHaveCount(0, { timeout: 15000 })
    expect(await violations(page)).toEqual([])
  })
}

test.describe('contact keyboard and zoom', () => {
  test('every control is reachable by keyboard in tab order', async ({ page }) => {
    await page.goto('/contact')
    await page.locator('#contact-name').focus()

    const reached: string[] = []
    for (let i = 0; i < 8; i += 1) {
      const id = await page.evaluate(() => document.activeElement?.id ?? '')
      if (id) reached.push(id)
      await page.keyboard.press('Tab')
    }

    expect(reached).toContain('contact-name')
    expect(reached).toContain('contact-subject')
    expect(reached).toContain('contact-email')
    expect(reached).toContain('contact-dial-code')
    expect(reached).toContain('contact-phone')
    expect(reached).toContain('contact-body')
    // The honeypot carries tabindex="-1" and must never appear in the tab order.
    expect(reached).not.toContain('contact-company-url')
  })

  test('the form can be submitted entirely from the keyboard', async ({ page }) => {
    await page.goto('/contact')
    // Same class as `success state` above — this drives the form and submits it, so the first typed
    // field is the one at risk. Latent rather than observed, and guarded for the same reason.
    await hydrated(page)
    await page.locator('#contact-name').focus()
    await page.keyboard.type('Alex Morgan')
    await page.locator('#contact-subject').focus()
    await page.keyboard.type('Project inquiry')
    await page.locator('#contact-email').focus()
    await page.keyboard.type('alex@example.com')
    await page.locator('#contact-body').focus()
    await page.keyboard.type('Submitted without a mouse.')

    await page.getByRole('button', { name: /send message/i }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Message received' })).toBeVisible({ timeout: 15000 })
    // Focus moves to the success heading, so a keyboard user is not stranded where the form was.
    await expect(page.locator('h2:focus')).toHaveCount(1)
  })

  test('no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/contact')
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - window.innerWidth,
      main: (document.querySelector('main')?.scrollWidth ?? 0) - window.innerWidth
    }))
    // `<main>` — this slice's surface — must not overflow at all.
    expect(overflow.main).toBeLessThanOrEqual(0)
    // The DOCUMENT is allowed a couple of pixels: finding F-5 (recorded with the Résumé slice)
    // is a pre-existing overflow in the global header's trailing control cluster, present on every
    // route. Holding `<main>` to zero and bounding the document is the precedent that slice set —
    // importing a defect this page did not cause would be the wrong gate.
    expect(overflow.doc).toBeLessThanOrEqual(2)
  })

  test('no horizontal overflow at 200% zoom', async ({ page }) => {
    // 200% zoom halves the CSS-pixel viewport.
    await page.setViewportSize({ width: 720, height: 450 })
    await page.goto('/contact')
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('honours reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/contact')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })
})
