import { describe, expect, it } from 'vitest'
import {
  PAGE_SEO_LOCALES,
  buildPageSeoPatch,
  initialPageSeoForm,
  isPageSeoFormDirty,
  isValidCanonicalUrl,
  pageSeoChangedLocales,
  pageSeoFormSchema
} from './admin-page-seo-form'
import type { AdminPageSeo, PageSeoFormState } from './admin-page-seo-form'
import {
  translationFieldErrorLocale,
  translationFieldErrorName
} from './dashboard-translation-errors'

/**
 * Calibration for the Static Page SEO form/payload layer (FE4-U1b) — pure semantics, no runtime.
 *
 * The load-bearing rules are negative-controlled by mutating this module's sibling source file
 * (`admin-page-seo-form.ts`), running the targeted test, restoring byte-for-byte and rerunning:
 * the null no-mutation result (never `translations: []`), per-field omission-preserves /
 * explicit-null-clears / replacement, the OG-image three-state pair, sent-order error mapping, and
 * the deliberate ABSENCE of OD-14's content guard on optional override data.
 */

type SeoTranslation = NonNullable<AdminPageSeo['translations'][string]>

const t = (key: string) => key

function entity(pageKey: AdminPageSeo['pageKey'], translations: Record<string, Partial<SeoTranslation>>): AdminPageSeo {
  // The read shape carries EVERY enabled locale; absent keys here model an all-null locale.
  const full = (value: Partial<SeoTranslation> | undefined): SeoTranslation => ({
    metaTitle: value?.metaTitle ?? null,
    metaDescription: value?.metaDescription ?? null,
    canonicalUrl: value?.canonicalUrl ?? null,
    ogImageId: value?.ogImageId ?? null
  })
  return {
    pageKey,
    translations: {
      en: full(translations.en),
      ar: full(translations.ar)
    }
  }
}

const ALL_NULL: Partial<SeoTranslation> = {}

const SEEDED = entity('about', {
  en: {
    metaTitle: 'About — Eslam Muatamed',
    metaDescription: 'Engineering background.',
    canonicalUrl: 'https://eslammuatamed.com/about',
    ogImageId: '00000000-0000-4000-b100-000000000001'
  },
  ar: {
    metaTitle: 'نبذة — إسلام معتمد',
    metaDescription: null,
    canonicalUrl: 'https://eslammuatamed.com/ar/about',
    ogImageId: null
  }
})

/** A form and its baseline, both initialized from the same entity — the editor's starting state. */
const fresh = (): { form: PageSeoFormState, initial: PageSeoFormState } => {
  const initial = initialPageSeoForm(SEEDED)
  return { form: initialPageSeoForm(SEEDED), initial }
}

describe('initialization — from AdminPageSeoEntity only', () => {
  it('seeds populated ENGLISH fields as editable strings', () => {
    const { form } = fresh()
    expect(form.translations.en.metaTitle).toBe('About — Eslam Muatamed')
    expect(form.translations.en.canonicalUrl).toBe('https://eslammuatamed.com/about')
    expect(form.translations.en.ogImageId).toBe('00000000-0000-4000-b100-000000000001')
  })

  it('seeds populated ARABIC fields independently', () => {
    const { form } = fresh()
    expect(form.translations.ar.metaTitle).toBe('نبذة — إسلام معتمد')
    expect(form.translations.ar.canonicalUrl).toBe('https://eslammuatamed.com/ar/about')
  })

  it('seeds a NULL read value as the editable empty string, never as null text', () => {
    const { form } = fresh()
    expect(form.translations.ar.metaDescription).toBe('')
    expect(typeof form.translations.ar.metaDescription).toBe('string')
  })

  it('an all-null locale initializes to the all-empty editable state', () => {
    const initial = initialPageSeoForm(entity('home', {}))
    expect(initial.translations.en).toEqual({ metaTitle: '', metaDescription: '', canonicalUrl: '', ogImageId: null })
    expect(initial.translations.ar).toEqual({ metaTitle: '', metaDescription: '', canonicalUrl: '', ogImageId: null })
    expect(buildPageSeoPatch(initial, initial)).toBeNull()
  })

  it('baseline and current state are INDEPENDENT objects', () => {
    const { form, initial } = fresh()
    expect(form).not.toBe(initial)
    form.translations.en.metaTitle = 'Mutated title'
    form.translations.ar.ogImageId = '00000000-0000-4000-b100-000000000002'
    expect(initial.translations.en.metaTitle).toBe('About — Eslam Muatamed')
    expect(initial.translations.ar.ogImageId).toBeNull()
  })
})

describe('no-change — explicit no-mutation, never translations: []', () => {
  it('a completely unchanged form returns NULL (do not save), not an empty payload', () => {
    const { form, initial } = fresh()
    expect(isPageSeoFormDirty(form, initial)).toBe(false)
    expect(buildPageSeoPatch(form, initial)).toBeNull()
  })

  it('whitespace-only edits count as unchanged and emit nothing', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = '  About — Eslam Muatamed  '
    expect(buildPageSeoPatch(form, initial)).toBeNull()
  })

  it('every emitted payload carries at least one translation ENTRY — [] can never be built', async () => {
    // Exercise every emission path below via the module's public surface in one sweep.
    const variants: PageSeoFormState[] = []
    for (const locale of PAGE_SEO_LOCALES) {
      const single = initialPageSeoForm(SEEDED)
      single.translations[locale].metaTitle = `${single.translations[locale].metaTitle}!`
      variants.push(single)
    }
    const both = initialPageSeoForm(entity('home', {}))
    both.translations.en.metaTitle = 'Home'
    both.translations.ar.ogImageId = '00000000-0000-4000-b100-000000000002'
    variants.push(both)

    for (const form of variants) {
      const patch = buildPageSeoPatch(form, initialPageSeoForm(SEEDED))
      expect(patch).not.toBeNull()
      expect(patch!.translations.length).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(patch)).not.toContain('"translations":[]')
    }
    expect(variants.length).toBeGreaterThan(0)
  })
})

describe('metaTitle — three wire states decided against the baseline', () => {
  it('unchanged populated field → OMITTED from its locale entry', () => {
    const { form, initial } = fresh()
    form.translations.en.metaDescription = 'New description only.'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]).toEqual({
      locale: 'en',
      metaDescription: 'New description only.'
    })
  })

  it('changed field → the new trimmed string', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = '  Revised about title  '
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.metaTitle).toBe('Revised about title')
  })

  it('HELD then cleared → explicit null travels', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = ''
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.metaTitle).toBeNull()
  })

  it('INITIALLY NULL and still blank → omitted (preservation, not a clear)', () => {
    const { form, initial } = fresh()
    form.translations.ar.metaDescription = '' // already null server-side
    form.translations.ar.metaTitle = 'Arabic change'
    const patch = buildPageSeoPatch(form, initial)!
    const arEntry = patch.translations.find(entry => entry.locale === 'ar')!
    expect(arEntry.metaTitle).toBe('Arabic change')
    expect('metaDescription' in arEntry).toBe(false)
  })
})

describe('metaDescription — three wire states decided against the baseline', () => {
  it('unchanged populated field → OMITTED', () => {
    const { form, initial } = fresh()
    form.translations.ar.metaTitle = 'Arabic-only change'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]).toEqual({ locale: 'ar', metaTitle: 'Arabic-only change' })
  })

  it('changed field → the new trimmed string', () => {
    const { form, initial } = fresh()
    form.translations.en.metaDescription = '  Fresh description.  '
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.metaDescription).toBe('Fresh description.')
  })

  it('HELD then cleared → explicit null travels', () => {
    const { form, initial } = fresh()
    form.translations.en.metaDescription = '   '
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.metaDescription).toBeNull()
  })

  it('INITIALLY NULL and still blank → omitted', () => {
    const { form, initial } = fresh()
    form.translations.ar.metaTitle = 'Arabic change again'
    const patch = buildPageSeoPatch(form, initial)!
    const arEntry = patch.translations.find(entry => entry.locale === 'ar')!
    expect('metaDescription' in arEntry).toBe(false)
  })
})

describe('canonicalUrl — three wire states plus client-side URI validation', () => {
  it('unchanged → OMITTED', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'Canonical untouched'
    const patch = buildPageSeoPatch(form, initial)!
    expect('canonicalUrl' in patch.translations[0]!).toBe(false)
  })

  it('changed valid absolute URI → the trimmed string', () => {
    const { form, initial } = fresh()
    form.translations.ar.canonicalUrl = ' https://eslammuatamed.com/ar/about-v2 '
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.canonicalUrl).toBe('https://eslammuatamed.com/ar/about-v2')
  })

  it('HELD then cleared → explicit null travels', () => {
    const { form, initial } = fresh()
    form.translations.en.canonicalUrl = ''
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.canonicalUrl).toBeNull()
  })

  it('INITIALLY NULL and still blank → omitted', () => {
    // A page whose AR canonical was never set: changing another Arabic field must NOT
    // manufacture a canonical clear.
    const source = entity('experience', {
      en: ALL_NULL,
      ar: { metaTitle: 'الخبرة', canonicalUrl: null }
    })
    const initial = initialPageSeoForm(source)
    const form = initialPageSeoForm(source)
    form.translations.ar.metaDescription = 'وصف الخبرة'
    const patch = buildPageSeoPatch(form, initial)!
    const arEntry = patch.translations.find(entry => entry.locale === 'ar')!
    expect('canonicalUrl' in arEntry).toBe(false)
  })

  it('a non-empty INVALID URI fails CLIENT validation before any request', () => {
    const { form, initial } = fresh()
    form.translations.en.canonicalUrl = 'not-a-uri'
    const schema = pageSeoFormSchema(t)
    const result = schema.safeParse(form)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(issue =>
        issue.path.join('.') === 'translations.en.canonicalUrl'
      )).toBe(true)
    }
    // And nothing about validation changes the payload layer's own decision.
    expect(buildPageSeoPatch(form, initial)!.translations[0]?.canonicalUrl).toBe('not-a-uri')
  })

  it('blank canonical is VALID (the cleared state), and absolute http(s) URIs pass', () => {
    const { form } = fresh()
    form.translations.en.canonicalUrl = ''
    expect(pageSeoFormSchema(t).safeParse(form).success).toBe(true)
    expect(isValidCanonicalUrl('https://eslammuatamed.com/x')).toBe(true)
    expect(isValidCanonicalUrl('http://localhost:3000/dev')).toBe(true)
    expect(isValidCanonicalUrl('ftp://eslammuatamed.com/x')).toBe(false)
    expect(isValidCanonicalUrl('//protocol-relative')).toBe(false)
  })

  it('Arabic and English canonical values are independent', () => {
    const { form, initial } = fresh()
    form.translations.en.canonicalUrl = 'https://eslammuatamed.com/about-en-new'
    expect((buildPageSeoPatch(form, initial)!.translations.find(e => e.locale === 'ar'))?.canonicalUrl).toBeUndefined()
    expect(initial.translations.ar.canonicalUrl).toBe('https://eslammuatamed.com/ar/about')
  })
})

describe('ogImageId — three wire states, no media logic in this layer', () => {
  it('existing id UNTOUCHED → OMITTED even when the locale emits', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'Image untouched'
    const patch = buildPageSeoPatch(form, initial)!
    expect('ogImageId' in patch.translations[0]!).toBe(false)
  })

  it('REPLACED with a new id → the new id travels', () => {
    const { form, initial } = fresh()
    form.translations.en.ogImageId = '00000000-0000-4000-b100-000000000002'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.ogImageId).toBe('00000000-0000-4000-b100-000000000002')
  })

  it('HELD id CLEARED → explicit null travels', () => {
    const { form, initial } = fresh()
    form.translations.en.ogImageId = null
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations[0]?.ogImageId).toBeNull()
  })

  it('INITIALLY NULL untouched → omitted (ar holds null; an Arabic text change omits it)', () => {
    const { form, initial } = fresh()
    form.translations.ar.metaTitle = 'بدون صورة'
    const patch = buildPageSeoPatch(form, initial)!
    const arEntry = patch.translations.find(entry => entry.locale === 'ar')!
    expect('ogImageId' in arEntry).toBe(false)
  })
})

describe('locale emission — exactly the changed locales, never replace-all', () => {
  it('EN-only change emits ONLY the EN entry', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'EN change'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations.map(entry => entry.locale)).toEqual(['en'])
  })

  it('AR-only change emits ONLY the AR entry, at index 0 of what was actually sent', () => {
    const { form, initial } = fresh()
    form.translations.ar.metaTitle = 'AR change'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations.map(entry => entry.locale)).toEqual(['ar'])
    expect(patch.translations[0]?.locale).toBe('ar')
  })

  it('an EN change OMITS the AR locale entirely — the server preserves it', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'EN change only'
    const patch = buildPageSeoPatch(form, initial)!
    expect(JSON.stringify(patch)).not.toContain('"ar"')
    expect(JSON.stringify(patch)).not.toContain('إسلام')
  })

  it('an AR change OMITS the EN locale entirely', () => {
    const { form, initial } = fresh()
    form.translations.ar.canonicalUrl = 'https://eslammuatamed.com/ar/about-new'
    const patch = buildPageSeoPatch(form, initial)!
    expect(JSON.stringify(patch)).not.toContain('Eslam Muatamed')
  })

  it('bilingual change emits BOTH entries in deterministic [en, ar] order with only each side\'s changes', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'Both changed EN'
    form.translations.ar.metaDescription = 'وصف جديد'
    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations.map(entry => entry.locale)).toEqual(['en', 'ar'])
    expect(patch.translations[0]).toEqual({ locale: 'en', metaTitle: 'Both changed EN' })
    expect(patch.translations[1]).toEqual({ locale: 'ar', metaDescription: 'وصف جديد' })
  })
})

describe('optional override data — NO content-entity minimum-translation rule', () => {
  it('both locales ALL-NULL is a valid initialized AND validatable state', () => {
    const empty = initialPageSeoForm(entity('resume', {}))
    expect(empty.translations.en.metaTitle).toBe('')
    expect(pageSeoFormSchema(t).safeParse(empty).success).toBe(true)
  })

  it('clearing the FINAL remaining override stays valid and emits the explicit clears', () => {
    // Seed a page whose EN row is its ONLY override anywhere.
    const source = entity('blog', {
      en: { metaTitle: 'The last override' },
      ar: ALL_NULL
    })
    const initial = initialPageSeoForm(source)
    const form = initialPageSeoForm(source)
    form.translations.en.metaTitle = ''

    const patch = buildPageSeoPatch(form, initial)!
    expect(patch.translations).toEqual([{ locale: 'en', metaTitle: null }])
    // And the resulting all-null page still validates — "use the site defaults" is a real state.
    expect(pageSeoFormSchema(t).safeParse(form).success).toBe(true)
  })

  it('no exported rule demands an authored locale: a single populated FIELD is enough, everywhere', () => {
    const minimal = initialPageSeoForm(entity('contact', { en: { ogImageId: '00000000-0000-4000-b100-000000000001' }, ar: ALL_NULL }))
    expect(pageSeoChangedLocales(minimal, initialPageSeoForm(entity('contact', {})))).toEqual(['en'])
    expect(pageSeoFormSchema(t).safeParse(minimal).success).toBe(true)
  })
})

describe('indexed 422 mapping uses the ACTUAL SENT order', () => {
  it('an Arabic-only payload puts Arabic at index 0: translations[0].canonicalUrl resolves to the ARABIC field', () => {
    const { form, initial } = fresh()
    form.translations.ar.canonicalUrl = 'not-a-uri'
    const patch = buildPageSeoPatch(form, initial)!
    // The resolver input is the payload's own locale sequence, never a canonical constant.
    const sentLocales = patch.translations.map(entry => entry.locale)
    expect(sentLocales).toEqual(['ar'])
    expect(translationFieldErrorName('translations[0].canonicalUrl', sentLocales))
      .toBe('translations.ar.canonicalUrl')
    expect(translationFieldErrorLocale('translations[0].canonicalUrl', sentLocales)).toBe('ar')
  })

  it('a two-locale payload maps each index by the SENT order, not [en, ar] by assumption', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'EN'
    form.translations.ar.canonicalUrl = 'bad'
    const patch = buildPageSeoPatch(form, initial)!
    const sentLocales = patch.translations.map(entry => entry.locale)
    expect(sentLocales).toEqual(['en', 'ar'])
    expect(translationFieldErrorName('translations[1].canonicalUrl', sentLocales))
      .toBe('translations.ar.canonicalUrl')
    expect(translationFieldErrorName('translations[0].metaTitle', sentLocales))
      .toBe('translations.en.metaTitle')
  })

  it('non-translation error paths pass through unchanged', () => {
    expect(translationFieldErrorName('pageKey', ['en'])).toBe('pageKey')
    expect(translationFieldErrorLocale('pageKey', ['en'])).toBeNull()
  })
})

describe('identity — the page key never enters the body', () => {
  it('UpdatePageSeoDto carries only translations; the initializer drops the key', () => {
    const { form, initial } = fresh()
    form.translations.en.metaTitle = 'Keyless'
    const patch = buildPageSeoPatch(form, initial)!
    const serialized = JSON.stringify(patch)
    expect(serialized).not.toContain('pageKey')
    expect(serialized).not.toContain('about')
    expect(Object.keys(patch)).toEqual(['translations'])
  })
})
