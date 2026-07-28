// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useProjectDetail, useProjectsList } from './useProjects'

// FR-PUB-030's contract with the API: the server owns ordering and publication, the client owns only
// the query. These tests pin the query shape and the no-client-sort rule, because both are invisible
// in the rendered output until they are wrong.
const apiMock = vi.fn()
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useApi', () => () => apiMock)
// The effective content locale is route-resolved (D06-6); `useRouteLocale` has its own spec, so here
// it is stubbed to keep these tests about the QUERY SHAPE rather than about locale resolution.
mockNuxtImport('useRouteLocale', () => () => ref('en'))

const card = (slug: string, featured: boolean) => ({
  id: slug, slug, title: slug, summary: '', featured, year: 2025, technologies: [], availableLocales: ['en']
})

/**
 * Runs a composable inside a real Nuxt setup context and resolves its request.
 *
 * NOTE ON KEYS: `useAsyncData` caches per key, and that cache is shared across tests in one Nuxt
 * instance. Each test therefore uses a DISTINCT page/slug so it gets its own key — otherwise a later
 * test silently reads the earlier test's payload and asserts nothing. This doubles as proof that the
 * key really is derived from locale + page + filter.
 */
async function run<T>(factory: () => T): Promise<T> {
  let captured: T | undefined
  const Harness = defineComponent({
    async setup() {
      captured = factory()
      await Promise.allSettled([captured])
      return () => h('div')
    }
  })
  await mountSuspended(Harness)
  return captured!
}

describe('useProjectsList', () => {
  it('omits the technology parameter entirely when no filter is active', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 0 } })

    await run(() => useProjectsList({ page: () => 1, technology: () => undefined }))

    // An empty string would be a contract 422, not "unfiltered".
    expect(apiMock).toHaveBeenCalledWith('/projects', { locale: 'en', query: { page: 1 } })
  })

  it('sends the canonical technology UUID when a filter is active', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 0 } })
    const uuid = '019f89b5-3050-7161-af37-3e9a2cbf41ed'

    await run(() => useProjectsList({ page: () => 2, technology: () => uuid }))

    expect(apiMock).toHaveBeenCalledWith('/projects', { locale: 'en', query: { page: 2, technology: uuid } })
  })

  it('preserves the API order verbatim — the client never re-sorts (D09-8)', async () => {
    apiMock.mockClear()
    // Deliberately NOT featured-first-then-alphabetical: any client sort would reorder this.
    const serverOrder = [card('zeta', true), card('alpha', true), card('beta', false)]
    apiMock.mockResolvedValue({ data: serverOrder, meta: { page: 3, perPage: 12, total: 3, totalPages: 1 } })

    const result = await run(() => useProjectsList({ page: () => 3, technology: () => undefined }))

    expect(result.data.value?.data.map(p => p.slug)).toEqual(['zeta', 'alpha', 'beta'])
  })

  it('exposes meta so the page can decide whether pagination exists at all', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [card('a', true)], meta: { page: 4, perPage: 12, total: 30, totalPages: 3 } })

    const result = await run(() => useProjectsList({ page: () => 4, technology: () => undefined }))

    expect(result.data.value?.meta).toEqual({ page: 4, perPage: 12, total: 30, totalPages: 3 })
  })

  it('captures a failed request into error instead of rejecting the page (NFR-DEGRADE)', async () => {
    apiMock.mockClear()
    apiMock.mockRejectedValue(new Error('boom'))

    const result = await run(() => useProjectsList({ page: () => 5, technology: () => undefined }))

    expect(result.error.value).toBeTruthy()
    expect(result.data.value).toBeFalsy()
  })
})

describe('useProjectDetail', () => {
  it('requests the per-locale slug path', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: { slug: 'personal-platform' } })

    await run(() => useProjectDetail(() => 'personal-platform'))

    expect(apiMock).toHaveBeenCalledWith('/projects/personal-platform', { locale: 'en' })
  })

  it('encodes the slug so a malformed param cannot alter the request path', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: {} })

    await run(() => useProjectDetail(() => 'a b/../c'))

    expect(apiMock).toHaveBeenCalledWith('/projects/a%20b%2F..%2Fc', { locale: 'en' })
  })

  it('unwraps the envelope to the project itself', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: { slug: 'samt-institution-website', title: 'SAMT' } })

    const result = await run(() => useProjectDetail(() => 'samt-institution-website'))

    expect(result.data.value).toEqual({ slug: 'samt-institution-website', title: 'SAMT' })
  })
})
