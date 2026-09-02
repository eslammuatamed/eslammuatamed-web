import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { ART, CATEGORY, TAKEN_AR_SLUG, TAKEN_EN_SLUG, server } from './articles-server'

/**
 * The Articles e2e backend is an INSTRUMENT, and this file is its calibration.
 *
 * Every browser assertion FE-2c makes about a loading, updating, submitting or validation-error
 * state is read through this server. If it answers instantly, six of plan §14.9's ten criteria pass
 * without the state under test ever having rendered — a green suite that proves nothing. If its 422
 * carries a hard-coded field path, the Dashboard's index→locale error mapping can be broken and
 * still look correct.
 *
 * So the instrument is proven here, at the process boundary, before anything is built on it. These
 * are not tests of the product; they are the negative controls that make the product's tests
 * meaningful.
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

const setState = (state: Record<string, unknown>) =>
  fetch(`${base}/__e2e/state`, { method: 'POST', body: JSON.stringify(state) })

describe('the hold — the capability six acceptance criteria depend on', () => {
  it('answers immediately by default, so no lane pays for latency it did not ask for', async () => {
    const started = Date.now()
    const res = await api('/admin/articles')
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeLessThan(150)
  })

  it('holds a READ open for delayMs, which is what makes a skeleton observable', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    const res = await api('/admin/articles')
    const elapsed = Date.now() - started
    expect(res.status).toBe(200)
    // The assertion that matters is that time actually passed. Without it the skeleton and the
    // refresh overlay are unreachable states and their tests are vacuous.
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  it('holds a WRITE open too — the only condition under which double-submit is a real test', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    const res = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DRAFT' })
    })
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('a reset clears the hold, so one spec cannot slow the next', async () => {
    await setState({ delayMs: 300 })
    await fetch(`${base}/__e2e/reset`, { method: 'POST' })
    const started = Date.now()
    await api('/admin/articles')
    expect(Date.now() - started).toBeLessThan(150)
  })
})

describe('422 field paths are computed from the payload, not canned', () => {
  it('reports the ARABIC slug collision at the index the client actually sent it in', async () => {
    // Arabic FIRST. A hard-coded `translations[0]` would accidentally be right here.
    const first = await api('/admin/articles', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: CATEGORY.engineering,
        translations: [
          { locale: 'ar', title: 'ت', slug: TAKEN_AR_SLUG, excerpt: 'x', body: 'y' },
          { locale: 'en', title: 'T', slug: 'a-free-slug', excerpt: 'x', body: 'y' }
        ]
      })
    })
    expect(first.status).toBe(422)
    const firstBody = await first.json()
    expect(firstBody.errors).toEqual([
      { field: 'translations[0].slug', message: "Slug already exists for locale 'ar'." }
    ])

    // Arabic SECOND, same collision. This is the control: the index must MOVE with the payload.
    const second = await api('/admin/articles', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: CATEGORY.engineering,
        translations: [
          { locale: 'en', title: 'T', slug: 'another-free-slug', excerpt: 'x', body: 'y' },
          { locale: 'ar', title: 'ت', slug: TAKEN_AR_SLUG, excerpt: 'x', body: 'y' }
        ]
      })
    })
    expect(second.status).toBe(422)
    const secondBody = await second.json()
    expect(secondBody.errors).toEqual([
      { field: 'translations[1].slug', message: "Slug already exists for locale 'ar'." }
    ])
  })

  it('scopes uniqueness PER LOCALE — the same string is free in the other language', async () => {
    const res = await api('/admin/articles', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: CATEGORY.engineering,
        // The English slug, claimed for ARABIC. Different locale, so it must be allowed.
        translations: [{ locale: 'ar', title: 'ت', slug: TAKEN_EN_SLUG, excerpt: 'x', body: 'y' }]
      })
    })
    expect(res.status).toBe(201)
  })

  it('lets an article keep its OWN slug on update, rather than colliding with itself', async () => {
    const res = await api(`/admin/articles/${ART.publishedBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', title: 'Renamed', slug: TAKEN_EN_SLUG, excerpt: 'x', body: 'y' }]
      })
    })
    expect(res.status).toBe(200)
  })

  it('carries the RFC 7807 envelope the Dashboard error shape reads', async () => {
    const res = await api('/admin/articles', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: CATEGORY.engineering,
        translations: [{ locale: 'en', title: '', slug: '', excerpt: '', body: '' }]
      })
    })
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = await res.json()
    expect(body).toMatchObject({ type: '/problems/validation', status: 422 })
    expect(body.title).toBeTruthy()
    expect(body.instance).toBeTruthy()
    // Four empty required fields, each reported against its own path.
    expect(body.errors.map((e: { field: string }) => e.field)).toEqual([
      'translations[0].title',
      'translations[0].slug',
      'translations[0].excerpt',
      'translations[0].body'
    ])
  })
})

describe('publishing rules the editor must not be able to violate silently', () => {
  it('rejects SCHEDULED without a publishAt', async () => {
    const res = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SCHEDULED' })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors[0].field).toBe('publishAt')
  })

  it('rejects SCHEDULED with a PAST publishAt', async () => {
    const res = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SCHEDULED', publishAt: '2020-01-01T00:00:00.000Z' })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors[0].message).toContain('future')
  })

  it('accepts SCHEDULED with a FUTURE publishAt — the control for the two rejections above', async () => {
    const res = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SCHEDULED', publishAt: '2099-01-01T00:00:00.000Z' })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('SCHEDULED')
  })
})

describe('D10-23 — explicit null clears, an omitted key preserves', () => {
  it('CLEARS publishAt when null is sent explicitly', async () => {
    const res = await api(`/admin/articles/${ART.publishedBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DRAFT', publishAt: null })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.publishAt).toBeNull()
  })

  it('PRESERVES publishAt when the key is omitted — the same request minus one key', async () => {
    const res = await api(`/admin/articles/${ART.publishedBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DRAFT' })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.publishAt).toBe('2026-08-01T09:00:00.000Z')
  })

  it('CLEARS coverImageId when null is sent explicitly', async () => {
    const res = await api(`/admin/articles/${ART.publishedBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ coverImageId: null })
    })
    expect((await res.json()).data.coverImageId).toBeNull()
  })
})

describe('translations UPSERT and never delete — why the editor must send every complete locale', () => {
  it('keeps a locale the payload omitted', async () => {
    const res = await api(`/admin/articles/${ART.publishedBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', title: 'Only English sent', slug: 'only-english-sent', excerpt: 'x', body: 'y' }]
      })
    })
    const data = (await res.json()).data
    expect(data.translations.en.title).toBe('Only English sent')
    // The Arabic translation was NOT in the payload and is still there — which is precisely why
    // omitting a cleared locale would be a false "success" that leaves stale content published.
    expect(data.translations.ar.title).toBe('الهندسة المعمارية المعيارية')
  })

  it('computes readingTimeMin server-side, so the form must never send it', async () => {
    const res = await api(`/admin/articles/${ART.draftBoth}`)
    const data = (await res.json()).data
    expect(data.translations.en.readingTimeMin).toBeGreaterThanOrEqual(1)
  })
})

describe('list shaping', () => {
  it('paginates with a real second page', async () => {
    const page1 = await (await api('/admin/articles?page=1')).json()
    const page2 = await (await api('/admin/articles?page=2')).json()
    expect(page1.meta.totalPages).toBeGreaterThan(1)
    expect(page1.data).toHaveLength(12)
    expect(page2.data.length).toBeGreaterThan(0)
    const overlap = page1.data.filter((a: { id: string }) => page2.data.some((b: { id: string }) => b.id === a.id))
    expect(overlap, 'page 2 must not repeat page 1').toEqual([])
  })

  it('filters by status, reaching a state the first page does not show', async () => {
    const archived = await (await api('/admin/articles?status=ARCHIVED')).json()
    expect(archived.data.map((a: { id: string }) => a.id)).toEqual([ART.archived])
  })

  it('filters title-only across authored locales, case-insensitively, and paginates the filtered set', async () => {
    const english = await (await api('/admin/articles?q=LISTED%20ARTICLE&page=2')).json()
    expect(english.meta).toMatchObject({ page: 2, perPage: 12, total: 25, totalPages: 3 })
    expect(english.data).toHaveLength(12)
    expect(english.data.every((article: { translations: { en: { title: string } } }) =>
      article.translations.en.title.toLowerCase().includes('listed article')
    )).toBe(true)

    const arabic = await (await api('/admin/articles?q=%D9%85%D9%82%D8%A7%D9%84%D8%A9%20%D9%85%D8%AF%D8%B1%D8%AC%D8%A9%202')).json()
    expect(arabic.data.map((article: { id: string }) => article.id)).toContain('00000000-0000-4000-a000-000000000102')
    expect(arabic.data.every((article: { translations: { ar: { title: string } } }) =>
      article.translations.ar.title.includes('مقالة مدرجة 2')
    )).toBe(true)

    const status = await (await api('/admin/articles?q=listed&status=DRAFT')).json()
    expect(status.data).toHaveLength(8)
    expect(status.data.every((article: { status: string }) => article.status === 'DRAFT')).toBe(true)
  })

  it('rejects a search longer than the Production contract permits', async () => {
    expect((await api(`/admin/articles?q=${'x'.repeat(121)}`)).status).toBe(422)
  })

  it('answers an EMPTY list distinctly from an error', async () => {
    await setState({ mode: 'empty' })
    const res = await api('/admin/articles')
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
  })

  it('answers 403 in forbidden mode — not an empty list', async () => {
    await setState({ mode: 'forbidden' })
    expect((await api('/admin/articles')).status).toBe(403)
  })

  it('requires a bearer token, as the real API does', async () => {
    const res = await fetch(`${base}/api/v1/admin/articles`)
    expect(res.status).toBe(401)
  })
})

describe('write failure and deletion', () => {
  it('fails exactly ONE write, then recovers', async () => {
    await setState({ failNextWrite: true })
    const failed = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DRAFT' })
    })
    expect(failed.status).toBe(500)
    const recovered = await api(`/admin/articles/${ART.draftBoth}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DRAFT' })
    })
    expect(recovered.status).toBe(200)
  })

  it('deletes with 204 and the row is really gone', async () => {
    expect((await api(`/admin/articles/${ART.archived}`, { method: 'DELETE' })).status).toBe(204)
    expect((await api(`/admin/articles/${ART.archived}`)).status).toBe(404)
  })

  it('404s an absent id rather than inventing an entity', async () => {
    expect((await api(`/admin/articles/${ART.absent}`)).status).toBe(404)
  })

  it('mints a preview token for a DRAFT, which is the whole point of preview', async () => {
    const res = await api(`/admin/articles/${ART.draftBoth}/preview-token`, { method: 'POST' })
    expect(res.status).toBe(200)
    const data = (await res.json()).data
    expect(data.url).toContain(`/preview/articles/${ART.draftBoth}`)
    expect(data.token).toBeTruthy()
  })
})
