// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  rows: [] as unknown[],
  status: 0,
  parkNext: false,
  releases: [] as Array<() => void>
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  const response = holder.rows
  if (holder.parkNext) {
    holder.parkNext = false
    await new Promise<void>(resolve => holder.releases.push(resolve))
  }
  if (holder.status) throw new ApiError({ type: 'about:blank', title: 'failed', status: holder.status })
  return { data: response, meta: { page: 1, perPage: 12, total: response.length, totalPages: 1 } }
})

function reset(rows: unknown[] = [{ id: 'category-1' }]) {
  holder.calls = []
  holder.rows = rows
  holder.status = 0
  holder.parkNext = false
  holder.releases = []
}

describe('the Categories collection read', () => {
  it('requests the production page contract and exposes server metadata', async () => {
    reset([{ id: 'category-1' }, { id: 'category-2' }])
    const source = useAdminCategories()
    await source.load({ page: 2 })
    expect(holder.calls).toEqual([{
      path: '/admin/categories', options: { locale: false, query: { page: 2, perPage: 12 } }
    }])
    expect(source.total.value).toBe(2)
    expect(source.totalPages.value).toBe(1)
  })

  it('clears page-one rows when page two fails, rather than mislabelling stale rows', async () => {
    reset()
    const source = useAdminCategories()
    await source.load({ page: 1 })
    holder.status = 500
    await source.load({ page: 2 })
    expect(source.failed.value).toBe(true)
    expect(source.items.value).toEqual([])
  })

  it('discards a slow page-one response after page two has won', async () => {
    reset([{ id: 'old' }])
    const source = useAdminCategories()
    holder.parkNext = true
    const slow = source.load({ page: 1 })
    holder.rows = [{ id: 'new' }]
    await source.load({ page: 2 })
    holder.releases[0]?.()
    await slow
    expect(source.items.value.map(row => row.id)).toEqual(['new'])
  })
})
