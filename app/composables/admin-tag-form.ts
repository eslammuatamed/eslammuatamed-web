import * as z from 'zod'
import type { components } from '~/types/api'
import {
  TAXONOMY_LOCALES,
  taxonomyHasTranslation,
  type TaxonomyLocale
} from '~/composables/admin-taxonomy-fields'

type Schemas = components['schemas']
export type CreateTagPayload = Schemas['CreateTagDto']
export type UpdateTagPayload = Schemas['UpdateTagDto']

/**
 * Tags FORM/PAYLOAD layer (FE-3 Taxonomy, `U3a`) — no UI ships here.
 *
 * A sibling of `admin-category-form.ts`, kept as its OWN module because the two entities differ in
 * exactly one contract fact and that fact is load-bearing: **tags have NO nullable field.** There is
 * no `description` on TagTranslationDto, so nothing in this file can clear, emit `null`, or treat
 * empty text as anything but content — the category clear-case must stay mechanically unreachable
 * here, and the spec pins that.
 *
 * ── ⚠ THERE IS NO DETAIL READ, SO EDITING STARTS FROM A LIST ROW ────────────────────────────────
 * `/admin/tags/{id}` answers PATCH and DELETE only; this module exports an initializer over the
 * collection entity and deliberately exports NO fetcher of any kind.
 *
 * ── THE PATCH BUILDER EMITS ONLY CHANGED LOCALES ────────────────────────────────────────────────
 * The same upsert reading as categories: supplied locale upserted, omitted locale preserved,
 * `translations: []` an accepted no-op — therefore changed locales only, and `{}` when nothing
 * changed. Slug is per-locale and MUTABLE: an edited locale carries its current slug, a conflict
 * surfaces later as an indexed 422.
 */
export interface TagTranslationForm {
  name: string
  slug: string
}

export interface TagFormState {
  translations: Record<TaxonomyLocale, TagTranslationForm>
}

export function emptyTagForm(): TagFormState {
  return {
    translations: {
      en: { name: '', slug: '' },
      ar: { name: '', slug: '' }
    }
  }
}

/** Initialize DIRECTLY from a collection-list row — the only read this module knows exists. */
export function initialTagForm(row: Schemas['AdminTagEntity'] | null): TagFormState {
  const form = emptyTagForm()
  for (const locale of TAXONOMY_LOCALES) {
    const saved = row?.translations[locale]
    if (saved) form.translations[locale] = { name: saved.name, slug: saved.slug }
  }
  return form
}

function comparable(translations: TagTranslationForm): string {
  return JSON.stringify([translations.name, translations.slug])
}

export function isTagFormDirty(form: TagFormState, initial: TagFormState): boolean {
  return TAXONOMY_LOCALES.some(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/** Changed locales — also the request's translation order for indexed-error resolution. */
export function tagChangedLocales(form: TagFormState, initial: TagFormState): TaxonomyLocale[] {
  return TAXONOMY_LOCALES.filter(
    locale => comparable(form.translations[locale]) !== comparable(initial.translations[locale])
  )
}

/** Locales carrying usable authored content right now (non-blank name AND slug). */
export function tagAuthoredLocales(form: TagFormState): TaxonomyLocale[] {
  return TAXONOMY_LOCALES.filter(locale => taxonomyHasTranslation(form, locale))
}

function tagItem(locale: TaxonomyLocale, form: TagFormState): Schemas['TagTranslationDto'] {
  return {
    locale,
    name: form.translations[locale].name.trim(),
    slug: form.translations[locale].slug.trim()
  }
}

export function tagCreatePayload(form: TagFormState): CreateTagPayload {
  const locales = tagAuthoredLocales(form)
  return {
    translations: locales.map(locale => tagItem(locale, form))
  }
}

export function tagUpdatePayload(form: TagFormState, initial: TagFormState): UpdateTagPayload {
  const changed = tagChangedLocales(form, initial)
  // Nothing changed -> an EMPTY body (the upsert contract makes `[]` an equivalent no-op).
  if (changed.length === 0) return {}
  return {
    translations: changed.map(locale => tagItem(locale, form))
  }
}

type Translate = (key: string) => string

/**
 * The same single frontend invariant as categories: at least ONE authored locale before save;
 * Arabic-first and English-first equally valid. NO description key exists anywhere in this schema —
 * inventing one would import a clearing behavior the Tag contract does not have.
 */
export function tagFormSchema(translate: Translate) {
  // An UNFILLED locale is valid while another locale is authored — the Skills/Category precedent.
  // Emission is driven by `tagAuthoredLocales`, so a half-filled locale is valid-but-unemitted.
  const translation = z.object({
    name: z.string(),
    slug: z.string()
  })
  return z.object({
    translations: z.object({
      en: translation,
      ar: translation
    })
  }).superRefine((form, ctx) => {
    if (tagAuthoredLocales(form as TagFormState).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['translations'],
        message: translate('dashboard.taxonomy.validation.atLeastOneLocale')
      })
    }
  })
}
