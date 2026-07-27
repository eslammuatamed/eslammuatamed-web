import type { Envelope, RedirectResolve } from '~/types/models'
import { toApiError } from '~/utils/api-error'

/**
 * Resolve a renamed public slug to its current path (D04-6, `GET /redirects/resolve`).
 *
 * Called only after a public read has already returned 404, so the request is **single-shot**: no
 * retry, no chaining. A 404 from the resolver means "no redirect exists" and is a normal answer, not a
 * failure — it is reported as `null` so the caller can raise the real not-found page.
 *
 * Any OTHER failure is rethrown. Swallowing a 5xx here would silently turn an outage into a 404 and
 * deindex a live page, which is the same defect `projectErrorParams` exists to prevent.
 *
 * `path` is section-relative and NOT locale-prefixed (contract example: `/blog/old-slug`); `useApi()`
 * adds `?locale=` itself (D10-6). The returned `toPath` is likewise section-relative, so the caller
 * localizes it before navigating.
 */
export function useSlugRedirect() {
  const api = useApi()

  return async function resolveRedirect(path: string): Promise<string | null> {
    try {
      const response = await api<Envelope<RedirectResolve>>('/redirects/resolve', {
        query: { path }
      })
      return response.data.toPath
    } catch (error) {
      if (toApiError(error).status === 404) return null
      throw error
    }
  }
}
