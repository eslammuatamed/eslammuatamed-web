import { describe, expect, it } from 'vitest'
import type { AdminSiteSettings } from '~/types/models'
import {
  buildPortraitPayload,
  initialAltFor,
  initialPortraitForm,
  isPortraitFormDirty,
  isPortraitFormValid,
  validatePortraitForm,
  type PortraitFormState
} from './portrait-form'

/**
 * The About portrait form's two load-bearing rules (D09-22):
 *
 *   1. the alt inputs are seeded from the PER-USAGE `translations[locale].portraitAlt`, NEVER from
 *      the asset-level `portrait.alt`;
 *   2. both locales' alt are required when a portrait is selected.
 *
 * Both are asserted here against contract shapes rather than through a rendered component, and both
 * are additionally mutation-tested in `mutation-guards.spec.ts` — a passing test is not evidence
 * until it has been shown to fail when the thing it protects is broken.
 */

/**
 * A settings entity whose ASSET-LEVEL default and PER-USAGE alts deliberately disagree.
 *
 * That disagreement is the whole point of the fixture: if the two were the same string, a form that
 * wrongly prefilled from `portrait.alt` would produce identical output to one that read the
 * translations, and every assertion below would pass on broken code.
 */
function settings(overrides: {
  portraitAssetId?: string | null
  assetDefaultAlt?: string | null
  enAlt?: string | null
  arAlt?: string | null
} = {}): AdminSiteSettings {
  const {
    portraitAssetId = 'asset-1',
    assetDefaultAlt = 'ASSET DEFAULT — the library description',
    enAlt = null,
    arAlt = null
  } = overrides

  const translation = (portraitAlt: string | null) => ({
    siteName: null,
    tagline: null,
    availabilityStatus: null,
    defaultMetaTitle: null,
    defaultMetaDescription: null,
    aboutBio: null,
    engineeringPhilosophy: null,
    currentFocus: null,
    portraitAlt
  })

  return {
    id: 'settings-1',
    profileLinks: [],
    resumeAssetId: null,
    portraitAssetId,
    portrait: portraitAssetId === null
      ? null
      : {
          id: portraitAssetId,
          url: 'https://media.example.com/portrait.webp',
          alt: assetDefaultAlt,
          width: 1200,
          height: 1500,
          blurhash: null,
          variants: []
        },
    professionalEmail: null,
    contactEmail: null,
    contactPhone: null,
    whatsappPhone: null,
    careerStartYear: null,
    careerStartMonth: null,
    googleSiteVerification: null,
    bingSiteVerification: null,
    analyticsProvider: null,
    analyticsMeasurementId: null,
    analyticsEnabled: false,
    customMetas: [],
    translations: { en: translation(enAlt), ar: translation(arAlt) }
  } as unknown as AdminSiteSettings
}

const form = (overrides: Partial<PortraitFormState> = {}): PortraitFormState => ({
  assetId: 'asset-1',
  alt: { en: 'A portrait', ar: 'صورة' },
  ...overrides
})

describe('initialAltFor — the D09-22 prefill rule', () => {
  it('reads the PER-USAGE alt for the locale', () => {
    const { translations } = settings({ enAlt: 'Per-usage English', arAlt: 'Per-usage Arabic' })
    expect(initialAltFor(translations, 'en')).toBe('Per-usage English')
    expect(initialAltFor(translations, 'ar')).toBe('Per-usage Arabic')
  })

  it('yields an EMPTY string when the per-usage alt is null, even though an asset default exists', () => {
    // The single most important assertion in this file. `portrait.alt` is populated and the
    // per-usage alt is not; the input must stay empty so the operator writes alt text FOR THIS
    // USAGE rather than silently publishing an unreviewed library default.
    const settled = settings({ assetDefaultAlt: 'ASSET DEFAULT', enAlt: null, arAlt: null })
    expect(settled.portrait?.alt).toBe('ASSET DEFAULT')
    expect(initialAltFor(settled.translations, 'en')).toBe('')
    expect(initialAltFor(settled.translations, 'ar')).toBe('')
  })

  it('yields an empty string when the locale has no translation row at all', () => {
    expect(initialAltFor({} as AdminSiteSettings['translations'], 'ar')).toBe('')
    expect(initialAltFor(undefined, 'en')).toBe('')
  })
})

describe('initialPortraitForm', () => {
  it('never copies the asset-level default into either input', () => {
    const state = initialPortraitForm(settings({ assetDefaultAlt: 'ASSET DEFAULT', enAlt: null, arAlt: null }))
    expect(state.alt.en).toBe('')
    expect(state.alt.ar).toBe('')
    // Stated as an explicit non-containment too: a future prefill would have to defeat BOTH.
    expect(JSON.stringify(state)).not.toContain('ASSET DEFAULT')
  })

  it('seeds the selected asset and both per-usage alts', () => {
    const state = initialPortraitForm(settings({ enAlt: 'English alt', arAlt: 'نص عربي' }))
    expect(state).toEqual({ assetId: 'asset-1', alt: { en: 'English alt', ar: 'نص عربي' } })
  })

  it('is empty for settings that carry no portrait, and for no settings at all', () => {
    expect(initialPortraitForm(settings({ portraitAssetId: null }))).toEqual({
      assetId: null, alt: { en: '', ar: '' }
    })
    expect(initialPortraitForm(null)).toEqual({ assetId: null, alt: { en: '', ar: '' } })
  })
})

describe('validatePortraitForm — both locales required when a portrait is selected', () => {
  it('accepts a portrait with both alts', () => {
    expect(validatePortraitForm(form()).missingAlt).toEqual([])
    expect(isPortraitFormValid(form())).toBe(true)
  })

  it.each([
    ['English missing', { en: '', ar: 'صورة' }, ['en']],
    ['Arabic missing', { en: 'A portrait', ar: '' }, ['ar']],
    ['both missing', { en: '', ar: '' }, ['en', 'ar']]
  ])('rejects when %s', (_name, alt, expected) => {
    expect(validatePortraitForm(form({ alt })).missingAlt).toEqual(expected)
    expect(isPortraitFormValid(form({ alt }))).toBe(false)
  })

  it('rejects whitespace — it would pass the API and still fail public readiness', () => {
    expect(validatePortraitForm(form({ alt: { en: '   ', ar: '\t\n' } })).missingAlt).toEqual(['en', 'ar'])
  })

  it('requires NOTHING when no portrait is selected, so the empty state stays saveable', () => {
    expect(validatePortraitForm({ assetId: null, alt: { en: '', ar: '' } }).missingAlt).toEqual([])
    expect(isPortraitFormValid({ assetId: null, alt: { en: '', ar: '' } })).toBe(true)
  })
})

describe('buildPortraitPayload', () => {
  it('sends ONLY the association and the two alts', () => {
    const payload = buildPortraitPayload(form())
    // `forbidNonWhitelisted` on the admin DTO makes an echoed read-only field a 422, so the payload
    // must carry nothing beyond what this surface owns.
    expect(Object.keys(payload).sort()).toEqual(['portraitAssetId', 'translations'])
  })

  it('sends the trimmed per-usage alt for each locale', () => {
    const payload = buildPortraitPayload(form({ alt: { en: '  A portrait  ', ar: ' صورة ' } }))
    expect(payload.translations).toEqual([
      { locale: 'en', portraitAlt: 'A portrait' },
      { locale: 'ar', portraitAlt: 'صورة' }
    ])
  })

  it('nulls BOTH alts in the same request as clearing the association', () => {
    // Not `''` and not omitted: an omission re-exposes the asset default through the D09-22
    // fallback, and `''` means "decorative". Only `null` is the explicit no-fallback clear. Leaving
    // the alts behind would publish the OLD portrait's words under a NEW portrait.
    const payload = buildPortraitPayload({ assetId: null, alt: { en: 'stale', ar: 'قديم' } })
    expect(payload).toEqual({
      portraitAssetId: null,
      translations: [
        { locale: 'en', portraitAlt: null },
        { locale: 'ar', portraitAlt: null }
      ]
    })
  })
})

describe('isPortraitFormDirty', () => {
  const initial = form()

  it('is clean against its own initial state', () => {
    expect(isPortraitFormDirty(form(), initial)).toBe(false)
  })

  it('notices a changed asset and a changed alt in either locale', () => {
    expect(isPortraitFormDirty(form({ assetId: 'asset-2' }), initial)).toBe(true)
    expect(isPortraitFormDirty(form({ alt: { en: 'Edited', ar: 'صورة' } }), initial)).toBe(true)
    expect(isPortraitFormDirty(form({ alt: { en: 'A portrait', ar: 'معدل' } }), initial)).toBe(true)
  })

  it('treats untrimmed whitespace as a change, so an edit is never silently unsaveable', () => {
    expect(isPortraitFormDirty(form({ alt: { en: 'A portrait ', ar: 'صورة' } }), initial)).toBe(true)
  })
})
