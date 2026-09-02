// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { parseAdminProjectsQuery } from '~/composables/admin-projects-query'
import { ApiError } from '~/utils/api-error'

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  rows: [] as unknown[],
  status: 0,
  releases: [] as Array<() => void>,
  parkNext: false
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  const response = { data: holder.rows, meta: { page: 1, perPage: 12, total: holder.rows.length, totalPages: 1 } }
  if (holder.parkNext) {
    holder.parkNext = false
    await new Promise<void>(resolve => holder.releases.push(resolve))
  }
  if (holder.status !== 0) throw new ApiError({ type: 'about:blank', title: 'Request failed', status: holder.status })
  return response
})

function reset(rows: unknown[] = [{ id: 'p1' }]): void {
  holder.calls = []
  holder.rows = rows
  holder.status = 0
  holder.releases = []
  holder.parkNext = false
}

describe('useAdminProjects', () => {
  it('passes pagination, search, filters and sort to the server with locale suppressed', async () => {
    reset()
    const source = useAdminProjects()
    await source.load(parseAdminProjectsQuery({ page: '2', q: 'api', published: 'yes', featured: 'no', sortBy: 'year', sortOrder: 'desc' }))

    expect(holder.calls).toEqual([{
      path: '/admin/projects',
      options: { locale: false, query: { page: 2, perPage: 12, q: 'api', isPublished: true, featured: false, sortBy: 'year', sortOrder: 'desc' } }
    }])
  })

  it('keeps usable rows visible when a refresh fails', async () => {
    reset([{ id: 'held' }])
    const source = useAdminProjects()
    await source.load(parseAdminProjectsQuery({}))

    holder.status = 500
    await source.load(parseAdminProjectsQuery({ q: 'next' }))
    expect(source.items.value.map(row => row.id)).toEqual(['held'])
    expect(source.failed.value).toBe(true)
  })

  it('discards an earlier response that resolves after the newer query', async () => {
    reset([{ id: 'old' }])
    const source = useAdminProjects()
    holder.parkNext = true
    const earlier = source.load(parseAdminProjectsQuery({ q: 'old' }))

    holder.rows = [{ id: 'current' }]
    await source.load(parseAdminProjectsQuery({ q: 'current' }))
    expect(source.items.value.map(row => row.id)).toEqual(['current'])

    holder.releases[0]?.()
    await earlier
    expect(source.items.value.map(row => row.id)).toEqual(['current'])
  })

  it('surfaces 403 as forbidden rather than a generic failure', async () => {
    reset()
    holder.status = 403
    const source = useAdminProjects()
    await source.load(parseAdminProjectsQuery({}))
    expect(source.forbidden.value).toBe(true)
    expect(source.failed.value).toBe(false)
  })
})
