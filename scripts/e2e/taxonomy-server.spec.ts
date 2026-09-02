import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import {
  CATEGORY_IDS,
  TAG_IDS,
  server,
  type TaxonomyKind
} from './taxonomy-server'

/**
 * Calibration for the Taxonomy e2e instrument (Categories + Tags), not a product test.
 *
 * The load-bearing rules are negative-controlled by mutating this instrument's sibling source file,
 * running the targeted test, restoring byte-for-byte, and rerunning: paginated list reads, PATCH
 * upsert-without-replace, omission preserves, empty-array no-op, explicit-null description clears,
 * the documented category 409, and the ABSENCE of any fabricated tag relation conflict.
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

interface Row {
  id: string
  translations: Record<string, { name: string, slug: string, description?: string | null }>
}

const IDS: Record<TaxonomyKind, typeof CATEGORY_IDS | typeof TAG_IDS> = {
  categories: CATEGORY_IDS,
  tags: TAG_IDS
}

/** The seeded server order per kind — deliberately NOT alphabetical, so a client-side re-sort cannot pass by coincidence. */
const SEED_ORDER: Record<TaxonomyKind, string[]> = {
  categories: [CATEGORY_IDS.oldest, CATEGORY_IDS.described, CATEGORY_IDS.middle, CATEGORY_IDS.enOnly],
  tags: [TAG_IDS.oldest, TAG_IDS.enOnly, TAG_IDS.middle]
}

const PAGINATED_SEED_ORDER: Record<TaxonomyKind, string[]> = {
  categories: [
    ...SEED_ORDER.categories,
    ...Array.from({ length: 9 }, (_, index) => `00000000-0000-4000-a100-1000000000${String(index + 1).padStart(2, '0')}`)
  ],
  tags: [
    ...SEED_ORDER.tags,
    ...Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-a200-1000000000${String(index + 1).padStart(2, '0')}`)
  ]
}

const listPage = async (kind: TaxonomyKind, page: number, perPage: number) =>
  (await (await api(`/admin/${kind}?page=${page}&perPage=${perPage}`)).json()) as {
    data: Row[]
    meta: { page: number, perPage: number, total: number, totalPages: number }
  }

const listIds = async (kind: TaxonomyKind): Promise<string[]> => {
  return (await listPage(kind, 1, 50)).data.map(row => row.id)
}

/**
 * Rows are read ONLY from the list response — there is no detail GET on either entity, and the
 * calibration itself must never depend on one. This helper is also the standing proof that list
 * entities carry every field an edit flow needs.
 */
const getRow = async (kind: TaxonomyKind, id: string): Promise<Row> => {
  const row = (await listPage(kind, 1, 50)).data.find(candidate => candidate.id === id)
  expect(row, `${kind}/${id} present in the list`).toBeDefined()
  return row as Row
}

/** The stored translation a test intends to mutate, per kind. */
const WORK_LOCALE = 'en'
const workTarget: Record<TaxonomyKind, string> = {
  categories: CATEGORY_IDS.oldest,
  tags: TAG_IDS.oldest
}

describe('the list read contract — paginated and server-ordered', () => {
  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: answers page one with { data, meta } and preserves SERVER order',
    async kind => {
      const res = await api(`/admin/${kind}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.meta).toEqual({ page: 1, perPage: 12, total: 13, totalPages: 2 })
      expect(body.data.map((row: Row) => row.id)).toEqual(PAGINATED_SEED_ORDER[kind].slice(0, 12))
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: exposes the final seeded row on valid page two', async kind => {
    const body = await listPage(kind, 2, 12)
    expect(body.meta).toEqual({ page: 2, perPage: 12, total: 13, totalPages: 2 })
    expect(body.data.map(row => row.id)).toEqual(PAGINATED_SEED_ORDER[kind].slice(12))
  })

  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: honours requested page and perPage values when slicing server order',
    async kind => {
      const body = await listPage(kind, 2, 2)
      expect(body.meta).toEqual({ page: 2, perPage: 2, total: 13, totalPages: 7 })
      expect(body.data.map(row => row.id)).toEqual(PAGINATED_SEED_ORDER[kind].slice(2, 4))
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: empty mode answers an empty paginated envelope', async kind => {
    await setState({ mode: 'empty' })
    const body = await (await api(`/admin/${kind}`)).json()
    expect(body.data).toEqual([])
    expect(body.meta).toEqual({ page: 1, perPage: 12, total: 0, totalPages: 1 })
  })
})

describe('create — translations required, array becomes keyed map', () => {
  const valid: Record<TaxonomyKind, object> = {
    categories: {
      translations: [
        { locale: 'en', name: 'Craft', slug: 'craft', description: 'Notes on practice.' },
        { locale: 'ar', name: 'حِرفة', slug: 'craft-ar' }
      ]
    },
    tags: {
      translations: [
        { locale: 'en', name: 'Nuxt', slug: 'nuxt' },
        { locale: 'ar', name: 'نوكست', slug: 'nuxt-ar' }
      ]
    }
  }

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: creates with 201 and converts write array to read map', async kind => {
    const res = await api(`/admin/${kind}`, { method: 'POST', body: JSON.stringify(valid[kind]) })
    expect(res.status).toBe(201)
    const entity = (await res.json()).data as Row
    const en = entity.translations.en!
    const ar = entity.translations.ar!
    expect(en.name.length).toBeGreaterThan(0)
    expect(ar.name.length).toBeGreaterThan(0)
    if (kind === 'categories') {
      expect(en.description).toBe('Notes on practice.')
      expect(ar.description).toBeNull()
    } else {
      expect('description' in en).toBe(false)
    }
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: create requires the translations property', async kind => {
    const res = await api(`/admin/${kind}`, { method: 'POST', body: JSON.stringify({}) })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations',
      message: 'translations should not be empty.'
    })
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: create rejects an empty translations array', async kind => {
    const res = await api(`/admin/${kind}`, { method: 'POST', body: JSON.stringify({ translations: [] }) })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations',
      message: 'translations must contain at least 1 elements.'
    })
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: create prepends to page one and shifts the remaining rows', async kind => {
    const created = await api(`/admin/${kind}`, { method: 'POST', body: JSON.stringify(valid[kind]) })
    expect(created.status).toBe(201)
    const entity = (await created.json()).data as Row
    const pageOne = await listPage(kind, 1, 12)
    const pageTwo = await listPage(kind, 2, 12)
    expect(pageOne.meta).toEqual({ page: 1, perPage: 12, total: 14, totalPages: 2 })
    expect(pageTwo.meta).toEqual({ page: 2, perPage: 12, total: 14, totalPages: 2 })
    expect(pageOne.data.map(row => row.id)).toEqual([entity.id, ...PAGINATED_SEED_ORDER[kind].slice(0, 11)])
    expect(pageTwo.data.map(row => row.id)).toEqual(PAGINATED_SEED_ORDER[kind].slice(11))
  })
})

describe('patch — upsert semantics on the sole updateable field', () => {
  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: an empty PATCH body changes nothing',
    async kind => {
      const before = await getRow(kind, workTarget[kind])
      const res = await api(`/admin/${kind}/${workTarget[kind]}`, { method: 'PATCH', body: '{}' })
      expect(res.status).toBe(200)
      expect(await getRow(kind, workTarget[kind])).toEqual(before)
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: PATCH one locale UPSERTS that locale and never deletes an omitted stored locale',
    async kind => {
      const updatedName = kind === 'categories' ? 'Systems updated' : 'NestJS updated'
      const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations: [{ locale: WORK_LOCALE, name: updatedName, slug: kind === 'categories' ? 'systems' : 'nestjs' }] })
      })
      expect(res.status).toBe(200)
      const after = await getRow(kind, workTarget[kind])
      expect(after.translations[WORK_LOCALE]?.name).toBe(updatedName)
      expect(after.translations.ar).toBeDefined()
      if (kind === 'categories') {
        // Omitted locale keeps its full row, including its nullable field.
        expect(after.translations.ar?.description).toBe('معمارية وخوادم وحِرفية.')
      }
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: PATCH translations: [] is an accepted NO-OP', async kind => {
    const before = await getRow(kind, workTarget[kind])
    const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
      method: 'PATCH',
      body: JSON.stringify({ translations: [] })
    })
    expect(res.status).toBe(200)
    expect(await getRow(kind, workTarget[kind])).toEqual(before)
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: PATCH rejects undeclared top-level properties', async kind => {
    const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'not-a-taxonomy-field' })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'name',
      message: 'property name should not exist.'
    })
  })

  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: slugs are MUTABLE through PATCH',
    async kind => {
      const current = (await getRow(kind, workTarget[kind])).translations[WORK_LOCALE]!
      const nextSlug = `${current.slug}-renamed`
      const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations: [{ locale: WORK_LOCALE, name: current.name, slug: nextSlug }] })
      })
      expect(res.status).toBe(200)
      expect((await getRow(kind, workTarget[kind])).translations[WORK_LOCALE]?.slug).toBe(nextSlug)
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: a slug held by a DIFFERENT row of the same type conflicts with 422 on the indexed field',
    async kind => {
      const otherId = kind === 'categories' ? CATEGORY_IDS.middle : TAG_IDS.middle
      const heldSlug = (await getRow(kind, otherId)).translations[WORK_LOCALE]!.slug
      const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
        method: 'PATCH',
        body: JSON.stringify({
          translations: [{
            locale: WORK_LOCALE,
            name: 'Whatever',
            slug: heldSlug
          }]
        })
      })
      expect(res.status).toBe(422)
      expect((await res.json()).errors).toContainEqual({
        field: 'translations[0].slug',
        message: 'slug already in use.'
      })
    }
  )

  it('slug namespaces are PER TYPE: the same slug may exist once as a category and once as a tag', async () => {
    const shared = { translations: [{ locale: 'en', name: 'Shared', slug: 'shared-slug' }] }
    for (const kind of ['categories', 'tags'] as const) {
      const res = await api(`/admin/${kind}`, { method: 'POST', body: JSON.stringify(shared) })
      expect(res.status, kind).toBe(201)
    }
  })

  it('re-saving a row\'s OWN slug does not conflict', async () => {
    const row = await getRow('categories', CATEGORY_IDS.oldest)
    const own = row.translations[WORK_LOCALE]!
    const res = await api(`/admin/categories/${CATEGORY_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({ translations: [{ locale: WORK_LOCALE, name: own.name, slug: own.slug }] })
    })
    expect(res.status).toBe(200)
  })
})

describe('category description — the sole nullable field', () => {
  it('explicit description null CLEARS a stored description', async () => {
    expect((await getRow('categories', CATEGORY_IDS.oldest)).translations.en?.description)
      .toBe('Architecture, backend, and craft.')
    const res = await api(`/admin/categories/${CATEGORY_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', name: 'Systems', slug: 'systems', description: null }]
      })
    })
    expect(res.status).toBe(200)
    expect((await getRow('categories', CATEGORY_IDS.oldest)).translations.en?.description).toBeNull()
  })

  it('omitted description PRESERVES the stored description, in every locale', async () => {
    const res = await api(`/admin/categories/${CATEGORY_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'ar', name: 'أنظمة جديدة', slug: 'systems-ar' }]
      })
    })
    expect(res.status).toBe(200)
    const row = await getRow('categories', CATEGORY_IDS.oldest)
    expect(row.translations.ar?.name).toBe('أنظمة جديدة')
    expect(row.translations.ar?.description).toBe('معمارية وخوادم وحِرفية.')
    expect(row.translations.en?.description).toBe('Architecture, backend, and craft.')
  })
})

describe('translation item validation — actual DTO boundaries, nothing invented', () => {
  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: every required translation field reports its indexed client path',
    async kind => {
      for (const field of ['locale', 'name', 'slug'] as const) {
        const complete = { locale: 'fr', name: 'X', slug: 'x' }
        const translation = Object.fromEntries(Object.entries(complete).filter(([key]) => key !== field))
        const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
          method: 'PATCH',
          body: JSON.stringify({ translations: [translation] })
        })
        expect(res.status, field).toBe(422)
        expect((await res.json()).errors).toContainEqual({
          field: `translations[0].${field}`,
          message: `${field} should not be empty.`
        })
      }
    }
  )

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: rejects an uppercase locale', async kind => {
    const res = await api(`/admin/${kind}/${workTarget[kind]}`, {
      method: 'PATCH',
      body: JSON.stringify({ translations: [{ locale: 'EN', name: 'X', slug: 'x' }] })
    })
    expect(res.status).toBe(422)
  })

  it('description is FOREIGN to tags and rejected, never silently accepted', async () => {
    const res = await api(`/admin/tags/${TAG_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', name: 'NestJS', slug: 'nestjs', description: 'tags have none' }]
      })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations[0].description',
      message: 'property description should not exist.'
    })
  })

  it('a non-string description is rejected on categories', async () => {
    const res = await api(`/admin/categories/${CATEGORY_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', name: 'Systems', slug: 'systems', description: 42 }]
      })
    })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toContainEqual({
      field: 'translations[0].description',
      message: 'description must be a string or null.'
    })
  })
})

describe('path identity — 400 versus 404 on the write-only subresource', () => {
  it.each<TaxonomyKind>(['categories', 'tags'])('%s: PATCH answers 400 for a malformed UUID and 404 for an absent one', async kind => {
    const patched = (id: string) => api(`/admin/${kind}/${id}`, { method: 'PATCH', body: '{}' })
    expect((await patched('not-a-uuid')).status).toBe(400)
    expect((await patched(IDS[kind].absent)).status).toBe(404)
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: DELETE answers 400 for a malformed UUID and 404 for an absent one', async kind => {
    expect((await api(`/admin/${kind}/bad-id`, { method: 'DELETE' })).status).toBe(400)
    expect((await api(`/admin/${kind}/${IDS[kind].absent}`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('there is NO detail read — the future UI must edit from list rows', () => {
  it.each<TaxonomyKind>(['categories', 'tags'])(
    '%s: GET under the {id} subpath hits the established unsupported-route 404',
    async kind => {
      for (const id of [IDS[kind].oldest, 'not-a-uuid', IDS[kind].absent]) {
        const res = await api(`/admin/${kind}/${id}`)
        expect(res.status, `${kind}/${id}`).toBe(404)
        const body = await res.json()
        expect(body.title).toBe('Not found')
      }
    }
  )
})

describe('delete — documented outcomes only', () => {
  it('deletes an unreferenced category with 204 and removes it from the list', async () => {
    const res = await api(`/admin/categories/${CATEGORY_IDS.enOnly}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(await listIds('categories')).not.toContain(CATEGORY_IDS.enOnly)
  })

  it('a category referenced by an article answers the DOCUMENTED 409 and is not deleted', async () => {
    await setState({ articleReferencedCategoryIds: [CATEGORY_IDS.oldest] })
    const res = await api(`/admin/categories/${CATEGORY_IDS.oldest}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect((await res.json()).detail).toContain('referenced by articles')
    expect(await listIds('categories')).toContain(CATEGORY_IDS.oldest)
  })

  it('tags delete WITHOUT any relation case — removes only the explicitly deleted original rows', async () => {
    for (const id of [TAG_IDS.oldest, TAG_IDS.enOnly, TAG_IDS.middle]) {
      const res = await api(`/admin/tags/${id}`, { method: 'DELETE' })
      expect(res.status, id).toBe(204)
    }
    const remaining = await listPage('tags', 1, 50)
    expect(remaining.meta).toEqual({ page: 1, perPage: 50, total: 10, totalPages: 1 })
    expect(remaining.data.map(row => row.id)).toEqual(PAGINATED_SEED_ORDER.tags.slice(3))
  })
})

describe('the hold, auth and operational modes', () => {
  it('requires bearer auth on both collections', async () => {
    expect((await fetch(`${base}/api/v1/admin/categories`)).status).toBe(401)
    expect((await fetch(`${base}/api/v1/admin/tags`)).status).toBe(401)
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: holds reads and writes for delayMs', async kind => {
    await setState({ delayMs: 300 })
    for (const request of [
      () => api(`/admin/${kind}`),
      () => api(`/admin/${kind}/${workTarget[kind]}`, { method: 'PATCH', body: '{}' })
    ]) {
      const started = Date.now()
      expect((await request()).status).toBe(200)
      expect(Date.now() - started).toBeGreaterThanOrEqual(280)
    }
  })

  it.each<TaxonomyKind>(['categories', 'tags'])('%s: distinguishes forbidden and transport failure', async kind => {
    await setState({ mode: 'forbidden' })
    expect((await api(`/admin/${kind}`)).status).toBe(403)
    await setState({ mode: 'error' })
    await expect(api(`/admin/${kind}`)).rejects.toThrow()
  })

  it('fails exactly one write when asked, then recovers', async () => {
    await setState({ failNextWrite: true })
    const init = { method: 'PATCH', body: '{}' }
    expect((await api(`/admin/tags/${TAG_IDS.oldest}`, init)).status).toBe(500)
    expect((await api(`/admin/tags/${TAG_IDS.oldest}`, init)).status).toBe(200)
  })
})

describe('reset — every mutable fixture, flag and reference returns to its seed', () => {
  it('restores changed rows, deleted rows, created rows and the article-reference set', async () => {
    await api(`/admin/categories/${CATEGORY_IDS.oldest}`, {
      method: 'PATCH',
      body: JSON.stringify({ translations: [{ locale: 'en', name: 'Mutated', slug: 'mutated' }] })
    })
    await api(`/admin/tags/${TAG_IDS.enOnly}`, { method: 'DELETE' })
    await setState({ articleReferencedCategoryIds: [CATEGORY_IDS.oldest] })
    expect((await api(`/admin/categories/${CATEGORY_IDS.oldest}`, { method: 'DELETE' })).status).toBe(409)

    await fetch(`${base}/__e2e/reset`, { method: 'POST' })

    expect((await getRow('categories', CATEGORY_IDS.oldest)).translations.en?.name).toBe('Systems')
    expect(await listIds('tags')).toContain(TAG_IDS.enOnly)
    expect(
      (await api(`/admin/categories/${CATEGORY_IDS.oldest}`, { method: 'DELETE' })).status
    ).toBe(204)
  })
})
