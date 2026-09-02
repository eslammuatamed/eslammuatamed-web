// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'

/**
 * `useAdminExperiences` — the three properties that a copy of `useAdminArticles` would get wrong.
 *
 * 1. It reads an ENVELOPE, not a page. The contract sends `{ data: [...] }` with no `meta`, so a
 *    composable that reached for `res.meta.total` would read `undefined` and a list would report
 *    "undefined roles". Asserted by answering with NO `meta` at all.
 * 2. It NEVER re-sorts. The API's order is `isCurrent` first; a `startDate desc` sort is a defect
 *    that has already shipped once. Asserted with rows whose two orderings differ.
 * 3. Keep-or-clear still holds, with its view identity degenerated to "has anything loaded" —
 *    because a zero-parameter endpoint has exactly one view.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  status: 0,
  rows: [] as unknown[],
  release: null as null | (() => void)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, ...options })
  const response = holder.rows
  if (holder.release !== null) {
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.status !== 0) {
    throw new ApiError({ type: 'about:blank', title: 'Request failed', status: holder.status })
  }
  return { data: response, meta: { page: 1, perPage: 12, total: response.length, totalPages: 1 } }
})

/**
 * Two rows whose API order and whose `startDate desc` order DISAGREE — the `EXP.endedLater` pair.
 *
 * `current` started earlier but is the current role, so the API ranks it FIRST. A naive
 * `startDate desc` ranks `endedLater` (2026-03) above it. Any client-side sort flips these.
 */
const CURRENT = { id: 'current', isCurrent: true, startDate: '2025-01-15T00:00:00.000Z', endDate: null, order: 0, employmentType: 'FULL_TIME', technologyIds: [], translations: {} }
const ENDED_LATER = { id: 'endedLater', isCurrent: false, startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-07-31T00:00:00.000Z', order: 3, employmentType: 'FREELANCE', technologyIds: [], translations: {} }

function reset(rows: unknown[] = [CURRENT, ENDED_LATER]) {
  holder.calls = []
  holder.status = 0
  holder.rows = rows
  holder.release = null
}

describe('useAdminExperiences', () => {
  it('requests the canonical first server page with locale suppressed', async () => {
    reset()
    const { load } = useAdminExperiences()
    await load()
    expect(holder.calls).toHaveLength(1)
    expect(holder.calls[0]!.path).toBe('/admin/experiences')
    expect(holder.calls[0]!.locale).toBe(false)
    expect(holder.calls[0]!.query).toEqual({ page: 1, perPage: 12 })
  })

  it('reads the server pagination metadata with its rows', async () => {
    reset()
    const { items, total, totalPages, load } = useAdminExperiences()
    await load()
    expect(items.value).toHaveLength(2)
    expect(total.value).toBe(2)
    expect(totalPages.value).toBe(1)
  })

  /**
   * ⚠ THE DISCRIMINATING ORDER TEST.
   *
   * Passes only if the rows are untouched. A `startDate desc` sort — the obvious reading of a CV
   * list, and the one that shipped a defect to production — puts `endedLater` first and fails here.
   */
  it('renders the API order verbatim, current-role-first, and never re-sorts by startDate', async () => {
    reset([CURRENT, ENDED_LATER])
    const { items, load } = useAdminExperiences()
    await load()
    expect(items.value.map(row => row.id)).toEqual(['current', 'endedLater'])
  })

  it('surfaces 403 as forbidden and NOT as a generic failure', async () => {
    reset()
    holder.status = 403
    const { forbidden, failed, load } = useAdminExperiences()
    await load()
    expect(forbidden.value).toBe(true)
    expect(failed.value).toBe(false)
  })

  it('clears nothing it never had: a failed FIRST load shows the error with an empty list', async () => {
    reset()
    holder.status = 500
    const { items, failed, load } = useAdminExperiences()
    await load()
    expect(failed.value).toBe(true)
    expect(items.value).toEqual([])
  })

  /**
   * Keep-or-clear (§10.3 rule 2). The rows survive a failed REFRESH, so the page can report
   * staleness instead of blanking a list that is still usable.
   */
  it('KEEPS the rows when a same-page refresh fails after a successful load', async () => {
    reset()
    const { items, failed, load } = useAdminExperiences()
    await load()
    expect(items.value).toHaveLength(2)

    holder.status = 500
    await load()
    expect(failed.value).toBe(true)
    expect(items.value).toHaveLength(2)
  })

  it('CLEARS rows when a different page fails instead of mislabelling the previous page', async () => {
    reset()
    const { items, failed, load } = useAdminExperiences()
    await load({ page: 1 })
    holder.status = 500
    await load({ page: 2 })
    expect(failed.value).toBe(true)
    expect(items.value).toEqual([])
  })

  /**
   * The overlap race, which survives the absence of query parameters: a slow EARLIER response must
   * not overwrite a fast later one. Without the sequence token the first response wins by arriving
   * last, and the list silently shows stale rows.
   */
  it('discards a superseded response instead of letting it overwrite fresher rows', async () => {
    reset([CURRENT])
    const composable = useAdminExperiences()

    holder.release = () => {}
    const slow = composable.load({ page: 1 })
    const releaseSlow = holder.release

    holder.release = null
    holder.rows = [ENDED_LATER]
    await composable.load({ page: 2 })
    expect(composable.items.value.map(r => r.id)).toEqual(['endedLater'])

    releaseSlow?.()
    await slow
    // The stale response landed last and was DISCARDED.
    expect(composable.items.value.map(r => r.id)).toEqual(['endedLater'])
  })
})
