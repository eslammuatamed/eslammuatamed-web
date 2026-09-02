// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  rows: [] as unknown[],
  total: 0,
  totalPages: 1,
  status: 0,
  parkNext: false,
  releases: [] as Array<() => void>
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  const response = { rows: holder.rows, total: holder.total, totalPages: holder.totalPages }
  if (holder.parkNext) {
    holder.parkNext = false
    await new Promise<void>(resolve => holder.releases.push(resolve))
  }
  if (holder.status) throw new ApiError({ type: 'about:blank', title: 'failed', status: holder.status })
  return { data: response.rows, meta: { page: 1, perPage: 12, total: response.total, totalPages: response.totalPages } }
})

function reset(rows: unknown[] = [{ id: 'skill-1' }]) {
  holder.calls = []
  holder.rows = rows
  holder.total = rows.length
  holder.totalPages = 1
  holder.status = 0
  holder.parkNext = false
  holder.releases = []
}

describe('the paginated Skills collection owner', () => {
  it('sends the default page and fixed perPage while omitting an absent group', async () => {
    reset()
    const source = useAdminSkillsCollection()
    await source.load()
    expect(holder.calls).toEqual([{
      path: '/admin/skills', options: { locale: false, query: { page: 1, perPage: 12 } }
    }])
  })

  it.each(['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'] as const)('sends %s as the unchanged server enum', async group => {
    reset()
    const source = useAdminSkillsCollection()
    await source.load({ page: 2, group })
    expect(holder.calls[0]?.options.query).toEqual({ page: 2, perPage: 12, group })
  })

  it('uses server metadata and clears a failed different-group view', async () => {
    reset([{ id: 'frontend' }])
    holder.total = 13
    holder.totalPages = 2
    const source = useAdminSkillsCollection()
    await source.load({ page: 1, group: 'FRONTEND' })
    expect(source.total.value).toBe(13)
    expect(source.totalPages.value).toBe(2)
    holder.status = 500
    await source.load({ page: 1, group: 'BACKEND' })
    expect(source.items.value).toEqual([])
  })

  it('discards a slow old group response after the newer group has resolved', async () => {
    reset([{ id: 'frontend' }])
    const source = useAdminSkillsCollection()
    holder.parkNext = true
    const slow = source.load({ page: 1, group: 'FRONTEND' })
    holder.rows = [{ id: 'backend' }]
    await source.load({ page: 1, group: 'BACKEND' })
    holder.releases[0]?.()
    await slow
    expect(source.items.value.map(skill => skill.id)).toEqual(['backend'])
  })

  it('discards a slow old page response after the newer page has resolved', async () => {
    reset([{ id: 'page-one' }])
    const source = useAdminSkillsCollection()
    holder.parkNext = true
    const slow = source.load({ page: 1, group: 'FRONTEND' })
    holder.rows = [{ id: 'page-two' }]
    await source.load({ page: 2, group: 'FRONTEND' })
    holder.releases[0]?.()
    await slow
    expect(source.items.value.map(skill => skill.id)).toEqual(['page-two'])
  })
})
