import { describe, expect, it } from 'vitest'
import * as categoryFormModule from './admin-category-form'
import {
  categoryAuthoredLocales,
  categoryChangedLocales,
  categoryCreatePayload,
  categoryFormSchema,
  categoryUpdatePayload,
  initialCategoryForm,
  isCategoryFormDirty
} from './admin-category-form'
import type { CategoryFormState } from './admin-category-form'
import { translationFieldErrorLocale, translationFieldErrorName } from './dashboard-translation-errors'

/**
 * Calibration for the CATEGORY form/payload layer (`U3a`), not a product test.
 *
 * The load-bearing rules are negative-controlled in the paired control run: upsert-vs-replace-all,
 * empty-array destructiveness, explicit-null clear suppression, and the minimum-translation guard.
 */

const translate = (key: string) => key

interface CategoryRowFixture {
  id?: string
  translations?: Record<string, { name: string, slug: string, description?: string | null }>
}

function row(over: CategoryRowFixture = {}): NonNullable<Parameters<typeof initialCategoryForm>[0]> {
  return {
    id: over.id ?? 'c1',
    translations: {
      en: { name: 'Systems', slug: 'systems', description: 'Architecture notes.' },
      ar: { name: 'أنظمة', slug: 'systems-ar', description: null },
      ...over.translations
    }
  }
}

function authored(options: {
  locales?: Array<'en' | 'ar'>
  name?: string
  slug?: string
  description?: string | null
} = {}): CategoryFormState {
  const { locales = ['en'], name, slug, description } = options
  const state: CategoryFormState = {
    translations: {
      en: { name: '', slug: '', description: null },
      ar: { name: '', slug: '', description: null }
    }
  }
  for (const locale of locales) {
    state.translations[locale] = {
      name: name ?? `${locale}-name`,
      slug: slug ?? `${locale}-slug`,
      description: description ?? null
    }
  }
  return state
}

describe('the module exports NO detail read — editing starts from a list row', () => {
  it('exports no fetcher of any kind (getCategory/getCategoryById/getTag et al. cannot exist here)', () => {
    const exportNames = Object.keys(categoryFormModule)
    expect(exportNames.filter(name => /^get/i.test(name))).toEqual([])
    expect(exportNames).toContain('initialCategoryForm')
    expect(exportNames).not.toContain('useApi')
  })

  it('initializes the COMPLETE edit form from the collection-list row alone', () => {
    const form = initialCategoryForm(row())
    expect(form.translations.en).toEqual({ name: 'Systems', slug: 'systems', description: 'Architecture notes.' })
    expect(form.translations.ar).toEqual({ name: 'أنظمة', slug: 'systems-ar', description: null })
    // And it is clean against its own row.
    expect(isCategoryFormDirty(form, initialCategoryForm(row()))).toBe(false)
  })
})

describe('create payloads — either locale can be first', () => {
  it('builds an ARABIC-FIRST create payload with Arabic at index 0 and no English', () => {
    const form = authored({ locales: ['ar'], name: 'واجهات', slug: 'interfaces-ar' })
    expect(categoryCreatePayload(form)).toEqual({
      translations: [{ locale: 'ar', name: 'واجهات', slug: 'interfaces-ar' }]
    })
    expect(categoryAuthoredLocales(form)).toEqual(['ar'])
  })

  it('builds an ENGLISH-FIRST create payload symmetrically', () => {
    const form = authored({ locales: ['en'], name: 'Interface', slug: 'interface', description: 'Design systems.' })
    expect(categoryCreatePayload(form)).toEqual({
      translations: [{ locale: 'en', name: 'Interface', slug: 'interface', description: 'Design systems.' }]
    })
  })

  it('the schema REJECTS zero usable translations client-side — no primary language mandated', () => {
    const blank = initialCategoryForm(null)
    const parsed = categoryFormSchema(translate).safeParse(blank)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some(issue => issue.path[0] === 'translations')).toBe(true)
    }
    // One authored locale is VALID but incomplete; the other stays empty without failing.
    const arabicFirst = authored({ locales: ['ar'], name: 'واجهات', slug: 'interfaces-ar' })
    expect(categoryFormSchema(translate).safeParse(arabicFirst).success).toBe(true)
  })

  it('blank text is NOT silently converted to null on create — content and clearing differ', () => {
    const form = authored({ locales: ['en'], name: 'Delivery', slug: 'delivery', description: '' })
    const payload = categoryCreatePayload(form).translations[0]!
    expect(payload.description).toBe('')
    expect(payload).not.toHaveProperty('description', null)
  })
})

describe('update payloads — omission IS the preservation mechanism', () => {
  const initial = initialCategoryForm(row())

  it('an EDITED locale is supplied as an indexed upsert carrying the MUTABLE slug', () => {
    const form = initialCategoryForm(row())
    form.translations.en.name = 'Systems rewritten'
    form.translations.en.slug = 'systems-v2'
    const body = categoryUpdatePayload(form, initial)
    expect(body.translations).toHaveLength(1)
    expect(body.translations![0]).toEqual({
      locale: 'en',
      name: 'Systems rewritten',
      slug: 'systems-v2'
    })
  })

  it('an UNTOUCHED existing locale is OMITTED — never re-sent, so the server preserves it', () => {
    const form = initialCategoryForm(row())
    form.translations.en.name = 'Systems rewritten'
    const locales = categoryUpdatePayload(form, initial).translations!.map(entry => entry.locale)
    expect(locales).not.toContain('ar')
  })

  it('a NEWLY AUTHORED second locale is supplied as an upsert while the untouched locale stays omitted', () => {
    // The stored row only ever had English; the operator now authors Arabic.
    const englishOnly: CategoryFormState = initialCategoryForm({
      id: 'c1',
      translations: { en: { name: 'Systems', slug: 'systems', description: null } }
    })
    const form: CategoryFormState = {
      translations: {
        en: { ...englishOnly.translations.en },
        ar: { name: 'أنظمة جديدة', slug: 'systems-new-ar', description: null }
      }
    }
    const body = categoryUpdatePayload(form, englishOnly)
    expect(body.translations!.map(entry => entry.locale)).toEqual(['ar'])
    expect(body.translations![0]).toMatchObject({ locale: 'ar', name: 'أنظمة جديدة', slug: 'systems-new-ar' })
  })

  it('NO changes -> an EMPTY body: nothing destructive is emitted, and [] never has to appear', () => {
    const form = initialCategoryForm(row())
    expect(categoryChangedLocales(form, initial)).toEqual([])
    expect(categoryUpdatePayload(form, initial)).toEqual({})
    // The instrument (U1) separately proves `translations: []` is an accepted no-op upstream; this
    // builder simply never produces a wholesale array to begin with.
    const serialized = JSON.stringify(categoryUpdatePayload(form, initial))
    expect(serialized).not.toContain('"translations":[]')
  })

  it('description: UNTOUCHED -> key omitted from the emitted item; OTHER locale untouched -> absent entirely', () => {
    const form = initialCategoryForm(row())
    form.translations.en.name = 'Renamed'
    const item = categoryUpdatePayload(form, initial).translations![0]!
    expect(item.locale).toBe('en')
    expect(item).not.toHaveProperty('description') // preserved by omission
    expect(JSON.stringify(categoryUpdatePayload(form, initial))).not.toContain('Architecture notes.')
  })

  it('description: EXPLICIT null CLEARS — null travels on the wire within the emitted locale', () => {
    const form = initialCategoryForm(row())
    form.translations.en.description = null
    const item = categoryUpdatePayload(form, initial).translations![0]!
    expect(item).toHaveProperty('description', null)
  })

  it('description: a NEW value travels; a change in ONE field of a locale carries that locale whole', () => {
    const form = initialCategoryForm(row())
    form.translations.ar.description = 'وصف جديد'
    const item = categoryUpdatePayload(form, initial).translations![0]!
    expect(item).toEqual({
      locale: 'ar',
      name: 'أنظمة',
      slug: 'systems-ar',
      description: 'وصف جديد'
    })
  })
})

describe('indexed 422 errors resolve through the SENT order', () => {
  it('an Arabic-first single-locale payload maps translations[0].slug onto the ARABIC tab', () => {
    const sentLocales = ['ar']
    expect(translationFieldErrorName('translations[0].slug', sentLocales)).toBe('translations.ar.slug')
    expect(translationFieldErrorLocale('translations[0].slug', sentLocales)).toBe('ar')
  })

  it('an English-first both-locales payload keeps index 1 on Arabic', () => {
    const sentLocales = ['en', 'ar']
    expect(translationFieldErrorName('translations[1].slug', sentLocales)).toBe('translations.ar.slug')
    expect(translationFieldErrorLocale('translations[0].name', sentLocales)).toBe('en')
  })

  it('the changed-locales array IS the sent order the resolver must receive', () => {
    const initial = initialCategoryForm(row())
    const form = initialCategoryForm(row())
    form.translations.ar.slug = 'systems-ar-renamed'
    expect(categoryChangedLocales(form, initial)).toEqual(['ar'])
  })
})
