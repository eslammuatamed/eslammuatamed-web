import { expect, test } from '@playwright/test'

/**
 * Contact submission outcomes in a REAL browser (011).
 *
 * These states cannot come from the contract lane: Prism replays one canned 200 for any POST
 * payload, so 422 / 429 / 500 / transport failure are unreachable there. They come from the
 * scenario backend's `POST /contact` handler instead — no fifth server pair (issue #30).
 *
 * The selector is the `x-contact-scenario` REQUEST HEADER, set per test below and never derived
 * from visible form text: a subject is content a real visitor writes, and selecting server
 * behaviour from it would mean a production message could change what the API does. The header
 * cannot reach the real API — the contract, scenario and real-API lanes are separate Playwright
 * projects with separate `baseURL`s.
 *
 * `MIN_FILL_MS` is 3000, so every submission here waits out the deferred dispatch. That wait is the
 * feature, not overhead: a genuine fast submission must not be discarded as spam.
 */

const FILL_WAIT_MS = 3000

async function useScenario(page: import('@playwright/test').Page, scenario?: string) {
  if (scenario) await page.setExtraHTTPHeaders({ 'x-contact-scenario': scenario })
}

async function fillForm(
  page: import('@playwright/test').Page,
  values: { name?: string, email?: string, phone?: string, subject?: string, body?: string } = {}
) {
  await page.fill('#contact-name', values.name ?? 'Alex Morgan')
  await page.fill('#contact-subject', values.subject ?? 'Project inquiry')
  if (values.email !== undefined) await page.fill('#contact-email', values.email)
  else await page.fill('#contact-email', 'alex@example.com')
  if (values.phone !== undefined) await page.fill('#contact-phone', values.phone)
  await page.fill('#contact-body', values.body ?? 'A real enquiry written in the browser lane.')
}

const submit = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /send message|إرسال الرسالة/i }).click()

test.describe('contact submission outcomes', () => {
  test('neutral 200 replaces the form with the success state', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByRole('heading', { name: 'Message received' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Thanks — your submission has been received.')).toBeVisible()
    // Success REPLACES the form rather than banner-ing above it.
    await expect(page.locator('form')).toHaveCount(0)
    // And it never claims the message was stored — the API receipt is identical either way (D02-1).
    await expect(page.locator('main')).not.toContainText(/inbox|delivered|stored/i)
  })

  test('Send another message restores a fresh empty form', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)
    await expect(page.getByRole('heading', { name: 'Message received' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Send another message' }).click()
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('#contact-name')).toHaveValue('')
    await expect(page.getByRole('heading', { name: 'Message received' })).toHaveCount(0)
  })

  test('422 maps field errors onto their inputs and keeps the form', async ({ page }) => {
    await useScenario(page, 'validation')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText('Check the form')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('form')).toBeVisible()
    // The API reports the phone against `phone`; the form's input is `nationalNumber`, so the error
    // must be re-pointed rather than dropped.
    await expect(page.locator('main')).toContainText('Provide a valid international phone number')
  })

  test('429 with a readable Retry-After renders a localized duration', async ({ page }) => {
    await useScenario(page, 'throttled')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText('Too many messages')).toBeVisible({ timeout: 15000 })
    // 3600s, rounded up through Intl.RelativeTimeFormat.
    await expect(page.locator('main')).toContainText('in 1 hour')
  })

  test('429 without Retry-After falls back to static copy', async ({ page }) => {
    await useScenario(page, 'throttled-no-retry-after')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText('Too many messages')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('main')).toContainText('Please try again later')
    await expect(page.locator('main')).not.toContainText(/NaN|undefined|Invalid Date/)
  })

  test('429 with a malformed Retry-After degrades identically, never printing NaN', async ({ page }) => {
    await useScenario(page, 'throttled-bad-retry-after')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText('Too many messages')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('main')).toContainText('Please try again later')
    await expect(page.locator('main')).not.toContainText(/NaN/)
  })

  test('500 shows the non-blaming server state and preserves input', async ({ page }) => {
    await useScenario(page, 'server-error')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText("The message didn't go through")).toBeVisible({ timeout: 15000 })
    // A recoverable failure must not discard what the visitor typed.
    await expect(page.locator('#contact-name')).toHaveValue('Alex Morgan')
  })

  test('a transport failure reads as unreachable, not as a server error', async ({ page }) => {
    await useScenario(page, 'network-failure')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)

    await expect(page.getByText("Couldn't reach the server")).toBeVisible({ timeout: 15000 })
  })
})

test.describe('contact submission mechanics', () => {
  test('defers a sub-3-second submission and sends the real elapsed time', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')

    const request = page.waitForRequest(r => r.url().includes('/contact') && r.method() === 'POST')
    await fillForm(page)
    const clickedAt = Date.now()
    await submit(page)

    const posted = await request
    const dispatchedAfter = Date.now() - clickedAt
    const body = JSON.parse(posted.postData() ?? '{}') as { elapsedMs: number }

    // Dispatch waited out the trap rather than sending immediately…
    expect(dispatchedAfter).toBeGreaterThanOrEqual(FILL_WAIT_MS - 750)
    // …and the value sent is the REAL measured duration, not a number chosen to clear the threshold.
    expect(body.elapsedMs).toBeGreaterThanOrEqual(FILL_WAIT_MS)
    expect(Number.isInteger(body.elapsedMs)).toBe(true)
  })

  test('prevents a double submission across the anti-spam wait', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    await fillForm(page)

    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/contact')) posts += 1
    })

    // `requestSubmit()` rather than two button clicks: the button disables itself while pending, so
    // a second CLICK proves only that the browser ignores disabled buttons. Submitting the form
    // directly bypasses that and exercises the actual `pending` guard in `onSubmit`, which is what
    // has to hold across the anti-spam wait and the request.
    await page.evaluate(() => {
      const form = document.querySelector('form')
      form?.requestSubmit()
      form?.requestSubmit()
    })
    await expect(page.getByRole('heading', { name: 'Message received' })).toBeVisible({ timeout: 15000 })

    expect(posts).toBe(1)
  })

  test('submits email only, omitting phone from the payload', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    const request = page.waitForRequest(r => r.url().includes('/contact') && r.method() === 'POST')
    await fillForm(page)
    await submit(page)

    const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>
    expect(body.email).toBe('alex@example.com')
    expect(body).not.toHaveProperty('phone')
  })

  test('submits phone only, omitting email and normalizing to E.164', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    const request = page.waitForRequest(r => r.url().includes('/contact') && r.method() === 'POST')
    await fillForm(page, { email: '', phone: '0100 278 5408' })
    await submit(page)

    const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>
    expect(body).not.toHaveProperty('email')
    expect(body.phone).toBe('+201002785408')
  })

  test('submits both methods when both are supplied', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')
    const request = page.waitForRequest(r => r.url().includes('/contact') && r.method() === 'POST')
    await fillForm(page, { phone: '01002785408' })
    await submit(page)

    const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>
    expect(body.email).toBe('alex@example.com')
    expect(body.phone).toBe('+201002785408')
  })

  // The exact F-6 sequence, in a real browser.
  test('F-6: a stale contact-method error clears when a phone is entered, and the resubmit works', async ({ page }) => {
    await useScenario(page)
    await page.goto('/contact')

    await fillForm(page, { email: '' })
    await submit(page)
    await expect(page.getByText('Enter an email address or phone number.')).toBeVisible()

    await page.fill('#contact-phone', '01002785408')
    await expect(page.getByText('Enter an email address or phone number.')).toHaveCount(0)

    await submit(page)
    await expect(page.getByRole('heading', { name: 'Message received' })).toBeVisible({ timeout: 15000 })
  })

  test('the honeypot field is not named website in the DOM', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('input[name="website"]')).toHaveCount(0)
    await expect(page.locator('input[name="company-url"]')).toHaveCount(1)
  })
})

test.describe('contact direct methods and locale', () => {
  test('renders email, phone and WhatsApp actions from settings', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(1)
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(1)
    await expect(page.locator('a[href*="wa.me/"]')).toHaveCount(1)
    // The prefilled WhatsApp message is URL-encoded, never raw.
    const wa = await page.locator('a[href*="wa.me/"]').getAttribute('href')
    expect(wa).toContain('?text=')
    expect(wa).not.toContain(' ')
  })

  test('switching locale clears entered values and the status', async ({ page }) => {
    await useScenario(page, 'server-error')
    await page.goto('/contact')
    await fillForm(page)
    await submit(page)
    await expect(page.getByText("The message didn't go through")).toBeVisible({ timeout: 15000 })

    // By accessible name, not href: the nav's own "تواصل" link also points at /ar/contact, and it
    // is not the visible control here. `.first()` selects the header switcher over the footer's.
    await page.getByRole('link', { name: 'AR', exact: true }).first().click()
    await page.waitForURL('**/ar/contact')

    await expect(page.locator('#contact-name')).toHaveValue('')
    await expect(page.locator('#contact-company-url')).toHaveValue('')
    // Scoped to the outcome message itself: the page shell carries its own `role="status"` region
    // (the shared data-loading overlay), so counting them page-wide would assert someone else's DOM.
    await expect(page.getByText("The message didn't go through")).toHaveCount(0)
    await expect(page.getByText('تعذّر إرسال الرسالة')).toHaveCount(0)
  })

  test('the Arabic route renders its own copy and keeps numbers left-to-right', async ({ page }) => {
    await page.goto('/ar/contact')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('لنتحدث')

    // The fixture gives `contactPhone` and `whatsappPhone` the SAME line, so the combined item
    // prints the number ONCE and carries Call and WhatsApp as separate labelled actions beside it
    // (D10-16). Asserting the number as the `tel:` anchor's own text would assert the pre-combined
    // markup this design replaced; what has to hold is that the number is still printed in full and
    // that each action still carries it in its accessible name.
    await expect(page.locator('main')).toContainText('+20 100 278 5408')
    await expect(page.locator('a[href^="tel:"]')).toHaveAttribute('aria-label', /\+20 100 278 5408$/)
    await expect(page.locator('a[href*="wa.me/"]')).toHaveAttribute('aria-label', /\+20 100 278 5408$/)

    // Left-to-right is asserted as a RENDERED OUTCOME rather than as a mechanism: the leading `+`
    // must be PAINTED to the left of the final digit. Asserting the wrapper element, or even its
    // computed `unicode-bidi`, is weaker than it looks — `unicode-bidi: isolate; direction: rtl`
    // satisfies an isolation check while still throwing the `+` to the right-hand side inside this
    // RTL column, which is the exact defect c5832ce fixed. Geometry cannot be satisfied that way,
    // and it stays true for any wrapper that achieves the same result.
    const painted = await page
      .getByText('+20 100 278 5408', { exact: true })
      .evaluateAll((elements) => {
        for (const element of elements) {
          const text = Array.from(element.childNodes).find(
            (node): node is Text => node.nodeType === 3 && (node.textContent ?? '').trim().length > 0
          )
          if (!text) continue

          const head = document.createRange()
          head.setStart(text, 0)
          head.setEnd(text, 1)
          const tail = document.createRange()
          tail.setStart(text, text.data.length - 1)
          tail.setEnd(text, text.data.length)

          return {
            head: head.getBoundingClientRect().left,
            tail: tail.getBoundingClientRect().left
          }
        }
        return null
      })

    if (!painted) throw new Error('the number did not render as a text run of its own')
    expect(painted.head).toBeLessThan(painted.tail)
  })
})
