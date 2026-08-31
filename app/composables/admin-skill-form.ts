import * as z from 'zod'
import type { components } from '~/types/api'
import {
  ADMIN_SKILL_GROUPS,
  SKILL_LOCALES,
  type AdminSkillGroup,
  type SkillLocale
} from '~/composables/admin-skill-fields'

type Schemas = components['schemas']
export type CreateSkillPayload = Schemas['CreateSkillDto']
export type UpdateSkillPayload = Schemas['UpdateSkillDto']

export interface SkillTranslationForm {
  label: string
}

export interface SkillFormState {
  slug: string
  group: AdminSkillGroup
  order: number
  brandColor: string
  isPublic: boolean
  translations: Record<SkillLocale, SkillTranslationForm>
}

export type SkillTranslationFill = 'empty' | 'complete'

const blank = (value: string): boolean => value.trim().length === 0

export function emptySkillForm(): SkillFormState {
  return {
    slug: '',
    group: ADMIN_SKILL_GROUPS[0],
    order: 0,
    brandColor: '',
    isPublic: true,
    translations: { en: { label: '' }, ar: { label: '' } }
  }
}

export function initialSkillForm(skill: Schemas['AdminSkillEntity'] | null): SkillFormState {
  const translations = { en: { label: '' }, ar: { label: '' } }
  for (const locale of SKILL_LOCALES) {
    const saved = skill?.translations[locale]
    if (saved) translations[locale] = { label: saved.label }
  }
  return {
    slug: skill?.slug ?? '',
    group: skill?.group ?? ADMIN_SKILL_GROUPS[0],
    order: skill?.order ?? 0,
    brandColor: skill?.brandColor ?? '',
    isPublic: skill?.isPublic ?? true,
    translations
  }
}

function comparable(form: SkillFormState): string {
  return JSON.stringify(form)
}

export function isSkillFormDirty(form: SkillFormState, initial: SkillFormState): boolean {
  return comparable(form) !== comparable(initial)
}

export function skillTranslationFill(form: SkillTranslationForm): SkillTranslationFill {
  return blank(form.label) ? 'empty' : 'complete'
}

/** The request's actual translation order. It is also the resolver input for indexed API errors. */
export function skillPayloadLocales(form: SkillFormState): SkillLocale[] {
  return SKILL_LOCALES.filter(locale => !blank(form.translations[locale].label))
}

/** OD-14 completeness is deliberately distinct from validity: one locale is valid but incomplete. */
export function isSkillTranslationComplete(form: SkillFormState): boolean {
  return skillPayloadLocales(form).length === SKILL_LOCALES.length
}

const translationPayload = (form: SkillFormState) => skillPayloadLocales(form).map(locale => ({
  locale,
  label: form.translations[locale].label.trim()
}))

export function skillCreatePayload(form: SkillFormState): CreateSkillPayload {
  return {
    slug: form.slug.trim(),
    group: form.group,
    order: form.order,
    brandColor: blank(form.brandColor) ? null : form.brandColor.trim(),
    isPublic: form.isPublic,
    translations: translationPayload(form)
  }
}

/**
 * PATCH has no slug. `brandColor` is included only when changed: an explicit empty value becomes
 * `null` and CLEARS, while an unchanged value is omitted and PRESERVES. These inverse contract
 * directions are kept separate so a form cannot accidentally turn every edit into a clear.
 */
export function skillUpdatePayload(form: SkillFormState, initial: SkillFormState): UpdateSkillPayload {
  const body: UpdateSkillPayload = {
    group: form.group,
    order: form.order,
    isPublic: form.isPublic,
    translations: translationPayload(form)
  }
  if (form.brandColor.trim() !== initial.brandColor.trim()) {
    body.brandColor = blank(form.brandColor) ? null : form.brandColor.trim()
  }
  return body
}

type Translate = (key: string) => string
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * OD-14 is a FRONTEND authoring invariant. OpenAPI requires the `translations` property but sets no
 * `minItems`, and the e2e backend deliberately accepts `[]`; this refinement is the only guard.
 * It requires at least one authored locale, never a particular primary locale and never all locales.
 */
export function skillFormSchema(translate: Translate) {
  const translation = z.object({
    // An unfilled locale is valid while another locale is authored; OD-14 only requires one.
    label: z.string().max(120, translate('dashboard.skills.validation.labelTooLong'))
  })
  return z.object({
    slug: z.string().min(1, translate('dashboard.skills.validation.slugRequired')).max(60, translate('dashboard.skills.validation.slugTooLong')),
    group: z.enum(ADMIN_SKILL_GROUPS),
    order: z.number(),
    brandColor: z.string(),
    isPublic: z.boolean(),
    translations: z.object({ en: translation, ar: translation })
  }).superRefine((form, ctx) => {
    if (!SLUG.test(form.slug) || UUID_SHAPED.test(form.slug)) {
      ctx.addIssue({ code: 'custom', path: ['slug'], message: translate('dashboard.skills.validation.slugInvalid') })
    }
    if (skillPayloadLocales(form as SkillFormState).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['translations'],
        message: translate('dashboard.skills.validation.atLeastOneLocale')
      })
    }
  })
}
