import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import {
  SKILL_IDS,
  UUID_SHAPED_SLUG,
  server
} from './skills-server'

/**
 * Calibration for the Skills e2e instrument, not a product test.
 *
 * Its job is to prove that the future Dashboard lane faces the contract's real distinctions rather
 * than a mock that forgives them: create versus patch, map reads versus array writes, null versus
 * omission, field-addressed versus detail-only 422, and project-linked versus unlinked deletion.
 *
 * Four rules below are additionally negative-controlled in M2·U1 by mutating the instrument, running
 * this file, restoring from a byte-identical copy and running it again. If one of those mutations does
 * not make its named test fail, the test is decoration and the unit is not complete.
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
  slug: string
  group: 'LANGUAGE' | 'FRONTEND' | 'BACKEND' | 'DELIVERY'
  order: number
  brandColor: string | null
  isPublic: boolean
  translations: Record<string, { label: string }>
}

interface Links {
  projectIds: string[]
  experienceIds: string[]
}

const list = async () => (await (await api('/admin/skills')).json()).data as Entity[]
const get = async (id: string) => (await (await api(`/admin/skills/${id}`)).json()).data as Entity
const links = async (id: string) => (await (await fetch(`${base}/__e2e/links/${id}`)).json()) as Links

describe('the collection envelope and query contract', () => {
  it('answers a paginated collection envelope with the documented defaults', async () => {
    const body = await (await api('/admin/skills')).json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(12)
    expect(body.meta).toEqual({ page: 1, perPage: 12, total: 52, totalPages: 5 })
  })

  it('honours only valid pagination and group query parameters', async () => {
    const filtered = await (await api('/admin/skills?page=2&perPage=12&group=BACKEND')).json()
    expect(filtered.meta).toEqual({ page: 2, perPage: 12, total: 13, totalPages: 2 })
    expect(filtered.data).toHaveLength(1)
    expect(filtered.data[0]?.group).toBe('BACKEND')

    for (const query of ['locale=en', 'page=0', 'perPage=51', 'group=OTHER', 'search=vue']) {
      const res = await api(`/admin/skills?${query}`)
      expect(res.status, query).toBe(422)
      const body = await res.json()
      expect(body.status).toBe(422)
      expect(body.errors).toBeUndefined()
    }
  })

  it('returns locale-keyed translation maps and never fixture-only relation state', async () => {
    const entity = await get(SKILL_IDS.typescript)
    expect(entity.translations.en?.label).toBe('TypeScript')
    expect(entity.translations.ar?.label).toBe('تايب سكربت')
    expect(entity).not.toHaveProperty('projectIds')
    expect(entity).not.toHaveProperty('experienceIds')
  })
})

describe('create — required fields and the stable slug', () => {
  const valid = {
    slug: 'web-performance',
    group: 'FRONTEND',
    order: -1.25,
    brandColor: 'not-limited-to-hex',
    isPublic: false,
    translations: [
      { locale: 'en', label: 'Web performance' },
      { locale: 'ar', label: 'أداء الويب' }
    ]
  }

  it('requires slug, group, order and the translations property', async () => {
    for (const field of ['slug', 'group', 'order', 'translations'] as const) {
      const body = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field))
      const res = await api('/admin/skills', { method: 'POST', body: JSON.stringify(body) })
      expect(res.status, field).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field,
        message: `${field} should not be empty.`
      })
    }
  })

  it('accepts slug on create and converts the translation array to a keyed read map', async () => {
    const res = await api('/admin/skills', { method: 'POST', body: JSON.stringify(valid) })
    expect(res.status).toBe(201)
    const entity = (await res.json()).data as Entity
    expect(entity.slug).toBe('web-performance')
    expect(entity.order).toBe(-1.25)
    expect(entity.brandColor).toBe('not-limited-to-hex')
    expect(entity.isPublic).toBe(false)
    expect(entity.translations).toEqual({
      en: { label: 'Web performance' },
      ar: { label: 'أداء الويب' }
    })
  })

  it('does not invent a non-empty-translations server rule the contract never declares', async () => {
    const res = await api('/admin/skills', {
      method: 'POST',
      body: JSON.stringify({ slug: 'empty-vocabulary-entry', group: 'DELIVERY', order: 0.5, translations: [] })
    })
    expect(res.status).toBe(201)
    expect((await res.json()).data.translations).toEqual({})
  })

  it('rejects a UUID-shaped slug even though it satisfies the kebab-case regex', async () => {
    const res = await api('/admin/skills', {
      method: 'POST',
      body: JSON.stringify({ ...valid, slug: UUID_SHAPED_SLUG })
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.type).toBe('about:blank')
    expect(body.detail).toContain('must not be shaped like a UUID')
    expect(body.errors).toBeUndefined()
  })
})

describe('patch — every declared field is optional, and slug is not declared', () => {
  it('accepts an empty PATCH and preserves the entity', async () => {
    const before = await get(SKILL_IDS.typescript)
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, { method: 'PATCH', body: '{}' })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual(before)
  })

  it('REJECTS slug on PATCH instead of accepting or ignoring it', async () => {
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'renamed-behind-the-contract' })
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors).toContainEqual({ field: 'slug', message: 'property slug should not exist.' })
    expect((await get(SKILL_IDS.typescript)).slug).toBe('typescript')
  })

  it('accepts exactly the four declared groups and rejects a copied foreign enum', async () => {
    for (const group of ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY']) {
      const res = await api(`/admin/skills/${SKILL_IDS.vue}`, {
        method: 'PATCH',
        body: JSON.stringify({ group })
      })
      expect(res.status, group).toBe(200)
    }

    const rejected = await api(`/admin/skills/${SKILL_IDS.vue}`, {
      method: 'PATCH',
      body: JSON.stringify({ group: 'FRAMEWORK' })
    })
    expect(rejected.status).toBe(422)
  })

  it('accepts fractional and negative order, because no narrower rule is in the contract', async () => {
    for (const order of [-17, 2.75]) {
      const res = await api(`/admin/skills/${SKILL_IDS.nest}`, {
        method: 'PATCH',
        body: JSON.stringify({ order })
      })
      expect(res.status, String(order)).toBe(200)
      expect((await res.json()).data.order).toBe(order)
    }
  })
})

describe('brandColor — explicit null clears, omission preserves (D10-23)', () => {
  it('CLEARS a stored brandColor on explicit null', async () => {
    expect((await get(SKILL_IDS.typescript)).brandColor).toBe('#3178C6')
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({ brandColor: null })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.brandColor).toBeNull()
    expect((await get(SKILL_IDS.typescript)).brandColor).toBeNull()
  })

  it('PRESERVES a stored brandColor when the key is omitted', async () => {
    expect((await get(SKILL_IDS.typescript)).brandColor).toBe('#3178C6')
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 8.5 })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.brandColor).toBe('#3178C6')
    expect((await get(SKILL_IDS.typescript)).brandColor).toBe('#3178C6')
  })
})

describe('translations and the two RFC 7807 validation shapes', () => {
  it('upserts the locale-tagged write array into the locale-keyed read map', async () => {
    const res = await api(`/admin/skills/${SKILL_IDS.delivery}`, {
      method: 'PATCH',
      body: JSON.stringify({ translations: [{ locale: 'ar', label: 'التسليم المستمر' }] })
    })
    expect(res.status).toBe(200)
    expect((await get(SKILL_IDS.delivery)).translations).toEqual({
      en: { label: 'Continuous delivery' },
      ar: { label: 'التسليم المستمر' }
    })
  })

  it('answers a label failure with errors[] indexed into the CLIENT array', async () => {
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [
          { locale: 'en', label: 'TypeScript' },
          { locale: 'ar', label: '' }
        ]
      })
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.type).toBe('/problems/validation')
    expect(body.errors).toContainEqual({
      field: 'translations[1].label',
      message: 'label should not be empty.'
    })
    expect(body.errors.some((error: { field: string }) => error.field.startsWith('translations[0]'))).toBe(false)
  })

  it('also answers a detail-only 422 with no errors array at all', async () => {
    const res = await api('/admin/skills', {
      method: 'POST',
      body: JSON.stringify({
        slug: UUID_SHAPED_SLUG,
        group: 'LANGUAGE',
        order: 1,
        translations: [{ locale: 'en', label: 'Reserved slug' }]
      })
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.status).toBe(422)
    expect(body.detail).toContain('UUID')
    expect(body.errors).toBeUndefined()
  })
})

describe('visibility and fixture-only links', () => {
  it('setting isPublic false preserves both project and experience links', async () => {
    const before = await links(SKILL_IDS.typescript)
    expect(before.projectIds).toHaveLength(1)
    expect(before.experienceIds).toHaveLength(1)

    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: false })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.isPublic).toBe(false)
    expect(await links(SKILL_IDS.typescript)).toEqual(before)
  })
})

describe('delete — only documented project linkage blocks it', () => {
  it('returns 409 for a project-linked skill and leaves it present', async () => {
    const res = await api(`/admin/skills/${SKILL_IDS.typescript}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.detail).toBe('Skill is linked to a project.')
    expect((await get(SKILL_IDS.typescript)).id).toBe(SKILL_IDS.typescript)
  })

  it('deletes an unlinked skill with 204, then answers 404', async () => {
    const res = await api(`/admin/skills/${SKILL_IDS.nest}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect((await api(`/admin/skills/${SKILL_IDS.nest}`)).status).toBe(404)
  })

  it('does not invent an experience-link deletion conflict the contract never states', async () => {
    expect((await links(SKILL_IDS.experienceOnly)).experienceIds).toHaveLength(1)
    const res = await api(`/admin/skills/${SKILL_IDS.experienceOnly}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('answers 404 when the target was already absent', async () => {
    expect((await api(`/admin/skills/${SKILL_IDS.absent}`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('the hold and operational modes', () => {
  it('answers immediately by default', async () => {
    const started = Date.now()
    expect((await api('/admin/skills')).status).toBe(200)
    expect(Date.now() - started).toBeLessThan(150)
  })

  it('holds a collection READ for delayMs', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    expect((await api('/admin/skills')).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('holds a detail READ for delayMs', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    expect((await api(`/admin/skills/${SKILL_IDS.typescript}`)).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('holds a WRITE for delayMs so duplicate submission is observable', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    expect((await api(`/admin/skills/${SKILL_IDS.vue}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 12 })
    })).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('distinguishes forbidden, empty and transport failure', async () => {
    await setState({ mode: 'forbidden' })
    expect((await api('/admin/skills')).status).toBe(403)

    await setState({ mode: 'empty' })
    expect((await (await api('/admin/skills')).json()).data).toEqual([])

    await setState({ mode: 'error' })
    await expect(api('/admin/skills')).rejects.toThrow()
  })

  it('fails exactly one write when asked, then recovers', async () => {
    await setState({ failNextWrite: true })
    const init = { method: 'PATCH', body: JSON.stringify({ order: 7 }) }
    expect((await api(`/admin/skills/${SKILL_IDS.vue}`, init)).status).toBe(500)
    expect((await api(`/admin/skills/${SKILL_IDS.vue}`, init)).status).toBe(200)
  })

  it('requires bearer auth', async () => {
    expect((await fetch(`${base}/api/v1/admin/skills`)).status).toBe(401)
  })
})

describe('reset — every mutable fixture and flag returns to its seed', () => {
  it('restores changed fields, deleted records, links and created records', async () => {
    await api(`/admin/skills/${SKILL_IDS.typescript}`, {
      method: 'PATCH',
      body: JSON.stringify({ brandColor: null, isPublic: false })
    })
    await api(`/admin/skills/${SKILL_IDS.nest}`, { method: 'DELETE' })
    await api('/admin/skills', {
      method: 'POST',
      body: JSON.stringify({ slug: 'temporary', group: 'BACKEND', order: 9, translations: [] })
    })

    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    expect((await get(SKILL_IDS.typescript)).brandColor).toBe('#3178C6')
    expect((await get(SKILL_IDS.typescript)).isPublic).toBe(true)
    expect((await get(SKILL_IDS.nest)).id).toBe(SKILL_IDS.nest)
    expect((await links(SKILL_IDS.typescript)).projectIds).toHaveLength(1)
    expect((await list()).some(skill => skill.slug === 'temporary')).toBe(false)
  })

  it('restores mode, delay and the one-shot failure flag', async () => {
    await setState({ mode: 'empty', delayMs: 400, failNextWrite: true })
    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    const started = Date.now()
    const body = await (await api('/admin/skills')).json()
    expect(Date.now() - started).toBeLessThan(150)
    expect(body.data.length).toBeGreaterThan(0)
    expect((await api(`/admin/skills/${SKILL_IDS.vue}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 6 })
    })).status).toBe(200)
  })
})
