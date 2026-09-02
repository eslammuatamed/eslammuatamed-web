import * as z from 'zod'
import type { components } from '~/types/api'
import { TESTIMONIAL_LOCALES, type TestimonialLocale } from '~/composables/admin-testimonial-fields'

type Schemas = components['schemas']
export type CreateTestimonialPayload = Schemas['CreateTestimonialDto']
export type UpdateTestimonialPayload = Schemas['UpdateTestimonialDto']

/**
 * The contract's translation WRITE entry, modeled as a schema so the rules T·U1 calibrated — a
 * two-letter lowercase locale and non-empty required text within the API's maximums — are enforced
 * by the same validation library the form uses, not restated as comments. The editor builds locales
 * from its own fixed tab list, so the locale rule can never fire from the UI; it exists so the
 * payload path is checked against the modeled contract rather than trusted.
 */
export const testimonialTranslationDtoSchema = z.object({
  locale: z.string().regex(/^[a-z]{2}$/, 'locale must be a two-letter lowercase locale.'),
  quote: z.string().min(1).max(4000),
  authorName: z.string().min(1).max(160),
  authorRole: z.string().min(1).max(160)
})

export interface TestimonialTranslationForm {
  quote: string
  authorName: string
  authorRole: string
}

export interface TestimonialFormState {
  /** Nullable by contract. PATCH discriminates explicit null (clear) from omission (preserve). */
  avatarId: string | null
  order: number
  isVisible: boolean
  translations: Record<TestimonialLocale, TestimonialTranslationForm>
}

export type TestimonialTranslationFill = 'empty' | 'partial' | 'complete'

const blank = (value: string): boolean => value.trim().length === 0

const emptyTranslation = (): TestimonialTranslationForm => ({ quote: '', authorName: '', authorRole: '' })

export function emptyTestimonialForm(): TestimonialFormState {
  return {
    avatarId: null,
    order: 0,
    isVisible: true,
    translations: { en: emptyTranslation(), ar: emptyTranslation() }
  }
}

export function initialTestimonialForm(testimonial: Schemas['AdminTestimonialEntity'] | null): TestimonialFormState {
  const translations = { en: emptyTranslation(), ar: emptyTranslation() }
  for (const locale of TESTIMONIAL_LOCALES) {
    const saved = testimonial?.translations[locale]
    if (saved) {
      translations[locale] = { quote: saved.quote, authorName: saved.authorName, authorRole: saved.authorRole }
    }
  }
  return {
    avatarId: testimonial?.avatarId ?? null,
    order: testimonial?.order ?? 0,
    isVisible: testimonial?.isVisible ?? true,
    translations
  }
}

function comparable(form: TestimonialFormState): string {
  return JSON.stringify(form)
}

export function isTestimonialFormDirty(form: TestimonialFormState, initial: TestimonialFormState): boolean {
  return comparable(form) !== comparable(initial)
}

/** Is ONE authored field present? A locale with any text is being written and must be completed. */
function authored(translation: TestimonialTranslationForm): boolean {
  return !blank(translation.quote) || !blank(translation.authorName) || !blank(translation.authorRole)
}

/** All three required fields carry text — the only state the write payload may include. */
export function isTestimonialLocaleComplete(form: TestimonialFormState, locale: TestimonialLocale): boolean {
  return isTestimonialTranslationFilled(form.translations[locale])
}

function isTestimonialTranslationFilled(translation: TestimonialTranslationForm): boolean {
  return !blank(translation.quote) && !blank(translation.authorName) && !blank(translation.authorRole)
}

export function testimonialTranslationFill(form: TestimonialTranslationForm): TestimonialTranslationFill {
  if (!authored(form)) return 'empty'
  return isTestimonialTranslationFilled(form) ? 'complete' : 'partial'
}

/** The request's actual translation order — also the resolver input for indexed API errors. */
export function testimonialPayloadLocales(form: TestimonialFormState): TestimonialLocale[] {
  return TESTIMONIAL_LOCALES.filter(locale => isTestimonialLocaleComplete(form, locale))
}

/** OD-14 completeness is deliberately distinct from validity: one locale is valid but incomplete. */
export function isTestimonialTranslationComplete(form: TestimonialFormState): boolean {
  return testimonialPayloadLocales(form).length === TESTIMONIAL_LOCALES.length
}

const translationPayload = (form: TestimonialFormState) => testimonialPayloadLocales(form).map(locale => ({
  locale,
  quote: form.translations[locale].quote.trim(),
  authorName: form.translations[locale].authorName.trim(),
  authorRole: form.translations[locale].authorRole.trim()
}))

export function testimonialCreatePayload(form: TestimonialFormState): CreateTestimonialPayload {
  return {
    // Create carries the avatar explicitly: a chosen id links it, an untouched picker sends null,
    // which is the stored default anyway.
    avatarId: form.avatarId,
    order: form.order,
    isVisible: form.isVisible,
    translations: translationPayload(form)
  }
}

/**
 * PATCH carries only what changed — and for the avatar that distinction IS the contract:
 *
 *   - untouched between load and save → OMITTED → the server preserves the linked asset;
 *   - cleared → EXPLICIT `null` → the server clears the link;
 *   - replaced → the new id.
 *
 * Sending `avatarId` unconditionally would make every unrelated edit re-assert (or, worse, silently
 * clear) the avatar; this is the same omission/preservation split `skillUpdatePayload` draws for
 * `brandColor`, kept beside the field whose semantics it serves.
 */
export function testimonialUpdatePayload(
  form: TestimonialFormState,
  initial: TestimonialFormState
): UpdateTestimonialPayload {
  const body: UpdateTestimonialPayload = {
    order: form.order,
    isVisible: form.isVisible,
    // Upsert semantics on the wire: supplied locales are rewritten, omitted locales are preserved.
    translations: translationPayload(form)
  }
  if (form.avatarId !== initial.avatarId) {
    body.avatarId = form.avatarId
  }
  return body
}

type Translate = (key: string) => string

/**
 * OD-14 is a FRONTEND authoring invariant, adapted to THREE required text fields: a locale with ANY
 * authored text must be completed before save, and at least one fully-authored locale is required.
 * No primary locale is privileged — Arabic-first and English-first are equally valid.
 */
export function testimonialFormSchema(translate: Translate) {
  const translation = z.object({
    // An unfilled field is valid while its locale is unauthored or complete elsewhere; the
    // cross-field refinement below decides which blanks actually block.
    quote: z.string().max(4000, translate('dashboard.testimonials.validation.quoteTooLong')),
    authorName: z.string().max(160, translate('dashboard.testimonials.validation.authorNameTooLong')),
    authorRole: z.string().max(160, translate('dashboard.testimonials.validation.authorRoleTooLong'))
  })
  return z.object({
    avatarId: z.string().nullable(),
    order: z.number(),
    isVisible: z.boolean(),
    translations: z.object({ en: translation, ar: translation })
  }).superRefine((form, ctx) => {
    if (!Number.isInteger(form.order)) {
      ctx.addIssue({
        code: 'custom',
        path: ['order'],
        message: translate('dashboard.testimonials.validation.orderInteger')
      })
      return
    }
    if (form.order < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['order'],
        message: translate('dashboard.testimonials.validation.orderNegative')
      })
      return
    }

    let completeLocales = 0
    for (const locale of TESTIMONIAL_LOCALES) {
      if (isTestimonialLocaleComplete(form as TestimonialFormState, locale)) {
        completeLocales += 1
        continue
      }
      if (!authored(form.translations[locale])) continue
      // Partially written: every blank required field blocks at its own path, so the operator is
      // taken to exactly what is missing instead of a generic "incomplete" complaint.
      const fields = [
        ['quote', translate('dashboard.testimonials.validation.quoteRequired')],
        ['authorName', translate('dashboard.testimonials.validation.authorNameRequired')],
        ['authorRole', translate('dashboard.testimonials.validation.authorRoleRequired')]
      ] as const
      for (const [field, message] of fields) {
        if (blank(form.translations[locale][field])) {
          ctx.addIssue({ code: 'custom', path: [`translations.${locale}.${field}`], message })
        }
      }
    }
    if (completeLocales === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['translations'],
        message: translate('dashboard.testimonials.validation.atLeastOneLocale')
      })
    }
  })
}
