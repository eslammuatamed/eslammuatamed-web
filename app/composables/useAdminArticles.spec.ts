// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'
import type { AdminArticlesQuery } from '~/composables/admin-articles-query'

/**
 * `useAdminArticles` — and specifically the one rule that makes §14.9 criterion 2 expressible.
 *
 * "A failed request must not destroy usable content" and "a failed request must not leave rows on
 * screen pretending to describe the current filter" are BOTH true, and they pull in opposite
 * directions. `useAdminProjects` resolves the conflict by always clearing, which is safe and loses
 * criterion 2. This composable resolves it by asking whether the failed request was a refresh of
 * what is ALREADY SHOWN, or a request for a different view.
 *
 * That distinction is invisible to a test that only checks "an error flag was set", which is why it
 * is asserted here in both directions rather than once.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  status: 0,
  rows: [] as unknown[],
  total: 0,
  totalPages: 1,
  /** Parks the request so overlapping loads can be interleaved deterministically. */
  release: null as null | (() => void)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, ...options })
  if (holder.release !== null) {
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.status !== 0) {
    throw new ApiError({ type: 'about:blank', title: 'Request failed', status: holder.status })
  }
  return { data: holder.rows, meta: { page: 1, perPage: 12, total: holder.total, totalPages: holder.totalPages } }
})

const ROW = { id: 'a1', status: 'PUBLISHED', translations: {} }

function reset(rows: unknown[] = [ROW]) {
  holder.calls = []
  holder.status = 0
  holder.rows = rows
  holder.total = rows.length
  holder.totalPages = 1
  holder.release = null
}

const query = (over: Partial<AdminArticlesQuery> = {}): AdminArticlesQuery =>
  ({ page: 1, status: 'all', ...over }) as AdminArticlesQuery

describe('a failure that is a REFRESH of what is on screen', () => {
  it('KEEPS the rows, and flags the failure without clearing them', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query())
    expect(list.items.value).toHaveLength(1)

    // The SAME view, now failing.
    holder.status = 500
    await list.load(query())

    expect(list.items.value, 'usable content survives a failed refresh').toHaveLength(1)
    expect(list.failed.value).toBe(true)
    expect(list.total.value, 'the count that describes those rows survives with them').toBe(1)
  })
})

describe('a failure for a DIFFERENT view', () => {
  it('CLEARS the rows, because they describe the previous filter', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query())
    expect(list.items.value).toHaveLength(1)

    // A different status — the rows on screen do not describe it.
    holder.status = 500
    await list.load(query({ status: 'DRAFT' }))

    expect(
      list.items.value,
      'rows from the previous filter must not be left pretending to be current'
    ).toHaveLength(0)
    expect(list.failed.value).toBe(true)
    expect(list.total.value).toBe(0)
  })

  it('CLEARS on a different PAGE too — page 2 is not a stand-in for page 3', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query({ page: 2 }))
    expect(list.items.value).toHaveLength(1)

    holder.status = 500
    await list.load(query({ page: 3 }))
    expect(list.items.value).toHaveLength(0)
  })

  it('CLEARS when a different title search fails — prior rows do not describe the new search', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query({ q: 'nest' }))
    expect(list.items.value).toHaveLength(1)

    holder.status = 500
    await list.load(query({ q: 'nestjs' }))

    expect(list.items.value).toHaveLength(0)
    expect(list.failed.value).toBe(true)
  })

  it('CLEARS when the very first load fails, since there is nothing to preserve', async () => {
    reset()
    holder.status = 500
    const list = useAdminArticles()
    await list.load(query())
    expect(list.items.value).toHaveLength(0)
    expect(list.failed.value).toBe(true)
  })
})

describe('403 is not 500 and not empty', () => {
  it('raises forbidden rather than failed', async () => {
    reset([])
    holder.status = 403
    const list = useAdminArticles()
    await list.load(query())
    expect(list.forbidden.value).toBe(true)
    expect(list.failed.value).toBe(false)
  })
})

describe('out-of-order responses', () => {
  it('discards a SUPERSEDED response instead of letting it overwrite the newest', async () => {
    reset([ROW])
    const list = useAdminArticles()

    // First request parks in flight.
    holder.release = () => {}
    const first = list.load(query({ status: 'DRAFT' }))

    // A second request is issued and completes normally.
    const parked = holder.release as unknown as () => void
    holder.release = null
    holder.rows = [ROW, { ...ROW, id: 'a2' }]
    holder.total = 2
    const second = list.load(query({ status: 'PUBLISHED' }))
    await second

    expect(list.items.value).toHaveLength(2)

    // Now the stale first request lands. It must not write.
    holder.rows = [ROW]
    parked()
    await first

    expect(list.items.value, 'a superseded response must not overwrite the newest').toHaveLength(2)
  })

  it('discards an old-q response after a newer title search wins', async () => {
    reset([ROW])
    const list = useAdminArticles()

    holder.release = () => {}
    const first = list.load(query({ q: 'nest' }))

    const parked = holder.release as unknown as () => void
    holder.release = null
    holder.rows = [ROW, { ...ROW, id: 'nestjs' }]
    holder.total = 2
    await list.load(query({ q: 'nestjs' }))

    holder.rows = [ROW]
    parked()
    await first

    expect(list.items.value.map(row => row.id)).toEqual(['a1', 'nestjs'])
  })

  it('a SUPERSEDED failure does not raise an error against the newer view', async () => {
    reset([ROW])
    const list = useAdminArticles()

    holder.release = () => {}
    holder.status = 500
    const first = list.load(query({ status: 'DRAFT' }))

    const parked = holder.release as unknown as () => void
    holder.release = null
    holder.status = 0
    const second = list.load(query({ status: 'PUBLISHED' }))
    await second
    expect(list.failed.value).toBe(false)

    parked()
    await first
    expect(list.failed.value, 'the stale failure belongs to a view nobody is looking at').toBe(false)
    expect(list.items.value).toHaveLength(1)
  })
})

describe('the request it actually issues', () => {
  it('omits status when the filter is `all`, and sends it otherwise', async () => {
    reset()
    const list = useAdminArticles()

    await list.load(query())
    expect(holder.calls.at(-1)?.query).toEqual({ page: 1, perPage: 12 })

    await list.load(query({ status: 'ARCHIVED' }))
    expect(holder.calls.at(-1)?.query).toEqual({ page: 1, perPage: 12, status: 'ARCHIVED' })
  })

  it('sends q with the exact page and status the URL committed', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query({ page: 2, status: 'PUBLISHED', q: 'nestjs' }))

    expect(holder.calls.at(-1)?.query).toEqual({ page: 2, perPage: 12, status: 'PUBLISHED', q: 'nestjs' })
  })

  it('retries the same q, status and page without filtering its server response locally', async () => {
    reset([{ ...ROW, id: 'server-result' }])
    const list = useAdminArticles()
    const searched = query({ page: 2, status: 'PUBLISHED', q: 'nestjs' })
    await list.load(searched)

    // The result is accepted as the server's authoritative filter outcome; no title predicate runs here.
    expect(list.items.value.map(row => row.id)).toEqual(['server-result'])

    holder.status = 500
    await list.load(searched)
    holder.status = 0
    await list.load(searched)
    expect(holder.calls.at(-1)?.query).toEqual({ page: 2, perPage: 12, status: 'PUBLISHED', q: 'nestjs' })
  })

  it('is locale-agnostic on every call', async () => {
    reset()
    const list = useAdminArticles()
    await list.load(query())
    expect(holder.calls.at(-1)?.locale).toBe(false)
  })
})
