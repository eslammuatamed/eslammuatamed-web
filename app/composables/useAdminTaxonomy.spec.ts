// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'

/**
 * Calibration for BOTH taxonomy collection reads (FE-3 Taxonomy, `U2`).
 *
 * The two composables are deliberate siblings — one per endpoint, so each section of the page owns
 * independent request state without a shared list abstraction. This spec holds them to the SAME
 * contract: whole `{ data }` read, zero query parameters, `locale: false`, forbidden-vs-failure
 * split, keep-content on failed refresh, and the superseded-response token.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  rows: [] as unknown[],
  status: 0,
  releases: [] as Array<() => void>,
  parkNext: false,
  makeError: null as null | ((status: number) => unknown)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  const response = holder.rows
  if (holder.parkNext) {
    holder.parkNext = false
    await new Promise<void>(resolve => holder.releases.push(resolve))
  }
  if (holder.status) throw holder.makeError?.(holder.status) ?? new Error('failed')
  return { data: response, meta: { page: 1, perPage: 12, total: response.length, totalPages: 1 } }
})

holder.makeError = status => new ApiError({ type: 'about:blank', title: 'failed', status })

function reset(rows: unknown[] = [{ id: 'row-1' }]) {
  holder.calls = []
  holder.rows = rows
  holder.status = 0
  holder.releases = []
  holder.parkNext = false
}

for (const [name, useComposable, endpoint] of [
  ['Categories', useAdminCategories, '/admin/categories'],
  ['Tags', useAdminTags, '/admin/tags']
] as const) {
  describe(`the ${name} collection read`, () => {
    it('reads the first collection page with locale suppressed', async () => {
      reset()
      const source = useComposable()
      expect(Object.keys(source).sort()).toEqual(['failed', 'forbidden', 'items', 'load', 'pending', 'total', 'totalPages'])
      await source.load()
      expect(holder.calls).toEqual([{ path: endpoint, options: { locale: false, query: { page: 1, perPage: 12 } } }])
      expect(source.items.value).toHaveLength(1)
      expect(source.pending.value).toBe(false)
      expect(source.failed.value).toBe(false)
    })

    it('renders rows in the order RECEIVED — no client-side sort exists on this line', async () => {
      // Deliberately NOT sorted by any field: what arrives is what renders.
      const order = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
      reset(order)
      const source = useComposable()
      await source.load()
      expect(source.items.value.map(row => row.id)).toEqual(['c', 'a', 'b'])
    })

    it('distinguishes forbidden from generic failure and clears unusable rows', async () => {
      reset()
      holder.status = 403
      const source = useComposable()
      await source.load()
      expect(source.forbidden.value).toBe(true)
      expect(source.failed.value).toBe(false)

      reset()
      holder.status = 500
      const failing = useComposable()
      await failing.load()
      expect(failing.forbidden.value).toBe(false)
      expect(failing.failed.value).toBe(true)
      expect(failing.items.value).toEqual([])
    })

    it('keeps rows and stays non-error when a REFRESH fails after a good load', async () => {
      reset()
      const source = useComposable()
      await source.load()
      expect(source.items.value).toHaveLength(1)

      reset()
      holder.status = 503
      await source.load()
      expect(source.items.value).toHaveLength(1)
      expect(source.failed.value).toBe(true)
    })

    it('ignores a superseded response entirely', async () => {
      reset([{ id: 'slow-truth' }])
      const source = useComposable()

      holder.parkNext = true
      const slow = source.load()
      // Swap the backend's answer WITHOUT resetting flags — the parked release must survive.
      holder.rows = [{ id: 'fast-truth' }]
      const fast = source.load()
      await fast
      for (const release of holder.releases.splice(0)) release()
      await slow

      expect(source.items.value.map(row => row.id)).toEqual(['fast-truth'])
      expect(source.pending.value).toBe(false)
    })
  })
}
