// Pure helpers for the public Contact form (FR-PUB-050/051/053). Nuxt-free so the anti-spam timing
// and the rate-limit copy can be unit-tested without a runtime — the two places where a subtle bug
// would either lose a genuine message or state something untrue to the visitor.

/**
 * The human fill-time threshold, mirrored from the API's `MIN_FILL_MS` (anti-spam.ts, D02-1).
 *
 * This is a deliberate cross-repo constant duplication, not an oversight: the value is part of the
 * request contract the client must satisfy, and there is no shared code between the repositories by
 * design. If the API ever changes it, this must follow — the spec records the coupling.
 */
export const MIN_FILL_MS = 3000

/**
 * How much longer the form must wait before dispatching, given the elapsed time so far.
 *
 * Owner decision: a legitimate visitor who submits before the threshold must NOT have their message
 * silently discarded as a spam-drop. Instead the submission waits out the remainder and is then sent
 * with its TRUE elapsed duration. Returns 0 once the threshold is met, so the caller's wait loop
 * terminates.
 */
export function remainingFillWaitMs(elapsedMs: number): number {
  return Math.max(0, MIN_FILL_MS - elapsedMs)
}

/**
 * The value sent as `elapsedMs`: the real measured duration, floored at 0 and rounded to an integer
 * (the contract types it as a number; a fractional `performance.now()` delta would be noise).
 *
 * Never synthesized — the caller measures again after waiting and passes what the clock actually
 * says, so the API receives a truthful duration rather than a value manufactured to clear the trap.
 */
export function toElapsedMs(elapsed: number): number {
  return Math.max(0, Math.round(elapsed))
}

/**
 * Parses a `Retry-After` header into a positive whole number of seconds.
 *
 * Accepts ONLY the delta-seconds form the API guarantees (doc 10 §3, D10-15). Anything else —
 * absent, empty, non-numeric, an HTTP-date, zero, negative, fractional or non-finite — returns
 * `null`, and the caller must fall back to the static rate-limit message. A parsed `NaN` rendered
 * into copy would tell the visitor to "try again in NaN minutes"; refusing to guess is the point.
 *
 * The header is readable cross-origin only because it is CORS-exposed (D10-15). Before that
 * correction a browser read `null` here in every environment, so this returning `null` is a real
 * runtime path, not a defensive branch.
 */
export function parseRetryAfterSeconds(header: string | null | undefined): number | null {
  if (typeof header !== 'string') return null
  const trimmed = header.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const seconds = Number(trimmed)
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null
}

/** The relative-time unit ladder, largest boundary first. */
const UNITS: readonly { readonly unit: Intl.RelativeTimeFormatUnit, readonly seconds: number }[] = [
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 }
]

/**
 * Formats a positive seconds value as a localized relative duration ("in 5 minutes" / "خلال ٥ دقائق"
 * → with `latn`, "خلال 5 دقائق").
 *
 * Two rules that are easy to get wrong and both matter:
 *
 * 1. **Round UP** (`Math.ceil`). Rounding down would advise the visitor to retry before the window
 *    actually reopens, so the retry 429s again and the copy has effectively lied.
 * 2. **Western Arabic digits.** D03-4 requires them in BOTH locales, but `Intl.RelativeTimeFormat`
 *    defaults to Eastern Arabic digits (٥) for `ar`. Without pinning, the Arabic route would render
 *    a digit style used nowhere else on the site. `app/utils/format.ts` pins the same thing on
 *    `Intl.DateTimeFormat`.
 *
 *    It is pinned here through the **`-u-nu-latn` Unicode locale extension** rather than the
 *    `numberingSystem` option, because TypeScript's `RelativeTimeFormatOptions` does not declare
 *    that option even though ECMA-402 defines it — the extension is the same standard mechanism,
 *    expressed where the type system can see it, so no cast is needed.
 *
 * `Intl` also owns pluralization, so there are no hand-written EN/AR plural branches. That matters
 * concretely: Arabic marks exactly two as a DUAL that drops the numeral ("خلال دقيقتين"), takes the
 * plural for three-to-ten, and the singular from eleven up. A `{count} دقيقة` interpolation gets
 * all three wrong.
 */
export function formatRetryAfter(seconds: number, locale: string): string {
  const match = UNITS.find(candidate => seconds >= candidate.seconds) ?? UNITS[UNITS.length - 1]!
  const value = Math.ceil(seconds / match.seconds)
  return new Intl.RelativeTimeFormat(withLatinDigits(locale), {
    numeric: 'always',
    style: 'long'
  }).format(value, match.unit)
}

/** Appends the `-u-nu-latn` numbering-system extension, leaving an already-extended tag alone. */
function withLatinDigits(locale: string): string {
  return locale.includes('-u-') ? locale : `${locale}-u-nu-latn`
}

/** Field caps, mirrored from `CreateContactMessageDto` so client and server reject the same values. */
export const CONTACT_LIMITS = {
  name: 200,
  email: 320,
  subject: 300,
  body: 5000
} as const
