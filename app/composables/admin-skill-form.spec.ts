import { describe, expect, it } from 'vitest'
import { translationFieldErrorLocale, translationFieldErrorName } from './dashboard-translation-errors'
import {
  emptySkillForm,
  isSkillTranslationComplete,
  skillCreatePayload,
  skillFormSchema,
  skillPayloadLocales,
  skillUpdatePayload
} from './admin-skill-form'

const t = (key: string) => key

describe('OD-14 — validity and completeness stay different', () => {
  it('BLOCKS a zero-translation save even though the API mock accepts translations: []', () => {
    const form = emptySkillForm()
    form.slug = 'typescript'
    const parsed = skillFormSchema(t).safeParse(form)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(expect.objectContaining({ path: ['translations'] }))
    }
  })

  it('ALLOWS one locale and still reports the Skill INCOMPLETE', () => {
    const form = emptySkillForm()
    form.translations.en.label = 'TypeScript'
    expect(skillFormSchema(t).safeParse(form).success).toBe(false) // slug is independently required
    form.slug = 'typescript'
    expect(skillFormSchema(t).safeParse(form).success).toBe(true)
    expect(skillPayloadLocales(form)).toEqual(['en'])
    expect(isSkillTranslationComplete(form)).toBe(false)
  })

  it('treats Arabic-only as first-class and resolves translations[0] to Arabic', () => {
    const form = emptySkillForm()
    form.slug = 'typescript'
    form.translations.ar.label = 'تايب سكربت'
    expect(skillFormSchema(t).safeParse(form).success).toBe(true)
    const payload = skillCreatePayload(form)
    expect(payload.translations).toEqual([{ locale: 'ar', label: 'تايب سكربت' }])
    const sentLocales = skillPayloadLocales(form)
    expect(translationFieldErrorName('translations[0].label', sentLocales)).toBe('translations.ar.label')
    expect(translationFieldErrorLocale('translations[0].label', sentLocales)).toBe('ar')
  })

  it('reports complete only when every configured locale is authored', () => {
    const form = emptySkillForm()
    form.translations.en.label = 'TypeScript'
    form.translations.ar.label = 'تايب سكربت'
    expect(isSkillTranslationComplete(form)).toBe(true)
  })
})

describe('the write contract', () => {
  it('accepts negative/fractional order and non-hex brandColor without narrowing OpenAPI', () => {
    const form = emptySkillForm()
    form.slug = 'web-performance'
    form.order = -1.25
    form.brandColor = 'brand-token'
    form.translations.en.label = 'Web performance'
    expect(skillFormSchema(t).safeParse(form).success).toBe(true)
    expect(skillCreatePayload(form)).toMatchObject({ order: -1.25, brandColor: 'brand-token' })
  })

  it('sends explicit null to CLEAR a changed brandColor', () => {
    const initial = emptySkillForm()
    initial.brandColor = '#3178C6'
    const form = structuredClone(initial)
    form.brandColor = ''
    expect(skillUpdatePayload(form, initial)).toHaveProperty('brandColor', null)
  })

  it('OMITS unchanged brandColor so PATCH preserves it, and never sends create-only slug', () => {
    const initial = emptySkillForm()
    initial.slug = 'typescript'
    initial.brandColor = '#3178C6'
    const payload = skillUpdatePayload(structuredClone(initial), initial)
    expect(payload).not.toHaveProperty('brandColor')
    expect(payload).not.toHaveProperty('slug')
  })
})
