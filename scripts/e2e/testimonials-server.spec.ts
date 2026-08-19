import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import {
  AVATAR_IDS,
  TESTIMONIAL_IDS,
  server
} from './testimonials-server'

/**
 * Calibration for the Testimonials e2e instrument, not a product test.
 *
 * The five load-bearing rules named in the unit brief are negative-controlled by mutating the
 * instrument, parse-checking it, running this file, restoring it byte-for-byte, and rerunning it:
 * avatar null clears, avatar omission preserves, empty PATCH is inert, translation PATCH upserts
 * without deletion, and each contract validation boundary rejects its invalid input.
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

interface Entity {
  id: string
  avatarId: string | null
  order: number
  isVisible: boolean
  translations: Record<string, { quote: string, authorName: string, authorRole: string }>
}

const list = async () => (await (await api('/admin/testimonials')).json()).data as Entity[]
const get = async (id: string) =>
  (await (await api(`/admin/testimonials/${id}`)).json()).data as Entity

describe('the collection and detail read contract', () => {
  it('answers { data } with no pagination meta and preserves fixture order', async () => {
    const body = await (await api('/admin/testimonials')).json()
    expect(body.data.map((item: Entity) => item.id)).toEqual([
      TESTIMONIAL_IDS.featured,
      TESTIMONIAL_IDS.hidden,
      TESTIMONIAL_IDS.enOnly,
      TESTIMONIAL_IDS.noAvatar
    ])
    expect(body.meta).toBeUndefined()
  })

  it('rejects unsolicited list query parameters instead of pretending to honour them', async () => {
    for (const query of ['locale=en', 'page=2', 'search=alex']) {
      const res = await api(`/admin/testimonials?${query}`)
      expect(res.status, query).toBe(422)
      const body = await res.json()
      expect(body.status).toBe(422)
      expect(body.errors).toBeUndefined()
    }
  })

  it('returns locale-keyed translation maps', async () => {
    const entity = await get(TESTIMONIAL_IDS.featured)
    expect(entity.translations.en).toEqual({
      quote: 'The team turned a difficult brief into a dependable product.',
      authorName: 'Alex Morgan',
      authorRole: 'CTO, Northstar'
    })
    expect(entity.translations.ar?.authorName).toBe('أليكس مورغان')
  })

  it('supports the declared detail read and distinguishes 400 from 404', async () => {
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.hidden}`)).status).toBe(200)
    expect((await api('/admin/testimonials/not-a-uuid')).status).toBe(400)
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.absent}`)).status).toBe(404)
  })
})

describe('create — required fields and array-to-map conversion', () => {
  const valid = {
    avatarId: AVATAR_IDS.replacement,
    order: 1,
    isVisible: false,
    translations: [
      { locale: 'en', quote: 'Excellent work.', authorName: 'Casey Jones', authorRole: 'COO, Acme' },
      { locale: 'ar', quote: 'عمل ممتاز.', authorName: 'كيسي جونز', authorRole: 'مدير العمليات، أكمي' }
    ]
  }

  it('requires order, isVisible and the translations property', async () => {
    for (const field of ['order', 'isVisible', 'translations'] as const) {
      const body = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field))
      const res = await api('/admin/testimonials', { method: 'POST', body: JSON.stringify(body) })
      expect(res.status, field).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field,
        message: `${field} should not be empty.`
      })
    }
  })

  it('creates with 201 and converts the write array to a keyed read map', async () => {
    const res = await api('/admin/testimonials', { method: 'POST', body: JSON.stringify(valid) })
    expect(res.status).toBe(201)
    const entity = (await res.json()).data as Entity
    expect(entity.avatarId).toBe(AVATAR_IDS.replacement)
    expect(entity.order).toBe(1)
    expect(entity.isVisible).toBe(false)
    expect(entity.translations).toEqual({
      en: { quote: 'Excellent work.', authorName: 'Casey Jones', authorRole: 'COO, Acme' },
      ar: { quote: 'عمل ممتاز.', authorName: 'كيسي جونز', authorRole: 'مدير العمليات، أكمي' }
    })
  })

  it('rejects an empty translations array with 422', async () => {
    const res = await api('/admin/testimonials', {
      method: 'POST',
      body: JSON.stringify({ order: 0, isVisible: true, translations: [] })
    })
    expect(res.status).toBe(422)
  })

  it('defaults omitted optional avatarId to null', async () => {
    const res = await api('/admin/testimonials', {
      method: 'POST',
      body: JSON.stringify({ order: 2, isVisible: true, translations: [{ locale: 'en', quote: 'Q', authorName: 'A', authorRole: 'R' }] })
    })
    expect(res.status).toBe(201)
    expect((await res.json()).data.avatarId).toBeNull()
  })
})

describe('patch — all declared properties are optional', () => {
  it('an empty PATCH body changes nothing', async () => {
    const before = await get(TESTIMONIAL_IDS.featured)
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: '{}'
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual(before)
    expect(await get(TESTIMONIAL_IDS.featured)).toEqual(before)
  })

  it('rejects undeclared top-level properties', async () => {
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'not-a-testimonial-field' })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'slug',
      message: 'property slug should not exist.'
    })
  })

  it('rejects negative and fractional order', async () => {
    for (const order of [-1, 2.75]) {
      const res = await api('/admin/testimonials', {
        method: 'POST',
        body: JSON.stringify({ order, isVisible: true, translations: [{ locale: 'en', quote: 'Q', authorName: 'A', authorRole: 'R' }] })
      })
      expect(res.status, String(order)).toBe(422)
    }
  })

  it('updates visibility without changing unrelated fields', async () => {
    const before = await get(TESTIMONIAL_IDS.hidden)
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.hidden}`, {
      method: 'PATCH',
      body: JSON.stringify({ isVisible: true })
    })
    const after = (await res.json()).data as Entity
    expect(after.isVisible).toBe(true)
    expect(after.avatarId).toBe(before.avatarId)
    expect(after.translations).toEqual(before.translations)
  })
})

describe('avatarId — explicit null clears and omission preserves independently', () => {
  it('explicit avatarId null CLEARS a stored avatar', async () => {
    expect((await get(TESTIMONIAL_IDS.featured)).avatarId).toBe(AVATAR_IDS.featured)
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatarId: null })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.avatarId).toBeNull()
    expect((await get(TESTIMONIAL_IDS.featured)).avatarId).toBeNull()
  })

  it('omitted avatarId PRESERVES a stored avatar', async () => {
    expect((await get(TESTIMONIAL_IDS.featured)).avatarId).toBe(AVATAR_IDS.featured)
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 8 })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.avatarId).toBe(AVATAR_IDS.featured)
    expect((await get(TESTIMONIAL_IDS.featured)).avatarId).toBe(AVATAR_IDS.featured)
  })

  it('accepts a UUID replacement and rejects a malformed avatar id', async () => {
    const accepted = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatarId: AVATAR_IDS.replacement })
    })
    expect(accepted.status).toBe(200)
    expect((await accepted.json()).data.avatarId).toBe(AVATAR_IDS.replacement)

    const rejected = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatarId: 'not-a-uuid' })
    })
    expect(rejected.status).toBe(422)
  })
})

describe('translation validation and upsert semantics', () => {
  it('PATCH translations UPSERTS supplied locales and never deletes an omitted stored locale', async () => {
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', quote: 'Updated quote.', authorName: 'Alex M.', authorRole: 'CEO' }]
      })
    })
    expect(res.status).toBe(200)
    expect((await get(TESTIMONIAL_IDS.featured)).translations).toEqual({
      en: { quote: 'Updated quote.', authorName: 'Alex M.', authorRole: 'CEO' },
      ar: {
        quote: 'حوّل الفريق متطلبات معقدة إلى منتج يمكن الاعتماد عليه.',
        authorName: 'أليكس مورغان',
        authorRole: 'المدير التقني، نورث ستار'
      }
    })
  })

  it('requires all four translation fields with client-array error paths', async () => {
    for (const field of ['locale', 'quote', 'authorName', 'authorRole'] as const) {
      const complete = { locale: 'en', quote: 'Quote', authorName: 'Name', authorRole: 'Role' }
      const translation = Object.fromEntries(Object.entries(complete).filter(([key]) => key !== field))
      const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations: [translation] })
      })
      expect(res.status, field).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: `translations[0].${field}`,
        message: `${field} should not be empty.`
      })
    }
  })

  it('rejects invalid locales and empty translation text', async () => {
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.enOnly}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'EN', quote: 'Q', authorName: 'A', authorRole: 'R' }]
      })
    })
    expect(res.status).toBe(422)
    for (const field of ['quote', 'authorName', 'authorRole'] as const) {
      const rejected = await api(`/admin/testimonials/${TESTIMONIAL_IDS.enOnly}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations: [{ locale: 'en', quote: field === 'quote' ? '' : 'Q', authorName: field === 'authorName' ? '' : 'A', authorRole: field === 'authorRole' ? '' : 'R' }] })
      })
      expect(rejected.status, field).toBe(422)
    }
  })

  it('rejects undeclared translation properties with the indexed client path', async () => {
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.enOnly}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', quote: 'Q', authorName: 'A', authorRole: 'R', label: 'foreign' }]
      })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations[0].label',
      message: 'property label should not exist.'
    })
  })
})

describe('delete — no invented conflict', () => {
  it('deletes any present testimonial with 204 and no body, then answers 404', async () => {
    const res = await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`)).status).toBe(404)
  })

  it('answers 400 for malformed UUID and 404 for a well-formed absent UUID', async () => {
    expect((await api('/admin/testimonials/bad-id', { method: 'DELETE' })).status).toBe(400)
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.absent}`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('the hold and operational modes', () => {
  it('answers immediately by default', async () => {
    const started = Date.now()
    expect((await api('/admin/testimonials')).status).toBe(200)
    expect(Date.now() - started).toBeLessThan(150)
  })

  it('holds collection reads, detail reads, and writes for delayMs', async () => {
    await setState({ delayMs: 300 })
    for (const request of [
      () => api('/admin/testimonials'),
      () => api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`),
      () => api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, { method: 'PATCH', body: '{}' })
    ]) {
      const started = Date.now()
      expect((await request()).status).toBe(200)
      expect(Date.now() - started).toBeGreaterThanOrEqual(280)
    }
  })

  it('distinguishes forbidden, empty and transport failure', async () => {
    await setState({ mode: 'forbidden' })
    expect((await api('/admin/testimonials')).status).toBe(403)

    await setState({ mode: 'empty' })
    expect((await (await api('/admin/testimonials')).json()).data).toEqual([])

    await setState({ mode: 'error' })
    await expect(api('/admin/testimonials')).rejects.toThrow()
  })

  it('fails exactly one write when asked, then recovers', async () => {
    await setState({ failNextWrite: true })
    const init = { method: 'PATCH', body: JSON.stringify({ order: 7 }) }
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, init)).status).toBe(500)
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, init)).status).toBe(200)
  })

  it('requires bearer auth', async () => {
    expect((await fetch(`${base}/api/v1/admin/testimonials`)).status).toBe(401)
  })
})

describe('reset — every mutable fixture and flag returns to its seed', () => {
  it('restores changed, deleted, and created records', async () => {
    await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatarId: null, isVisible: false })
    })
    await api(`/admin/testimonials/${TESTIMONIAL_IDS.hidden}`, { method: 'DELETE' })
    await api('/admin/testimonials', {
      method: 'POST',
      body: JSON.stringify({ order: 9, isVisible: true, translations: [{ locale: 'en', quote: 'Q', authorName: 'A', authorRole: 'R' }] })
    })

    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    expect((await get(TESTIMONIAL_IDS.featured)).avatarId).toBe(AVATAR_IDS.featured)
    expect((await get(TESTIMONIAL_IDS.featured)).isVisible).toBe(true)
    expect((await get(TESTIMONIAL_IDS.hidden)).id).toBe(TESTIMONIAL_IDS.hidden)
    expect((await list()).map(item => item.id)).toHaveLength(4)
  })

  it('restores mode, delay, and the one-shot failure flag', async () => {
    await setState({ mode: 'empty', delayMs: 400, failNextWrite: true })
    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    const started = Date.now()
    expect((await list()).length).toBeGreaterThan(0)
    expect(Date.now() - started).toBeLessThan(150)
    expect((await api(`/admin/testimonials/${TESTIMONIAL_IDS.featured}`, {
      method: 'PATCH', body: '{}'
    })).status).toBe(200)
  })
})
