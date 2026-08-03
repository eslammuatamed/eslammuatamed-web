// @vitest-environment nuxt
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useUnreadCount, __resetUnreadInFlight } from './useUnreadCount'

/**
 * The badge is derived state with two properties worth proving: it issues ONE request per burst
 * even though two independent callers (shell + page) ask for it, and it never renders a confident
 * number it has not been told.
 */
const holder = vi.hoisted(() => ({ api: null as unknown }))
mockNuxtImport('useApi', () => () => holder.api)

const paginated = (total: number) => ({ data: [], meta: { page: 1, perPage: 1, total, totalPages: 1 } })

/** Never resolves until released — lets two callers overlap deterministically, without timers. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  __resetUnreadInFlight()
  clearNuxtState()
})

describe('useUnreadCount — request shape', () => {
  it('derives the count from meta.total with perPage=1 and the active-unread filter', async () => {
    const api = vi.fn().mockResolvedValue(paginated(7))
    holder.api = api

    const { count, fetchCount } = useUnreadCount()
    await fetchCount()

    expect(api).toHaveBeenCalledWith('/admin/messages', {
      query: { isRead: false, isArchived: false, perPage: 1 }
    })
    expect(count.value).toBe(7)
  })
})

describe('useUnreadCount — deduplication', () => {
  it('two concurrent callers share ONE in-flight request', async () => {
    const gate = deferred<ReturnType<typeof paginated>>()
    const api = vi.fn().mockReturnValue(gate.promise)
    holder.api = api

    // The shell and the page ask in the same tick.
    const shell = useUnreadCount().fetchCount()
    const page = useUnreadCount().fetchCount()

    expect(api).toHaveBeenCalledTimes(1)

    gate.resolve(paginated(3))
    expect(await shell).toBe(3)
    expect(await page).toBe(3)
  })

  it('releases the in-flight slot after settling, so a later call refetches', async () => {
    const api = vi.fn().mockResolvedValue(paginated(1))
    holder.api = api

    const { fetchCount } = useUnreadCount()
    await fetchCount()
    await fetchCount()

    expect(api).toHaveBeenCalledTimes(2)
  })

  it('does not wedge the badge when a request rejects', async () => {
    const api = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(paginated(4))
    holder.api = api

    const { fetchCount, count } = useUnreadCount()
    await expect(fetchCount()).rejects.toThrow('network')
    // The slot is free again — a failure is not permanent.
    await fetchCount()
    expect(count.value).toBe(4)
  })
})

describe('useUnreadCount — freshness', () => {
  it('ensureFresh does not refetch a fresh value', async () => {
    const api = vi.fn().mockResolvedValue(paginated(2))
    holder.api = api

    const { ensureFresh } = useUnreadCount()
    await ensureFresh()
    await ensureFresh()

    expect(api).toHaveBeenCalledTimes(1)
  })

  it('refresh always refetches — a mutation knows the count moved', async () => {
    const api = vi.fn().mockResolvedValue(paginated(2))
    holder.api = api

    const { ensureFresh, refresh } = useUnreadCount()
    await ensureFresh()
    await refresh()

    expect(api).toHaveBeenCalledTimes(2)
  })

  it('ensureFresh swallows a failure — the badge must not break its caller', async () => {
    holder.api = vi.fn().mockRejectedValue(new Error('boom'))
    const { ensureFresh, count } = useUnreadCount()
    await expect(ensureFresh()).resolves.toBeUndefined()
    expect(count.value).toBeNull()
  })
})

describe('useUnreadCount — bounded display', () => {
  it('renders nothing before the first response — null is not zero', () => {
    holder.api = vi.fn()
    expect(useUnreadCount().badge.value).toBeNull()
  })

  it.each([
    [0, null],
    [1, '1'],
    [99, '99'],
    [100, '99+'],
    [1000, '99+']
  ])('count %i renders %s', async (total, expected) => {
    holder.api = vi.fn().mockResolvedValue(paginated(total))
    const { fetchCount, badge } = useUnreadCount()
    await fetchCount()
    expect(badge.value).toBe(expected)
  })
})
