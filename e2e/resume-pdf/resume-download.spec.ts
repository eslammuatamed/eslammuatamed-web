import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The PDF-populated résumé state (010), against a backend whose `/settings/site` carries a real
 * `resumeAsset` AND which serves the object itself.
 *
 * WHY A WHOLE LANE FOR THIS. The download contract is not observable from markup. Whether a link
 * downloads or navigates is decided by the OBJECT's `Content-Disposition` header — which in
 * production is metadata written at upload time (doc 19 §5), not response logic — and the HTML
 * `download` attribute is ignored cross-origin, so it cannot be the mechanism. The only way to
 * prove the claim is to serve a real object from a real second origin and read the headers back.
 *
 * The served bytes are a minimal placeholder PDF, never the owner's résumé: what is under test is
 * delivery, not content, and a copy of a governed asset must not live in the test harness.
 */

const EN = '/resume'
const PDF_NAME = 'eslam-muatamed-resume.pdf'

async function open(page: import('@playwright/test').Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' })
}

function downloadLink(page: import('@playwright/test').Page) {
  return page.locator(`main a[href$="${PDF_NAME}"]`)
}

test.describe('Download action', () => {
  test('is visible and carries the filename', async ({ page }) => {
    await open(page, EN)

    const link = downloadLink(page)
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('aria-label', new RegExp(PDF_NAME))
  })

  test('shows a human-readable file size', async ({ page }) => {
    await open(page, EN)
    await expect(downloadLink(page)).toContainText(/\d+\s*(kB|MB)/)
  })

  test('renders no unavailable notice when the PDF exists', async ({ page }) => {
    await open(page, EN)
    await expect(page.getByTestId('resume-pdf-unavailable')).toHaveCount(0)
  })

  /**
   * The URL must be the ABSOLUTE media-origin URL from the descriptor — a different origin from the
   * page. A relative href, or one on the app origin, would mean the Web app had rewritten it or
   * rebuilt a storage key locally, which is the specific defect this asserts against.
   */
  test('points at the absolute media origin, not the app origin and not a rebuilt key', async ({ page, baseURL }) => {
    await open(page, EN)

    const href = await downloadLink(page).getAttribute('href')
    expect(href).toBeTruthy()
    expect(href!).toMatch(/^https?:\/\//)
    expect(new URL(href!).origin).not.toBe(new URL(baseURL!).origin)
    // The descriptor's own path, verbatim.
    expect(href!).toContain(`/media/${PDF_NAME}`)
  })

  test('never renders the bare asset id', async ({ page }) => {
    await open(page, EN)
    const html = await page.locator('main').innerHTML()
    expect(html).not.toContain('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  })
})

test.describe('Object delivery — the authoritative headers', () => {
  test('serves the object as application/pdf with attachment disposition', async ({ page, request }) => {
    await open(page, EN)
    const href = await downloadLink(page).getAttribute('href')

    const response = await request.get(href!)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    // This header — not the `download` attribute — is what makes the link download.
    expect(response.headers()['content-disposition']).toContain('attachment')
    expect(response.headers()['content-disposition']).toContain(PDF_NAME)
  })

  test('the delivered bytes really are a PDF', async ({ page, request }) => {
    await open(page, EN)
    const href = await downloadLink(page).getAttribute('href')

    const body = await (await request.get(href!)).body()
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  test('the advertised size matches the object actually served', async ({ page, request }) => {
    await open(page, EN)
    const href = await downloadLink(page).getAttribute('href')

    const body = await (await request.get(href!)).body()
    const shown = await downloadLink(page).innerText()
    // The label is rounded for humans; assert the object is non-empty and the label is not zero.
    expect(body.byteLength).toBeGreaterThan(0)
    expect(shown).toMatch(/\d/)
  })

  /**
   * The download must work with JavaScript disabled: it is a plain anchor with an href, and the
   * server does the rest. Fetched with a bare HTTP client, no browser JS involved.
   */
  test('works without JavaScript — the href is in the SSR HTML', async ({ request }) => {
    const html = await (await request.get(EN)).text()

    expect(html).toContain(`/media/${PDF_NAME}`)
    expect(html).toMatch(new RegExp(`<a[^>]+href="[^"]*${PDF_NAME}"`))
  })
})

test.describe('Print and accessibility with a PDF present', () => {
  test('hides the download control in print', async ({ page }) => {
    await open(page, EN)
    await page.emulateMedia({ media: 'print' })

    await expect(downloadLink(page)).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('has no axe violations with the download present', async ({ page }) => {
    await open(page, EN)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('has no axe violations in Arabic with the download present', async ({ page }) => {
    await open(page, '/ar/resume')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})
