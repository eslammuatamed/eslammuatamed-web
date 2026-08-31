import type { AdminTestimonial } from '~/composables/admin-testimonial-types'

/**
 * Testimonials FIELD RULES — what a translation is, and how one is presented (FE-3 module 3).
 *
 * Nuxt-free and zod-free, so it unit-tests without a runtime and costs the list route nothing.
 *
 * ── THE SPLIT FROM A FUTURE FORM MODULE IS MADE NOW, BEFORE IT COSTS ANYTHING ───────────────────
 * There is no `admin-testimonial-form.ts` yet — it arrives with the editor. This file is separated
 * NOW anyway, because Articles measured what happens when it is not: the collection route's
 * app-owned bytes rose 8,889 B when the editor's form model and Zod schema landed in the file the
 * list imported from, and splitting them recovered 6,211 B (§10.1). Replicating that boundary per
 * module is a rule FE-3 inherits rather than a discovery it re-makes.
 *
 * ── EVERY EXPORT IS PREFIXED ─────────────────────────────────────────────────────────────────────
 * `app/composables/` is auto-imported WHOLESALE and Nuxt resolves a duplicated name by SILENTLY
 * ignoring one of them — a defect with no error message (§10.3 rule 12). The sibling modules already
 * export `hasTranslation`/`*Display*` names under their own prefixes, so everything here carries
 * `testimonial` or `TESTIMONIAL`. The public home section (`Voices.vue`) has its own shape; nothing
 * here is shared with it.
 */

/** The two authored locales. Same set as articles, projects and experiences, named per module. */
export const TESTIMONIAL_LOCALES = ['en', 'ar'] as const
export type TestimonialLocale = (typeof TESTIMONIAL_LOCALES)[number]

/**
 * ALL THREE TRANSLATION FIELDS ARE REQUIRED — a contract fact, not a client choice.
 *
 * Every translation item carries a locale plus non-empty `quote`, `authorName` and `authorRole`
 * (quote ≤ 4000 chars, author fields ≤ 160), enforced by the server on every write. As with
 * Experiences, §10.3 rule 6 — "a locale is unauthored OR complete, never half" — is ENFORCED BY THE
 * SERVER here, so a half-written Arabic testimonial is a 422, not a silently-accepted partial row.
 */
export const TESTIMONIAL_REQUIRED_TRANSLATION_FIELDS = ['quote', 'authorName', 'authorRole'] as const
export type TestimonialRequiredField = (typeof TESTIMONIAL_REQUIRED_TRANSLATION_FIELDS)[number]

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0

/**
 * Does this testimonial really have this locale?
 *
 * Answered from the translation MAP the API returned, never from a flag and never by falling back
 * to the other language — the indicator exists to make a missing translation visible, so a function
 * that substituted English for absent Arabic would assert its own input.
 *
 * `authorName` and `quote` are the two tested, matching what the row actually shows. All three
 * fields are required by the contract, so a present translation has all three; testing the two that
 * identify the row keeps this honest against a hand-built fixture that omits authorRole.
 */
export function testimonialHasTranslation(testimonial: AdminTestimonial, locale: TestimonialLocale): boolean {
  const translation = testimonial.translations[locale]
  if (!translation) return false
  return !blank(translation.authorName) && !blank(translation.quote)
}

/** Which locales are missing — the list view's completeness summary. */
export function testimonialMissingLocales(testimonial: AdminTestimonial): TestimonialLocale[] {
  return TESTIMONIAL_LOCALES.filter(locale => !testimonialHasTranslation(testimonial, locale))
}

/**
 * A row's heading: WHO said it.
 *
 * The ONE place a cross-locale read is correct, exactly as `experienceDisplayRole`: it identifies a
 * row, it is not authored content, and the completeness badges beside it state plainly which
 * languages actually exist. Falls back to the neutral untitled label rather than rendering a blank
 * heading — an empty `<h2>` would be both an accessibility failure and a silent one.
 */
export function testimonialDisplayAuthor(
  testimonial: AdminTestimonial,
  preferred: string,
  fallbackLabel: string
): string {
  const inPreferred = testimonial.translations[preferred]?.authorName
  if (!blank(inPreferred)) return inPreferred as string
  const other = TESTIMONIAL_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? testimonial.translations[other]?.authorName : undefined
  if (!blank(inOther)) return inOther as string
  return fallbackLabel
}

/**
 * The quote preview shown under the author.
 *
 * Unlike the author name, the quote is AUTHORED CONTENT — but the established collection rule allows
 * a cross-locale read for recognition in the list (`adminSkillDisplayLabel`,
 * `experienceDisplayCompany`), with completeness badges stating plainly which languages exist. The
 * editor does no such thing — it seeds a missing locale EMPTY.
 *
 * Returns `null` rather than a placeholder when neither locale has one: the row's markup decides how
 * to render an absence, and a helper that invented an em dash would push presentation into a
 * Nuxt-free module and make the empty case untestable as an empty case.
 */
export function testimonialDisplayQuote(testimonial: AdminTestimonial, preferred: string): string | null {
  const inPreferred = testimonial.translations[preferred]?.quote
  if (!blank(inPreferred)) return inPreferred as string
  const other = TESTIMONIAL_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? testimonial.translations[other]?.quote : undefined
  if (!blank(inOther)) return inOther as string
  return null
}
