// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'
import { useMediaLibrary } from './useMediaLibrary'

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  respond: (() => Promise.resolve({ data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } })) as
    (path: string, options: Record<string, unknown>) => Promise<unknown>
}))

mockNuxtImport('useApi', () => () => (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  return holder.respond(path, options)
})

function reset(respond?: typeof holder.respond) {
  holder.calls = []
  if (respond) holder.respond = respond
}

const problem = (status: number) =>
  new ApiError({ type: 'about:blank', title: 'x', status })

describe('the list request', () => {
  it('sends `locale: false` — an unsolicited ?locale= is a 422 on an admin DTO', async () => {
    reset(() => Promise.resolve({ data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } }))
    await useMediaLibrary().load()
    expect(holder.calls[0]?.options.locale).toBe(false)
  })

  it('OMITS `q` and `kind` entirely when they are unset, rather than sending empty values', async () => {
    reset()
    await useMediaLibrary().load({ page: 2 })
    expect(holder.calls[0]?.options.query).toEqual({ page: 2, perPage: 12 })
  })

  it('sends `q` and `kind` when they are set', async () => {
    reset()
    await useMediaLibrary().load({ q: 'desk', kind: 'PDF', page: 1 })
    expect(holder.calls[0]?.options.query).toEqual({ page: 1, perPage: 12, q: 'desk', kind: 'PDF' })
  })

  it('separates 403 from a transport failure — they are different answers', async () => {
    reset(() => Promise.reject(problem(403)))
    const forbiddenLib = useMediaLibrary()
    await forbiddenLib.load()
    expect(forbiddenLib.forbidden.value).toBe(true)
    expect(forbiddenLib.failed.value).toBe(false)

    reset(() => Promise.reject(problem(500)))
    const failedLib = useMediaLibrary()
    await failedLib.load()
    expect(failedLib.forbidden.value).toBe(false)
    expect(failedLib.failed.value).toBe(true)
  })

  it('clears the previous result set on failure, so stale rows cannot pose as current', async () => {
    reset(() => Promise.resolve({
      data: [{ id: 'a1' }], meta: { page: 1, perPage: 12, total: 1, totalPages: 1 }
    }))
    const library = useMediaLibrary()
    await library.load()
    expect(library.items.value).toHaveLength(1)

    holder.respond = () => Promise.reject(problem(500))
    await library.load()
    expect(library.items.value).toEqual([])
    expect(library.total.value).toBe(0)
  })

  it('lets only the NEWEST request write — an out-of-order response is discarded', async () => {
    // Typing into search issues a request per debounced keystroke; a slow earlier one landing later
    // would otherwise leave the wrong result set under the current query.
    const resolvers: Array<(value: unknown) => void> = []
    reset(() => new Promise((resolve) => { resolvers.push(resolve) }))
    const library = useMediaLibrary()

    const first = library.load({ q: 'por' })
    const second = library.load({ q: 'portrait' })

    // Resolve the SECOND (current) request first, then the stale first one.
    resolvers[1]?.({ data: [{ id: 'current' }], meta: { page: 1, perPage: 12, total: 1, totalPages: 1 } })
    resolvers[0]?.({ data: [{ id: 'stale' }], meta: { page: 1, perPage: 12, total: 1, totalPages: 1 } })
    await Promise.all([first, second])

    expect(library.items.value).toEqual([{ id: 'current' }])
  })
})

describe('upload', () => {
  it('posts FormData and sets no content-type, so the browser can supply the boundary', async () => {
    reset(() => Promise.resolve({ data: { id: 'new' } }))
    await useMediaLibrary().upload(new File(['x'], 'desk.jpg', { type: 'image/jpeg' }))
    const call = holder.calls[0]
    expect(call?.options.method).toBe('POST')
    expect(call?.options.body).toBeInstanceOf(FormData)
    expect(call?.options.headers).toBeUndefined()
  })

  it('reports a 201 (new asset, no meta) as NOT deduplicated', async () => {
    reset(() => Promise.resolve({ data: { id: 'new' } }))
    const result = await useMediaLibrary().upload(new File(['x'], 'a.jpg'))
    expect(result).toEqual({ asset: { id: 'new' }, deduplicated: false })
  })

  it('reports a 200 with meta.deduplicated as a SUCCESS carrying the existing asset', async () => {
    reset(() => Promise.resolve({ data: { id: 'existing' }, meta: { deduplicated: true } }))
    const result = await useMediaLibrary().upload(new File(['x'], 'a.jpg'))
    expect(result).toEqual({ asset: { id: 'existing' }, deduplicated: true })
  })
})

describe('delete', () => {
  it('reports a plain success', async () => {
    reset(() => Promise.resolve(undefined))
    expect(await useMediaLibrary().remove('a1')).toEqual({ deleted: true, usages: [] })
  })

  it('on a 409, does NOT parse the untyped error body — it fetches the TYPED usages endpoint', async () => {
    reset((path, options) => {
      if (options.method === 'DELETE') return Promise.reject(problem(409))
      return Promise.resolve({ data: [{ type: 'settings-portrait', id: 'p1' }] })
    })
    const result = await useMediaLibrary().remove('a1')
    expect(result.deleted).toBe(false)
    expect(result.usages).toEqual([{ type: 'settings-portrait', id: 'p1' }])
    expect(holder.calls.map(c => c.path)).toEqual(['/admin/media/a1', '/admin/media/a1/usages'])
  })

  it('still reports the refusal when the usages lookup itself fails', async () => {
    // The delete WAS correctly refused; failing to enrich it must not become "the delete errored".
    reset((path, options) => Promise.reject(problem(options.method === 'DELETE' ? 409 : 500)))
    const result = await useMediaLibrary().remove('a1')
    expect(result).toEqual({ deleted: false, usages: [] })
  })

  it('rethrows any other failure rather than reporting a false refusal', async () => {
    reset(() => Promise.reject(problem(500)))
    await expect(useMediaLibrary().remove('a1')).rejects.toBeInstanceOf(ApiError)
  })
})
