import { describe, expect, it } from 'vitest'
import { isAboutPublishable, resolveAboutReadiness } from './about-readiness'
import type { MediaImage, SiteSettings } from '~/types/models'

/**
 * The readiness gate decides whether `/about` may present itself as published. Every negative branch
 * is exercised here rather than in the browser lane: `/settings/site` carries no slug or query the
 * scenario backend could select on, and it must stay healthy for every other scenario's chrome, so
 * that lane can express only one settings variant per locale. These are pure decisions over contract
 * shapes, so proving them here is stronger than proving one of them end to end.
 */

function portrait(alt: string | null): MediaImage {
  return {
    id: '019f89b5-3050-7161-af37-0000000000f1',
    kind: 'IMAGE',
    url: 'https://media.example.com/p/1086-webp.webp',
    width: 1086,
    height: 1448,
    blurhash: 'LA8:bcoL0LR+^NoL9uWC0zaz}@oL',
    alt,
    variants: []
  }
}

function settings(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    siteName: 'Eslam Muatamed',
    tagline: 'Frontend Engineer',
    defaultMetaTitle: null,
    defaultMetaDescription: null,
    profileLinks: [],
    availabilityStatus: null,
    careerStartYear: 2023,
    careerStartMonth: 11,
    googleSiteVerification: null,
    bingSiteVerification: null,
    analytics: null,
    customMetas: [],
    resumeAsset: null,
    portraitAssetId: null,
    portrait: null,
    professionalEmail: null,
    contactEmail: null,
    aboutBio: 'Bio.',
    engineeringPhilosophy: 'Philosophy.',
    currentFocus: 'Focus.',
    availableLocales: ['en', 'ar'],
    ...overrides
  } as SiteSettings
}

describe('resolveAboutReadiness', () => {
  it('is ready only when the prose and a portrait with localized alt are all present', () => {
    const result = resolveAboutReadiness(
      settings({ portraitAssetId: 'x', portrait: portrait('Eslam against a plain wall') })
    )

    expect(result).toBe('ready')
    expect(isAboutPublishable(result)).toBe(true)
  })

  it('reports portrait-missing for the real API state after the content seed', () => {
    // Exactly what the live contract returns today: every About field populated, portrait null.
    const result = resolveAboutReadiness(settings({ portraitAssetId: null, portrait: null }))

    expect(result).toBe('portrait-missing')
    expect(isAboutPublishable(result)).toBe(false)
  })

  it('refuses to publish when the portrait carries no alt for this locale', () => {
    // `alt: null` is the contract's "no translation for ?locale=", NOT "decorative".
    const result = resolveAboutReadiness(
      settings({ portraitAssetId: 'x', portrait: portrait(null) })
    )

    expect(result).toBe('portrait-alt-missing')
    expect(isAboutPublishable(result)).toBe(false)
  })

  it('refuses to publish when the alt is empty, because the portrait is not decorative here', () => {
    // `alt: ""` means the owner marked it decorative on purpose. The About portrait is meaningful
    // content (B6), so a deliberately decorative portrait still cannot satisfy the slot.
    expect(resolveAboutReadiness(settings({ portraitAssetId: 'x', portrait: portrait('') })))
      .toBe('portrait-alt-missing')
    expect(resolveAboutReadiness(settings({ portraitAssetId: 'x', portrait: portrait('   ') })))
      .toBe('portrait-alt-missing')
  })

  it.each([
    ['aboutBio', { aboutBio: null }],
    ['engineeringPhilosophy', { engineeringPhilosophy: null }],
    ['currentFocus', { currentFocus: null }],
    ['whitespace-only prose', { aboutBio: '   ' }]
  ])('reports content-missing when %s is absent, even with a perfect portrait', (_label, override) => {
    const result = resolveAboutReadiness(
      settings({ portraitAssetId: 'x', portrait: portrait('An alt'), ...override })
    )

    expect(result).toBe('content-missing')
    expect(isAboutPublishable(result)).toBe(false)
  })

  it('reports the content blocker before the portrait blocker so the fix is not misdirected', () => {
    // Both are wrong here. Naming the portrait would send someone to upload an image for a page that
    // still has nothing to say.
    expect(resolveAboutReadiness(settings({ aboutBio: null, portrait: null })))
      .toBe('content-missing')
  })

  it('never treats one locale as satisfying another: readiness is decided per response', () => {
    // Each response is fetched for one locale (D10-6), so an English alt simply is not present in the
    // Arabic response. The gate sees only what that response carried, which is what makes a
    // cross-locale fallback structurally impossible rather than merely discouraged.
    const arabicResponse = settings({ portraitAssetId: 'x', portrait: portrait(null) })

    expect(resolveAboutReadiness(arabicResponse)).toBe('portrait-alt-missing')
  })
})
