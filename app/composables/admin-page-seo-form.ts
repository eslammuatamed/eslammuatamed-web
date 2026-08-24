import * as z from 'zod'
import type { components } from '~/types/api'

type Schemas = components['schemas']
export type AdminPageSeo = Schemas['AdminPageSeoEntity']
export type UpdatePageSeoPayload = Schemas['UpdatePageSeoDto']
export type PageSeoTranslationInput = Schemas['PageSeoTranslationDto']

/**
 * The Static Page SEO FORM/PAYLOAD layer (FR-DSH-051, FE4-U1b) — no UI ships here, no API calls,
 * no composable: every rule below is a decision about what the operator meant and what
 * `PATCH /admin/seo/pages/{pageKey}` will do with it, testable without a runtime.
 *
 * ── THE CONTRACT THIS MODULE ENCODES (all verified against the adopted openapi.json) ────────────
 *
 * Static page SEO is OPTIONAL OVERRIDE DATA. Every per-locale field is nullable and optional on the
 * write; a page whose locales are ALL-NULL is a valid, complete state — the public endpoint answers
 * such pages with success-plus-nulls (D10-24) and the site falls back to its defaults. This is why
 * this module deliberately does NOT apply OD-14's content rule ("at least one authored locale"):
 * that guard exists because a content entity with no localized prose has no human-facing
 * representation. An SEO page with no overrides has exactly the right representation — "use the
 * defaults". Clearing the LAST override is therefore always legal here.
 *
 * The API's only cardinality requirement is different in kind: a PATCH BODY must carry at least one
 * translation ENTRY. An unchanged form must not produce a request at all — so `buildPageSeoPatch`
 * returns `null`, not an empty payload. `null` cannot be sent down the wire by accident, whereas an
 * empty `translations` array (or `{}`) is a 422 waiting for a caller who forgets to check.
 *
 * PATCH UPSERT SEMANTICS (D10-23 inside D09-24): a supplied locale is upserted, an omitted locale is
 * preserved verbatim; within a supplied locale an omitted FIELD key preserves, explicit `null`
 * clears, a non-null value replaces. So emission is decided by ORIGINAL-VS-CURRENT — never by the
 * current value alone, because blank means two different things depending on what was held:
 *
 *   unchanged since load            → key OMITTED      → server preserves
 *   held, then cleared              → `null` SENT      → server clears
 *   initially null, still blank     → key OMITTED      → preserved (there is nothing to clear)
 *   changed to another value        → new trimmed string
 *
 * ── IDENTITY ─────────────────────────────────────────────────────────────────────────────────────
 * `pageKey` is the entity's identity, carried by the REQUEST PATH, never by the body:
 * `UpdatePageSeoDto` accepts only `translations`. The initializer reads the entity's translation map
 * and drops the key; nothing in this module can serialize it.
 */

/** The two supported Dashboard/content locales, same set every admin surface uses (D04-2). */
export const PAGE_SEO_LOCALES = ['en', 'ar'] as const
export type PageSeoLocale = (typeof PAGE_SEO_LOCALES)[number]

/**
 * UI representation: nullable READ values become editable strings (`''`), `ogImageId` stays
 * `string | null` because it is an id, not text — the picker owns its empty state.
 */
export interface PageSeoTranslationForm {
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImageId: string | null
}

export interface PageSeoFormState {
  translations: Record<PageSeoLocale, PageSeoTranslationForm>
}

const blank = (value: string): boolean => value.trim().length === 0

function translationFormFrom(translation: Schemas['PageSeoTranslationEntity'] | undefined): PageSeoTranslationForm {
  return {
    metaTitle: translation?.metaTitle ?? '',
    metaDescription: translation?.metaDescription ?? '',
    canonicalUrl: translation?.canonicalUrl ?? '',
    ogImageId: translation?.ogImageId ?? null
  }
}

/**
 * Initialize directly from `AdminPageSeoEntity` — the detail read carries EVERY enabled locale
 * (all-null when unauthored), so there is no absent case and no fallback to invent.
 */
export function initialPageSeoForm(entity: AdminPageSeo | null): PageSeoFormState {
  const translations = {} as Record<PageSeoLocale, PageSeoTranslationForm>
  for (const locale of PAGE_SEO_LOCALES) {
    translations[locale] = translationFormFrom(entity?.translations[locale])
  }
  return { translations }
}

/** A stable structural snapshot of ONE locale's edited values (trimmed, like every sibling form). */
function comparable(translation: PageSeoTranslationForm): string {
  return JSON.stringify([
    translation.metaTitle.trim(),
    translation.metaDescription.trim(),
    translation.canonicalUrl.trim(),
    translation.ogImageId
  ])
}

export function isPageSeoFormDirty(form: PageSeoFormState, initial: PageSeoFormState): boolean {
  return PAGE_SEO_LOCALES.some(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/**
 * Locales whose SEO values CHANGED versus the initialized state — also THE REQUEST'S ACTUAL
 * TRANSLATION ORDER, and therefore the resolver input for indexed API errors. A payload built from
 * this list emits Arabic at index 0 whenever Arabic is the only changed locale; mapping indexed 422
 * paths against anything else attaches errors to fields the operator never touched.
 */
export function pageSeoChangedLocales(form: PageSeoFormState, initial: PageSeoFormState): PageSeoLocale[] {
  return PAGE_SEO_LOCALES.filter(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/**
 * One text field's wire value, decided by original-vs-current — see the module header for the
 * three-state table. Whitespace-only differences count as unchanged, matching the trim discipline
 * of `comparable()`.
 */
function seoTextPatchValue(before: string, after: string): string | null | undefined {
  if (after.trim() === before.trim()) return undefined
  return blank(after) ? null : after.trim()
}

export function isValidCanonicalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function pageSeoItem(
  locale: PageSeoLocale,
  form: PageSeoFormState,
  initial: PageSeoFormState
): PageSeoTranslationInput {
  const current = form.translations[locale]
  const before = initial.translations[locale]
  const entry: PageSeoTranslationInput = { locale }

  // Each key travels ONLY when it differs from the baseline: omission preserves, `null` clears.
  const metaTitle = seoTextPatchValue(before.metaTitle, current.metaTitle)
  if (metaTitle !== undefined) entry.metaTitle = metaTitle
  const metaDescription = seoTextPatchValue(before.metaDescription, current.metaDescription)
  if (metaDescription !== undefined) entry.metaDescription = metaDescription
  const canonicalUrl = seoTextPatchValue(before.canonicalUrl, current.canonicalUrl)
  if (canonicalUrl !== undefined) entry.canonicalUrl = canonicalUrl

  if (current.ogImageId !== before.ogImageId) entry.ogImageId = current.ogImageId

  return entry
}

/**
 * The PATCH body for changed locales, or **`null` when nothing changed** — the explicit
 * "no mutation required" result. Returning a payload shape instead would invite callers to send
 * `{ translations: [] }`, which the adopted contract REJECTS ("at least one entry"); `null` cannot
 * be serialized, so the no-op path is unsendable by construction.
 *
 * Within an emitted locale only CHANGED fields travel, so untouched values are never re-sent as
 * `null` and replace-all semantics are unreachable: an emitted entry carries exactly the operator's
 * changes for that locale, and omitted locales stay out of the body entirely.
 */
export function buildPageSeoPatch(
  form: PageSeoFormState,
  initial: PageSeoFormState
): UpdatePageSeoPayload | null {
  const changed = pageSeoChangedLocales(form, initial)
  if (changed.length === 0) return null
  return {
    translations: changed.map(locale => pageSeoItem(locale, form, initial))
  }
}

type Translate = (key: string) => string

/**
 * Validation for the eventual editor form. Deliberately MINIMAL, because the contract declares
 * almost none: no length limits on title/description, no required fields anywhere. The single real
 * rule is the canonical override's URI format — and even that applies only to NON-BLANK values,
 * because a blank canonical is the legitimate cleared state, not an error.
 *
 * ⚠ NO minimum-authored-locale refinement lives here, on purpose: that is the content entities'
 * OD-14 rule, and applying it to optional override data would make "clear everything back to
 * defaults" unsavable.
 */
export function pageSeoFormSchema(translate: Translate) {
  /** Blank-tolerant: emptiness rules live in `superRefine`, where the locale is known. */
  const loose = z.string()
  const translationShape = z.object({
    metaTitle: loose,
    metaDescription: loose,
    canonicalUrl: loose,
    ogImageId: z.string().nullable()
  })

  return z
    .object({
      translations: z.object({
        en: translationShape,
        ar: translationShape
      })
    })
    .superRefine((form, ctx) => {
      for (const locale of PAGE_SEO_LOCALES) {
        const value = form.translations[locale].canonicalUrl.trim()
        if (value === '') continue
        if (!isValidCanonicalUrl(value)) {
          ctx.addIssue({
            code: 'custom',
            path: ['translations', locale, 'canonicalUrl'],
            message: translate('dashboard.seo.validation.canonicalUrl')
          })
        }
      }
    })
}
