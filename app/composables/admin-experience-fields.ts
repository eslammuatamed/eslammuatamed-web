import type { AdminExperience, EmploymentType } from '~/composables/admin-experience-types'

/**
 * Experience FIELD RULES — what a translation is, and how one is presented.
 *
 * Nuxt-free and zod-free, so it unit-tests without a runtime and costs a list route nothing.
 *
 * ── THE SPLIT FROM `admin-experience-form.ts` IS KEPT DELIBERATELY, BEFORE IT COSTS ANYTHING ─────
 * There is no `admin-experience-form.ts` yet — it arrives with the editor in `M1·U3`. This file is
 * separated NOW anyway, because Articles measured what happens when it is not: the collection
 * route's app-owned bytes rose 8,889 B when the editor's form model and Zod schema landed in the
 * file the list imported from, and splitting them recovered 6,211 B (§10.1).
 *
 * Replicating that split per module is a rule FE-3 inherits rather than a discovery it re-makes.
 * Creating the boundary before the editor exists is cheaper than moving exports across it later,
 * and it means the collection can never accidentally import a validation schema.
 *
 * ── EVERY EXPORT IS PREFIXED ────────────────────────────────────────────────────────────────────
 * `app/composables/` is auto-imported WHOLESALE and Nuxt resolves a duplicated name by SILENTLY
 * ignoring one of them — a defect with no error message (§10.3 rule 12). `admin-article-fields.ts`
 * and `admin-project-form.ts` already export `hasTranslation`, `ARTICLE_LOCALES`,
 * `PROJECT_LOCALES` and `REQUIRED_TRANSLATION_FIELDS`, so everything here carries `experience`
 * or `EXPERIENCE`. The names were checked against the existing exports before they were written.
 */

/** The two authored locales. Same set as articles and projects, named separately for the reason above. */
export const EXPERIENCE_LOCALES = ['en', 'ar'] as const
export type ExperienceLocale = (typeof EXPERIENCE_LOCALES)[number]

/**
 * ⚠ ALL FOUR TRANSLATION FIELDS ARE REQUIRED — and that is a CONTRACT fact, not a client choice.
 *
 * `ExperienceTranslationDto` declares `role`, `company`, `location` and `impact` as required, with
 * no optional per-locale field at all. This is the discriminating difference from Articles, whose
 * translation carries four required fields AND three optional SEO overrides.
 *
 * The consequence is that §10.3 rule 6 — "a locale is unauthored OR complete, never half" — is
 * ENFORCED BY THE SERVER here, where Articles had to enforce it in the client. A half-written
 * Arabic translation is a 422, not a silently-accepted partial row.
 */
export const EXPERIENCE_REQUIRED_TRANSLATION_FIELDS = ['role', 'company', 'location', 'impact'] as const
export type ExperienceRequiredField = (typeof EXPERIENCE_REQUIRED_TRANSLATION_FIELDS)[number]

/**
 * The four employment types, read off the contract enum rather than restated as strings.
 *
 * Ordered as the contract declares them, so the editor's select and any list filter present the
 * same order without a second opinion about it.
 */
export const EXPERIENCE_EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'FREELANCE'
] as const satisfies readonly EmploymentType[]

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0

/**
 * Does this experience really have this locale?
 *
 * Answered from the translation MAP the API returned, never from a flag and never by falling back
 * to the other language — the indicator exists to make a missing translation visible, so a function
 * that substituted English for absent Arabic would assert its own input.
 *
 * `role` and `company` are the two tested, matching what the row actually shows. All four fields
 * are required by the contract, so a present translation has all four; testing the two that
 * identify the row keeps this honest against a hand-built fixture that omits the others.
 */
export function experienceHasTranslation(experience: AdminExperience, locale: ExperienceLocale): boolean {
  const translation = experience.translations[locale]
  if (!translation) return false
  return !blank(translation.role) && !blank(translation.company)
}

/** Which locales are missing — the list view's completeness summary, and the editor's tab badges. */
export function experienceMissingLocales(experience: AdminExperience): ExperienceLocale[] {
  return EXPERIENCE_LOCALES.filter(locale => !experienceHasTranslation(experience, locale))
}

/**
 * A row's heading, in the operator's language where it exists.
 *
 * The ONE place a cross-locale read is correct, exactly as in `articleDisplayTitle`: it identifies
 * a row, it is not authored content, and the completeness badges beside it state plainly which
 * languages actually exist. The editor does no such thing — it seeds a missing locale EMPTY.
 */
export function experienceDisplayRole(
  experience: AdminExperience,
  preferred: string,
  fallbackLabel: string
): string {
  const inPreferred = experience.translations[preferred]?.role
  if (!blank(inPreferred)) return inPreferred as string
  const other = EXPERIENCE_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? experience.translations[other]?.role : undefined
  if (!blank(inOther)) return inOther as string
  return fallbackLabel
}

/**
 * The company shown beside the role, under the same cross-locale rule and for the same reason.
 *
 * Returns `null` rather than a placeholder when neither locale has one: the row's markup decides
 * how to render an absence, and a helper that invented an em dash would push presentation into a
 * Nuxt-free module and make the empty case untestable as an empty case.
 */
export function experienceDisplayCompany(experience: AdminExperience, preferred: string): string | null {
  const inPreferred = experience.translations[preferred]?.company
  if (!blank(inPreferred)) return inPreferred as string
  const other = EXPERIENCE_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? experience.translations[other]?.company : undefined
  if (!blank(inOther)) return inOther as string
  return null
}

/**
 * Is this row the CURRENT role, as the SERVER decided?
 *
 * Reads `isCurrent` and never re-derives it from `endDate`. The two can contradict each other: the
 * cross-field rule is CLIENT-ONLY — the API's DTOs carry no such constraint and the service accepts
 * a current role that also has an end date. Re-deriving would make the list disagree with both the
 * stored record and the ordering the server sorted by, which is the one thing a list must not do.
 */
export function experienceIsCurrent(experience: AdminExperience): boolean {
  return experience.isCurrent === true
}
