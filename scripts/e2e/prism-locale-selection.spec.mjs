import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { matchContractPath, readExampleIndex, selectExample } from './prism-locale-selection.mjs'

/**
 * The contract mock answers `?locale=ar` with the Arabic identity only because these functions
 * choose the right named example. Two failure modes are worth real coverage, and both were measured
 * against Prism 5.x rather than assumed:
 *
 * 1. SELECTING THE WRONG EXAMPLE is silent. Prism returns 200 with the other locale's body, the
 *    Arabic page renders `Eslam Muatamed`, and the only visible symptom is a layout-shift budget
 *    failing three steps downstream. That is exactly how this defect stayed hidden.
 *
 * 2. SELECTING AN EXAMPLE THAT DOES NOT EXIST is loud but breaks everything else:
 *    `Prefer: example=ar` on an operation that declares no such example returns
 *    `404 … "Response for contentType: application/json and exampleKey: ar does not exist."`
 *    A blanket "every Arabic request gets the header" would take out `/experiences`, `/skills` and
 *    `/projects`. The header must therefore be CONTRACT-DERIVED, which is what these tests pin.
 *
 * The committed contract is used as the fixture, not a hand-written stub, so this suite fails if
 * the adopted artifact ever stops carrying the named examples.
 */

const CONTRACT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../openapi/openapi.json', import.meta.url)), 'utf8')
)
const INDEX = readExampleIndex(CONTRACT)
const SETTINGS = '/api/v1/settings/site'
const PAGE_SEO = '/api/v1/seo/pages/{pageKey}'
const PAGE_SEO_PAGES = ['home', 'experience', 'projects', 'blog', 'resume', 'contact']
const PAGE_SEO_EXAMPLES = new Set([
  'en', 'ar',
  ...PAGE_SEO_PAGES.flatMap(pageKey => [`en-${pageKey}`, `ar-${pageKey}`])
])
const params = (query = '') => new URLSearchParams(query)

describe('the committed contract', () => {
  it('declares named en/ar examples for the settings operation', () => {
    expect(INDEX.get(`GET ${SETTINGS}`)).toEqual(new Set(['en', 'ar']))
  })

  it('declares named en/ar examples for the public static-page SEO operation', () => {
    expect(INDEX.get(`GET ${PAGE_SEO}`)).toEqual(PAGE_SEO_EXAMPLES)
  })
})

describe('selectExample', () => {
  it('selects the English example for an English request', () => {
    expect(selectExample(INDEX, 'GET', SETTINGS, params('locale=en'))).toBe('en')
  })

  it('selects the Arabic example for an Arabic request', () => {
    expect(selectExample(INDEX, 'GET', SETTINGS, params('locale=ar'))).toBe('ar')
  })

  it('selects the Arabic Page SEO example for an Arabic request', () => {
    expect(selectExample(INDEX, 'GET', '/api/v1/seo/pages/about', params('locale=ar'))).toBe('ar')
  })

  it('selects a page-specific Page SEO example for every other static page', () => {
    for (const pageKey of PAGE_SEO_PAGES) {
      expect(selectExample(INDEX, 'GET', `/api/v1/seo/pages/${pageKey}`, params('locale=en')))
        .toBe(`en-${pageKey}`)
      expect(selectExample(INDEX, 'GET', `/api/v1/seo/pages/${pageKey}`, params('locale=ar')))
        .toBe(`ar-${pageKey}`)
    }
  })

  // The API applies `en` when `?locale=` is absent (the parameter's documented default), so the
  // mock must not answer such a request with a different locale than production would.
  it('falls back to the contract default when no locale is requested', () => {
    expect(selectExample(INDEX, 'GET', SETTINGS, params())).toBe('en')
  })

  // THE 404 GUARD. Forwarding untouched is the only safe answer: naming an undeclared example makes
  // Prism 404 the request, and a mock that 404s `/settings/site` renders every page's outage state.
  it('returns null for a locale the operation does not declare', () => {
    expect(selectExample(INDEX, 'GET', SETTINGS, params('locale=fr'))).toBeNull()
  })

  it('returns null for an operation that declares no examples at all', () => {
    expect(selectExample(INDEX, 'GET', '/api/v1/skills', params('locale=ar'))).toBeNull()
    expect(selectExample(INDEX, 'GET', '/api/v1/experiences', params('locale=ar'))).toBeNull()
  })

  it('returns null for an unknown path', () => {
    expect(selectExample(INDEX, 'GET', '/api/v1/nothing/here', params('locale=ar'))).toBeNull()
  })

  it('does not select on a method the example is not declared for', () => {
    expect(selectExample(INDEX, 'POST', SETTINGS, params('locale=ar'))).toBeNull()
  })
})

describe('matchContractPath', () => {
  const templated = new Map([['GET /api/v1/articles/{slug}', new Set(['en'])]])

  it('resolves a concrete path to its templated contract path', () => {
    expect(matchContractPath(templated, 'GET', '/api/v1/articles/hello-world')).toBe(
      'GET /api/v1/articles/{slug}'
    )
  })

  it('does not match across segment boundaries', () => {
    expect(matchContractPath(templated, 'GET', '/api/v1/articles/a/b')).toBeNull()
  })

  it('prefers an exact path over a templated one', () => {
    const both = new Map([
      ['GET /api/v1/articles/{slug}', new Set(['en'])],
      ['GET /api/v1/articles/featured', new Set(['ar'])]
    ])
    expect(matchContractPath(both, 'GET', '/api/v1/articles/featured')).toBe(
      'GET /api/v1/articles/featured'
    )
  })
})
