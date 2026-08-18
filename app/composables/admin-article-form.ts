import * as z from 'zod'
import { ADMIN_ARTICLE_STATUSES } from '~/composables/admin-articles-query'
import type { AdminArticle, ArticleStatus, CreateArticlePayload } from '~/composables/admin-article-types'

/**
 * Pure rules for the Articles module — Nuxt-free, so they unit-test without a runtime, exactly as
 * `admin-project-form.ts` is.
 *
 * ## Every export here is prefixed, and that is not a style preference
 *
 * `app/composables/` is auto-imported WHOLESALE. `admin-project-form.ts` already exports
 * `hasTranslation`, `PROJECT_LOCALES` and `REQUIRED_TRANSLATION_FIELDS`, and Nuxt resolves a
 * duplicated auto-import name by silently ignoring one of them — a defect with no error message,
 * recorded in `app/utils/list-query.ts` and warned about again in `admin-projects-query.ts`. So the
 * Articles equivalents are named `articleHasTranslation`, `ARTICLE_LOCALES` and
 * `ARTICLE_REQUIRED_TRANSLATION_FIELDS`, and every future export in this file must be too.
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE EDITOR'S FORM MODEL
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * One locale's authored fields.
 *
 * `readingTimeMin` is ABSENT and that is load-bearing twice over: the API computes it per
 * translation and does not declare it on the write DTO, so sending it is a `forbidNonWhitelisted`
 * 422 — and holding it in the form would put a server-computed value into the dirty-comparison
 * baseline, which makes a freshly saved article look unsaved. `createdAt`/`updatedAt` are out for
 * the same reason.
 *
 * Optional fields are `string`, never `null`, because an `<input>` yields `''`. The conversion of
 * `''` back to the explicit `null` that CLEARS a field (D10-23) happens once, in the payload
 * builder, rather than at every binding.
 */
export interface ArticleTranslationForm {
  title: string
  slug: string
  excerpt: string
  body: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImageId: string | null
}

export interface ArticleFormState {
  status: ArticleStatus
  /**
   * The `datetime-local` value — `YYYY-MM-DDTHH:mm` in the OPERATOR's zone, or `''` for unset.
   *
   * Kept as the control's own string rather than an ISO instant so the field round-trips exactly
   * what was typed. `articlePublishAtToIso` performs the one conversion, at the payload boundary.
   */
  publishAtLocal: string
  categoryId: string
  coverImageId: string | null
  tagIds: string[]
  translations: Record<ArticleLocale, ArticleTranslationForm>
}

export function emptyArticleTranslationForm(): ArticleTranslationForm {
  return {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    metaTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    ogImageId: null
  }
}

/** `null` reads as the empty string, so a cleared server value and an untouched input agree. */
const text = (value: string | null | undefined): string => value ?? ''

/**
 * ISO instant → the `datetime-local` string, in the operator's own zone.
 *
 * Done by hand rather than with `toISOString().slice(0,16)`, which would render the UTC wall-clock
 * and silently shift a scheduled article by the operator's offset — a scheduling control that lies
 * about the time it is showing.
 */
export function articleIsoToPublishAtLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The `datetime-local` string → an ISO instant, or `null` when unset. */
export function articlePublishAtToIso(local: string): string | null {
  if (local.trim() === '') return null
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Seed the form from the server entity, or empty for a new article.
 *
 * A locale the article does not have is seeded EMPTY, never from its sibling. The list view
 * deliberately falls back across locales to IDENTIFY a row; the editor must not, because a
 * pre-filled Arabic tab holding English text is how an operator saves a translation nobody wrote.
 */
export function initialArticleForm(article: AdminArticle | null): ArticleFormState {
  const translations = {} as Record<ArticleLocale, ArticleTranslationForm>
  for (const locale of ARTICLE_LOCALES) {
    const saved = article?.translations[locale]
    translations[locale] = saved
      ? {
          title: text(saved.title),
          slug: text(saved.slug),
          excerpt: text(saved.excerpt),
          body: text(saved.body),
          metaTitle: text(saved.metaTitle),
          metaDescription: text(saved.metaDescription),
          canonicalUrl: text(saved.canonicalUrl),
          ogImageId: saved.ogImageId ?? null
        }
      : emptyArticleTranslationForm()
  }
  return {
    status: article?.status ?? 'DRAFT',
    publishAtLocal: articleIsoToPublishAtLocal(article?.publishAt ?? null),
    categoryId: article?.categoryId ?? '',
    coverImageId: article?.coverImageId ?? null,
    tagIds: [...(article?.tagIds ?? [])],
    translations
  }
}

/**
 * Is the operator authoring this locale at all?
 *
 * Any non-blank REQUIRED field counts. SEO-only input does not make a locale "in use" — a meta
 * title with no article behind it is not a translation, and treating it as one would demand three
 * more fields the operator never intended to write.
 */
export function articleTranslationInUse(form: ArticleTranslationForm): boolean {
  return ARTICLE_REQUIRED_TRANSLATION_FIELDS.some(field => !blank(form[field]))
}

export type ArticleFillState = 'empty' | 'partial' | 'complete'

/** How much of one locale is filled in — drives the tab badge (FR-DSH-011). */
export function articleFillState(form: ArticleTranslationForm): ArticleFillState {
  const filled = ARTICLE_REQUIRED_TRANSLATION_FIELDS.filter(field => !blank(form[field])).length
  if (filled === 0) return 'empty'
  return filled === ARTICLE_REQUIRED_TRANSLATION_FIELDS.length ? 'complete' : 'partial'
}

/** Required fields still missing in a locale that is being authored. */
export function articleMissingFields(form: ArticleTranslationForm): ArticleRequiredField[] {
  return ARTICLE_REQUIRED_TRANSLATION_FIELDS.filter(field => blank(form[field]))
}

/**
 * Locales that EXISTED on the saved article and have been emptied in the form.
 *
 * This must block the save. `PATCH /admin/articles/{id}` UPSERTS translations and never deletes
 * them, so omitting an emptied locale from the payload would report success while the old text
 * stayed live on the public site — the worst outcome available to a content editor, because it
 * looks like it worked. Proven against the real semantics in `articles-server.spec.ts`.
 */
export function articleClearedLocales(
  form: ArticleFormState,
  saved: AdminArticle | null
): ArticleLocale[] {
  if (!saved) return []
  return ARTICLE_LOCALES.filter(locale =>
    articleHasTranslation(saved, locale) && !articleTranslationInUse(form.translations[locale])
  )
}

/** The locales the payload will carry, in the order it will carry them. */
export function articlePayloadLocales(form: ArticleFormState): ArticleLocale[] {
  return ARTICLE_LOCALES.filter(locale => articleTranslationInUse(form.translations[locale]))
}

/**
 * Map an API field path onto a FORM field path.
 *
 * The asymmetry this exists for: reads carry `translations` as a locale-KEYED map, writes carry it
 * as an ARRAY, and a 422 names `translations[0].slug` — an index into the array THIS CLIENT built.
 * So resolving it back to a locale requires the ordering of the request that was just issued, which
 * is why `sentLocales` is a parameter rather than a constant. With Arabic sent first,
 * `translations[0]` is Arabic; with English first it is English, and a mapping that assumed either
 * would put an Arabic slug collision on the English tab — an error the operator cannot act on,
 * against a field that looks fine.
 *
 * Anything that is not a translation path (`publishAt`, `categoryId`) passes through unchanged.
 * An index outside the sent array yields `null`: better to surface it as a form-level message than
 * to attach it confidently to the wrong locale.
 */
export function articleFieldErrorName(field: string, sentLocales: readonly ArticleLocale[]): string | null {
  const match = /^translations\[(\d+)\]\.(.+)$/.exec(field)
  if (!match) return field
  const locale = sentLocales[Number(match[1])]
  return locale ? `translations.${locale}.${match[2]}` : null
}

/** Which locale tab an API field path belongs to, or `null` when it is not locale-scoped. */
export function articleFieldErrorLocale(
  field: string,
  sentLocales: readonly ArticleLocale[]
): ArticleLocale | null {
  const match = /^translations\[(\d+)\]\./.exec(field)
  if (!match) return null
  return sentLocales[Number(match[1])] ?? null
}

/** `''` becomes the explicit `null` that CLEARS a nullable field; a real value passes through (D10-23). */
const nullable = (value: string): string | null => (blank(value) ? null : value.trim())

/**
 * Build the write payload.
 *
 * EVERY in-use locale is sent, not only the one being edited, because the PATCH upserts per locale
 * — sending just the active tab would leave the other locale's stored text untouched while the
 * operator believes the whole article was saved.
 *
 * The optional per-locale fields are sent as explicit `null` when empty rather than omitted, which
 * is what makes "clear this field" expressible at all (D10-23). Omission means "preserve", and a
 * form that omitted them could never empty a meta description once one was set.
 */
export function articlePayload(form: ArticleFormState): CreateArticlePayload {
  return {
    status: form.status,
    publishAt: articlePublishAtToIso(form.publishAtLocal),
    categoryId: form.categoryId,
    coverImageId: form.coverImageId,
    tagIds: [...form.tagIds],
    translations: articlePayloadLocales(form).map(locale => {
      const value = form.translations[locale]
      return {
        locale,
        title: value.title.trim(),
        slug: value.slug.trim(),
        excerpt: value.excerpt.trim(),
        body: value.body,
        metaTitle: nullable(value.metaTitle),
        metaDescription: nullable(value.metaDescription),
        canonicalUrl: nullable(value.canonicalUrl),
        ogImageId: value.ogImageId
      }
    })
  } as CreateArticlePayload
}

/**
 * A stable comparison string for dirty tracking.
 *
 * Tag ids are SORTED: reordering the same selection is not an edit, and without this the unsaved
 * guard would challenge an operator who ticked a tag off and back on.
 */
function comparable(form: ArticleFormState): string {
  return JSON.stringify({
    status: form.status,
    publishAtLocal: form.publishAtLocal,
    categoryId: form.categoryId,
    coverImageId: form.coverImageId,
    tagIds: [...form.tagIds].sort(),
    translations: ARTICLE_LOCALES.map(locale => form.translations[locale])
  })
}

export function isArticleFormDirty(form: ArticleFormState, initial: ArticleFormState): boolean {
  return comparable(form) !== comparable(initial)
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   VALIDATION — ONE ARCHITECTURE, ZOD, AS THE DASHBOARD POLICY REQUIRES
   ══════════════════════════════════════════════════════════════════════════════════════════════

   Plan §5.2 names zod + `UForm` (Standard Schema) as the Dashboard's validation architecture, and
   §14.3 forbids introducing a second one. `ProjectEditor` predates that and hand-rolls a pure
   validator against a plain `<form>`; it is the OUTLIER, not the precedent, and is deliberately not
   copied here. Reconciling it is a later retrofit, exactly as `messages.vue`'s hand-rolled loading
   state is.

   THE SCHEMA IS A FUNCTION OF `t`, and must be rebuilt when the dashboard language changes. Held as
   a `const`, it would keep serving validation messages in whichever language the page loaded in
   while every other string changed around them — the defect FE-2a found and fixed in `login.vue`,
   which OD-11 created by making the language switch state rather than navigation.

   THE PER-LOCALE RULES ARE CONDITIONAL, and that is the whole difficulty. A locale is either not
   authored at all — which is legitimate, an article may exist in one language — or authored and
   therefore complete. "Half a translation" is the only state that is wrong, and a flat
   `z.string().min(1)` per field could not express it: it would demand Arabic from an operator who
   only ever wanted English.
*/

type Translate = (key: string, named?: Record<string, unknown>) => string

/** A blank-tolerant field: the emptiness rules live in `superRefine`, where the locale is known. */
const loose = z.string()

export function articleFormSchema(translate: Translate, saved: AdminArticle | null) {
  const translationShape = z.object({
    title: loose,
    slug: loose,
    excerpt: loose,
    body: loose,
    metaTitle: loose,
    metaDescription: loose,
    canonicalUrl: loose,
    ogImageId: z.string().nullable()
  })

  return z
    .object({
      status: z.enum(ADMIN_ARTICLE_STATUSES),
      publishAtLocal: loose,
      categoryId: z.string().min(1, translate('dashboard.articles.validation.categoryRequired')),
      coverImageId: z.string().nullable(),
      tagIds: z.array(z.string()),
      translations: z.object({ en: translationShape, ar: translationShape })
    })
    .superRefine((form, ctx) => {
      const inUse = ARTICLE_LOCALES.filter(locale => articleTranslationInUse(form.translations[locale]))

      // At least one language must actually be written. The API requires it too, but a 422 for
      // "you have not written anything" is a round trip that says nothing the form could not.
      if (inUse.length === 0) {
        for (const field of ARTICLE_REQUIRED_TRANSLATION_FIELDS) {
          ctx.addIssue({
            code: 'custom',
            path: ['translations', ARTICLE_LOCALES[0], field],
            message: translate('dashboard.articles.validation.atLeastOneLocale')
          })
        }
      }

      // A locale being authored must be COMPLETE. Reported per missing field so the message lands
      // on the input rather than on the tab, and so `UForm`'s own focus handling can reach it.
      for (const locale of inUse) {
        for (const field of articleMissingFields(form.translations[locale])) {
          ctx.addIssue({
            code: 'custom',
            path: ['translations', locale, field],
            message: translate('dashboard.articles.validation.fieldRequired')
          })
        }
      }

      // A locale that EXISTS on the server and has been emptied. Blocked rather than silently
      // dropped from the payload, because the PATCH never deletes a translation: omitting it would
      // report success while the old text stayed published.
      for (const locale of articleClearedLocales(form as ArticleFormState, saved)) {
        ctx.addIssue({
          code: 'custom',
          path: ['translations', locale, 'title'],
          message: translate('dashboard.articles.validation.cannotClearLocale')
        })
      }

      // SCHEDULED needs a FUTURE instant — the API's rule, enforced here so the operator finds out
      // while looking at the control rather than after a save round trip.
      if (form.status === 'SCHEDULED') {
        const iso = articlePublishAtToIso(form.publishAtLocal)
        if (!iso) {
          ctx.addIssue({
            code: 'custom',
            path: ['publishAtLocal'],
            message: translate('dashboard.articles.validation.publishAtRequired')
          })
        } else if (new Date(iso).getTime() <= Date.now()) {
          ctx.addIssue({
            code: 'custom',
            path: ['publishAtLocal'],
            message: translate('dashboard.articles.validation.publishAtFuture')
          })
        }
      }
    })
}
