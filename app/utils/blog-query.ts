import type { LocationQuery } from 'vue-router'

/**
 * URL query rules for the blog index (FR-PUB-040, D13-4). Pure so the rules are testable — each one is
 * invisible in the rendered output until it is wrong, and each has a specific failure mode:
 *   - a filter change that kept `page` would land on an out-of-range page and render an empty list
 *     that looks like a broken filter;
 *   - pagination that dropped `category` would silently widen the result set mid-journey;
 *   - emitting `page=1` or `category=` would create a second URL for the same content.
 *
 * Deliberately a SIBLING of `projects-query.ts` rather than a shared generic. The two look alike today
 * but they are not the same contract: a Skill slug is locale-independent and a Category slug is
 * PER-LOCALE (D04-2), which is a real behavioural difference at exactly the point a shared abstraction
 * would hide it. The chip CONTROL is shared (`UiChipFilter`); the query rules are not.
 */

/**
 * Articles shown per page (FR-PUB-040). Sent explicitly rather than left to the API's default of 12:
 * the page size is a LAYOUT decision — eight article rows is what fills the index without turning it
 * into a scroll — and leaving it implicit would mean a change to the API's default silently reflows
 * this page.
 *
 * Within the contract's `perPage` bounds (1–50), so it can never be rejected as out of range.
 */
export const ARTICLES_PER_PAGE = 8

/** Read the active category filter. Only a non-empty string is a filter; anything else is "all". */
export function readCategory(query: LocationQuery): string | undefined {
  const value = query.category
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Query for a filter change — deliberately drops `page`, resetting to the first page. */
export function buildCategoryQuery(category: string | undefined): LocationQuery {
  return category ? { category } : {}
}

/** Query for a page change — carries the active filter; omits `page=1` as it is the default. */
export function buildBlogPageQuery(category: string | undefined, page: number): LocationQuery {
  return {
    ...(category ? { category } : {}),
    ...(page > 1 ? { page: String(page) } : {})
  }
}
