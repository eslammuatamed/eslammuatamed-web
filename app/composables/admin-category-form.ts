import * as z from 'zod'
import type { components } from '~/types/api'
import {
  TAXONOMY_LOCALES,
  taxonomyHasTranslation,
  type TaxonomyLocale
} from '~/composables/admin-taxonomy-fields'

type Schemas = components['schemas']
export type CreateCategoryPayload = Schemas['CreateCategoryDto']
export type UpdateCategoryPayload = Schemas['UpdateCategoryDto']

/**
 * Categories FORM/PAYLOAD layer (FE-3 Taxonomy, `U3a`) — no UI ships here.
 *
 * ── ⚠ THERE IS NO DETAIL READ, SO EDITING STARTS FROM A LIST ROW ────────────────────────────────
 * `/admin/categories/{id}` answers PATCH and DELETE only. This module therefore exports an
 * initializer that accepts the entity ALREADY HELD by the collection (`initialCategoryForm(row)`)
 * and deliberately exports NO fetcher of any kind: a function that cannot be called cannot build a
 * request the API cannot answer.
 *
 * ── THE PATCH BUILDER EMITS ONLY CHANGED LOCALES ────────────────────────────────────────────────
 * UpdateCategoryDto.upsert semantics: a SUPPLIED locale is upserted, an OMITTED locale is preserved
 * server-side, and `translations: []` is an accepted no-op. So omission IS the preservation
 * mechanism, and the builder sends exactly the locales whose authored content differs from the row
 * the form was initialized from:
 *
 *   · untouched existing locale  -> OMITTED     (server preserves it verbatim)
 *   · edited existing locale     -> supplied    (upsert)
 *   · newly authored locale      -> supplied    (upsert creates it)
 *   · nothing changed at all     -> `{}`        (an empty PATCH body; saying nothing)
 *
 * This is deliberately NOT the Testimonials send-every-in-use-locale rule: there the endpoint
 * replaced wholesale, so sending everything was the only safe shape. Here replacement does not
 * exist, and re-sending an untouched locale would claim an authority over stored data the operator
 * never exercised.
 *
 * ── THE ONE NULLABLE FIELD ───────────────────────────────────────────────────────────────────────
 * `description` is the sole nullable translation property. Within an EMITTED locale its key is
 * included only when it differs from the initialized row: unchanged -> omitted (preserved), explicit
 * clear -> `null` travels (the documented clear), a new value -> the value travels. Empty text is
 * never silently converted to `null` — clearing is an operator act represented by `null`, not a side
 * effect of typing nothing.
 */

export interface CategoryTranslationForm {
  name: string
  slug: string
  /** `null` is the CLEARED state; `''` is empty CONTENT. They are different and stay different. */
  description: string | null
}

export interface CategoryFormState {
  translations: Record<TaxonomyLocale, CategoryTranslationForm>
}

export function emptyCategoryForm(): CategoryFormState {
  return {
    translations: {
      en: { name: '', slug: '', description: null },
      ar: { name: '', slug: '', description: null }
    }
  }
}

/** Initialize DIRECTLY from a collection-list row — the only read this module knows exists. */
export function initialCategoryForm(row: Schemas['AdminCategoryEntity'] | null): CategoryFormState {
  const form = emptyCategoryForm()
  for (const locale of TAXONOMY_LOCALES) {
    const saved = row?.translations[locale]
    if (saved) {
      form.translations[locale] = {
        name: saved.name,
        slug: saved.slug,
        description: saved.description ?? null
      }
    }
  }
  return form
}

function comparable(translations: CategoryTranslationForm): string {
  // Field order is fixed by construction, so stringify is a stable structural snapshot.
  return JSON.stringify([translations.name, translations.slug, translations.description])
}

export function isCategoryFormDirty(form: CategoryFormState, initial: CategoryFormState): boolean {
  return TAXONOMY_LOCALES.some(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/**
 * Locales whose authored content CHANGED versus the initialized row — also the request's actual
 * translation order, and therefore the resolver input for indexed API errors.
 */
export function categoryChangedLocales(form: CategoryFormState, initial: CategoryFormState): TaxonomyLocale[] {
  return TAXONOMY_LOCALES.filter(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/** Which locales carry usable authored content right now (non-blank name AND slug). */
export function categoryAuthoredLocales(form: CategoryFormState): TaxonomyLocale[] {
  return TAXONOMY_LOCALES.filter(locale => taxonomyHasTranslation(form, locale))
}

function categoryItem(
  locale: TaxonomyLocale,
  form: CategoryFormState,
  initial: CategoryFormState | null
): Schemas['CategoryTranslationDto'] {
  const entry: Schemas['CategoryTranslationDto'] = {
    locale,
    name: form.translations[locale].name.trim(),
    slug: form.translations[locale].slug.trim()
  }
  const nextDescription = form.translations[locale].description
  const previous = initial?.translations[locale]?.description ?? null
  // Include the nullable key ONLY on change: omission preserves, `null` clears, a value sets.
  if (nextDescription !== previous) entry.description = nextDescription
  return entry
}

export function categoryCreatePayload(form: CategoryFormState): CreateCategoryPayload {
  const locales = categoryAuthoredLocales(form)
  return {
    translations: locales.map(locale => categoryItem(locale, form, null))
  }
}

export function categoryUpdatePayload(form: CategoryFormState, initial: CategoryFormState): UpdateCategoryPayload {
  const changed = categoryChangedLocales(form, initial)
  // Nothing changed -> an EMPTY body. Emitting `[]` would also be a contract-safe no-op, but an
  // empty body says honestly that the operator changed nothing about translations.
  if (changed.length === 0) return {}
  return {
    translations: changed.map(locale => categoryItem(locale, form, initial))
  }
}

type Translate = (key: string) => string

/**
 * Frontend authoring invariant (OD-14's taxonomy application): AT LEAST ONE usable locale before a
 * save is allowed — Arabic-first and English-first equally valid, no mandatory primary language,
 * one authored locale valid-but-incomplete. The contract itself declares no `minItems`, so this
 * refinement is the only zero-translations guard, exactly as the Skills module records.
 */
export function categoryFormSchema(translate: Translate) {
  // An UNFILLED locale is valid while another locale is authored — OD-14 requires one usable
  // locale, never two, and never a particular primary language (the Skills precedent verbatim).
  // A HALF-filled locale stays valid-but-incomplete here and is simply never EMITTED, because
  // emission is driven by `categoryAuthoredLocales` (non-blank name AND slug).
  const translation = z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable()
  })
  return z.object({
    translations: z.object({
      en: translation,
      ar: translation
    })
  }).superRefine((form, ctx) => {
    if (categoryAuthoredLocales(form as CategoryFormState).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['translations'],
        message: translate('dashboard.taxonomy.validation.atLeastOneLocale')
      })
    }
  })
}
