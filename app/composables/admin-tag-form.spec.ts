import { describe, expect, it } from 'vitest'
import * as tagFormModule from './admin-tag-form'
import {
  tagAuthoredLocales,
  tagChangedLocales,
  tagCreatePayload,
  tagFormSchema,
  tagUpdatePayload,
  initialTagForm,
  isTagFormDirty
} from './admin-tag-form'
import type { TagFormState } from './admin-tag-form'
import { translationFieldErrorLocale, translationFieldErrorName } from './dashboard-translation-errors'

/**
 * Calibration for the TAG form/payload layer (`U3a`).
 *
 * The isolation half of this file is as load-bearing as the semantics half: tags have NO nullable
 * field, so every test here also proves the category clear-case cannot leak into this module.
 */

const translate = (key: string) => key

function row(): Parameters<typeof initialTagForm>[0] {
  return {
    id: 't1',
    translations: {
      en: { name: 'NestJS', slug: 'nestjs' },
      ar: { name: 'نيست', slug: 'nestjs-ar' }
    }
  }
}

function authored(locales: Array<'en' | 'ar'>, name = `${locales[0]}-name`, slug = `${locales[0]}-slug`): TagFormState {
  const state: TagFormState = {
    translations: {
      en: { name: '', slug: '' },
      ar: { name: '', slug: '' }
    }
  }
  for (const locale of locales) {
    state.translations[locale] = { name, slug }
  }
  return state
}

describe('the module exports NO detail read — editing starts from a list row', () => {
  it('exports no fetcher of any kind (getTag/getCategory et al. cannot exist here)', () => {
    const exportNames = Object.keys(tagFormModule)
    expect(exportNames.filter(name => /^get/i.test(name))).toEqual([])
    expect(exportNames).toContain('initialTagForm')
    expect(exportNames).not.toContain('useApi')
  })

  it('initializes the COMPLETE edit form from the collection-list row alone', () => {
    const form = initialTagForm(row())
    expect(form.translations.en).toEqual({ name: 'NestJS', slug: 'nestjs' })
    expect(form.translations.ar).toEqual({ name: 'نيست', slug: 'nestjs-ar' })
    expect(isTagFormDirty(form, initialTagForm(row()))).toBe(false)
  })
})

describe('create payloads — either locale can be first', () => {
  it('builds an ARABIC-FIRST create payload with Arabic at index 0 and no English', () => {
    expect(tagCreatePayload(authored(['ar'], 'وسوم-اختبار', 'test-ar'))).toEqual({
      translations: [{ locale: 'ar', name: 'وسوم-اختبار', slug: 'test-ar' }]
    })
    expect(tagAuthoredLocales(authored(['ar']))).toEqual(['ar'])
  })

  it('builds an ENGLISH-FIRST create payload symmetrically', () => {
    expect(tagCreatePayload(authored(['en'], 'Vue', 'vue'))).toEqual({
      translations: [{ locale: 'en', name: 'Vue', slug: 'vue' }]
    })
  })

  it('the schema REJECTS zero usable translations client-side', () => {
    const parsed = tagFormSchema(translate).safeParse(initialTagForm(null))
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some(issue => issue.path[0] === 'translations')).toBe(true)
    }
    // Arabic-only is valid; no primary language is mandated.
    expect(tagFormSchema(translate).safeParse(authored(['ar'], 'اختبار', 'test-ar')).success).toBe(true)
  })

  it('a tag item carries EXACTLY the contract keys — NO description ever', () => {
    const item = tagCreatePayload(authored(['en'], 'Vue', 'vue')).translations[0]!
    expect(Object.keys(item).sort()).toEqual(['locale', 'name', 'slug'])
    const serialized = JSON.stringify(tagCreatePayload(authored(['en', 'ar'], 'X', 'x')))
    expect(serialized).not.toContain('description')
    // The form shape itself has nowhere to express a clear.
    expect('description' in authored(['en']).translations.en).toBe(false)
  })
})

describe('update payloads — omission IS the preservation mechanism', () => {
  const initial = initialTagForm(row())

  it('an EDITED locale is supplied as an indexed upsert carrying the MUTABLE slug', () => {
    const form = initialTagForm(row())
    form.translations.en.name = 'NestJS rewritten'
    form.translations.en.slug = 'nestjs-v2'
    const body = tagUpdatePayload(form, initial)
    expect(body.translations).toHaveLength(1)
    expect(body.translations![0]).toEqual({ locale: 'en', name: 'NestJS rewritten', slug: 'nestjs-v2' })
  })

  it('an UNTOUCHED existing locale is OMITTED — never re-sent, so the server preserves it', () => {
    const form = initialTagForm(row())
    form.translations.ar.name = 'نيست معدّل'
    const locales = tagUpdatePayload(form, initial).translations!.map(entry => entry.locale)
    expect(locales).toEqual(['ar'])
    expect(locales).not.toContain('en')
  })

  it('NO changes -> an EMPTY body; a wholesale array is never produced', () => {
    const form = initialTagForm(row())
    expect(tagChangedLocales(form, initial)).toEqual([])
    expect(tagUpdatePayload(form, initial)).toEqual({})
    expect(JSON.stringify(tagUpdatePayload(form, initial))).not.toContain('"translations":[]')
  })

  it('a NEWLY AUTHORED second locale upserts while the stored locale stays omitted', () => {
    const englishOnly: TagFormState = initialTagForm({
      id: 't1',
      translations: { en: { name: 'Testing', slug: 'testing' } }
    })
    const form: TagFormState = {
      translations: {
        en: { ...englishOnly.translations.en },
        ar: { name: 'اختبار', slug: 'testing-ar' }
      }
    }
    const body = tagUpdatePayload(form, englishOnly)
    expect(body.translations!.map(entry => entry.locale)).toEqual(['ar'])
  })
})

describe('indexed 422 errors resolve through the SENT order', () => {
  it('an English-first single-locale payload maps translations[0].slug onto the ENGLISH tab', () => {
    expect(translationFieldErrorName('translations[0].slug', ['en'])).toBe('translations.en.slug')
    expect(translationFieldErrorLocale('translations[0].name', ['en'])).toBe('en')
  })

  it('an Arabic-first both-locales payload keeps index 0 on Arabic — the canonical-list trap stays closed', () => {
    expect(translationFieldErrorName('translations[0].slug', ['ar', 'en'])).toBe('translations.ar.slug')
    expect(translationFieldErrorName('translations[1].slug', ['ar', 'en'])).toBe('translations.en.slug')
  })

  it('the changed-locales array IS the sent order the resolver must receive', () => {
    const initial = initialTagForm(row())
    const form = initialTagForm(row())
    form.translations.ar.slug = 'nestjs-ar-renamed'
    expect(tagChangedLocales(form, initial)).toEqual(['ar'])
  })
})
