import type { LocationQuery } from 'vue-router'

/**
 * URL query rules for the projects index (FR-PUB-030, D13-4). Pure so the rules are testable — each
 * one is invisible in the rendered output until it is wrong, and each has a specific failure mode:
 *   - a filter change that kept `page` would land on an out-of-range page and render an empty list
 *     that looks like a broken filter;
 *   - pagination that dropped `technology` would silently widen the result set mid-journey;
 *   - emitting `page=1` or `technology=` would create a second URL for the same content.
 */

/**
 * Projects shown per page (FR-PUB-030). Sent explicitly rather than left to the API's default of 12:
 * the page size is a LAYOUT decision — six case-study cards is what fills the index without turning it
 * into a scroll — and leaving it implicit would mean a change to the API's default silently reflows
 * this page. It lives here, beside the page/filter rules, because `meta.totalPages` (and therefore
 * whether pagination renders at all) is derived from it.
 *
 * Within the contract's `perPage` bounds (1–50), so it can never be rejected as out of range.
 */
export const PROJECTS_PER_PAGE = 6

/** Read the active technology filter. Only a non-empty string is a filter; anything else is "all". */
export function readTechnology(query: LocationQuery): string | undefined {
  const value = query.technology
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Read the current page, defaulting to 1 for absent, malformed, or out-of-range values. */
export function readPage(query: LocationQuery): number {
  const value = Number(query.page)
  return Number.isInteger(value) && value > 0 ? value : 1
}

/** Query for a filter change — deliberately drops `page`, resetting to the first page. */
export function buildFilterQuery(technology: string | undefined): LocationQuery {
  return technology ? { technology } : {}
}

/** Query for a page change — carries the active filter; omits `page=1` as it is the default. */
export function buildPageQuery(technology: string | undefined, page: number): LocationQuery {
  return {
    ...(technology ? { technology } : {}),
    ...(page > 1 ? { page: String(page) } : {})
  }
}
