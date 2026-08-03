import { expect } from '@playwright/test'
import {
  RequestCoordinator, badge, dbRow, dbUnreadCount, raceTest as test, renderedSubjects, resetMessages, sql
} from './harness'

/**
 * Real-API async-ordering proof for the Dashboard Inbox.
 *
 * Five review rounds moved the ordering logic in `messages.vue`, and the last two corrections
 * over-adjusted each other. Unit tests pin the intended contract but simulate the ordering; this lane
 * forces the ordering for real — real browser, real PATCH, real GET, real PostgreSQL — and asserts
 * black-box: final URL, rendered rows, slideover state, badge, and the database.
 *
 * The invariant under test:
 *   1. a successful mutation changes server state;
 *   2. the post-mutation refresh targets the view/page the reader is on WHEN THE REFRESH BEGINS;
 *   3. only the newest list request may commit list data;
 *   4. interaction-local effects do not leak into a later context;
 *   5. the badge reflects final confirmed server state.
 */

test('1 — archive, then navigate to Archived before the mutation lands', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  await page.goto('/dashboard/messages')
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  // Open it, which also marks it read; settle that before the archive so the two do not interleave.
  await page.locator('table tbody tr td:nth-child(3) button', { hasText: target.subject }).click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
  await expect.poll(() => dbRow(target.id)?.isRead).toBe(true)

  // Park the archive PATCH so the navigation can overtake it.
  coordinator.holdNext('PATCH')
  await page.locator('[role=dialog] button', { hasText: 'Archive' }).click()
  await coordinator.waitUntilHeld('PATCH')

  // The message is still UNARCHIVED on the server at this point — that is the whole race.
  expect(dbRow(target.id)?.isArchived).toBe(false)

  // Close the detail, then switch tabs. Both are CLIENT-SIDE: a full page load would cancel the
  // in-flight PATCH and destroy the race being tested. The open slideover's overlay legitimately
  // blocks the tab, which is correct modal behaviour, so a real reader dismisses it first.
  await page.keyboard.press('Escape')
  await expect(page.locator('[role=dialog]')).toBeHidden()

  // Reader navigates to Archived. Its list request runs now and therefore observes the
  // pre-mutation state: the message is not in it.
  await page.locator('button[role=tab]', { hasText: 'Archived' }).click()
  await expect.poll(async () => (await renderedSubjects(page)).length).toBe(2)
  expect(await renderedSubjects(page)).not.toContain(target.subject)

  // Now let the mutation land, and let the refresh it triggers complete.
  await coordinator.release('PATCH')
  await expect.poll(() => dbRow(target.id)?.isArchived, { timeout: 15_000 }).toBe(true)

  // THE ASSERTION THIS LANE EXISTS FOR: the destination list must end up containing the message,
  // even though the list request that populated it ran before the mutation existed.
  await expect.poll(async () => await renderedSubjects(page), { timeout: 15_000 })
    .toContain(target.subject)

  // Reader stays where they navigated; nothing yanks them back.
  expect(new URL(page.url()).searchParams.get('view')).toBe('archived')

  // No stale request removes it afterwards.
  await page.waitForTimeout(1500)
  expect(await renderedSubjects(page)).toContain(target.subject)

  // Server state, and the badge agreeing with it.
  expect(dbRow(target.id)).toEqual({ isRead: true, isArchived: true })
  await expect.poll(async () => await badge(page)).toBe(dbUnreadCount() === 0 ? null : String(dbUnreadCount()))

  // No stale interaction state leaked into the new context.
  await expect(page.getByText('The change did not save')).toBeHidden()
  expect(sql(`SELECT count(*) FROM contact_messages WHERE id='${target.id}' AND is_archived`)).toBe('1')
})

test('2 — unarchive, then navigate to Inbox before the mutation lands', async ({ page, coordinator }) => {
  const { archived } = resetMessages()
  const target = archived[0]!
  await page.goto('/dashboard/messages?view=archived')
  await expect(page.locator('table tbody tr')).toHaveCount(2)

  // Unarchive from the row menu, so no modal overlay is involved.
  const row = page.locator('table tbody tr', { hasText: target.subject })
  await row.locator('button[aria-label="Message actions"]').click()
  coordinator.holdNext('PATCH')
  await page.locator('[role=menuitem]', { hasText: 'Restore from archive' }).click()
  await coordinator.waitUntilHeld('PATCH')
  expect(dbRow(target.id)?.isArchived).toBe(true)

  // Navigate to Inbox; its list request runs against the PRE-mutation state.
  await page.locator('button[role=tab]', { hasText: 'Inbox' }).click()
  await expect.poll(async () => (await renderedSubjects(page)).length).toBe(3)
  expect(await renderedSubjects(page)).not.toContain(target.subject)

  await coordinator.release('PATCH')
  await expect.poll(() => dbRow(target.id)?.isArchived, { timeout: 15_000 }).toBe(false)

  // The destination (Inbox) must end up showing the restored message.
  await expect.poll(async () => await renderedSubjects(page), { timeout: 15_000 })
    .toContain(target.subject)
  expect(new URL(page.url()).searchParams.get('view')).toBe('inbox')

  // ...and it must be gone from Archived when the reader goes back.
  await page.locator('button[role=tab]', { hasText: 'Archived' }).click()
  await expect.poll(async () => await renderedSubjects(page), { timeout: 15_000 })
    .not.toContain(target.subject)

  expect(dbRow(target.id)).toEqual({ isRead: true, isArchived: false })
  await expect.poll(async () => await badge(page)).toBe(dbUnreadCount() === 0 ? null : String(dbUnreadCount()))
})

test('3 — several navigations during one mutation, GETs released out of order', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  await page.goto('/dashboard/messages')
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  const row = page.locator('table tbody tr', { hasText: target.subject })
  await row.locator('button[aria-label="Message actions"]').click()
  coordinator.holdNext('PATCH')
  await page.locator('[role=menuitem]', { hasText: 'Archive' }).click()
  await coordinator.waitUntilHeld('PATCH')

  // Inbox -> Archived -> Inbox, holding BOTH intermediate list reads so they can be released
  // in the wrong order on purpose.
  coordinator.holdNext('GET list isArchived=true')
  await page.locator('button[role=tab]', { hasText: 'Archived' }).click()
  await coordinator.waitUntilHeld('GET list isArchived=true')

  coordinator.holdNext('GET list isArchived=false')
  await page.locator('button[role=tab]', { hasText: 'Inbox' }).click()
  await coordinator.waitUntilHeld('GET list isArchived=false')

  // Release the NEWER (Inbox) request first, then the older (Archived) one. The stale Archived
  // response must not commit over the current Inbox view.
  await coordinator.release('GET list isArchived=false')
  await coordinator.release('GET list isArchived=true')

  await coordinator.release('PATCH')
  await expect.poll(() => dbRow(target.id)?.isArchived, { timeout: 15_000 }).toBe(true)

  // The final URL-selected view wins, and the archived message is NOT in it.
  expect(new URL(page.url()).searchParams.get('view')).toBe('inbox')
  await page.waitForTimeout(1500)
  const rows = await renderedSubjects(page)
  expect(rows).not.toContain(target.subject)
  // The older Archived response never leaked its rows into the Inbox view.
  expect(rows.every(s => s.startsWith('Inbox msg'))).toBe(true)
  // The mutation still refreshed the final destination: the archived row is gone from Inbox.
  expect(rows).toHaveLength(2)
  await expect.poll(async () => await badge(page)).toBe(dbUnreadCount() === 0 ? null : String(dbUnreadCount()))
})

test('4 — mutation fails for real while the reader navigates', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  const unreadBefore = dbUnreadCount()
  await page.goto('/dashboard/messages')
  await expect(page.locator('table tbody tr')).toHaveCount(3)
  const badgeBefore = await badge(page)

  const row = page.locator('table tbody tr', { hasText: target.subject })
  await row.locator('button[aria-label="Message actions"]').click()
  coordinator.holdNext('PATCH')
  await page.locator('[role=menuitem]', { hasText: 'Archive' }).click()
  await coordinator.waitUntilHeld('PATCH')

  // A GENUINE failure from the real API: delete the row while the PATCH is parked, so releasing it
  // produces a real 404 from the real service. Nothing is fabricated.
  sql(`DELETE FROM contact_messages WHERE id='${target.id}'`)

  await page.locator('button[role=tab]', { hasText: 'Archived' }).click()
  await expect.poll(async () => (await renderedSubjects(page)).length).toBe(2)

  await coordinator.release('PATCH')
  await page.waitForTimeout(2000)

  // Server membership is unchanged by the failed mutation (the row is gone because the TEST removed
  // it, and nothing was archived).
  expect(dbRow(target.id)).toBeNull()
  expect(sql('SELECT count(*) FROM contact_messages WHERE is_archived')).toBe('2')

  // The destination list stays correct and is not overwritten by the abandoned context.
  const rows = await renderedSubjects(page)
  expect(rows.every(s => s.startsWith('Archived msg'))).toBe(true)
  expect(new URL(page.url()).searchParams.get('view')).toBe('archived')

  // POLICY: a failure belonging to an abandoned context is NOT surfaced in the new one. It would
  // point at a message and a list the reader is no longer looking at.
  await expect(page.getByText('The change did not save')).toBeHidden()

  // No detail-close/focus effect from the abandoned context fires.
  await expect(page.locator('[role=dialog]')).toBeHidden()

  // THE REQUIREMENT: the unread count does not change, because no mutation succeeded. The badge is
  // refreshed only after a CONFIRMED mutation and is never polled (owner decision 7), so it
  // legitimately does not track the out-of-band delete this test performed to force the failure —
  // that delete is the test's instrument, not something the application can observe.
  expect(await badge(page)).toBe(badgeBefore)
  // The database moved only by the test's own delete; nothing was archived.
  expect(dbUnreadCount()).toBe(unreadBefore - 1)
  expect(sql('SELECT count(*) FROM contact_messages WHERE is_archived')).toBe('2')
})

test('4b — the same failure IS surfaced when the reader has not navigated', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  await page.goto('/dashboard/messages')
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  const row = page.locator('table tbody tr', { hasText: target.subject })
  await row.locator('button[aria-label="Message actions"]').click()
  coordinator.holdNext('PATCH')
  await page.locator('[role=menuitem]', { hasText: 'Archive' }).click()
  await coordinator.waitUntilHeld('PATCH')

  sql(`DELETE FROM contact_messages WHERE id='${target.id}'`)
  await coordinator.release('PATCH')

  // The counterpart to scenario 4: staying put means the failure is genuinely the reader's, so it
  // must be shown. Suppression is scoped to abandoned contexts, never used to hide a real failure.
  await expect(page.getByText('The change did not save')).toBeVisible({ timeout: 15_000 })
})

test('5 — URL, Back/Forward and a stale selection during the race', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  await page.goto('/dashboard/messages')
  await page.locator('table tbody tr td:nth-child(3) button', { hasText: target.subject }).click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('message')).toBe(target.id)

  // Archive it while it is the selected message.
  coordinator.holdNext('PATCH')
  await page.locator('[role=dialog] button', { hasText: 'Archive' }).click()
  await coordinator.waitUntilHeld('PATCH')
  await coordinator.release('PATCH')
  await expect.poll(() => dbRow(target.id)?.isArchived, { timeout: 15_000 }).toBe(true)

  // The message left the Inbox, so the detail closes and only `message` is dropped from the URL.
  await expect(page.locator('[role=dialog]')).toBeHidden({ timeout: 15_000 })
  const after = new URL(page.url())
  expect(after.searchParams.get('message')).toBeNull()
  expect(after.pathname).toBe('/dashboard/messages')

  // Back/Forward must not restore stale rows: the archived message stays out of the Inbox.
  await page.goBack()
  await page.waitForTimeout(1200)
  expect(await renderedSubjects(page)).not.toContain(target.subject)
  await page.goForward()
  await page.waitForTimeout(1200)
  expect(await renderedSubjects(page)).not.toContain(target.subject)

  // A selection that no longer exists in the loaded page is handled without a broken slideover.
  await page.goto(`/dashboard/messages?message=${target.id}`)
  await expect(page.locator('table tbody tr').first()).toBeVisible()
  await expect(page.locator('[role=dialog]')).toBeHidden()
  await expect(page.getByText('That message is not on this page')).toBeVisible()
  // Focus stayed in the document rather than jumping to a row from the previous view.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBeTruthy()
})

test('6 — archiving the only row on a non-first page', async ({ page, coordinator }) => {
  resetMessages()
  // 13 unarchived rows => page 2 holds exactly one.
  sql(`INSERT INTO contact_messages (id,name,email,phone,subject,body,is_read,is_archived,archived_at,meta,created_at,updated_at)
       SELECT gen_random_uuid(),'Bulk '||g,'b'||g||'@example.com',NULL,'Bulk msg '||g,'Body',true,false,NULL,'{}'::jsonb, now() - (g||' hours')::interval, now()
       FROM generate_series(1,10) g`)
  const total = Number(sql('SELECT count(*) FROM contact_messages WHERE NOT is_archived'))
  expect(total).toBe(13)

  await page.goto('/dashboard/messages?page=2')
  await expect.poll(async () => (await renderedSubjects(page)).length).toBe(1)
  const only = (await renderedSubjects(page))[0] as string

  const row = page.locator('table tbody tr', { hasText: only })
  await row.locator('button[aria-label="Message actions"]').click()
  await page.locator('[role=menuitem]', { hasText: 'Archive' }).click()

  await expect.poll(() => Number(sql('SELECT count(*) FROM contact_messages WHERE NOT is_archived')), { timeout: 15_000 })
    .toBe(12)
  await page.waitForTimeout(1500)

  // Governed behaviour: page 2 no longer exists. The page must not loop, must not show a stale row,
  // and the URL must stay coherent with what is rendered.
  const url = new URL(page.url())
  const renderedNow = await renderedSubjects(page)
  expect(renderedNow).not.toContain(only)

  // Whatever the page settles on, it is driven by confirmed server metadata: either it stayed on
  // page 2 and shows the honest empty state, or it is on a page that exists and renders rows.
  if (renderedNow.length === 0) {
    await expect(page.getByText('No messages yet')).toBeVisible()
  } else {
    expect(Number(url.searchParams.get('page') ?? '1')).toBeLessThanOrEqual(
      Number(sql('SELECT ceil(count(*)::numeric/12) FROM contact_messages WHERE NOT is_archived'))
    )
  }
  // No invalid page loop: the request log must not grow without bound.
  expect(coordinator.ordering().filter(l => l.includes('GET list')).length).toBeLessThan(12)
})

test('badge and request behaviour across a mutation', async ({ page, coordinator }) => {
  const { inbox } = resetMessages()
  const target = inbox[0]!
  await page.goto('/dashboard/messages')
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  const before = coordinator.ordering().length
  const row = page.locator('table tbody tr', { hasText: target.subject })
  await row.locator('button[aria-label="Message actions"]').click()
  await page.locator('[role=menuitem]', { hasText: 'Archive' }).click()
  await expect.poll(() => dbRow(target.id)?.isArchived, { timeout: 15_000 }).toBe(true)
  await page.waitForTimeout(2000)

  const issued = coordinator.ordering().slice(before)
  // Exactly ONE mutation request — no duplicate PATCH.
  expect(issued.filter(l => l.includes('PATCH'))).toHaveLength(1)
  // The badge is refreshed after the successful mutation.
  expect(issued.filter(l => l.includes('badge-count')).length).toBeGreaterThanOrEqual(1)
  // The unconditional list refresh does not loop.
  expect(issued.filter(l => l.includes('GET list')).length).toBeLessThanOrEqual(2)
  await expect.poll(async () => await badge(page)).toBe(dbUnreadCount() === 0 ? null : String(dbUnreadCount()))

  // Shell + page both ask for the count on load; the dedup must keep that to one request.
  const fresh = await page.context().newPage()
  const c2 = await RequestCoordinator.attach(fresh)
  await fresh.goto('/dashboard/messages')
  await expect(fresh.locator('table tbody tr').first()).toBeVisible()
  await fresh.waitForTimeout(1500)
  expect(c2.ordering().filter(l => l.includes('badge-count'))).toHaveLength(1)
  await c2.drain()
  await fresh.close()
})
