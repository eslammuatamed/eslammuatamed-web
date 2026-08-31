import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PageSeoImageDescriptor, PageSeoMetadataInput } from './page-seo-metadata'
import { resolvePageSeoMetadata } from './page-seo-metadata'

/**
 * Trust gate for the FE4-U2b effective Static Page SEO resolver.
 *
 * The suite proves the doc 22 §3 (F-D4) chain — authored page meta → localized site defaults →
 * committed constants, expressed over the current static-page tiers — and the FE4-U2b owner
 * rulings: canonicalUrl is STORAGE-ONLY and can never reach the output; one text pair feeds
 * title/OG/Twitter; the image override comes only through the existing shareable-format helper;
 * Home's standalone title returns verbatim; no locale logic exists here.
 */

const BASE = {
  pageSeo: {
    metaTitle: null as string | null,
    metaDescription: null as string | null,
    ogImage: null as PageSeoImageDescriptor
  },
  pageTitle: 'About — page',
  pageDescription: 'About page description.',
  settingsDefaultTitle: 'Site default title',
  settingsDefaultDescription: 'Site default description.',
  fallbackTitle: 'Eslam Muatamed',
  fallbackDescription: 'Committed floor description.',
  siteUrl: 'https://eslammuatamed.com'
}

type ResolveOverrides = Partial<Omit<PageSeoMetadataInput, 'fallbackTitle' | 'fallbackDescription'>>

const resolve = (over: ResolveOverrides = {}) =>
  resolvePageSeoMetadata({ ...BASE, fallbackTitle: BASE.fallbackTitle, fallbackDescription: BASE.fallbackDescription, ...over })

describe('title precedence — authored Page SEO → page i18n → Settings default → committed', () => {
  it('1 — a populated Page SEO title beats the page i18n title', () => {
    expect(resolve({ pageSeo: { ...BASE.pageSeo, metaTitle: 'Authored about title' } }).title)
      .toBe('Authored about title')
  })

  it('2 — a null Page SEO title falls through to the page i18n title', () => {
    expect(resolve().title).toBe('About — page')
  })

  it('3 — a whitespace-only Page SEO title is NOT an override; page i18n wins', () => {
    expect(resolve({ pageSeo: { ...BASE.pageSeo, metaTitle: '   ' } }).title).toBe('About — page')
  })

  it('4 — the page i18n title beats the Settings default', () => {
    // No Page SEO override at all: tier order must hold with both lower candidates present.
    const r = resolve({ pageSeo: null })
    expect(r.title).toBe('About — page')
  })

  it('5 — a blank page i18n title falls to the Settings default', () => {
    expect(resolve({ pageTitle: '' }).title).toBe('Site default title')
    expect(resolve({ pageTitle: '  \t ' }).title).toBe('Site default title')
    expect(resolve({ pageTitle: null }).title).toBe('Site default title')
  })

  it('6 — blank/null Settings defaults fall to the committed fallback', () => {
    expect(resolve({ pageTitle: '', settingsDefaultTitle: '' }).title).toBe('Eslam Muatamed')
    expect(resolve({ pageTitle: '', settingsDefaultTitle: null }).title).toBe('Eslam Muatamed')
    expect(resolve({ pageTitle: '', settingsDefaultTitle: '  ' }).title).toBe('Eslam Muatamed')
  })
})

describe('description precedence — same chain, resolved independently of title', () => {
  it('7 — a populated Page SEO description beats the page i18n description', () => {
    expect(resolve({ pageSeo: { ...BASE.pageSeo, metaDescription: 'Authored about description' } }).description)
      .toBe('Authored about description')
  })

  it('8 — a null Page SEO description falls through to the page i18n description', () => {
    expect(resolve().description).toBe('About page description.')
  })

  it('9 — a whitespace-only Page SEO description falls to the page i18n description', () => {
    expect(resolve({ pageSeo: { ...BASE.pageSeo, metaDescription: ' ' } }).description)
      .toBe('About page description.')
  })

  it('10 — the page i18n description beats the Settings default', () => {
    expect(resolve({ pageSeo: null }).description).toBe('About page description.')
  })

  it('11 — a blank page i18n description falls to the Settings default', () => {
    expect(resolve({ pageDescription: '' }).description).toBe('Site default description.')
  })

  it('12 — blank/null Settings descriptions fall to the committed fallback', () => {
    expect(resolve({ pageDescription: '', settingsDefaultDescription: '' }).description)
      .toBe('Committed floor description.')
    expect(resolve({ pageDescription: '', settingsDefaultDescription: null }).description)
      .toBe('Committed floor description.')
  })

  it('resolves title and description independently — one authored field does not mask the other tier', () => {
    const r = resolve({
      pageSeo: { ...BASE.pageSeo, metaTitle: 'Only a title was authored' },
      pageTitle: '',
      pageDescription: ''
    })
    expect(r.title).toBe('Only a title was authored')
    expect(r.description).toBe('Site default description.')
  })
})

describe('Page SEO absence / fetch failure', () => {
  it('13 — no Page SEO object preserves the COMPLETE fallback chain', () => {
    for (const pageSeo of [undefined, null]) {
      const r = resolve({ pageSeo })
      expect(r.title).toBe('About — page')
      expect(r.description).toBe('About page description.')
      expect(r.socialImageOverride).toBeUndefined()
    }
  })
})

describe('one text pair feeds title + OG + Twitter (single-source coherence)', () => {
  it('14 — the single effective title IS the og/twitter title source; no separate social copy exists', () => {
    const r = resolve({ pageSeo: { ...BASE.pageSeo, metaTitle: 'One title everywhere' } })
    // The contract has NO ogTitle/twitterTitle fields, so the wiring maps THIS value onto all
    // three tags. Pinning the pair identity here keeps later per-tag divergence a visible change.
    expect(r.title).toBe('One title everywhere')
    expect(Object.keys(r).sort()).toEqual(['description', 'title'])
    expect(Object.hasOwn(r, 'ogTitle')).toBe(false)
    expect(Object.hasOwn(r, 'twitterTitle')).toBe(false)
  })

  it('15 — the single effective description IS the og/twitter description source', () => {
    const r = resolve({ pageSeo: { ...BASE.pageSeo, metaDescription: 'One description everywhere' } })
    expect(r.description).toBe('One description everywhere')
    expect(Object.hasOwn(r, 'ogDescription')).toBe(false)
    expect(Object.hasOwn(r, 'twitterDescription')).toBe(false)
  })
})

const ACCEPTED_IMAGE = {
  url: 'https://media.eslammuatamed.com/media/abc/social.png',
  width: 1200,
  height: 630,
  alt: 'Authored preview of About'
}

describe('page-level social image — delegated entirely to the existing helper', () => {
  it('16 — a null Page SEO ogImage yields NO page-level override', () => {
    const r = resolve()
    expect(r.socialImageOverride).toBeUndefined()
    expect(Object.hasOwn(r, 'socialImageOverride')).toBe(false)
  })

  it('17 — an accepted descriptor produces the existing social-image override representation', () => {
    const r = resolve({ pageSeo: { ...BASE.pageSeo, ogImage: { ...ACCEPTED_IMAGE } } })
    expect(r.socialImageOverride).toEqual({
      url: 'https://media.eslammuatamed.com/media/abc/social.png',
      width: 1200,
      height: 630,
      alt: 'Authored preview of About'
    })
  })

  it('18 — an UNSUPPORTED descriptor (shareable-format gate) yields no override — committed floor owns the image', () => {
    // Today's public descriptors carry WebP rendition URLs — the documented gate rejects them.
    const webp = resolve({
      pageSeo: { ...BASE.pageSeo, ogImage: { ...ACCEPTED_IMAGE, url: 'https://media.eslammuatamed.com/media/abc/1920-webp.webp' } }
    })
    expect(webp.socialImageOverride).toBeUndefined()

    const unknownFormat = resolve({
      pageSeo: { ...BASE.pageSeo, ogImage: { ...ACCEPTED_IMAGE, url: 'https://media.eslammuatamed.com/media/abc/file' } }
    })
    expect(unknownFormat.socialImageOverride).toBeUndefined()

    const unusable = resolve({ pageSeo: { ...BASE.pageSeo, ogImage: {} } })
    expect(unusable.socialImageOverride).toBeUndefined()
  })

  it('19 — URL absolutization and alt behavior remain DELEGATED, not re-implemented', () => {
    // A relative descriptor URL must come back absolute against the supplied governed site URL,
    // exactly as entitySocialImage/absoluteSocialUrl already define; blank alt stays undefined.
    const r = resolve({
      pageSeo: { ...BASE.pageSeo, ogImage: { url: '/media/abc/social.png', alt: null } }
    })
    expect(r.socialImageOverride?.url).toBe('https://eslammuatamed.com/media/abc/social.png')
    expect(r.socialImageOverride?.alt).toBeUndefined()
  })
})

describe('canonical is STORAGE-ONLY — the owner ruling, proven behaviorally', () => {
  const withCanonical = (canonicalUrl: string | null) => {
    const candidate = { ...BASE.pageSeo, metaTitle: 'Stable title', canonicalUrl }
    return resolvePageSeoMetadata({ ...BASE, pageSeo: candidate })
  }

  it('20-22 — http(s), ftp and null canonicalUrl produce BYTE-IDENTICAL effective output', () => {
    const viaNull = withCanonical(null)
    const viaHttps = withCanonical('https://example.com/custom')
    const viaFtp = withCanonical('ftp://example.com/resource')
    const expected = { title: 'Stable title', description: BASE.pageDescription }
    expect(viaNull).toStrictEqual(expected)
    expect(viaHttps).toStrictEqual(expected)
    expect(viaFtp).toStrictEqual(expected)
    expect(viaHttps).toStrictEqual(viaNull)
    expect(viaFtp).toStrictEqual(viaHttps)
  })

  it('23 — the resolver exposes NO public canonical override of any name', () => {
    const r = withCanonical('https://example.com/custom')
    for (const key of Object.keys(r)) {
      expect(key.toLowerCase()).not.toContain('canonical')
    }
    expect(Object.hasOwn(r, 'canonicalUrl')).toBe(false)
  })
})

describe('Home standalone title (D22-4) — verbatim passthrough', () => {
  it('24 — the helper never brands, templates or alters the supplied title', () => {
    const standalone = 'Eslam Muatamed — Full-Stack Engineer'
    expect(resolve({ pageTitle: standalone }).title).toBe(standalone)

    // A brand-less title must NOT gain the sitewide " — Eslam Muatamed" suffix here; applying
    // `titleTemplate` stays the caller's job (Home passes `titleTemplate: null`).
    const brandless = resolve({ pageSeo: null, pageTitle: 'Home' })
    expect(brandless.title).toBe('Home')
    expect(brandless.title.endsWith('— Eslam Muatamed')).toBe(false)
  })
})

describe('locale isolation — the helper receives pre-localized strings and never translates', () => {
  it('25 — no cross-locale fallback: an Arabic page title wins as-is over English defaults', () => {
    const r = resolve({ pageTitle: 'من نحن', settingsDefaultTitle: 'Site default title' })
    expect(r.title).toBe('من نحن')
    // And an Arabic authored override beats an English page string without any swapping:
    expect(
      resolve({ pageSeo: { ...BASE.pageSeo, metaTitle: 'عنوان الصفحة' } }).title
    ).toBe('عنوان الصفحة')
  })
})

describe('source boundary — pure resolution only', () => {
  // Scan CODE, not prose: strip line comments so the header documentation (which must EXPLAIN the
  // exclusions by naming them) cannot false-positive. After stripping, the banned identifiers must
  // not appear anywhere — executable calls AND stray references alike.
  const code = readFileSync('app/utils/page-seo-metadata.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('26 — performs no network/API calls', () => {
    expect(code).not.toMatch(/\$fetch|useFetch|useAsyncData|useApi|ofetch|fetch\s*\(/)
  })

  it('27 — performs no head ownership (no useHead/useSeoMeta)', () => {
    expect(code).not.toMatch(/useHead|useSeoMeta|useServerSeoMeta/)
  })

  it('28 — generates no structured data', () => {
    expect(code).not.toMatch(/ld\+json|useSchemaOrg|schema/i)
  })

  it('never reads or emits canonicalUrl in ANY form — storage-only proven structurally', () => {
    expect(code).not.toContain('canonicalUrl')
    expect(code).not.toMatch(/canonical/i)
  })

  it('owns no route knowledge', () => {
    expect(code).not.toMatch(/definePageMeta|useRoute\(|useLocalePath|pageKey/)
    expect(code).not.toMatch(/\/about|\/experience/)
  })
})
