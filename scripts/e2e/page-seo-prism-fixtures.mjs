/**
 * Frontend-owned response fixtures for the Prism contract-mock proxy.
 *
 * These payloads are intentionally NOT OpenAPI examples. They only make the browser harness
 * deterministic where Prism cannot vary a response by `?locale=` without contract metadata.
 * Production resolves Page SEO from backend data; this module exists exclusively under scripts/e2e.
 */

export const PAGE_SEO_PRISM_FIXTURE_PAGES = [
  'home', 'about', 'experience', 'projects', 'blog', 'resume', 'contact'
]

const LOCALES = ['en', 'ar']
const PAGE_SEO_PATH = /^\/api\/v1\/seo\/pages\/(home|about|experience|projects|blog|resume|contact)$/

function emptyPageSeo(pageKey, locale) {
  return {
    data: {
      pageKey,
      locale,
      metaTitle: null,
      metaDescription: null,
      ogImageId: null,
      ogImage: null,
      canonicalUrl: null
    }
  }
}

const ABOUT_FIXTURES = {
  en: {
    data: {
      pageKey: 'about',
      locale: 'en',
      metaTitle: 'About — Eslam Muatamed',
      metaDescription: 'Engineering background, philosophy, and current focus.',
      ogImageId: null,
      ogImage: null,
      canonicalUrl: null
    }
  },
  ar: {
    data: {
      pageKey: 'about',
      locale: 'ar',
      metaTitle: 'نبذة — إسلام معتمد',
      metaDescription: 'الخلفية الهندسية والفلسفة والتركيز الحالي.',
      ogImageId: null,
      ogImage: null,
      canonicalUrl: null
    }
  }
}

/**
 * Return the mock-only Page SEO response for a recognized GET request, otherwise `null` so the
 * proxy forwards the request to Prism under its normal contract-derived behavior.
 */
export function resolvePageSeoPrismFixture(method, pathname, searchParams) {
  if (method !== 'GET') return null

  const match = PAGE_SEO_PATH.exec(pathname)
  if (!match) return null

  const locale = searchParams.get('locale') ?? 'en'
  if (!LOCALES.includes(locale)) return null

  if (match[1] === 'about') return structuredClone(ABOUT_FIXTURES[locale])
  return emptyPageSeo(match[1], locale)
}
