import { toApiError } from './api-error'

/**
 * Error-page params for a failed article fetch. Nuxt captures a `useAsyncData` handler throw into
 * its `error` ref (it does NOT re-throw from the awaited call), so the page maps that error here: a
 * genuine not-found becomes a 404, and every other failure keeps its real status so a transient 5xx
 * or transport error surfaces the error page instead of a deindexable "not found" (review MAJOR-1).
 * Pure and Nuxt-free so it unit-tests without page scaffolding.
 */
export function articleErrorParams(error: unknown): { status: number, statusText: string } {
  const apiError = toApiError(error)
  return apiError.status === 404
    ? { status: 404, statusText: 'Article not found' }
    : { status: apiError.status || 500, statusText: 'Failed to load article' }
}
