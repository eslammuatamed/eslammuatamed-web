// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'

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
  return { data: response, meta: { page: 1, perPage: 50, total: response.length, totalPages: 1 } }
})

holder.makeError = status => new ApiError({ type: 'about:blank', title: 'failed', status })

function reset(rows: unknown[] = [{ id: 's1' }]) {
  holder.calls = []
  holder.rows = rows
  holder.status = 0
  holder.releases = []
  holder.parkNext = false
}

describe('the absorbed useAdminSkills surface', () => {
  it('requests the first picker vocabulary page without a group filter', async () => {
    reset()
    const source = useAdminSkills()
    expect(Object.keys(source).sort()).toEqual(['failed', 'forbidden', 'load', 'pending', 'skills'])
    await source.load()
    expect(holder.calls).toEqual([{ path: '/admin/skills', options: { locale: false, query: { page: 1, perPage: 50 } } }])
    expect(source.skills.value).toHaveLength(1)
  })

  it('distinguishes forbidden from generic failure and clears unusable picker options', async () => {
    reset()
    holder.status = 403
    const forbidden = useAdminSkills()
    await forbidden.load()
    expect(forbidden.forbidden.value).toBe(true)
    expect(forbidden.failed.value).toBe(false)

    reset()
    holder.status = 500
    const failed = useAdminSkills()
    await failed.load()
    expect(failed.failed.value).toBe(true)
    expect(failed.forbidden.value).toBe(false)
    expect(failed.skills.value).toEqual([])
  })

  it('discards a superseded response', async () => {
    reset([{ id: 'old' }])
    const source = useAdminSkills()
    holder.parkNext = true
    const slow = source.load()
    holder.rows = [{ id: 'new' }]
    await source.load()
    expect(source.skills.value.map(skill => skill.id)).toEqual(['new'])
    holder.releases[0]?.()
    await slow
    expect(source.skills.value.map(skill => skill.id)).toEqual(['new'])
  })
})
