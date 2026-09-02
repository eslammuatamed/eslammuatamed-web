import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

/**
 * The canonical route-query contract for `/dashboard/articles` — Zod-first, and deliberately the
 * same shape of parser as `admin-projects-query.ts`, `messages-query.ts` and `media-query.ts`.
 *
 * ONE parser, not rules scattered across watchers and handlers, so `page` and `status` cannot be
 * normalised one way in a computed and another way in a click handler.
 *
 * PURE, AND IT NEVER REWRITES THE URL. Normalisation happens on read only: a parser that
 * "corrected" the address bar would re-trigger the watcher that called it and loop.
 *
 * `q` is the Production-owned title search. It remains a query parameter rather than a browser
 * filter so the server's `meta.total` and pagination describe the same filtered collection as the
 * rows on screen. No sort parameter exists, so none is invented here.
 *
 * ## Why `status` is an enum with an `all` member rather than an optional
 *
 * `GET /admin/articles` returns EVERY status when `status` is omitted, so "all" is a real, distinct
 * choice and it is the DEFAULT — an operator opening the module wants to see the drafts too.
 * Modelling it as `ArticleStatus | undefined` would make `?status=` and no parameter at all two
 * spellings of one state; naming the default gives each state exactly one URL.
 */

/**
 * Vue Router hands back `string | null | (string | null)[]` — a repeated `?page=1&page=2` really
 * does arrive as an array. Take the first entry so an array cannot crash the parse, and let the
 * schema judge the value.
 */
const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The backend caps title search at 120 characters; preserve a valid, useful prefix from deep links. */
const clampQ = (value: unknown): unknown => {
  const first = firstValue(value)
  return typeof first === 'string' ? first.slice(0, 120) : first
}

/** The API default; max 50. Explicit rather than implicit so the URL and the request agree. */
export const ADMIN_ARTICLES_PER_PAGE = 12

/** The contract's status enum, plus the `all` spelling that means "send no status parameter". */
export const ADMIN_ARTICLE_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const
export const ADMIN_ARTICLE_STATUS_FILTER = ['all', ...ADMIN_ARTICLE_STATUSES] as const
export type AdminArticleStatusFilter = (typeof ADMIN_ARTICLE_STATUS_FILTER)[number]

export const adminArticlesQuerySchema = z.object({
  // `.catch(1)`, and strict about integrality and sign so `page=0` and `page=-3` fall back rather
  // than reaching the API as an out-of-range offset.
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1)),
  /** Blank search has one spelling: an absent key, never `?q=`. */
  q: z.preprocess(
    clampQ,
    z.string().trim().transform(value => (value.length > 0 ? value : undefined)).optional().catch(undefined)
  ),
  status: z.preprocess(firstValue, z.enum(ADMIN_ARTICLE_STATUS_FILTER).catch('all'))
})

export type AdminArticlesQuery = z.output<typeof adminArticlesQuerySchema>

/**
 * Parse a raw Nuxt/Vue Router query into the typed, defaulted shape the Articles page uses.
 * Total: any input yields a valid result, so callers never branch on parse failure.
 */
export function parseAdminArticlesQuery(query: LocationQuery): AdminArticlesQuery {
  return adminArticlesQuerySchema.parse(query)
}

/**
 * The exact `query` object for `GET /admin/articles`.
 *
 * `all` is never sent: the admin DTOs are validated with `forbidNonWhitelisted`, and an omitted key
 * and a key with an empty value are different requests. Sending `status=all` would be a 422, not a
 * harmless no-op.
 */
export function adminArticlesRequestQuery(query: AdminArticlesQuery): Record<string, string | number> {
  return {
    page: query.page,
    perPage: ADMIN_ARTICLES_PER_PAGE,
    ...(query.q ? { q: query.q } : {}),
    ...(query.status === 'all' ? {} : { status: query.status })
  }
}

/**
 * A stable identity for "which result set is this".
 *
 * Used by `useAdminArticles` to tell a REFRESH of the current view apart from a request for a
 * DIFFERENT one, which decides whether a failure may keep the rows on screen (§14.9 criterion 2) or
 * must clear them. Page is part of the identity: page 2's rows are not a usable stand-in for page 3.
 */
export function adminArticlesQueryKey(query: AdminArticlesQuery): string {
  return JSON.stringify([query.status, query.page, query.q ?? null])
}
