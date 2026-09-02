import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { MSG } from '../../scripts/e2e/dashboard-server'
import {
  DESKTOP, MOBILE, cardOpeners, drawerTrigger, listSettled, messagesNavLink, query, resetBackend,
  seedSinglePage, setBackendState, signIn, slideover, tableOpeners, unreadBadge
} from './harness'

/**
 * Dashboard Inbox — the committed CI browser suite (Feature 012).
 *
 * ONE FILE ON PURPOSE. This project shares a single MUTABLE backend process, so every test must run
 * serially against it. Playwright's `workers` is a top-level option only — it cannot be set per
 * project — and `fullyParallel: false` serialises tests WITHIN a file while still distributing
 * FILES across workers. Split across three files these specs therefore reset each other's fixtures
 * mid-assertion (observed: a keyboard-navigation test that passed in isolation failed in the full
 * run). Keeping them in one file is what actually makes the lane serial.
 *
 * Layering: this suite protects normal Dashboard behaviour deterministically in CI. The committed
 * `e2e-race/` lane remains the AUTHORITATIVE proof for timing-sensitive ordering against a real API
 * and a real database. Neither replaces the other.
 *
 * Selection is by structure or by fixture identity, never by rendered copy.
 */

/** Full unfiltered WCAG 2.2 AA scan. No rule disabled and no region excluded. */
async function axe(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    violations,
    `${label}: ${JSON.stringify(violations.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.length })), null, 2)}`
  ).toEqual([])
}

/** The row action menu for a given row index, opened. Structural, not copy-based. */
async function openRowMenu(page: Page, index = 0) {
  const row = page.locator('table tbody tr').nth(index)
  await row.locator('button').last().click()
  await expect(page.locator('[role=menu]')).toBeVisible()
}

test.describe('Shell, navigation and list presentations', () => {
  /**
   * Dashboard shell, navigation, and the two responsive list presentations (Feature 012).
   *
   * This is the CI-durable layer. It proves normal behaviour deterministically against the committed
   * dashboard backend; `e2e-race/` remains the authoritative proof for timing-sensitive ordering
   * against a real database.
   */

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/login')
    await resetBackend(page)
  })

  test('authenticated shell loads with the Messages destination', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    await expect(messagesNavLink(page)).toBeVisible()
  })

  test('unread badge renders a nonzero count and disappears at zero', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    // The fixture seeds unread messages, so the badge must be present and numeric.
    await expect.poll(() => unreadBadge(page), { timeout: 15_000 }).toMatch(/^\d+\+?$/)

    // Zero unread ⇒ NO badge, not a rendered "0".
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/messages')
    await listSettled(page)
    await page.goto('/dashboard')
    await listSettled(page)
    await expect.poll(() => unreadBadge(page), { timeout: 15_000 }).toBeNull()
  })

  test('active Messages navigation state is exposed', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const link = messagesNavLink(page)
    const active = await link.evaluate(el =>
      el.getAttribute('aria-current') ?? (el.className.includes('active') ? 'page' : null))
    expect(active, 'the current destination must be programmatically exposed').not.toBeNull()
  })

  test('desktop renders the table; mobile renders the UCard list and no table', async ({ page }) => {
    await signIn(page)

    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    await expect(page.locator('table')).toBeVisible()
    expect(await tableOpeners(page).count()).toBeGreaterThan(0)

    await page.setViewportSize(MOBILE)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    await expect(page.locator('article').first()).toBeVisible()
    expect(
      await page.locator('table').isVisible().catch(() => false),
      'the desktop table must not render on the mobile card surface'
    ).toBe(false)
  })

  test('mobile drawer exposes navigation', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    // The sidebar link exists in the DOM at every width but is hidden below `lg`, so assert against
    // the sidebar navigation landmark rather than the visible Overview action with the same route.
    await expect(
      messagesNavLink(page),
      'the desktop sidebar must be hidden on mobile'
    ).toBeHidden()

    await drawerTrigger(page).click()
    const drawer = page.locator('[role=dialog]')
    await expect(drawer).toBeVisible()
    await expect(
      drawer.locator('a[href="/dashboard/messages"]'),
      'the mobile drawer must expose the Messages destination'
    ).toBeVisible()
  })

  test('unread state is not colour-only', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const textual = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label]'))
        .some(el => /unread|read/i.test(el.getAttribute('aria-label') ?? '')))
    expect(textual, 'read/unread must be exposed to assistive tech, not by colour alone').toBe(true)
  })

  test('no nested interactive controls anywhere in the list', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const nested = await page.evaluate(() => {
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
      return Array.from(document.querySelectorAll(sel)).filter(el => el.querySelector(sel)).length
    })
    expect(nested, 'an interactive control must never contain another').toBe(0)
  })

  test('mobile card opener and its action menu do not trigger one another', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    await expect(page.locator('article').first()).toBeVisible()

    // Opening the row action menu must NOT open the detail slideover.
    const card = page.locator('article').first()
    const buttons = card.locator('button')
    const menuTrigger = buttons.last()
    await menuTrigger.click()
    await expect(
      page.locator('[role=dialog]'),
      'the action menu must not open the message detail'
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    // And the opener must open the detail.
    await cardOpeners(page).click()
    await expect(page.locator('[role=dialog]')).toBeVisible()
  })

  test('no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'the governed 320px width must not scroll horizontally').toBeLessThanOrEqual(1)
  })

  test('pagination moves between pages and is carried by the URL', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signIn(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const firstPage = await tableOpeners(page).allTextContents()

    await page.goto('/dashboard/messages?page=2')
    await listSettled(page)
    const secondPage = await tableOpeners(page).allTextContents()

    expect(new URL(page.url()).searchParams.get('page')).toBe('2')
    expect(secondPage, 'page 2 must not render page 1').not.toEqual(firstPage)
    expect(secondPage.length).toBeGreaterThan(0)
  })
})

test.describe('collection refresh continuity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/login')
    await resetBackend(page)
    await page.setViewportSize(DESKTOP)
    await signIn(page)
  })

  test('page refresh keeps the current list and detail usable through stale retry', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const held = await tableOpeners(page).allTextContents()
    expect(held.length).toBeGreaterThan(0)

    await setBackendState(page, { delayMs: 2000 })
    await page.locator('[aria-label="Page 2"]').click()
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    expect(await tableOpeners(page).allTextContents(), 'refresh must retain the usable current page').toEqual(held)

    await setBackendState(page, { mode: 'error' })
    await expect(page.locator('[data-messages-stale]')).toBeVisible({ timeout: 15_000 })
    expect(await tableOpeners(page).allTextContents(), 'a failed page refresh must leave stale rows available').toEqual(held)
    await expect(page.locator('[data-messages-failed]')).toHaveCount(0)

    await setBackendState(page, { mode: 'ok', delayMs: 0 })
    await page.locator('[data-messages-stale-retry]').click()
    await listSettled(page)
    await expect(page.locator('[data-messages-stale]')).toHaveCount(0)
    expect(query(page).get('page')).toBe('2')
    expect(await tableOpeners(page).allTextContents(), 'retry must replace held rows with requested page').not.toEqual(held)

    // Detail remains a mutation-capable working surface once the list has recovered; opening an
    // unread row triggers the confirmed, action-local mark-read path rather than list takeover.
    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    await expect(page.locator('[data-messages-failed]')).toHaveCount(0)

    await page.setViewportSize({ width: 380, height: 780 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'the retained-list notice must not introduce 380px horizontal overflow').toBeLessThanOrEqual(1)
  })
})

test.describe('URL contract and detail selection', () => {
  /**
   * URL contract and detail selection (Feature 012).
   *
   * The canonical route-query schema (`app/utils/messages-query.ts`, D11-7) must be TOTAL and PURE:
   * every input yields a valid result, and reading never rewrites the URL. Both properties are
   * asserted here directly, because a parser that rewrites what it reads is how navigation loops start.
   */

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/login')
    await resetBackend(page)
    await page.setViewportSize(DESKTOP)
    await signIn(page)
  })

  test('opening detail puts the id in the URL; closing removes only `message`', async ({ page }) => {
    await page.goto('/dashboard/messages?view=inbox&page=1')
    await listSettled(page)

    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    expect(query(page).get('message'), 'opening must record the selection in the URL').toBeTruthy()

    await page.keyboard.press('Escape')
    await expect(slideover(page)).toHaveCount(0)
    expect(query(page).get('message'), 'closing must clear the selection').toBeNull()
    expect(query(page).get('view'), 'closing must not disturb the view').toBe('inbox')
    expect(query(page).get('page'), 'closing must not disturb the page').toBe('1')
  })

  test('a selected message survives reload', async ({ page }) => {
    // A single page, so the message cannot be paged out by its own auto-read between the first load
    // and the reload. Resolving a selection that is NOT on the loaded page would require a detail
    // request, which this feature deliberately does not make (list rows already carry the body).
    await seedSinglePage(page)
    await page.goto(`/dashboard/messages?message=${MSG.both}`)
    await listSettled(page)
    await expect(slideover(page)).toBeVisible()

    await page.reload()
    await listSettled(page)
    await expect(slideover(page), 'a deep-linked selection must survive a reload').toBeVisible()
  })

  test('Back and Forward restore detail state', async ({ page }) => {
    await seedSinglePage(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    const selected = query(page).get('message')

    await page.goBack()
    await listSettled(page)
    await expect(slideover(page), 'Back must close the detail').toHaveCount(0)

    await page.goForward()
    await listSettled(page)
    await expect(slideover(page), 'Forward must restore the detail').toBeVisible()
    expect(query(page).get('message')).toBe(selected)
  })

  test('an unknown but well-formed id clears safely instead of breaking the page', async ({ page }) => {
    await page.goto(`/dashboard/messages?message=${MSG.absent}`)
    await listSettled(page)
    await expect(page.locator('table'), 'the list must still render').toBeVisible()
    await expect(slideover(page), 'a stale selection must not leave an empty dialog open').toHaveCount(0)
  })

  test('view switches between Inbox and Archived by URL', async ({ page }) => {
    await page.goto('/dashboard/messages?view=archived')
    await listSettled(page)
    const archived = (await tableOpeners(page).allTextContents()).join(' ')
    expect(archived).toContain('Archived subject')

    await page.goto('/dashboard/messages?view=inbox')
    await listSettled(page)
    const inbox = (await tableOpeners(page).allTextContents()).join(' ')
    expect(inbox).toContain('Inbox subject')
    expect(inbox).not.toContain('Archived subject')
  })

  /**
   * Malformed and hostile query values. The parser is TOTAL, so each of these must render a working
   * surface, and PURE, so none of them may cause the URL to be rewritten.
   */
  const HOSTILE = [
    '?view=<script>alert(1)</script>&page=-5',
    '?view=archived%00&page=NaN',
    '?page=999999999999999999999',
    "?view=' OR 1=1--&page=1e9",
    '?view=../../etc/passwd',
    '?page[]=2&view[]=archived',
    '?view=ARCHIVED&page=+2',
    '?message=not-a-uuid&view=inbox',
    '?page=0',
    '?page=1.5'
  ]

  for (const q of HOSTILE) {
    test(`malformed query normalises deterministically and never rewrites the URL: ${q}`, async ({ page }) => {
      const expected = new URL(`http://x/dashboard/messages${q}`).search
      await page.goto(`/dashboard/messages${q}`)
      await listSettled(page)

      // TOTAL: a usable surface always renders — never an error boundary, never a blank page.
      // A page number beyond the last page legitimately yields an EMPTY list rather than a table, so
      // the assertion is "the Messages surface rendered", not "rows exist".
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })
      expect(
        (await page.locator('main').innerText()).trim().length,
        'the Messages surface must render something'
      ).toBeGreaterThan(0)

      // PURE: reading must not rewrite. A rewrite here is the first half of a navigation loop.
      // Compared as decoded PARAMS, not as a raw string: `%20` vs `+` is a serialisation difference
      // between `URL` and the browser, not a rewrite, and asserting the raw form would fail on it.
      const after = new URL(page.url())
      expect(after.pathname).toBe('/dashboard/messages')
      const seen = [...after.searchParams.entries()].sort()
      const want = [...new URLSearchParams(expected).entries()].sort()
      expect(seen, 'the parser must normalise on read, not rewrite the URL').toEqual(want)
    })
  }

  test('unrelated query parameters are preserved', async ({ page }) => {
    await page.goto('/dashboard/messages?view=archived&utm_source=newsletter&ref=abc')
    await listSettled(page)
    expect(query(page).get('utm_source')).toBe('newsletter')
    expect(query(page).get('ref')).toBe('abc')

    // ...and still preserved after an in-page selection changes the URL.
    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    expect(query(page).get('utm_source'), 'selecting must not drop unrelated params').toBe('newsletter')
  })

  test('focus returns to the exact desktop opener', async ({ page }) => {
    await seedSinglePage(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = tableOpeners(page).nth(1)
    const id = await opener.getAttribute('data-message')
    expect(id).toBeTruthy()
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(slideover(page)).toHaveCount(0)

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute?.('data-message') ?? null),
        { timeout: 10_000 })
      .toBe(id)
  })

  test('focus returns to the exact mobile opener', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = page.locator('[data-opener="card"]').first()
    // Identity, not text: opening flips the row's read-state label, so its text is not stable across
    // the interaction under test.
    const id = await opener.getAttribute('data-message')
    expect(id).toBeTruthy()
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(slideover(page)).toHaveCount(0)

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute?.('data-message') ?? null),
        { timeout: 10_000 })
      .toBe(id)
  })

  test('keyboard alone can reach and open a message', async ({ page }) => {
    await seedSinglePage(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    // Tab to the first row opener, then activate it ONCE.
    //
    // The activation is deliberately outside the search loop. An earlier version checked
    // `isVisible()` immediately after Enter, which is an instant read: if the overlay had not
    // rendered yet the loop tabbed again, focus moved INTO the dialog's focus trap, and no
    // subsequent Tab could ever land back on a row opener — a self-inflicted race that failed
    // roughly one run in a hundred and twenty-six. Waiting for the overlay is the assertion.
    let reached = false
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press('Tab')
      reached = await page.evaluate(() => {
        const el = document.activeElement
        return !!el?.closest('table tbody tr') && el.tagName === 'BUTTON'
      })
    }
    expect(reached, 'a row opener must be reachable by Tab alone').toBe(true)

    await page.keyboard.press('Enter')
    await expect(slideover(page), 'Enter on a focused row opener must open the detail').toBeVisible()
  })

  /**
   * REGRESSION — the detail must not close itself.
   *
   * Opening an unread message auto-marks it read, and a confirmed mutation refreshes the list. Because
   * the list is unread-first, the just-opened message is re-sorted behind every remaining unread one,
   * which on any inbox holding more than one page of unread mail moves it off the current page. The
   * detail then closed roughly 400 ms after opening while `?message=` still named the message — the
   * URL and the page disagreeing, which is precisely what the canonical query schema exists to stop.
   *
   * This uses the FULL fixture set deliberately: with 17 messages at 12 per page the reproduction is
   * guaranteed, and a single-page fixture would silently stop exercising it.
   */
  test('the detail stays open when auto-read re-sorts the message off the page', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await listSettled(page)
    expect(await tableOpeners(page).count(), 'this regression needs a full page').toBe(12)

    const opener = tableOpeners(page).first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()

    // The refresh that used to close it lands within a few hundred ms; wait well past that.
    await page.waitForTimeout(2500)

    await expect(slideover(page), 'the detail must survive its own auto-read refresh').toBeVisible()
    expect(query(page).get('message'), 'the URL must still agree with what is shown').toBe(id)
  })
})

test.describe('Mutations, contact shapes, required states and accessibility', () => {
  /**
   * Triage mutations, contact-method affordances, required states, and the WCAG 2.2 AA matrix.
   *
   * Mutations are CONFIRMED, never optimistic (owner decision 6): the assertions below are written so
   * that an optimistic implementation would FAIL them — state must change only after the server
   * confirms, and a failure must leave the previous confirmed state intact.
   */

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/login')
    await resetBackend(page)
    await page.setViewportSize(DESKTOP)
    await signIn(page)
  })

  test('opening an unread message marks it read only after confirmed success', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const before = await unreadBadge(page)

    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()

    // The badge must follow CONFIRMED server state, so it settles to one less than before.
    await expect.poll(() => unreadBadge(page), { timeout: 15_000 })
      .not.toBe(before)
  })

  test('a failed mutation preserves the previous confirmed state', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const badgeBefore = await unreadBadge(page)
    const rowsBefore = await tableOpeners(page).allTextContents()

    // The very next PATCH fails. An optimistic implementation would have already moved the row.
    await setBackendState(page, { failNextPatch: true })
    await openRowMenu(page)
    await page.locator('[role=menu] [role=menuitem]').first().click()
    await listSettled(page)
    await expect(page.locator('div[aria-live="polite"]')).toContainText('The change did not save')
    await expect(messagesNavLink(page)).toBeVisible()

    expect(await tableOpeners(page).allTextContents(), 'a failed mutation must not change the list')
      .toEqual(rowsBefore)
    expect(await unreadBadge(page), 'a failed mutation must not change the unread badge')
      .toBe(badgeBefore)
  })

  test('archive removes from Inbox and appears in Archived; unarchive reverses it', async ({ page }) => {
    // A single page, so membership is asserted by IDENTITY rather than by row counts — a full 12-row
    // page stays full after one archive and would make a count assertion silently vacuous.
    await seedSinglePage(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const subject = (await tableOpeners(page).first().textContent())?.trim() as string
    expect(subject).toBeTruthy()

    await openRowMenu(page)
    await page.locator('[role=menu] [role=menuitem]').last().click()
    await listSettled(page)

    expect(await tableOpeners(page).allTextContents(), 'archiving must remove it from Inbox')
      .not.toContain(subject)

    await page.goto('/dashboard/messages?view=archived')
    await listSettled(page)
    expect(await tableOpeners(page).allTextContents(), 'the archived message must appear in Archived')
      .toContain(subject)

    // Unarchive the same message and require it back in Inbox.
    const idx = (await tableOpeners(page).allTextContents()).findIndex(t => t.trim() === subject)
    await openRowMenu(page, idx)
    await page.locator('[role=menu] [role=menuitem]').last().click()
    await listSettled(page)

    await page.goto('/dashboard/messages')
    await listSettled(page)
    expect(await tableOpeners(page).allTextContents(), 'unarchiving must return it to Inbox')
      .toContain(subject)
  })

  test('mark unread restores the unread badge', async ({ page }) => {
    await seedSinglePage(page)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    // Read a message first.
    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await listSettled(page)
    const afterRead = await unreadBadge(page)

    // Mark it unread again through the row menu.
    await openRowMenu(page)
    await page.locator('[role=menu] [role=menuitem]').first().click()
    await listSettled(page)
    await expect.poll(() => unreadBadge(page), { timeout: 15_000 }).not.toBe(afterRead)
  })

  test('contact affordances: email-only, phone-only, both — and never an inferred WhatsApp', async ({ page }) => {
    for (const [id, wantMailto, wantTel] of [
      [MSG.emailOnly, true, false],
      [MSG.phoneOnly, false, true],
      [MSG.both, true, true]
    ] as const) {
      await page.goto(`/dashboard/messages?message=${id}`)
      await listSettled(page)
      await expect(slideover(page)).toBeVisible()

      const dialog = slideover(page)
      const html = (await dialog.innerHTML()).toLowerCase()
      expect(html, `${id}: a WhatsApp affordance must never be inferred from a phone number`)
        .not.toContain('whatsapp')
      expect(html, `${id}: no wa.me link`).not.toContain('wa.me')

      const mailto = await dialog.locator('a[href^="mailto:"]').count()
      const tel = await dialog.locator('a[href^="tel:"]').count()
      expect(mailto > 0, `${id}: reply-by-email presence`).toBe(wantMailto)
      expect(tel > 0, `${id}: Call presence`).toBe(wantTel)

      if (wantTel) {
        // Copy number is a control, distinct from the tel: link.
        expect(await dialog.locator('button').count(), `${id}: Copy number control`).toBeGreaterThan(0)
      }
    }
  })

  test('empty Inbox and empty Archived render a state, not a broken list', async ({ page }) => {
    await setBackendState(page, { mode: 'empty' })

    await page.goto('/dashboard/messages')
    await listSettled(page)
    await expect(page.locator('table tbody tr')).toHaveCount(0)
    expect((await page.locator('main').innerText()).trim().length,
      'an empty Inbox must say something').toBeGreaterThan(0)
    await axe(page, 'messages/empty-inbox')

    await page.goto('/dashboard/messages?view=archived')
    await listSettled(page)
    await expect(page.locator('table tbody tr')).toHaveCount(0)
    await axe(page, 'messages/empty-archived')
  })

  test('a recoverable API error offers recovery, and recovery works', async ({ page }) => {
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/messages')
    await listSettled(page)

    await expect(page.locator('table tbody tr')).toHaveCount(0)
    // The Inbox/Archived tabs are also buttons inside <main>; the recovery control is not a tab.
    const recovery = page.locator('main button:not([role=tab])')
    expect(await recovery.count(), 'a transport error must offer a recovery control').toBeGreaterThan(0)
    await axe(page, 'messages/error')

    // Heal the backend, use the recovery control, and require real rows.
    await setBackendState(page, { mode: 'ok' })
    await recovery.first().click()
    await listSettled(page)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })
  })

  test('a real 403 renders a forbidden state, not an empty list', async ({ page }) => {
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const text = (await page.locator('main').innerText()).toLowerCase()
    expect(text, '403 must be a distinct surface from "no messages"')
      .toMatch(/permission|forbidden|access|not allowed/)
    await axe(page, 'messages/forbidden')
  })

  test('offline: a mutation cannot be confirmed and the previous state stands', async ({ page, context }) => {
    await page.goto('/dashboard/messages')
    await listSettled(page)
    const rowsBefore = await tableOpeners(page).allTextContents()
    const badgeBefore = await unreadBadge(page)

    // Open the menu FIRST, then drop the network: the mutation is what must be prevented, and
    // clicking through a torn-down network would be testing the harness, not the product.
    await openRowMenu(page)
    await context.setOffline(true)
    await page.locator('[role=menu] [role=menuitem]').first().click()
    await page.waitForTimeout(1500)

    expect(await tableOpeners(page).allTextContents(),
      'an unconfirmed offline mutation must not alter the list').toEqual(rowsBefore)
    expect(await unreadBadge(page),
      'an unconfirmed offline mutation must not alter the badge').toBe(badgeBefore)

    await context.setOffline(false)
  })

  test('the Archived view carries the retention copy and the Inbox does not', async ({ page }) => {
    await page.goto('/dashboard/messages?view=archived')
    await listSettled(page)
    const archivedText = (await page.locator('main').innerText()).toLowerCase()
    expect(archivedText, 'the Archived view must state the retention policy').toMatch(/retain|retention|kept|deleted/)

    await page.goto('/dashboard/messages?view=inbox')
    await listSettled(page)
    const inboxText = (await page.locator('main').innerText()).toLowerCase()
    expect(inboxText, 'retention copy belongs to Archived only').not.toMatch(/retention/)
  })

  test('WCAG 2.2 AA — login, overview, inbox, archived, slideover, desktop and mobile', async ({ page }) => {
    // Single page: the desktop pass auto-reads the sampled message, which would otherwise page it out
    // before the mobile pass deep-links to it.
    await seedSinglePage(page)
    for (const [label, viewport] of [['desktop', DESKTOP], ['mobile', MOBILE]] as const) {
      await page.setViewportSize(viewport)

      await page.goto('/dashboard/login')
      await axe(page, `login/${label}`)

      await page.goto('/dashboard')
      await listSettled(page)
      await axe(page, `overview/${label}`)

      await page.goto('/dashboard/messages')
      await listSettled(page)
      await axe(page, `messages/inbox/${label}`)

      await page.goto('/dashboard/messages?view=archived')
      await listSettled(page)
      await axe(page, `messages/archived/${label}`)

      await page.goto(`/dashboard/messages?message=${MSG.both}`)
      await listSettled(page)
      await expect(slideover(page)).toBeVisible()
      await axe(page, `messages/slideover/${label}`)
    }
  })

  test('reduced motion is honoured and stays accessible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard/messages')
    await listSettled(page)
    await expect(page.locator('table')).toBeVisible()
    await axe(page, 'messages/reduced-motion')
    await page.emulateMedia({ reducedMotion: null })
  })
})


/**
 * FOCUS RESTORATION AFTER A GOVERNED SLIDEOVER CLOSE.
 *
 * The invariant is single and absolute: closing the detail must NEVER leave focus on `<body>`.
 * Restoring to the exact opener is the preferred outcome, but the opener genuinely ceases to exist
 * in several ordinary flows — auto-read re-sorts the message off the current page, archiving removes
 * it, the reader pages or switches view while the detail is open. In every one of those the fallback
 * is the labelled list region, which names the CURRENT view so a screen reader announces where focus
 * landed.
 *
 * What the fallback must NOT be: the hidden desktop/mobile counterpart, an arbitrary first message,
 * or an opener belonging to a page or view the reader has already left.
 */
type FocusInfo = {
  isBody: boolean
  tag: string | null
  messageId: string | null
  presentation: string | null
  role: string | null
  ariaLabel: string | null
  visible: boolean
}

async function focusInfo(page: Page): Promise<FocusInfo> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      isBody: el === document.body || el === null,
      tag: el?.tagName?.toLowerCase() ?? null,
      messageId: el?.getAttribute?.('data-message') ?? null,
      presentation: el?.getAttribute?.('data-opener') ?? null,
      role: el?.getAttribute?.('role') ?? null,
      ariaLabel: el?.getAttribute?.('aria-label') ?? null,
      // Proves the fallback is never the `display:none` counterpart of the other breakpoint.
      visible: el ? (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkVisibilityCSS: true }) : el.offsetParent !== null) : false
    }
  })
}

/**
 * Focus once it has SETTLED, which is not the same as focus once it is first acceptable.
 *
 * The failure mode being guarded against is a LATE overwrite: `USlideover` performs its own focus
 * restoration when it unmounts, and that lands after ours — the original defect was precisely our
 * value being replaced by the overlay's, which resolved to a detached node and therefore `<body>`.
 * A poll that stops the instant it sees a non-body value cannot tell "landed correctly" from
 * "landed correctly, then was stolen", so it would go green on the exact bug it is here to catch.
 *
 * So: poll until focus is off `<body>`, then hold and re-check that it is STILL off `<body>` and
 * still the same element.
 */
async function settledFocus(page: Page): Promise<FocusInfo> {
  let last: FocusInfo = await focusInfo(page)
  await expect.poll(async () => {
    last = await focusInfo(page)
    return last.isBody
  }, { timeout: 10_000, message: 'focus must never settle on <body> after a governed close' }).toBe(false)

  // Long enough to cover the overlay's own post-unmount restoration, which is what used to win.
  await page.waitForTimeout(600)
  const after = await focusInfo(page)
  expect(after.isBody, 'focus was restored and then STOLEN back to <body>').toBe(false)
  expect(after.messageId, 'focus must not drift to a different element after settling').toBe(last.messageId)
  return after
}

async function closeDetail(page: Page) {
  await page.keyboard.press('Escape')
  await expect(slideover(page)).toHaveCount(0)
}

test.describe('Focus restoration and its fallback', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend(page)
    await signIn(page)
  })

  test('opener remains present — desktop table restores the EXACT opener', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = tableOpeners(page).nth(1)
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await closeDetail(page)

    const focus = await settledFocus(page)
    expect(focus.messageId, 'the exact opener must win when it survives').toBe(id)
    expect(focus.presentation).toBe('row')
    expect(focus.visible).toBe(true)
  })

  test('opener remains present — mobile UCard list restores the EXACT opener', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = page.locator('[data-opener="card"]').first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await closeDetail(page)

    const focus = await settledFocus(page)
    expect(focus.messageId).toBe(id)
    // Never the desktop counterpart, which is in the DOM but `display:none` at this width.
    expect(focus.presentation, 'must not focus the hidden desktop row').toBe('card')
    expect(focus.visible).toBe(true)
  })

  test('opener is REPLACED but the message stays on the page — re-acquired, not dropped', async ({ page }) => {
    // A single-page fixture keeps the message on screen while auto-read re-renders the row, so the
    // clicked node is replaced by a fresh one carrying the same identity.
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = tableOpeners(page).first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await closeDetail(page)

    const focus = await settledFocus(page)
    expect(focus.messageId, 'the replacement node for the same message must take focus').toBe(id)
    expect(focus.presentation).toBe('row')
  })

  test('opener moves OFF the page after auto-read sorting — falls back to the list region', async ({ page }) => {
    // The full fixture is 17 inbox rows at 12 per page, ordered unread-first. Opening an unread
    // message on page 1 marks it read, which sorts it behind every remaining unread one and pushes
    // it onto page 2. The opener then genuinely does not exist on the current page.
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const opener = tableOpeners(page).first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()
    await closeDetail(page)

    const focus = await settledFocus(page)
    expect(focus.messageId, 'the vanished opener must not be re-invented').toBeNull()
    expect(focus.tag).toBe('section')
    expect(focus.ariaLabel, 'the fallback must name the current view').toMatch(/inbox/i)
    expect(focus.visible).toBe(true)

    // And specifically NOT an arbitrary neighbouring message.
    const rowIds = await page.locator('[data-opener="row"]').evaluateAll(
      els => els.map(e => e.getAttribute('data-message'))
    )
    expect(rowIds, 'sanity: the opened message really did leave page 1').not.toContain(id)
  })

  test('opener DISAPPEARS after archive — falls back to the list region', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()

    // Archive from inside the detail: the message leaves the Inbox list entirely.
    await page.locator('[role=dialog] button').filter({ hasText: /archive/i }).first().click()
    await expect(slideover(page)).toHaveCount(0)

    const focus = await settledFocus(page)
    expect(focus.tag).toBe('section')
    expect(focus.ariaLabel).toMatch(/inbox/i)
  })

  test('unarchive from the Archived view — falls back to the Archived list region', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages?view=archived')
    await listSettled(page)

    await tableOpeners(page).first().click()
    await expect(slideover(page)).toBeVisible()
    await page.locator('[role=dialog] button').filter({ hasText: /unarchive|restore/i }).first().click()
    await expect(slideover(page)).toHaveCount(0)

    const focus = await settledFocus(page)
    expect(focus.tag).toBe('section')
    expect(focus.ariaLabel, 'the fallback must name the ARCHIVED list, not the Inbox').toMatch(/archived/i)
  })

  test('PAGE changes while the detail is open — no focus restore to the old page’s opener', async ({ page }) => {
    // The detail is MODAL, so the pagination control and the view tabs cannot be clicked while it is
    // open. The only way page or view changes underneath an open detail is history navigation — which
    // is precisely the contract this page is built on: the URL is the single source of truth, so Back
    // and Forward move view/page/selection together. A single `history.go(-2)` is one such step.
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    // page 1 -> page 2 -> open a message there. Three history entries.
    // The UPagination root, not the sidebar nav — both are `<nav>`.
    await page.locator('nav[data-slot=root] button').filter({ hasText: /^2$/ }).first().click()
    await expect.poll(() => query(page).get('page')).toBe('2')
    await listSettled(page)

    const opener = tableOpeners(page).first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()

    // One step back over BOTH the selection and the page change: the detail closes and the list is
    // page 1, where the opener never existed.
    await page.evaluate(() => history.go(-2))
    await expect(slideover(page)).toHaveCount(0)
    await expect.poll(() => query(page).get('page')).toBeNull()
    await listSettled(page)

    const focus = await settledFocus(page)
    expect(focus.messageId, 'an opener from page 2 is not a valid target on page 1').not.toBe(id)
    expect(focus.tag).toBe('section')
    expect(focus.visible).toBe(true)
  })

  test('VIEW changes while the detail is open — no focus restore to the old view’s opener', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    // inbox -> archived -> open a message there.
    await page.locator('[role=tab]').filter({ hasText: /archived/i }).click()
    await expect.poll(() => query(page).get('view')).toBe('archived')
    await listSettled(page)

    const opener = tableOpeners(page).first()
    const id = await opener.getAttribute('data-message')
    await opener.click()
    await expect(slideover(page)).toBeVisible()

    // Back over the selection AND the view switch in one step: the reader is in the Inbox again.
    await page.evaluate(() => history.go(-2))
    await expect(slideover(page)).toHaveCount(0)
    await expect.poll(() => query(page).get('view')).toBeNull()
    await listSettled(page)

    const focus = await settledFocus(page)
    expect(focus.messageId, 'an Archived opener is not a valid target in the Inbox').not.toBe(id)
    expect(focus.tag).toBe('section')
    expect(focus.ariaLabel, 'the fallback must name the list the reader is now in').toMatch(/inbox/i)
  })

  test('a deep-linked detail with no opener at all still never lands on <body>', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto(`/dashboard/messages?message=${MSG.both}`)
    await expect(slideover(page)).toBeVisible()
    await closeDetail(page)

    const focus = await settledFocus(page)
    expect(focus.tag).toBe('section')
  })

  test('the fallback region is programmatic-only — it is not a keyboard tab stop', async ({ page }) => {
    await seedSinglePage(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/dashboard/messages')
    await listSettled(page)

    const tabindex = await page.locator('section[aria-label]').first().getAttribute('tabindex')
    expect(tabindex, 'tabindex=-1 only, so no keyboard user gains a stop').toBe('-1')
  })
})
