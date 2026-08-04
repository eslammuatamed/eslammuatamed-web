import { toApiError } from './api-error'

/**
 * Error-page params for a failed project fetch. Nuxt captures a `useAsyncData` handler throw into its
 * `error` ref (it does NOT re-throw from the awaited call), so the page maps that error here: a genuine
 * not-found becomes a 404, and every other failure keeps its real status so a transient 5xx or transport
 * error surfaces the error page instead of a deindexable "not found" (the same rule as
 * `articleErrorParams` — review MAJOR-1). Pure and Nuxt-free so it unit-tests without page scaffolding.
 *
 * A 404 here is NOT automatically terminal: the case-study page first asks the redirect resolver whether
 * the slug was renamed (D04-6) and only falls back to this 404 when no redirect matches.
 */
export function projectErrorParams(error: unknown): { status: number, statusText: string } {
  const apiError = toApiError(error)
  return apiError.status === 404
    ? { status: 404, statusText: 'Project not found' }
    : { status: apiError.status || 500, statusText: 'Failed to load project' }
}

/** True only for a genuine API 404 — the one case that may trigger redirect resolution. */
export function isNotFound(error: unknown): boolean {
  return toApiError(error).status === 404
}
