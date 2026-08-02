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

// ── phone composition and normalization (D13-6) ───────────────────────────────────────────────
//
// Deliberately hand-rolled rather than an international-phone-input component: `/contact` measured
// 247.6 KB gz against the frozen 250 KB budget, and such a component plus its country metadata is
// an order of magnitude larger than the remaining headroom.
//
// The goal is STRUCTURAL validation — that a number is well-formed for the selected numbering plan
// — not proof that it is in service or belongs to the sender. The API remains authoritative.

/** The `value` used by the "Other country" option — the visitor types the full international number. */
export const OTHER_DIAL_CODE = 'other'

export interface CountryRule {
  /** E.164 country calling code, with the leading `+`. */
  readonly dialCode: string
  /** Permitted national-number lengths, AFTER the trunk prefix is removed. */
  readonly nationalLengths: readonly number[]
  /** Trunk prefix stripped before composing E.164, when the plan uses one. */
  readonly trunkPrefix: string | null
  /**
   * National prefixes the plan actually assigns, when they are meaningful enough to reject a typo.
   * Empty means the plan is not narrowed here — length alone decides.
   */
  readonly nationalPrefixes: readonly string[]
}

/**
 * The explicit markets, in offer order. Egypt leads because it is the owner's market and the
 * sensible default; the rest are the GCC. Everywhere else uses `OTHER_DIAL_CODE` rather than
 * shipping a ~250-entry list for a portfolio's realistic audience.
 *
 * Prefix lists are given only where the numbering plan makes them load-bearing for catching a
 * mistyped number. Kuwait, Qatar, Bahrain and Oman allocate mobile ranges broadly enough that
 * enumerating them here would reject valid numbers as the plans evolve, so those are length-checked
 * only — deliberately permissive, because a client that rejects more than the API turns a valid
 * number into an error the visitor cannot resolve.
 */
export const COUNTRY_RULES: Readonly<Record<string, CountryRule>> = {
  '+20': { dialCode: '+20', nationalLengths: [10], trunkPrefix: '0', nationalPrefixes: ['10', '11', '12', '15'] },
  '+966': { dialCode: '+966', nationalLengths: [9], trunkPrefix: '0', nationalPrefixes: ['5'] },
  '+971': { dialCode: '+971', nationalLengths: [9], trunkPrefix: '0', nationalPrefixes: ['5'] },
  '+965': { dialCode: '+965', nationalLengths: [8], trunkPrefix: null, nationalPrefixes: [] },
  '+974': { dialCode: '+974', nationalLengths: [8], trunkPrefix: null, nationalPrefixes: [] },
  '+973': { dialCode: '+973', nationalLengths: [8], trunkPrefix: null, nationalPrefixes: [] },
  '+968': { dialCode: '+968', nationalLengths: [8], trunkPrefix: null, nationalPrefixes: [] }
}

export const DIAL_CODES = ['+20', '+966', '+971', '+965', '+974', '+973', '+968'] as const

export type DialCode = (typeof DIAL_CODES)[number] | typeof OTHER_DIAL_CODE

/**
 * Folds Arabic-Indic (٠-٩) and Extended Arabic-Indic / Persian (۰-۹) digits to ASCII.
 *
 * An Arabic-locale keyboard produces these routinely, and without folding a perfectly valid number
 * typed on /ar would be rejected as "not a number" — a locale-specific dead end on the platform's
 * single conversion point.
 */
export function toAsciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })
}

/** Strips formatting humans type — spaces, hyphens, parentheses, dots — leaving digits and `+`. */
function stripFormatting(value: string): string {
  return toAsciiDigits(value).replace(/[^\d+]/g, '')
}

/**
 * Normalizes a visitor's phone entry to a single E.164 value for the selected country.
 *
 * Handles, in order: Arabic/Persian digits → ASCII; formatting removed; a leading `00`
 * international prefix rewritten to `+`; an already-present country code accepted rather than
 * doubled; a national trunk prefix removed only where the plan defines one.
 *
 * Returns `null` when nothing was entered, so "no phone" and "a bad phone" stay distinguishable.
 * Returns the cleaned-but-unusable string otherwise, which then fails `validatePhone` — a supplied
 * value is never silently discarded (D10-16).
 */
export function normalizePhone(dialCode: DialCode, input: string): string | null {
  const raw = input.trim()
  if (raw === '') return null

  let compact = stripFormatting(raw)
  if (compact === '') return raw

  // `00` is the international access prefix in every market listed here.
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`
  // A stray interior `+` is formatting noise; only a leading one is meaningful.
  compact = compact.startsWith('+') ? `+${compact.slice(1).replace(/\+/g, '')}` : compact.replace(/\+/g, '')

  if (dialCode === OTHER_DIAL_CODE) return compact

  const rule = COUNTRY_RULES[dialCode]
  if (!rule) return compact

  const bare = rule.dialCode.slice(1)

  // Already international: keep it as typed so a mismatched country is REJECTED downstream rather
  // than silently re-homed to the selected one.
  if (compact.startsWith('+')) return compact
  // The country code typed without a `+` (e.g. "201002785408") — accepted, never doubled.
  if (compact.startsWith(bare) && compact.length > bare.length) return `+${compact}`

  let national = compact
  if (rule.trunkPrefix && national.startsWith(rule.trunkPrefix)) {
    national = national.slice(rule.trunkPrefix.length)
  }
  return `${rule.dialCode}${national}`
}

/**
 * Structural validation of a normalized E.164 value against the selected country's plan.
 *
 * For an explicit country this checks the country code matches the selection, the national length
 * is one the plan uses, and — where the plan makes prefixes meaningful — that the prefix is
 * assigned. For "Other country" it requires only a well-formed international number, because this
 * app holds no plan data for the rest of the world and guessing would reject valid numbers.
 */
export function validatePhone(dialCode: DialCode, normalized: string): boolean {
  if (dialCode === OTHER_DIAL_CODE) return isPlausibleE164(normalized)
  const rule = COUNTRY_RULES[dialCode]
  if (!rule) return isPlausibleE164(normalized)

  if (!normalized.startsWith(`${rule.dialCode}`)) return false
  const national = normalized.slice(rule.dialCode.length)
  if (!/^\d+$/.test(national)) return false
  if (!rule.nationalLengths.includes(national.length)) return false
  if (rule.nationalPrefixes.length > 0 && !rule.nationalPrefixes.some(p => national.startsWith(p))) return false
  return true
}

/**
 * A deliberately shallow shape check: `+`, a non-zero leading digit, plausible total length.
 *
 * Must stay permissive — a client that rejected more than the API would turn a valid number into an
 * error the visitor cannot resolve, and D13-6 is explicit that the API is authoritative.
 */
export function isPlausibleE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value)
}

// ── feature-local validation (D13-6 fallback) ─────────────────────────────────────────────────
//
// Replaces zod on this route. Not a style preference: `USelectMenu` — required for the approved
// control appearance — pushed `/contact` to 281.0 KB gz against the frozen 250 KB budget, and the
// pre-agreed remedy is to drop the schema library rather than the control or the threshold.
//
// UForm's `validate` prop takes exactly this shape, so `UFormField`, error rendering, focus
// management and every accessibility association are untouched — only the rule ENGINE changes.

export interface ContactFormValues {
  readonly name: string
  readonly email: string
  readonly dialCode: string
  readonly nationalNumber: string
  readonly subject: string
  readonly body: string
}

export interface ContactFieldError {
  readonly name: string
  readonly message: string
}

/** The localized strings the validator needs, passed in so this stays pure and Nuxt-free. */
export interface ContactMessages {
  readonly nameRequired: string
  readonly nameTooLong: string
  readonly emailInvalid: string
  readonly emailTooLong: string
  readonly phoneInvalid: string
  readonly subjectRequired: string
  readonly subjectTooLong: string
  readonly bodyRequired: string
  readonly bodyTooLong: string
}

/**
 * Mirrors the API exactly (D10-15 trimming, D10-16 per-field rules).
 *
 * The email-or-phone GROUP rule is deliberately absent: it is derived reactively in the page, not
 * filed under a field name, because UForm replaces the error list per validated field and a
 * cross-field issue keyed to one name goes stale the moment the other changes (F-6).
 */
export function validateContactForm(
  values: ContactFormValues,
  messages: ContactMessages
): ContactFieldError[] {
  const errors: ContactFieldError[] = []
  const name = values.name.trim()
  const subject = values.subject.trim()
  const body = values.body.trim()
  const email = values.email.trim()

  if (name === '') errors.push({ name: 'name', message: messages.nameRequired })
  else if (name.length > CONTACT_LIMITS.name) errors.push({ name: 'name', message: messages.nameTooLong })

  if (subject === '') errors.push({ name: 'subject', message: messages.subjectRequired })
  else if (subject.length > CONTACT_LIMITS.subject) errors.push({ name: 'subject', message: messages.subjectTooLong })

  if (body === '') errors.push({ name: 'body', message: messages.bodyRequired })
  else if (body.length > CONTACT_LIMITS.body) errors.push({ name: 'body', message: messages.bodyTooLong })

  // A supplied value is judged on its own merits; an absent one is simply absent (D10-16).
  if (email !== '') {
    if (email.length > CONTACT_LIMITS.email) errors.push({ name: 'email', message: messages.emailTooLong })
    else if (!isPlausibleEmail(email)) errors.push({ name: 'email', message: messages.emailInvalid })
  }

  if (values.nationalNumber.trim() !== '') {
    const normalized = normalizePhone(values.dialCode as DialCode, values.nationalNumber)
    if (normalized === null || !validatePhone(values.dialCode as DialCode, normalized)) {
      errors.push({ name: 'nationalNumber', message: messages.phoneInvalid })
    }
  }

  return errors
}

/**
 * Deliberately permissive: one `@`, something either side, a dot in the domain, no whitespace.
 *
 * Email syntax is famously not a regex, and the API's `@IsEmail()` is authoritative. A client
 * stricter than the server would reject a deliverable address the visitor cannot then fix — the
 * same asymmetry D13-6 rejects for phone numbers.
 */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
