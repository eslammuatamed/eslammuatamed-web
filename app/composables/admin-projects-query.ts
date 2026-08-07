import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

/**
 * The canonical route-query contract for `/dashboard/projects` — Zod-first, per the Dashboard
 * validation policy, and deliberately the same shape of parser as `messages-query.ts` and
 * `media-query.ts`.
 *
 * ONE parser, not rules scattered across watchers and handlers, so `page`, `q`, the two tri-state
 * filters and the sort cannot be normalised one way in a computed and another way in a click
 * handler — the class of drift that produces a URL the page disagrees with.
 *
 * PURE, AND IT NEVER REWRITES THE URL. Normalisation happens on read only: a parser that "corrected"
 * the address bar would re-trigger the watcher that called it and loop.
 *
 * ## Why this lives in `app/composables/` rather than beside its two siblings in `app/utils/`
 *
 * `app/utils/` is the SHARED surface — public pages import from it, and another lane holds it open
 * for this release. This module is dashboard-only, so it is parked in the dashboard lane's own
 * directory. Both directories are auto-imported wholesale, which is why every export here is
 * prefixed `ADMIN_`/`adminProjects`: `app/utils/projects-query.ts` already exports the PUBLIC
 * projects listing's rules, and Nuxt resolves a duplicated auto-import name by silently ignoring one
 * of them (see the incident recorded in `app/utils/list-query.ts`).
 *
 * ## Why the filters are tri-state in the URL and boolean on the wire
 *
 * `GET /admin/projects` returns BOTH publication states when `isPublished` is omitted, and both
 * featured states when `featured` is omitted. So "either" is a real, distinct third option, not the
 * absence of an opinion — and it is the DEFAULT, because an operator opening the module wants to see
 * the drafts too. Modelling that as `boolean | undefined` in the URL would make `?isPublished=` and
 * no parameter at all two spellings of one state; `all | yes | no` gives each state exactly one.
 */

/**
 * Vue Router hands back `string | null | (string | null)[]` — a repeated `?page=1&page=2` really does
 * arrive as an array. Take the first entry so an array cannot crash the parse, and let the schema
 * judge the value.
 */
const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The API default; max 50 (D10-18). Explicit rather than implicit so the URL and the request agree. */
export const ADMIN_PROJECTS_PER_PAGE = 12

/** The API's allowlisted sort columns (D10-18). Anything else is a 422, so it is never sent. */
export const ADMIN_PROJECT_SORT_COLUMNS = ['featured', 'order', 'year', 'createdAt', 'updatedAt'] as const
export type AdminProjectSortColumn = (typeof ADMIN_PROJECT_SORT_COLUMNS)[number]

/** The tri-state the two boolean filters are spelled with in the URL. `all` is never sent. */
export const ADMIN_PROJECT_TRISTATE = ['all', 'yes', 'no'] as const
export type AdminProjectTristate = (typeof ADMIN_PROJECT_TRISTATE)[number]

/**
 * The contract caps `q` at 120 characters and answers 422 above it. A pasted-in longer string is a
 * mistyped address, not an error state worth showing an operator, so it is CLAMPED rather than
 * dropped: `.catch('')` would silently discard the whole search, which reads as "your filter did
 * nothing" instead of "your filter was shortened". Sliced before trimming so the result cannot
 * exceed 120 either way.
 */
const clampQ = (value: unknown): unknown => {
  const first = firstValue(value)
  return typeof first === 'string' ? first.slice(0, 120) : first
}

export const adminProjectsQuerySchema = z.object({
  // `.catch(1)`, and strict about integrality and sign so `page=0` and `page=-3` fall back rather
  // than reaching the API as an out-of-range offset.
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1)),
  /**
   * Free-text over title/slug/summary across ALL translations. Trimmed, and an empty search is
   * `undefined` rather than `''` so "no filter" has exactly one representation — `?q=` and no `q`
   * at all must not be two different states that fetch two different URLs.
   */
  q: z.preprocess(
    clampQ,
    z
      .string()
      .trim()
      .transform(value => (value.length > 0 ? value : undefined))
      .optional()
      .catch(undefined)
  ),
  published: z.preprocess(firstValue, z.enum(ADMIN_PROJECT_TRISTATE).catch('all')),
  featured: z.preprocess(firstValue, z.enum(ADMIN_PROJECT_TRISTATE).catch('all')),
  /** Absent means the API's own default order (`featured desc, order asc`), which is not reproducible client-side. */
  sortBy: z.preprocess(firstValue, z.enum(ADMIN_PROJECT_SORT_COLUMNS).optional().catch(undefined)),
  sortOrder: z.preprocess(firstValue, z.enum(['asc', 'desc']).catch('asc'))
})

export type AdminProjectsQuery = z.output<typeof adminProjectsQuerySchema>

/**
 * Parse a raw Nuxt/Vue Router query into the typed, defaulted shape the Projects page uses.
 * Total: any input yields a valid result, so callers never branch on parse failure.
 */
export function parseAdminProjectsQuery(query: LocationQuery): AdminProjectsQuery {
  return adminProjectsQuerySchema.parse(query)
}

/** The tri-state as the API reads it: a boolean, or the parameter left off entirely. */
function tristateToApi(value: AdminProjectTristate): boolean | undefined {
  if (value === 'yes') return true
  if (value === 'no') return false
  return undefined
}

/**
 * The exact `query` object for `GET /admin/projects`.
 *
 * EVERY filter, the search, the page and the sort are parameters — nothing here is ever applied in
 * the browser. Pagination is computed server-side under the server's order, so a client-side filter
 * would silently disagree with the page count it is displaying.
 *
 * Absent rather than empty, throughout: an omitted key and a key with an empty value are different
 * requests, and the admin DTOs are `forbidNonWhitelisted` — `?q=` on a blank search would be a
 * filter the operator did not ask for, and `sortOrder` without `sortBy` is documented as ignored,
 * so it is not sent at all rather than sent to be discarded.
 */
export function adminProjectsRequestQuery(query: AdminProjectsQuery): Record<string, string | number | boolean> {
  const isPublished = tristateToApi(query.published)
  const featured = tristateToApi(query.featured)
  return {
    page: query.page,
    perPage: ADMIN_PROJECTS_PER_PAGE,
    ...(query.q ? { q: query.q } : {}),
    ...(isPublished === undefined ? {} : { isPublished }),
    ...(featured === undefined ? {} : { featured }),
    ...(query.sortBy ? { sortBy: query.sortBy, sortOrder: query.sortOrder } : {})
  }
}
