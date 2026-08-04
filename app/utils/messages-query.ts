import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

/**
 * The canonical route-query contract for `/dashboard/messages` — Zod-first, per the Dashboard
 * validation policy.
 *
 * ONE parser, not rules scattered across watchers and handlers. Every consumer reads the same typed
 * result, so `view`, `page` and `message` cannot be normalised one way in a computed and another way
 * in a click handler — the class of drift that produces a URL the page disagrees with.
 *
 * PURE, AND IT NEVER REWRITES THE URL. Normalisation happens on read only. A parser that "corrected"
 * the address bar would re-trigger the watcher that called it and loop; the URL is the reader's, and
 * an unrecognised value is simply read as its default rather than being taken away from them.
 *
 * Unrelated query parameters are preserved by construction: this schema reads the three keys it
 * governs and never reconstructs the query object. Writing is `setQuery`, which merges.
 */

/**
 * Vue Router hands back `string | null | (string | null)[]` — a repeated `?page=1&page=2` really does
 * arrive as an array. Take the first entry so an array cannot crash the parse, and let the schema
 * judge the value.
 */
const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The two governed views (owner decision 4). Anything else reads as the Inbox. */
export const MESSAGES_VIEWS = ['inbox', 'archived'] as const

export const messagesQuerySchema = z.object({
  view: z.preprocess(firstValue, z.enum(MESSAGES_VIEWS).catch('inbox')),
  // `.catch(1)` rather than a hard failure: `?page=abc` is a malformed address, not an error state
  // worth showing a reader. Coercion is deliberately strict about integrality and sign so `page=0`
  // and `page=-3` fall back rather than reaching the API as an out-of-range offset.
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1)),
  // A message id must be a real UUID. A malformed one is DROPPED rather than passed to the API,
  // which would answer 400/404 for something the reader only mistyped.
  message: z.preprocess(firstValue, z.uuid().optional().catch(undefined))
})

export type MessagesQuery = z.output<typeof messagesQuerySchema>

/**
 * Parse a raw Nuxt/Vue Router query into the typed, defaulted shape the Messages page uses.
 * Total: any input yields a valid result, so callers never branch on parse failure.
 */
export function parseMessagesQuery(query: LocationQuery): MessagesQuery {
  return messagesQuerySchema.parse(query)
}
