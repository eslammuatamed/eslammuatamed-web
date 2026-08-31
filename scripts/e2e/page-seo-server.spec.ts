import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { ENABLED_LOCALES, OG_ASSET, PAGE_KEYS, server } from './page-seo-server'

/**
 * Calibration for the Static Page SEO e2e instrument (FR-DSH-051), not a product test.
 *
 * Every rule asserted here was re-derived from the adopted `openapi/openapi.json` before being
 * modeled; the load-bearing ones are negative-controlled by mutating this instrument's sibling
 * source file (`page-seo-server.ts`), running the targeted test, restoring byte-for-byte and
 * rerunning: upsert-without-replace across locales, omission preserves per field, explicit null
 * clears per field, admin↔public single-state coherence, the IMAGE-only ogImageId rule, and the
 * public nullable-success rule that keeps "nothing authored" (200) apart from "no such page" (404).
 */
let base = ''
const AUTH = { authorization: 'Bearer e2e-access-token', 'content-type': 'application/json' }

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

beforeEach(async () => {
  await fetch(`${base}/__e2e/reset`, { method: 'POST' })
})

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${base}/api/v1${path}`, { ...init, headers: { ...AUTH, ...(init.headers ?? {}) } })

const anon = (path: string) => fetch(`${base}/api/v1${path}`)

const setState = (state: Record<string, unknown>) =>
  fetch(`${base}/__e2e/state`, { method: 'POST', body: JSON.stringify(state) })

interface AdminEntity {
  pageKey: string
  translations: Record<string, {
    metaTitle: string | null
    metaDescription: string | null
    canonicalUrl: string | null
    ogImageId: string | null
  }>
}

interface PublicEntity {
  pageKey: string
  locale: string
  metaTitle: string | null
  metaDescription: string | null
  ogImageId: string | null
  ogImage: { id: string, kind: string, alt: string | null } | null
  canonicalUrl: string | null
}

const getList = async (): Promise<AdminEntity[]> => {
  const res = await api('/admin/seo/pages')
  expect(res.status).toBe(200)
  return ((await res.json()).data as AdminEntity[])
}

/** Entries are looked up BY KEY on purpose: no list ordering is documented in the contract. */
const getDetail = async (pageKey: string): Promise<Response> =>
  api(`/admin/seo/pages/${pageKey}`)

const getDetailBody = async (pageKey: string): Promise<AdminEntity> =>
  (await (await getDetail(pageKey)).json()).data as AdminEntity

const patchPage = async (pageKey: string, translations: unknown[]) =>
  api(`/admin/seo/pages/${pageKey}`, { method: 'PATCH', body: JSON.stringify({ translations }) })

const getPublic = async (pageKey: string, locale?: string): Promise<Response> =>
  anon(`/seo/pages/${pageKey}${locale ? `?locale=${locale}` : ''}`)

const getPublicBody = async (pageKey: string, locale?: string): Promise<PublicEntity> =>
  (await (await getPublic(pageKey, locale)).json()).data as PublicEntity

describe('the closed page-key vocabulary — static pages only, never ids or slugs', () => {
  it('exposes exactly the seven adopted keys and nothing else', async () => {
    const keys = (await getList()).map(entry => entry.pageKey)
    expect([...keys].sort()).toEqual([...PAGE_KEYS].sort())
    expect(keys).toHaveLength(7)
  })

  it('is PAGE-KEY based, not entity-id based: a UUID path is outside the vocabulary entirely', async () => {
    const uuid = OG_ASSET.absent
    expect((await getDetail(uuid)).status).toBe(422)
    expect((await patchPage(uuid, [{ locale: 'en' }])).status).toBe(422)
    expect((await getPublic(uuid)).status).toBe(404)
  })

  it('the UpdatePageSeoDto boundary REJECTS FR-DSH-052 global-tags fields — they live on Settings, not here', async () => {
    const res = await api('/admin/seo/pages/home', {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en' }],
        googleSiteVerification: 'not-a-page-field',
        gtmContainerId: 'GTM-XXXX'
      })
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors).toContainEqual({ field: 'googleSiteVerification', message: 'property googleSiteVerification should not exist.' })
    expect(body.errors).toContainEqual({ field: 'gtmContainerId', message: 'property gtmContainerId should not exist.' })
  })
})

describe('admin list contract — complete maps, no pagination/filter contract', () => {
  it('answers { data } with NO pagination meta', async () => {
    const body = await (await api('/admin/seo/pages')).json() as Record<string, unknown>
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toBeUndefined()
  })

  it('carries EVERY enabled locale per page, all-null when unauthored', async () => {
    // The only SEEDED authored rows; every other page/locale pair must arrive all-null.
    const seeded: Record<string, string[]> = { about: [...ENABLED_LOCALES], blog: ['ar'] }
    const list = await getList()
    for (const entry of list) {
      expect(Object.keys(entry.translations).sort()).toEqual([...ENABLED_LOCALES].sort())
      for (const locale of ENABLED_LOCALES) {
        if (seeded[entry.pageKey]?.includes(locale)) continue
        const row = entry.translations[locale]!
        expect(row.metaTitle, `${entry.pageKey}/${locale} metaTitle`).toBeNull()
        expect(row.metaDescription, `${entry.pageKey}/${locale} metaDescription`).toBeNull()
        expect(row.canonicalUrl, `${entry.pageKey}/${locale} canonicalUrl`).toBeNull()
        expect(row.ogImageId, `${entry.pageKey}/${locale} ogImageId`).toBeNull()
      }
    }
  })

  it.each(['page=2', 'perPage=10', 'q=about', 'locale=en'])('rejects unsolicited list query parameter %s', async query => {
    const res = await api(`/admin/seo/pages?${query}`)
    expect(res.status, query).toBe(422)
  })

  it('detail read returns one whole page map with every enabled locale', async () => {
    const body = await getDetailBody('about')
    expect(body.pageKey).toBe('about')
    expect(body.translations.en?.metaTitle).toBe('About — Eslam Muatamed')
    expect(body.translations.ar?.metaTitle).toBe('نبذة — إسلام معتمد')
  })

  it('an unknown key answers 422 on detail AND patch — the set is closed (D09-24), not 404', async () => {
    expect((await getDetail('unknown-page')).status).toBe(422)
    expect((await patchPage('unknown-page', [{ locale: 'en' }])).status).toBe(422)
  })
})

describe('authored-state shapes — EN-only, AR-only, bilingual', () => {
  it('EN-only authoring leaves the unauthored locale ALL-NULL, never absent', async () => {
    const res = await patchPage('home', [{
      locale: 'en',
      metaTitle: 'Home',
      metaDescription: 'Portfolio home.',
      canonicalUrl: null,
      ogImageId: OG_ASSET.spare
    }])
    expect(res.status).toBe(200)
    const entity = (await res.json()).data as AdminEntity
    expect(entity.translations.en?.metaTitle).toBe('Home')
    expect(entity.translations.ar?.metaTitle).toBeNull()
    expect(entity.translations.ar?.ogImageId).toBeNull()
  })

  it('AR-only authoring leaves EN all-null — Arabic-first authoring is equally valid', async () => {
    const res = await patchPage('resume', [{
      locale: 'ar',
      metaTitle: 'السيرة الذاتية',
      metaDescription: 'سيرة إسلام المهنية.'
    }])
    expect(res.status).toBe(200)
    const entity = (await res.json()).data as AdminEntity
    expect(entity.translations.ar?.metaTitle).toBe('السيرة الذاتية')
    expect(entity.translations.en?.metaTitle).toBeNull()
    expect(entity.translations.en?.canonicalUrl).toBeNull()
  })

  it('bilingual authoring keeps each locale its own value', async () => {
    await patchPage('contact', [
      { locale: 'en', metaTitle: 'Contact EN' },
      { locale: 'ar', metaTitle: 'اتصل بي' }
    ])
    const entity = await getDetailBody('contact')
    expect(entity.translations.en?.metaTitle).toBe('Contact EN')
    expect(entity.translations.ar?.metaTitle).toBe('اتصل بي')
  })
})

describe('locale upsert semantics — supplied locale upserts, omitted locale untouched', () => {
  it('PATCH EN UPSERTS EN and preserves the stored AR row verbatim', async () => {
    const beforeAr = (await getDetailBody('about')).translations.ar!
    const res = await patchPage('about', [{ locale: 'en', metaTitle: 'About (revised)' }])
    expect(res.status).toBe(200)
    const after = await getDetailBody('about')
    expect(after.translations.en?.metaTitle).toBe('About (revised)')
    expect(after.translations.ar).toEqual(beforeAr)
  })

  it('PATCH AR UPSERTS AR and preserves the stored EN row verbatim', async () => {
    const beforeEn = (await getDetailBody('blog')).translations.en!
    expect(beforeEn).toEqual({ metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null })
    const res = await patchPage('blog', [{ locale: 'ar', metaTitle: 'المدونة (محدّثة)' }])
    expect(res.status).toBe(200)
    const after = await getDetailBody('blog')
    expect(after.translations.ar?.metaTitle).toBe('المدونة (محدّثة)')
    expect(after.translations.en).toEqual(beforeEn)
  })

  it('indexed writes land on their SENT locale, not canonical array position', async () => {
    // [ar, en] deliberately reverses the canonical order: index 0 is ARABIC here.
    const res = await patchPage('projects', [
      { locale: 'ar', metaTitle: 'المشاريع' },
      { locale: 'en', metaTitle: 'Projects' }
    ])
    expect(res.status).toBe(200)
    const entity = await getDetailBody('projects')
    expect(entity.translations.ar?.metaTitle).toBe('المشاريع')
    expect(entity.translations.en?.metaTitle).toBe('Projects')
  })
})

describe('per-field three-state proofs — omission preserves, null clears, value replaces', () => {
  describe('metaTitle', () => {
    it('OMITTED field PRESERVES the stored title', async () => {
      await patchPage('about', [{ locale: 'en', metaDescription: 'Same title, new description.' }])
      expect((await getDetailBody('about')).translations.en?.metaTitle).toBe('About — Eslam Muatamed')
    })
    it('explicit null CLEARS the stored title', async () => {
      expect((await getDetailBody('about')).translations.en?.metaTitle).not.toBeNull()
      const res = await patchPage('about', [{ locale: 'en', metaTitle: null }])
      expect(res.status).toBe(200)
      expect((await getDetailBody('about')).translations.en?.metaTitle).toBeNull()
    })
    it('a replacement value REPLACES the stored title', async () => {
      await patchPage('about', [{ locale: 'en', metaTitle: 'Replaced title' }])
      expect((await getDetailBody('about')).translations.en?.metaTitle).toBe('Replaced title')
    })
  })

  describe('metaDescription', () => {
    it('OMITTED field PRESERVES the stored description', async () => {
      await patchPage('about', [{ locale: 'ar', metaTitle: 'عنوان جديد فقط' }])
      const ar = (await getDetailBody('about')).translations.ar!
      expect(ar.metaTitle).toBe('عنوان جديد فقط')
      expect(ar.metaDescription).toBe('الخلفية الهندسية والفلسفة والتركيز الحالي.')
    })
    it('explicit null CLEARS the stored description', async () => {
      const res = await patchPage('about', [{ locale: 'en', metaDescription: null }])
      expect(res.status).toBe(200)
      expect((await getDetailBody('about')).translations.en?.metaDescription).toBeNull()
    })
    it('a replacement value REPLACES the stored description', async () => {
      await patchPage('about', [{ locale: 'en', metaDescription: 'New description text.' }])
      expect((await getDetailBody('about')).translations.en?.metaDescription).toBe('New description text.')
    })
  })

  describe('canonicalUrl', () => {
    it('OMITTED field PRESERVES the stored canonical', async () => {
      await patchPage('about', [{ locale: 'en', metaTitle: 'Canonical untouched' }])
      expect((await getDetailBody('about')).translations.en?.canonicalUrl)
        .toBe('https://eslammuatamed.com/about')
    })
    it('explicit null CLEARS the stored canonical', async () => {
      const res = await patchPage('about', [{ locale: 'en', canonicalUrl: null }])
      expect(res.status).toBe(200)
      expect((await getDetailBody('about')).translations.en?.canonicalUrl).toBeNull()
    })
    it('a replacement value REPLACES the stored canonical', async () => {
      await patchPage('about', [{ locale: 'en', canonicalUrl: 'https://eslammuatamed.com/about-v2' }])
      expect((await getDetailBody('about')).translations.en?.canonicalUrl)
        .toBe('https://eslammuatamed.com/about-v2')
    })
    it('rejects a value that is not an absolute URI with 422', async () => {
      const res = await patchPage('about', [{ locale: 'en', canonicalUrl: 'not-a-uri' }])
      expect(res.status).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: 'translations[0].canonicalUrl',
        message: 'canonicalUrl must be an absolute URI.'
      })
    })
    it('accepts an absolute http(s) URI', async () => {
      expect((await patchPage('home', [{ locale: 'en', canonicalUrl: 'https://eslammuatamed.com/' }])).status).toBe(200)
    })
  })

  describe('ogImageId', () => {
    it('OMITTED field PRESERVES the stored image reference', async () => {
      await patchPage('about', [{ locale: 'en', metaTitle: 'Image untouched' }])
      expect((await getDetailBody('about')).translations.en?.ogImageId).toBe(OG_ASSET.hero)
    })
    it('explicit null CLEARS the stored image reference', async () => {
      const res = await patchPage('about', [{ locale: 'en', ogImageId: null }])
      expect(res.status).toBe(200)
      expect((await getDetailBody('about')).translations.en?.ogImageId).toBeNull()
    })
    it('a replacement IMAGE id REPLACES the stored reference', async () => {
      const res = await patchPage('about', [{ locale: 'en', ogImageId: OG_ASSET.spare }])
      expect(res.status).toBe(200)
      expect((await getDetailBody('about')).translations.en?.ogImageId).toBe(OG_ASSET.spare)
    })
    it('accepts a VALID IMAGE asset id', async () => {
      expect((await patchPage('home', [{ locale: 'en', ogImageId: OG_ASSET.hero }])).status).toBe(200)
    })
    it('rejects a malformed UUID with 422', async () => {
      const res = await patchPage('home', [{ locale: 'en', ogImageId: 'not-a-uuid' }])
      expect(res.status).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: 'translations[0].ogImageId',
        message: 'ogImageId must be a UUID.'
      })
    })
    it('rejects a well-formed but MISSING asset id with 422', async () => {
      const res = await patchPage('home', [{ locale: 'en', ogImageId: OG_ASSET.absent }])
      expect(res.status).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: 'translations[0].ogImageId',
        message: 'ogImageId references a missing media asset.'
      })
    })
    it('rejects a NON-IMAGE (PDF) asset id with 422', async () => {
      const res = await patchPage('home', [{ locale: 'en', ogImageId: OG_ASSET.pdf }])
      expect(res.status).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: 'translations[0].ogImageId',
        message: 'ogImageId must reference an IMAGE asset.'
      })
    })
  })
})

describe('validation boundaries — exactly the classes the contract declares', () => {
  it('an EMPTY translations array is rejected (at least one entry)', async () => {
    const res = await patchPage('home', [])
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations',
      message: 'translations must contain at least 1 elements.'
    })
  })

  it('a MISSING translations property is rejected', async () => {
    const res = await api('/admin/seo/pages/home', { method: 'PATCH', body: '{}' })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations',
      message: 'translations should not be empty.'
    })
  })

  it('a two-letter but DISABLED locale answers the dedicated 400 class', async () => {
    const res = await patchPage('home', [{ locale: 'fr', metaTitle: 'X' }])
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.detail).toContain('Bad Request')
    expect(body.errors).toContainEqual({
      field: 'translations[0].locale',
      message: 'Unknown or disabled locale.'
    })
  })

  it('a malformed locale answers 422', async () => {
    expect((await patchPage('home', [{ locale: 'EN', metaTitle: 'X' }])).status).toBe(422)
    expect((await patchPage('home', [{ locale: 'eng', metaTitle: 'X' }])).status).toBe(422)
  })

  it('foreign properties on a translation item are rejected, never silently accepted', async () => {
    const res = await patchPage('home', [{ locale: 'en', slug: 'no-slugs-on-static-pages' }])
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations[0].slug',
      message: 'property slug should not exist.'
    })
  })

  it('a non-string metaTitle is rejected', async () => {
    const res = await patchPage('home', [{ locale: 'en', metaTitle: 42 }])
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations[0].metaTitle',
      message: 'metaTitle must be a string or null.'
    })
  })
})

describe('public read contract — an override layer with nullable success (D10-24)', () => {
  it('a KNOWN page with NOTHING AUTHORED returns 200 with every field null — not 404', async () => {
    for (const locale of ENABLED_LOCALES) {
      const res = await getPublic('experience', locale)
      expect(res.status).toBe(200)
      const body = (await res.json()).data as PublicEntity
      expect(body.pageKey).toBe('experience')
      expect(body.locale).toBe(locale)
      expect(body.metaTitle).toBeNull()
      expect(body.metaDescription).toBeNull()
      expect(body.ogImageId).toBeNull()
      expect(body.ogImage).toBeNull()
      expect(body.canonicalUrl).toBeNull()
    }
  })

  it('404 is RESERVED for a key outside the known set', async () => {
    expect((await getPublic('no-such-page')).status).toBe(404)
  })

  it('NO cross-locale fallback (D10-6): an EN-authored page reads all-null in AR', async () => {
    await patchPage('home', [{ locale: 'en', metaTitle: 'English only override' }])
    const en = await getPublicBody('home', 'en')
    expect(en.metaTitle).toBe('English only override')
    const ar = await getPublicBody('home', 'ar')
    expect(ar.metaTitle).toBeNull()
    expect(ar.ogImage).toBeNull()
  })

  it('defaults to ?locale=en when omitted', async () => {
    const body = await getPublicBody('about')
    expect(body.locale).toBe('en')
    expect(body.metaTitle).toBe('About — Eslam Muatamed')
  })

  it('a DISABLED locale answers 400; a MALFORMED locale answers 422', async () => {
    expect((await getPublic('home', 'fr')).status).toBe(400)
    expect((await getPublic('home', 'en-US')).status).toBe(422)
  })

  it('requires NO authentication', async () => {
    expect((await anon('/seo/pages/home')).status).toBe(200)
  })

  it('resolves ogImage from the shared registry with the ASSET-LEVEL localized alt', async () => {
    const en = await getPublicBody('about', 'en')
    expect(en.ogImage?.id).toBe(OG_ASSET.hero)
    expect(en.ogImage?.kind).toBe('IMAGE')
    expect(en.ogImage?.alt).toBe('About page social card')
    const ar = await getPublicBody('about', 'ar')
    expect(ar.ogImage?.alt).toBe('بطاقة صفحة نبذة')
  })
})

describe('admin↔public state coherence — ONE underlying SEO state', () => {
  it('an admin PATCH is immediately observable from the public endpoint', async () => {
    const patched = await patchPage('home', [
      { locale: 'en', metaTitle: 'Coherent title', metaDescription: 'Coherent description.', canonicalUrl: 'https://eslammuatamed.com/?coherent=1' }
    ])
    expect(patched.status).toBe(200)

    const en = await getPublicBody('home', 'en')
    expect(en.metaTitle).toBe('Coherent title')
    expect(en.metaDescription).toBe('Coherent description.')
    expect(en.canonicalUrl).toBe('https://eslammuatamed.com/?coherent=1')

    // The other locale stays exactly as seeded — same store, per-locale isolation.
    const ar = await getPublicBody('home', 'ar')
    expect(ar.metaTitle).toBeNull()
  })

  it('round-trips an OG IMAGE through both surfaces: set → resolved descriptor → clear → null', async () => {
    await patchPage('blog', [{ locale: 'en', ogImageId: OG_ASSET.spare }])
    const setRead = await getPublicBody('blog', 'en')
    expect(setRead.ogImageId).toBe(OG_ASSET.spare)
    expect(setRead.ogImage?.id).toBe(OG_ASSET.spare)

    await patchPage('blog', [{ locale: 'en', ogImageId: null }])
    const clearedRead = await getPublicBody('blog', 'en')
    expect(clearedRead.ogImageId).toBeNull()
    expect(clearedRead.ogImage).toBeNull()
  })
})

describe('auth, modes and operational controls', () => {
  it('rejects UNAUTHENTICATED admin requests on list, detail and patch', async () => {
    expect((await anon('/admin/seo/pages')).status).toBe(401)
    expect((await anon('/admin/seo/pages/about')).status).toBe(401)
    expect(
      (
        await fetch(`${base}/api/v1/admin/seo/pages/about`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ translations: [{ locale: 'en' }] })
        })
      ).status
    ).toBe(401)
  })

  it('FORBIDDEN mode blocks the admin surface while the public read stays available', async () => {
    await setState({ mode: 'forbidden' })
    expect((await api('/admin/seo/pages')).status).toBe(403)
    expect((await getDetail('about')).status).toBe(403)
    expect((await patchPage('about', [{ locale: 'en', metaTitle: 'X' }])).status).toBe(403)
    expect((await getPublic('about')).status).toBe(200)
  })

  it('ERROR mode destroys the transport on the admin surface', async () => {
    await setState({ mode: 'error' })
    await expect(api('/admin/seo/pages')).rejects.toThrow()
  })

  it('holds reads and writes for delayMs', async () => {
    await setState({ delayMs: 300 })
    for (const request of [
      () => api('/admin/seo/pages'),
      () => patchPage('about', [{ locale: 'en', metaTitle: 'Held' }])
    ]) {
      const started = Date.now()
      expect((await request()).status).toBe(200)
      expect(Date.now() - started).toBeGreaterThanOrEqual(280)
    }
  })

  it('fails exactly ONE write when asked, then recovers', async () => {
    await setState({ failNextWrite: true })
    expect((await patchPage('home', [{ locale: 'en', metaTitle: 'X' }])).status).toBe(500)
    expect((await patchPage('home', [{ locale: 'en', metaTitle: 'X' }])).status).toBe(200)
  })
})

describe('reset — every mutated page returns to its seed', () => {
  it('restores authored overrides and cleared fields to the seed state', async () => {
    await patchPage('about', [
      { locale: 'en', metaTitle: 'Mutated', metaDescription: null, canonicalUrl: null, ogImageId: null },
      { locale: 'ar', metaTitle: null }
    ])
    expect((await getDetailBody('about')).translations.en?.metaTitle).toBe('Mutated')

    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    const restored = await getDetailBody('about')
    expect(restored.translations.en).toEqual({
      metaTitle: 'About — Eslam Muatamed',
      metaDescription: 'Engineering background, philosophy, and current focus.',
      canonicalUrl: 'https://eslammuatamed.com/about',
      ogImageId: OG_ASSET.hero
    })
    expect(restored.translations.ar?.metaTitle).toBe('نبذة — إسلام معتمد')
  })
})
