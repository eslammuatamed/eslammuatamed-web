import { describe, expect, it } from 'vitest'
import {
  TAXONOMY_LOCALES,
  taxonomyDisplayName,
  taxonomyDisplaySlug,
  taxonomyHasTranslation,
  taxonomyMissingLocales
} from './admin-taxonomy-fields'
function row(translations: Record<string, { name: string, slug: string, description?: string | null }>) {
  return { id: 'row-1', translations }
}

describe('taxonomyHasTranslation', () => {
  it('requires a NON-BLANK name AND slug — a present key with empty fields is not a translation', () => {
    expect(taxonomyHasTranslation(row({ en: { name: 'Systems', slug: 'systems' } }), 'en')).toBe(true)
    for (const broken of [
      { name: '', slug: 'systems' },
      { name: 'Systems', slug: '' },
      { name: '  ', slug: 'systems' },
      { name: 'Systems', slug: '  ' }
    ]) {
      expect(taxonomyHasTranslation(row({ en: broken }), 'en')).toBe(false)
    }
  })

  it('answers from the returned map only — an absent locale is missing, never substituted', () => {
    const enOnly = row({ en: { name: 'Field notes', slug: 'field-notes' } })
    expect(taxonomyHasTranslation(enOnly, 'en')).toBe(true)
    expect(taxonomyHasTranslation(enOnly, 'ar')).toBe(false)
  })

  it('treats a nullable description as irrelevant to presence — it is not incompleteness', () => {
    expect(
      taxonomyHasTranslation(row({ en: { name: 'Delivery', slug: 'delivery', description: null } }), 'en')
    ).toBe(true)
  })

  it('exposes the two authored locales under the module prefix', () => {
    expect(TAXONOMY_LOCALES).toEqual(['en', 'ar'])
  })
})

describe('taxonomyMissingLocales', () => {
  it('lists exactly the locales without a usable translation', () => {
    const partial = row({
      en: { name: 'Interface', slug: 'interface' },
      ar: { name: '  ', slug: 'interface-ar' }
    })
    expect(taxonomyMissingLocales(partial)).toEqual(['ar'])
    expect(taxonomyMissingLocales(row({}))).toEqual(['en', 'ar'])
  })
})

describe('taxonomyDisplayName', () => {
  it('prefers the requested locale and falls back ONCE, never fabricating content', () => {
    const both = row({
      en: { name: 'Delivery', slug: 'delivery' },
      ar: { name: 'تسليم', slug: 'delivery-ar' }
    })
    expect(taxonomyDisplayName(both, 'en', 'Untitled')).toBe('Delivery')
    expect(taxonomyDisplayName(both, 'ar', 'Untitled')).toBe('تسليم')

    const enOnly = row({ en: { name: 'Field notes', slug: 'field-notes' } })
    expect(taxonomyDisplayName(enOnly, 'ar', 'Untitled tag')).toBe('Field notes')
    expect(taxonomyDisplayName(row({}), 'en', 'Untitled category')).toBe('Untitled category')
  })

  it('does not accept a blank name as content', () => {
    const blankEn = row({ en: { name: '  ', slug: 'x' }, ar: { name: 'اسم', slug: 'x-ar' } })
    expect(taxonomyDisplayName(blankEn, 'en', 'Untitled')).toBe('اسم')
  })
})

describe('taxonomyDisplaySlug', () => {
  it('returns the preferred locale slug verbatim, then the other locale, then null', () => {
    const both = row({
      en: { name: 'NestJS', slug: 'nestjs' },
      ar: { name: 'نيست', slug: 'nestjs-ar' }
    })
    expect(taxonomyDisplaySlug(both, 'en')).toBe('nestjs')
    expect(taxonomyDisplaySlug(both, 'ar')).toBe('nestjs-ar')
    expect(taxonomyDisplaySlug(row({ en: { name: 'Vue', slug: 'vue' } }), 'ar')).toBe('vue')
    expect(taxonomyDisplaySlug(row({}), 'en')).toBeNull()
  })
})
