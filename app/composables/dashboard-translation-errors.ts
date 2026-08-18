/**
 * Mapping an API validation error back onto a translated form field.
 *
 * ── WHY THIS IS SHARED AND NOT ARTICLE-SPECIFIC ─────────────────────────────────────────────────
 * It is a property of the CONTRACT, not of any one module. Every admin write DTO that carries
 * translations carries them the same way, and there are SIXTEEN of them — `CreateArticleDto`,
 * `UpdateArticleDto`, `Create/UpdateProjectDto`, `Create/UpdateSkillDto`,
 * `Create/UpdateExperienceDto`, `Create/UpdateTestimonialDto`, `Create/UpdateCategoryDto`,
 * `Create/UpdateTagDto`, `UpdateSettingsDto` and `UpdatePageSeoDto`. All of them:
 *
 *   - READ back a locale-KEYED map (`translations: { en: {...}, ar: {...} }`), and
 *   - WRITE an ARRAY of locale-tagged objects (`translations: [{ locale: 'en', ... }]`), and
 *   - answer a 422 with array-indexed field paths (`translations[0].slug`).
 *
 * So this rule is extracted because a real implementation demonstrated the boundary AND the boundary
 * is the contract's, not one module's — which is the §14.6 bar. The tab component that renders those
 * locales is deliberately NOT extracted alongside it: that has exactly one consumer today.
 *
 * ── THE ONE THING THAT MAKES THIS SUBTLE ────────────────────────────────────────────────────────
 * The index is into the array THE CLIENT BUILT, so resolving it requires that request's own
 * ordering — hence `sentLocales` is a parameter and never a module constant. With Arabic sent first,
 * `translations[0]` is Arabic; with English first it is English. The case that actually bites is a
 * SINGLE-LOCALE payload: an Arabic-only entity sends one entry, so index 0 is Arabic, and any
 * implementation resolving against a canonical `['en', 'ar']` list attaches the error to a field the
 * operator deliberately left empty while the real problem stays invisible on the other tab.
 *
 * That failure was reproduced deliberately: with both resolvers pinned to a canonical list, a
 * both-locales test still PASSED and only the single-locale test failed.
 *
 * Pure and Nuxt-free, so it unit-tests without a runtime.
 */

/**
 * An API field path → the FORM field path, or `null` when it cannot be resolved.
 *
 * A non-translation path (`publishAt`, `categoryId`) passes through unchanged. An index outside the
 * sent array yields `null`, so the caller can surface it as a form-level message rather than pin it
 * confidently to the wrong field.
 */
export function translationFieldErrorName(
  field: string,
  sentLocales: readonly string[]
): string | null {
  const match = /^translations\[(\d+)\]\.(.+)$/.exec(field)
  if (!match) return field
  const locale = sentLocales[Number(match[1])]
  return locale ? `translations.${locale}.${match[2]}` : null
}

/** Which locale an API field path belongs to, or `null` when it is not locale-scoped. */
export function translationFieldErrorLocale(
  field: string,
  sentLocales: readonly string[]
): string | null {
  const match = /^translations\[(\d+)\]\./.exec(field)
  if (!match) return null
  return sentLocales[Number(match[1])] ?? null
}
