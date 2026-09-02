/**
 * Deterministic Taxonomy backend for the future Dashboard Taxonomy surface (FE-3, Categories +
 * Tags). One process models BOTH entities because the approved product surface groups them under
 * one Taxonomy destination (plan §7.1); the entity types are separate stores with separate slug
 * namespaces exactly as the two database tables are.
 *
 * This unit creates only the instrument and its calibration; registering the lane and any browser
 * spec belongs to later units, same as Skills M2·U1 and Testimonials T·U1.
 *
 * Contract distinctions kept deliberately sharp:
 * - admin list reads are whole `{ data }` array responses with no query DTO and no `meta`, in
 *   server order (`createdAt` ascending); unsolicited query parameters are rejected;
 * - there is NO detail read on either entity — `/admin/categories/{id}` and `/admin/tags/{id}`
 *   answer PATCH and DELETE only, so a GET falls through to the generic unsupported-route 404;
 * - the list entity IS the complete edit source: `{ id, translations }` carries every writable
 *   field, because UpdateCategoryDto/UpdateTagDto accept only `translations`;
 * - writes take a translation ARRAY; reads expose a locale-keyed map;
 * - create requires at least one translation; PATCH fields are all optional;
 * - PATCH translations UPSERT supplied locales and never delete omitted ones, and an empty
 *   translations array is an accepted no-op — there is no replace-all and no delete-locale;
 * - every translation item requires a two-letter lowercase locale plus non-empty name and slug;
 * - category translations carry `description`, the sole nullable field: explicit null clears and
 *   omission preserves; tags have NO description, which stays a foreign property for them;
 * - slugs are mutable through PATCH and unique per locale WITHIN each entity type (the two
 *   `@@unique([locale, slug])` table constraints are independent), so a conflict answers 422 while
 *   the same slug may exist once per type;
 * - DELETE answers 204, 400 for a malformed UUID and 404 for an absent one. A category still
 *   referenced by an article answers the documented 409, modeled as an internal referential set on
 *   the control plane — no article endpoints are invented. Tags document NO relation case and the
 *   instrument must not invent one.
 *
 * The control plane matches the established authoring instruments: resettable fixtures, bearer
 * auth, forbidden/empty/transport-error modes, one-shot write failure, and response holds.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type TaxonomyBackendMode = 'ok' | 'empty' | 'error' | 'forbidden'

export type TaxonomyKind = 'categories' | 'tags'

export interface SeedTranslation {
  name: string
  slug: string
  description?: string | null
}

export interface SeedEntity {
  id: string
  translations: Record<string, SeedTranslation>
}

export const CATEGORY_IDS = {
  oldest: '00000000-0000-4000-a100-000000000001',
  middle: '00000000-0000-4000-a100-000000000002',
  described: '00000000-0000-4000-a100-000000000003',
  enOnly: '00000000-0000-4000-a100-000000000004',
  absent: '00000000-0000-4000-a100-0000000000ff'
} as const

export const TAG_IDS = {
  oldest: '00000000-0000-4000-a200-000000000001',
  middle: '00000000-0000-4000-a200-000000000002',
  enOnly: '00000000-0000-4000-a200-000000000003',
  absent: '00000000-0000-4000-a200-0000000000ff'
} as const

/**
 * Seeds are listed in createdAt order but deliberately NOT in alphabetical or id order, so a
 * client-side re-sort cannot pass the server-order pin by coincidence.
 */
function seedCategories(): SeedEntity[] {
  return [
    {
      id: CATEGORY_IDS.oldest,
      translations: {
        en: { name: 'Systems', slug: 'systems', description: 'Architecture, backend, and craft.' },
        ar: { name: 'أنظمة', slug: 'systems-ar', description: 'معمارية وخوادم وحِرفية.' }
      }
    },
    {
      id: CATEGORY_IDS.described,
      translations: {
        en: { name: 'Interface', slug: 'interface', description: 'Design systems and the browser.' },
        ar: { name: 'واجهات', slug: 'interface-ar', description: 'أنظمة التصميم والمتصفح.' }
      }
    },
    {
      id: CATEGORY_IDS.middle,
      translations: {
        en: { name: 'Delivery', slug: 'delivery', description: null },
        ar: { name: 'تسليم', slug: 'delivery-ar' }
      }
    },
    {
      id: CATEGORY_IDS.enOnly,
      translations: {
        en: { name: 'Field notes', slug: 'field-notes', description: null }
      }
    },
    ...Array.from({ length: 9 }, (_, index): SeedEntity => ({
      id: `00000000-0000-4000-a100-1000000000${String(index + 1).padStart(2, '0')}`,
      translations: { en: { name: `Archived category ${index + 1}`, slug: `archived-category-${index + 1}`, description: null } }
    }))
  ]
}

function seedTags(): SeedEntity[] {
  return [
    {
      id: TAG_IDS.oldest,
      translations: {
        en: { name: 'NestJS', slug: 'nestjs' },
        ar: { name: 'نيست', slug: 'nestjs-ar' }
      }
    },
    {
      id: TAG_IDS.enOnly,
      translations: {
        en: { name: 'Vue', slug: 'vue' }
      }
    },
    {
      id: TAG_IDS.middle,
      translations: {
        en: { name: 'Testing', slug: 'testing' },
        ar: { name: 'اختبار', slug: 'testing-ar' }
      }
    },
    ...Array.from({ length: 10 }, (_, index): SeedEntity => ({
      id: `00000000-0000-4000-a200-1000000000${String(index + 1).padStart(2, '0')}`,
      translations: { en: { name: `Archived tag ${index + 1}`, slug: `archived-tag-${index + 1}` } }
    }))
  ]
}

let categories = seedCategories()
let tags = seedTags()
let mode: TaxonomyBackendMode = 'ok'
let delayMs = 0
let failNextWrite = false
let createdSequence = 0
/** Article ids referencing a category, modeled without inventing article endpoints (D09-3 RESTRICT). */
let articleReferencedCategoryIds: string[] = []

const OWNER = {
  id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  email: 'owner@example.com',
  role: { name: 'OWNER' }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...headers
  })
  res.end(JSON.stringify(body))
}

function noContent(res: http.ServerResponse) {
  res.writeHead(204, {
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end()
}

function problem(
  res: http.ServerResponse,
  status: number,
  title: string,
  detail?: string,
  errors?: Array<{ field: string, message: string }>
) {
  res.writeHead(status, {
    'content-type': 'application/problem+json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end(JSON.stringify({
    type: errors ? '/problems/validation' : 'about:blank',
    title,
    status,
    detail: detail ?? title,
    instance: res.req.url ?? '/',
    ...(errors ? { errors } : {})
  }))
}

function authorized(req: http.IncomingMessage): boolean {
  return (req.headers.authorization ?? '').startsWith('Bearer ')
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function toEntity(row: SeedEntity) {
  return {
    id: row.id,
    translations: Object.fromEntries(
      Object.entries(row.translations).map(([locale, value]) => [locale, { ...value }])
    )
  }
}

interface TranslationInput {
  locale?: unknown
  name?: unknown
  slug?: unknown
  description?: unknown
  [key: string]: unknown
}

interface WriteBody {
  translations?: unknown
  [key: string]: unknown
}

/**
 * The declared DTO properties, per kind. `description` exists ONLY on category translations —
 * for a tag it is a foreign property and must be rejected, never silently accepted.
 */
function translationFields(kind: TaxonomyKind): string[] {
  return kind === 'categories' ? ['locale', 'name', 'slug', 'description'] : ['locale', 'name', 'slug']
}

function ownErrors(body: WriteBody): Array<{ field: string, message: string }> {
  return Object.keys(body)
    .filter(field => field !== 'translations')
    .map(field => ({ field, message: `property ${field} should not exist.` }))
}

function validateTranslations(kind: TaxonomyKind, body: WriteBody): Array<{ field: string, message: string }> {
  const errors: Array<{ field: string, message: string }> = []

  if (body.translations !== undefined && !Array.isArray(body.translations)) {
    return [{ field: 'translations', message: 'translations must be an array.' }]
  }

  const allowed = translationFields(kind)
  ;(Array.isArray(body.translations) ? body.translations : []).forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push({ field: `translations[${index}]`, message: 'translation must be an object.' })
      return
    }
    const entry = raw as TranslationInput
    for (const field of ['locale', 'name', 'slug'] as const) {
      if (entry[field] === undefined) {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
      } else if (typeof entry[field] !== 'string') {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} must be a string.` })
      } else if (field === 'locale' && !/^[a-z]{2}$/.test(entry[field])) {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} must be a two-letter lowercase locale.` })
      } else if (field !== 'locale' && entry[field].length === 0) {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
      }
    }
    if (entry.description !== undefined && typeof entry.description !== 'string' && entry.description !== null) {
      errors.push({ field: `translations[${index}].description`, message: 'description must be a string or null.' })
    }
    for (const field of Object.keys(entry).filter(field => !allowed.includes(field))) {
      errors.push({ field: `translations[${index}].${field}`, message: `property ${field} should not exist.` })
    }
  })

  return errors
}

/**
 * The per-table `@@unique([locale, slug])` constraint, scoped to ONE entity type. A supplied
 * translation whose (locale, slug) pair is held by a DIFFERENT row of the same type conflicts;
 * re-saving a row's own slug does not.
 */
function slugConflicts(
  kind: TaxonomyKind,
  selfId: string | null,
  body: WriteBody
): Array<{ field: string, message: string }> {
  const pool = kind === 'categories' ? categories : tags
  const taken = new Map<string, string>()
  for (const row of pool) {
    if (row.id === selfId) continue
    for (const [locale, translation] of Object.entries(row.translations)) {
      taken.set(`${locale}\u0000${translation.slug}`, locale)
    }
  }
  const errors: Array<{ field: string, message: string }> = []
  ;(Array.isArray(body.translations) ? body.translations : []).forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return
    const entry = raw as TranslationInput
    if (typeof entry.locale !== 'string' || typeof entry.slug !== 'string') return
    if (taken.has(`${entry.locale}\u0000${entry.slug}`)) {
      errors.push({
        field: `translations[${index}].slug`,
        message: 'slug already in use.'
      })
    }
  })
  return errors
}

/** Locale upserts only — omitted locales keep their stored rows, `[]` changes nothing. */
function applyWrite(target: SeedEntity, kind: TaxonomyKind, body: WriteBody): void {
  for (const raw of Array.isArray(body.translations) ? body.translations : []) {
    const entry = raw as TranslationInput
    const previous = target.translations[entry.locale as string]
    target.translations[entry.locale as string] =
      kind === 'categories'
        ? {
            name: entry.name as string,
            slug: entry.slug as string,
            description: entry.description === undefined ? previous?.description ?? null : entry.description as string | null
          }
        : { name: entry.name as string, slug: entry.slug as string }
  }
}

function nextId(kind: TaxonomyKind): string {
  createdSequence += 1
  const prefix = kind === 'categories' ? 'a900' : 'a910'
  return `00000000-0000-4000-${prefix}-${String(100000000000 + createdSequence).padStart(12, '0')}`
}

function validPathId(id: string): boolean {
  return UUID_PATTERN.test(id)
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    if (req.destroyed || res.writableEnded || res.destroyed) return
    try {
      problem(res, 500, 'Internal Error', error instanceof Error ? error.message : String(error))
    } catch {
      // The client disconnected between the guard and the response write.
    }
  })
})

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  if (path === '/__e2e/reset' && req.method === 'POST') {
    categories = seedCategories()
    tags = seedTags()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    createdSequence = 0
    articleReferencedCategoryIds = []
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: TaxonomyBackendMode
      delayMs?: number
      failNextWrite?: boolean
      categories?: SeedEntity[]
      tags?: SeedEntity[]
      articleReferencedCategoryIds?: string[]
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.categories) categories = body.categories
    if (body.tags) tags = body.tags
    if (body.articleReferencedCategoryIds) articleReferencedCategoryIds = body.articleReferencedCategoryIds
    return json(res, 200, { ok: true, mode, delayMs })
  }

  if (path === `${API_PREFIX}/auth/login` && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as { email?: string, password?: string }
    if (!body.email || !body.password) return problem(res, 422, 'Validation failed')
    if (body.password === 'wrong-password') return problem(res, 401, 'Invalid credentials')
    return json(res, 200, { data: { accessToken: 'e2e-access-token', user: OWNER } }, {
      'set-cookie': `refresh_token=e2e-refresh; Path=${API_PREFIX}/auth; HttpOnly; SameSite=Lax`
    })
  }
  if (path === `${API_PREFIX}/auth/refresh` && req.method === 'POST') {
    if (!(req.headers.cookie ?? '').includes('refresh_token=')) return problem(res, 401, 'Missing refresh token')
    return json(res, 200, { data: { accessToken: 'e2e-access-token' } }, {
      'set-cookie': `refresh_token=e2e-refresh; Path=${API_PREFIX}/auth; HttpOnly; SameSite=Lax`
    })
  }
  if (path === `${API_PREFIX}/auth/logout` && req.method === 'POST') {
    return json(res, 200, { data: { ok: true } }, {
      'set-cookie': `refresh_token=; Path=${API_PREFIX}/auth; HttpOnly; Max-Age=0`
    })
  }

  for (const kind of ['categories', 'tags'] as const) {
    const collectionRoot = `${API_PREFIX}/admin/${kind}`
    if (!path.startsWith(collectionRoot)) continue

    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      res.socket?.destroy()
      return
    }

    const rest = path.slice(collectionRoot.length)

    if (delayMs > 0) await sleep(delayMs)

    if (rest === '' && req.method === 'GET') {
      const pool = kind === 'categories' ? categories : tags
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
      const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('perPage') ?? '12') || 12))
      const rows = mode === 'empty' ? [] : pool
      const total = rows.length
      const totalPages = Math.max(1, Math.ceil(total / perPage))
      return json(res, 200, {
        data: rows.slice((page - 1) * perPage, page * perPage).map(toEntity),
        meta: { page, perPage, total, totalPages }
      })
    }

    if (rest === '' && req.method === 'POST') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = ownErrors(body)
      if (body.translations === undefined) {
        errors.push({ field: 'translations', message: 'translations should not be empty.' })
      } else if (Array.isArray(body.translations) && body.translations.length === 0) {
        errors.push({ field: 'translations', message: 'translations must contain at least 1 elements.' })
      }
      errors.push(...validateTranslations(kind, body))
      errors.push(...slugConflicts(kind, null, body))
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }

      const created: SeedEntity = { id: nextId(kind), translations: {} }
      applyWrite(created, kind, body)
      // Keep a just-created row visible on the current first page, matching the collection's
      // observable server ordering in this deterministic browser fixture.
      ;(kind === 'categories' ? categories : tags).unshift(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/')) {
      const id = rest.slice(1)
      // NOTE: there is deliberately NO GET branch here. Neither entity has a detail read, so a GET
      // under this subpath falls through to the generic unsupported-route 404 below — exactly like
      // the real router, which runs path validation only on MATCHED routes.
      if (req.method === 'PATCH' || req.method === 'DELETE') {
        if (!validPathId(id)) return problem(res, 400, 'Bad Request', `${kind.slice(0, -1)} id must be a UUID.`)

        if (req.method === 'PATCH') {
          if (failNextWrite) {
            failNextWrite = false
            return problem(res, 500, 'Save failed')
          }
          const pool = kind === 'categories' ? categories : tags
          const target = pool.find(row => row.id === id)
          if (!target) return problem(res, 404, 'Not found')
          const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
          const errors = [...ownErrors(body), ...validateTranslations(kind, body), ...slugConflicts(kind, id, body)]
          if (errors.length > 0) {
            return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
          }
          applyWrite(target, kind, body)
          return json(res, 200, { data: toEntity(target) })
        }

        if (req.method === 'DELETE') {
          if (failNextWrite) {
            failNextWrite = false
            return problem(res, 500, 'Delete failed')
          }
          if (kind === 'categories') {
            const target = categories.find(row => row.id === id)
            if (!target) return problem(res, 404, 'Not found')
            if (articleReferencedCategoryIds.includes(id)) {
              return problem(res, 409, 'Conflict', 'Category is still referenced by articles.')
            }
            categories = categories.filter(row => row.id !== id)
            return noContent(res)
          }
          const target = tags.find(row => row.id === id)
          if (!target) return problem(res, 404, 'Not found')
          tags = tags.filter(row => row.id !== id)
          return noContent(res)
        }
      }
    }
  }

  // Dashboard shell dependencies stay healthy in every Taxonomy scenario.
  if (path === `${API_PREFIX}/settings/site`) {
    return json(res, 200, {
      data: { siteName: 'Eslam Muatamed', profileLinks: [], contactEmail: null, contactPhone: null }
    })
  }
  if (path.startsWith(`${API_PREFIX}/admin/messages`) && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    return json(res, 200, { data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } })
  }

  return problem(res, 404, 'Not found')
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1] as string) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isMain) {
  // Standalone default only. The AUTHORITATIVE port pair belongs to the lane record, which is
  // registered by the later browser-spec unit (established pairs end at 4300/4301).
  const port = Number(process.env.CI_MOCK_PORT ?? 4401)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[taxonomy-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
