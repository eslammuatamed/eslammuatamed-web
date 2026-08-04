// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ApiError } from '~/utils/api-error'
import { useSlugRedirect } from './useSlugRedirect'

// The resolver is only consulted AFTER a public read already 404'd (D04-6), so its failure modes decide
// whether a renamed URL recovers, a missing one 404s honestly, or an outage silently deindexes a page.
const apiMock = vi.fn()
mockNuxtImport('useApi', () => () => apiMock)
// Redirect resolution is locale-scoped, and the locale is the ROUTE's (D06-6). `useRouteLocale` has
// its own spec; here it is stubbed so these tests stay about the resolver's failure modes.
const routeLocale = ref('ar')
mockNuxtImport('useRouteLocale', () => () => routeLocale)

describe('useSlugRedirect', () => {
  it('returns the section-relative destination when a redirect matches', async () => {
    apiMock.mockResolvedValueOnce({ data: { toPath: '/projects/new-slug' } })

    const resolve = useSlugRedirect()
    await expect(resolve('/projects/old-slug')).resolves.toBe('/projects/new-slug')
  })

  it('sends the path as a query parameter and the ROUTE locale explicitly (D06-6)', async () => {
    apiMock.mockResolvedValueOnce({ data: { toPath: '/projects/new-slug' } })

    const resolve = useSlugRedirect()
    await resolve('/projects/old-slug')

    // The locale rides as an explicit option, not inside `query` — `useApi()` owns turning it into
    // `?locale=` (D10-6), and resolution is locale-scoped, so asking in the outgoing language during
    // a locale switch would miss a redirect that exists and turn it into a 404.
    expect(apiMock).toHaveBeenCalledWith('/redirects/resolve', {
      locale: 'ar',
      query: { path: '/projects/old-slug' }
    })
    const [, options] = apiMock.mock.calls.at(-1)!
    expect(options.query).not.toHaveProperty('locale')
  })

  it('reports null when no redirect exists — a 404 here is a normal answer, not a failure', async () => {
    apiMock.mockRejectedValueOnce(new ApiError({ type: 'about:blank', title: 'Not Found', status: 404 }))

    const resolve = useSlugRedirect()
    await expect(resolve('/projects/never-existed')).resolves.toBeNull()
  })

  it('rethrows a 5xx instead of reporting "no redirect" — an outage must not become a 404', async () => {
    apiMock.mockRejectedValueOnce(new ApiError({ type: 'about:blank', title: 'Bad Gateway', status: 502 }))

    const resolve = useSlugRedirect()
    await expect(resolve('/projects/old-slug')).rejects.toThrow()
  })

  it('rethrows a transport failure (status 0) rather than swallowing it', async () => {
    apiMock.mockRejectedValueOnce(new ApiError({ type: 'about:blank', title: 'Network', status: 0 }))

    const resolve = useSlugRedirect()
    await expect(resolve('/projects/old-slug')).rejects.toThrow()
  })

  it('is single-shot — it never retries the resolver', async () => {
    apiMock.mockClear()
    apiMock.mockRejectedValueOnce(new ApiError({ type: 'about:blank', title: 'Not Found', status: 404 }))

    const resolve = useSlugRedirect()
    await resolve('/projects/old-slug')

    expect(apiMock).toHaveBeenCalledTimes(1)
  })
})
