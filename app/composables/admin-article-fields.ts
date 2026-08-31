import type { AdminArticle, ArticleStatus } from '~/composables/admin-article-types'

/**
 * Article FIELD RULES — what a translation is, and how one is presented.
 *
 * Nuxt-free and zod-free, so it unit-tests without a runtime and costs a list route nothing.
 *
 * ── WHY THIS IS SPLIT FROM `admin-article-form.ts`, MEASURED ─────────────────────────────────────
 * It used to be one module. When the editor landed, the COLLECTION route's app-owned bytes rose from
 * 88,344 B to 97,233 B — an 8,889 B jump for a page that gained no features. The cause was this
 * import boundary: the list needs `articleHasTranslation`, `articleDisplayTitle`, `articleSlug` and
 * `articleStatusColor`, and importing any of them dragged in the editor's whole form model and Zod
 * schema, because they shared a file.
 *
 * So the split is along an observed cost, not an aesthetic one: a list route should not carry an
 * editor's validation schema. FE-3 replicates this module shape across five more content modules,
 * which is five more chances to pay that 8.9 KB — the reason it is fixed in the tracer bullet rather
 * than noted for later.
 *
 * ── EVERY EXPORT IS PREFIXED ────────────────────────────────────────────────────────────────────
 * `app/composables/` is auto-imported WHOLESALE, and `admin-project-form.ts` already exports
 * `hasTranslation`, `PROJECT_LOCALES` and `REQUIRED_TRANSLATION_FIELDS`. Nuxt resolves a duplicated
 * auto-import name by silently ignoring one of them — a defect with no error message, recorded in
 * `app/utils/list-query.ts`. Hence `articleHasTranslation`, `ARTICLE_LOCALES`, and so on.
 */

/** The two authored locales. Same set as projects, named separately for the reason above. */
export const ARTICLE_LOCALES = ['en', 'ar'] as const
export type ArticleLocale = (typeof ARTICLE_LOCALES)[number]

/**
 * The fields the API requires on every translation it accepts (`ArticleTranslationDto.required`).
 *
 * `readingTimeMin` is deliberately absent: it is computed server-side per translation and is not
 * declared on the write DTO, so a form that carried it would be sending a field the API rejects.
 */
export const ARTICLE_REQUIRED_TRANSLATION_FIELDS = ['title', 'slug', 'excerpt', 'body'] as const
export type ArticleRequiredField = (typeof ARTICLE_REQUIRED_TRANSLATION_FIELDS)[number]

/** The per-locale SEO overrides — all optional, all clearable with an explicit `null` (D10-23). */
export const ARTICLE_OPTIONAL_TRANSLATION_FIELDS = [
  'metaTitle',
  'metaDescription',
  'canonicalUrl'
] as const
export type ArticleOptionalField = (typeof ARTICLE_OPTIONAL_TRANSLATION_FIELDS)[number]

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0

/**
 * Does this article really have this locale?
 *
 * Answered from the translation MAP the API returned, never from a flag and never by falling back
 * to the other language — the whole point of the indicator is to make a missing translation
 * visible, so a function that substituted English for absent Arabic would assert its own input.
 */
export function articleHasTranslation(article: AdminArticle, locale: ArticleLocale): boolean {
  const translation = article.translations[locale]
  if (!translation) return false
  return !blank(translation.title) && !blank(translation.slug)
}

/** Which locales are missing — the list view's completeness summary, and the editor's tab badges. */
export function articleMissingLocales(article: AdminArticle): ArticleLocale[] {
  return ARTICLE_LOCALES.filter(locale => !articleHasTranslation(article, locale))
}

/**
 * A row's heading, in the operator's language where it exists.
 *
 * This is the ONE place a cross-locale read is correct: it identifies a row, it is not authored
 * content, and the completeness badges beside it state plainly which languages actually exist. The
 * editor does no such thing — it seeds a missing locale EMPTY, never from its sibling.
 *
 * Follows the operator (OD-11 / D02-15) rather than hard-coding `en`, matching the same correction
 * made to the projects list and to `skillLabel()` in FE-2a.
 */
export function articleDisplayTitle(
  article: AdminArticle,
  preferred: string,
  fallbackLabel: string
): string {
  const inPreferred = article.translations[preferred]?.title
  if (!blank(inPreferred)) return inPreferred as string
  const other = ARTICLE_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? article.translations[other]?.title : undefined
  if (!blank(inOther)) return inOther as string
  return fallbackLabel
}

/** One locale's slug, or `null` when that locale does not exist. Never the other locale's slug. */
export function articleSlug(article: AdminArticle, locale: ArticleLocale): string | null {
  const slug = article.translations[locale]?.slug
  return blank(slug) ? null : (slug as string)
}

/**
 * Does this article have a real public destination right now?
 *
 * PUBLISHED alone is not enough — the public route resolves by PER-LOCALE slug, and
 * `GET /articles/{slug}` 404s for a locale the article does not have. So a `View on site` action
 * offered for a published article whose Arabic is missing would link an Arabic-working operator
 * straight to a 404, which plan §14.2 forbids by name.
 *
 * SCHEDULED and ARCHIVED both answer `false`: a scheduled article is not public yet, and an
 * archived one is no longer public. Neither is a preview case either — preview is about drafts.
 */
export function articleIsPubliclyVisible(article: AdminArticle, locale: ArticleLocale): boolean {
  return article.status === 'PUBLISHED' && articleHasTranslation(article, locale)
}

/**
 * The badge colour for a status.
 *
 * Colour is never the only carrier — every badge renders its own translated word beside it — but
 * the mapping is centralised so the list and the editor cannot drift into showing the same status
 * two different ways.
 */
export function articleStatusColor(status: ArticleStatus): 'success' | 'primary' | 'neutral' | 'warning' {
  switch (status) {
    case 'PUBLISHED': return 'success'
    case 'SCHEDULED': return 'primary'
    case 'ARCHIVED': return 'warning'
    default: return 'neutral'
  }
}

