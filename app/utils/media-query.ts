import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

/**
 * The canonical route-query contract for `/dashboard/media` — Zod-first, per the Dashboard
 * validation policy, and deliberately the same shape of parser as `messages-query.ts`.
 *
 * ONE parser, not rules scattered across watchers and handlers, so `q`, `kind` and `page` cannot be
 * normalised one way in a computed and another way in a click handler.
 *
 * PURE, AND IT NEVER REWRITES THE URL. Normalisation happens on read only: a parser that "corrected"
 * the address bar would re-trigger the watcher that called it and loop.
 *
 * ## Why the PICKER does not use this
 *
 * The picker opens INSIDE another page — Profile today, the article and project editors later — and
 * its search, kind and page are its own transient browsing state, not the host page's address. Put
 * them in the route query and two surfaces would write the same three keys: opening the picker would
 * rewrite Profile's URL, closing it would leave `?q=` behind, and a `?page=` meant for the picker's
 * grid would be indistinguishable from one meant for the host. So the picker holds component-local
 * refs and this module governs the LIBRARY PAGE only, where the URL genuinely is the state.
 */

/**
 * Vue Router hands back `string | null | (string | null)[]` — a repeated `?page=1&page=2` really does
 * arrive as an array. Take the first entry so an array cannot crash the parse, and let the schema
 * judge the value.
 */
const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The kinds the API exposes (`?kind=`). `all` is the absence of the filter, never a sent value. */
export const MEDIA_KINDS = ['IMAGE', 'PDF'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/** The API default; max 50. Explicit rather than implicit so the URL and the request agree. */
export const MEDIA_PER_PAGE = 12

export const mediaQuerySchema = z.object({
  /**
   * Free-text search over filename and alt text. Trimmed, and an empty search is `undefined` rather
   * than `''` so "no filter" has exactly one representation — `?q=` and no `q` at all must not be
   * two different states that fetch two different URLs.
   */
  q: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .max(200)
      .transform(value => (value.length > 0 ? value : undefined))
      .optional()
      .catch(undefined)
  ),
  /** An unrecognised kind reads as no filter rather than an error — a mistyped URL is not a fault. */
  kind: z.preprocess(firstValue, z.enum(MEDIA_KINDS).optional().catch(undefined)),
  // `.catch(1)` rather than a hard failure, and strict about integrality and sign so `page=0` and
  // `page=-3` fall back rather than reaching the API as an out-of-range offset.
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1))
})

/**
 * The browse state, as ONE value.
 *
 * It is a single object rather than three separate props/events for a reason that is not stylistic.
 * A URL-backed consumer must issue exactly ONE navigation per interaction: `router.push` does not
 * update `route.query` synchronously, so two pushes in the same tick both build their target from
 * the SAME pre-interaction query and the second silently discards the first. Measured — selecting a
 * kind filter while on page 2 emitted `kind` and then `page: 1`, and the second push, built from a
 * query that had never seen `kind`, dropped the filter and landed on a bare URL.
 *
 * Changing the filter and resetting the page are ONE interaction, so they travel as one value and
 * there is only ever one push to get wrong.
 */
export interface MediaBrowseState {
  readonly q?: string
  readonly kind?: MediaKind
  readonly page: number
}

export type MediaQuery = z.output<typeof mediaQuerySchema>

/**
 * Parse a raw Nuxt/Vue Router query into the typed, defaulted shape the Media page uses.
 * Total: any input yields a valid result, so callers never branch on parse failure.
 */
export function parseMediaQuery(query: LocationQuery): MediaQuery {
  return mediaQuerySchema.parse(query)
}
