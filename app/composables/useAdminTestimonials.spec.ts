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
  return { data: response }
})

holder.makeError = status => new ApiError({ type: 'about:blank', title: 'failed', status })

function reset(rows: unknown[] = [{ id: 't1' }]) {
  holder.calls = []
  holder.rows = rows
  holder.status = 0
  holder.releases = []
  holder.parkNext = false
}

describe('the Testimonials collection read', () => {
  it('reads the whole list with no query parameters and locale suppressed', async () => {
    reset()
    const source = useAdminTestimonials()
    expect(Object.keys(source).sort()).toEqual(['failed', 'forbidden', 'items', 'load', 'pending'])
    await source.load()
    expect(holder.calls).toEqual([{ path: '/admin/testimonials', options: { locale: false } }])
    expect(source.items.value).toHaveLength(1)
    expect(source.pending.value).toBe(false)
  })

  it('distinguishes forbidden from generic failure and clears unusable rows', async () => {
    reset()
    holder.status = 403
    const forbidden = useAdminTestimonials()
    await forbidden.load()
    expect(forbidden.forbidden.value).toBe(true)
    expect(forbidden.failed.value).toBe(false)

    reset()
    holder.status = 500
    const failed = useAdminTestimonials()
    await failed.load()
    expect(failed.failed.value).toBe(true)
    expect(failed.forbidden.value).toBe(false)
    expect(failed.items.value).toEqual([])
  })

  it('renders the received order verbatim — order values running backwards stay backwards', async () => {
    reset([{ id: 'sent-third', order: 30 }, { id: 'sent-first', order: 10 }, { id: 'sent-second', order: 20 }])
    const source = useAdminTestimonials()
    await source.load()
    expect(source.items.value.map(item => item.id)).toEqual(['sent-third', 'sent-first', 'sent-second'])
  })

  it('discards a superseded response instead of letting a slow earlier read win', async () => {
    reset([{ id: 'old' }])
    const source = useAdminTestimonials()
    holder.parkNext = true
    const slow = source.load()
    holder.rows = [{ id: 'new' }]
    await source.load()
    expect(source.items.value.map(item => item.id)).toEqual(['new'])
    holder.releases[0]?.()
    await slow
    expect(source.items.value.map(item => item.id)).toEqual(['new'])
  })
})
