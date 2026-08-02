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

// ── phone composition (D13-6) ─────────────────────────────────────────────────────────────────
//
// Deliberately hand-rolled rather than an international-phone-input component: `/contact` measured
// 245.8 KB gz against the frozen 250 KB budget, and such a component plus its country metadata is
// an order of magnitude larger than the remaining headroom. What the client owes is a well-formed
// CANDIDATE; the API decides validity (D10-16), so no per-country national-number rules live here.

/** The `value` used by the "Other country" option — the visitor types the full international number. */
export const OTHER_DIAL_CODE = 'other'

/**
 * The explicit markets, in the order they are offered. Egypt leads because it is the owner's own
 * market and the sensible default; the rest are the GCC. Everywhere else is served by
 * `OTHER_DIAL_CODE` rather than by shipping a ~250-entry list for a portfolio's realistic audience.
 */
export const DIAL_CODES = ['+20', '+966', '+971', '+965', '+974', '+973', '+968'] as const

export type DialCode = (typeof DIAL_CODES)[number] | typeof OTHER_DIAL_CODE

/**
 * Builds the E.164 candidate actually submitted as `phone`.
 *
 * For an explicit market the national part is stripped to digits and appended to the chosen prefix.
 * A leading trunk `0` is dropped — writing `010 0278 5408` is how the number is said locally, but
 * E.164 has no trunk prefix, and leaving it produces a number that looks right and is not.
 *
 * For `OTHER_DIAL_CODE` the visitor's own text is normalized as-is; they are asked to include the
 * `+`, and if they do not, the result fails validation rather than being guessed at.
 *
 * Returns `null` when nothing usable was entered, so the caller can treat "no phone" and "a bad
 * phone" as the different things they are.
 */
export function composeE164(dialCode: DialCode, nationalInput: string): string | null {
  const raw = nationalInput.trim()
  if (raw === '') return null

  if (dialCode === OTHER_DIAL_CODE) {
    const compact = raw.replace(/[^\d+]/g, '')
    const normalized = compact.startsWith('+') ? `+${compact.slice(1).replace(/\+/g, '')}` : compact
    return normalized === '' ? raw : normalized
  }

  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  return digits === '' ? raw : `${dialCode}${digits}`
}

/**
 * A deliberately shallow shape check: `+`, a non-zero leading digit, and a plausible total length.
 *
 * This exists to give immediate feedback on an obviously wrong entry, not to adjudicate. It must
 * stay permissive — a client that rejected more than the API would turn a valid number into an
 * error the visitor cannot resolve, and D13-6 is explicit that the API is authoritative.
 */
export function isPlausibleE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value)
}
