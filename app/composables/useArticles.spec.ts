// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleCategories, useArticlesList } from './useArticles'

// FR-PUB-040's contract with the API: the server owns ordering and publication, the client owns only
// the query. These tests pin the query shape, because it is invisible in the rendered output until it
// is wrong.
const apiMock = vi.fn()
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useApi', () => () => apiMock)
// The effective content locale is route-resolved (D06-6); `useRouteLocale` has its own spec, so here
// it is stubbed to keep these tests about the QUERY SHAPE rather than about locale resolution.
mockNuxtImport('useRouteLocale', () => () => ref('en'))

const meta = { page: 1, perPage: 8, total: 0, totalPages: 0 }

/**
 * Runs a composable inside a real Nuxt setup context and resolves its request.
 *
 * NOTE ON KEYS: `useAsyncData` caches per key, and that cache is shared across tests in one Nuxt
 * instance. Each test therefore uses a DISTINCT page so it gets its own key — otherwise a later test
 * silently reads the earlier test's payload and asserts nothing, which is the vacuous-test failure
 * mode already caught once in this codebase.
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

describe('useArticlesList', () => {
  it('omits the category parameter entirely when no filter is active', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta })

    await run(() => useArticlesList({ page: () => 1, category: () => undefined }))

    // An empty string would be a contract 422, not "unfiltered".
    expect(apiMock).toHaveBeenCalledWith('/articles', {
      locale: 'en',
      query: { page: 1, perPage: ARTICLES_PER_PAGE }
    })
  })

  it('sends the page size explicitly rather than inheriting the API default', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta })

    await run(() => useArticlesList({ page: () => 9, category: () => undefined }))

    // Pinned to the value, not to "some perPage": `expect.anything()` here would still pass with the
    // parameter silently reverted to the API's default of 12.
    expect(apiMock.mock.calls[0]?.[1]?.query?.perPage).toBe(8)
  })

  it('sends the category slug when a filter is active', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta })

    await run(() => useArticlesList({ page: () => 2, category: () => 'engineering' }))

    expect(apiMock).toHaveBeenCalledWith('/articles', {
      locale: 'en',
      query: { page: 2, perPage: ARTICLES_PER_PAGE, category: 'engineering' }
    })
  })

  it('forwards a non-ASCII slug unchanged — Arabic category slugs are legitimate (D04-2)', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta })

    await run(() => useArticlesList({ page: () => 3, category: () => 'هندسة-البرمجيات' }))

    expect(apiMock.mock.calls[0]?.[1]?.query?.category).toBe('هندسة-البرمجيات')
  })

  it('keys the cache by locale, page AND filter so a filter change cannot show the previous set', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({ data: [], meta })

    await run(() => useArticlesList({ page: () => 4, category: () => undefined }))
    await run(() => useArticlesList({ page: () => 4, category: () => 'engineering' }))

    // Same page, different filter: if the filter were missing from the key, the second call would be
    // served from the first one's cache and the API would be hit once.
    expect(apiMock).toHaveBeenCalledTimes(2)
  })

  it('captures a failed request into error instead of rejecting the page (NFR-DEGRADE)', async () => {
    apiMock.mockClear()
    apiMock.mockRejectedValue(new Error('boom'))

    const result = await run(() => useArticlesList({ page: () => 5, category: () => undefined }))

    expect(result.error.value).toBeTruthy()
    expect(result.data.value).toBeFalsy()
  })
})

describe('useArticleCategories', () => {
  it('unwraps the envelope and requests the current locale', async () => {
    apiMock.mockClear()
    apiMock.mockResolvedValue({
      data: [{ id: 'c1', name: 'Engineering', slug: 'engineering', description: null, availableLocales: ['en', 'ar'] }]
    })

    const result = await run(() => useArticleCategories())

    expect(apiMock).toHaveBeenCalledWith('/categories', { locale: 'en' })
    // The page maps these to chips, so it needs the array itself, not the envelope.
    expect(result.data.value?.map(category => category.slug)).toEqual(['engineering'])
  })
})
